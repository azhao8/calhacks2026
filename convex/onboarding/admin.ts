import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { SITE, SPOTIFY } from "../lib/config";
import { isTeamEmail } from "../lib/access";
import { fail } from "../lib/errors";
import { sendEmail } from "../services/resend";
import { checkClientCredentials } from "../services/spotify";
import { appUsage, assignWaitingRequests, savedSecret } from "./apps";
import { emailPool } from "../lib/pools";

// S17 allow-list queue internals. The admin page wraps these with requireAdmin (ADMIN_EMAILS, server-side).

// How the admin page reads a request. Derived from spotifyAccess, never stored.
export const ADMIN_STATUSES = ["needs_adding", "refused", "no_app", "added", "connected", "disconnected"] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];
const vAdminStatus = v.union(
  v.literal("needs_adding"),
  v.literal("refused"),
  v.literal("no_app"),
  v.literal("added"),
  v.literal("connected"),
  v.literal("disconnected"),
);

export function adminStatus(row: Doc<"spotifyAccess">): AdminStatus {
  switch (row.status) {
    case "requested":
      if (row.spotifyAppId === undefined) return "no_app";
      return row.refusedAt !== undefined ? "refused" : "needs_adding";
    case "allowlisted":
      return "added";
    case "connected":
      return "connected";
    case "revoked":
      return "disconnected";
  }
}

const QUEUE_PAGE = 25;
const QUEUE_PAGE_MAX = 500;

const vStatusCounts = v.object({
  needs_adding: v.number(),
  refused: v.number(),
  no_app: v.number(),
  added: v.number(),
  connected: v.number(),
  disconnected: v.number(),
});

const emptyCounts = (): Record<AdminStatus, number> =>
  Object.fromEntries(ADMIN_STATUSES.map((status) => [status, 0])) as Record<AdminStatus, number>;

// The allow-list for the admin page: apps with their slots, secret state and counts, plus one filtered
// page of requests. Filtering, search and paging happen here so the page never renders every row.
// Never returns a client secret, only whether one is saved and when.
export const queue = internalQuery({
  args: {
    status: v.optional(vAdminStatus),
    // An app's requests, or "none" for requests with no app yet.
    appId: v.optional(v.union(v.id("spotifyApps"), v.literal("none"))),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    rows: v.array(
      v.object({
        accessId: v.id("spotifyAccess"),
        userId: v.id("users"),
        firstName: v.union(v.string(), v.null()),
        schoolEmail: v.union(v.string(), v.null()),
        spotifyEmail: v.string(),
        appId: v.union(v.id("spotifyApps"), v.null()),
        appLabel: v.union(v.string(), v.null()),
        appOwner: v.union(v.string(), v.null()),
        status: vAdminStatus,
        requestedAt: v.number(),
        allowlistedAt: v.union(v.number(), v.null()),
        allowlistedBy: v.union(v.string(), v.null()),
        refusedAt: v.union(v.number(), v.null()),
        emailed: v.boolean(),
        isTeam: v.boolean(),
      }),
    ),
    total: v.number(),
    apps: v.array(
      v.object({
        appId: v.id("spotifyApps"),
        label: v.string(),
        ownerName: v.string(),
        clientId: v.string(),
        used: v.number(),
        capacity: v.number(),
        active: v.boolean(),
        // "saved" on the admin page, "env" from the old SPOTIFY_CLIENT_SECRET_<LABEL> variable, or "none".
        secret: v.union(v.literal("saved"), v.literal("env"), v.literal("none")),
        secretSetAt: v.union(v.number(), v.null()),
        secretSetBy: v.union(v.string(), v.null()),
        checkedAt: v.union(v.number(), v.null()),
        checkOk: v.union(v.boolean(), v.null()),
        counts: vStatusCounts,
        // Spotify emails the owner still has to add in the app's User Management, oldest first.
        emailsToAdd: v.array(v.string()),
      }),
    ),
    counts: vStatusCounts,
    redirectUris: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const usage = await appUsage(ctx);
    const access = await ctx.db.query("spotifyAccess").collect();
    const users = new Map<Id<"users">, Doc<"users"> | null>();
    for (const row of access) users.set(row.userId, await ctx.db.get(row.userId));

    const counts = emptyCounts();
    const byApp = new Map<Id<"spotifyApps">, { counts: Record<AdminStatus, number>; toAdd: Doc<"spotifyAccess">[] }>();
    for (const { app } of usage) byApp.set(app._id, { counts: emptyCounts(), toAdd: [] });
    for (const row of access) {
      const status = adminStatus(row);
      counts[status] += 1;
      const group = row.spotifyAppId ? byApp.get(row.spotifyAppId) : undefined;
      if (group) {
        group.counts[status] += 1;
        if (status === "needs_adding" || status === "refused") group.toAdd.push(row);
      }
    }

    const apps = await Promise.all(
      usage.map(async ({ app, used }) => {
        const saved = await ctx.db
          .query("spotifyAppSecrets")
          .withIndex("by_appId", (q) => q.eq("appId", app._id))
          .first();
        const group = byApp.get(app._id)!;
        return {
          appId: app._id,
          label: app.label,
          ownerName: app.ownerName,
          clientId: app.clientId,
          used,
          capacity: app.capacity,
          active: app.active,
          secret: saved ? ("saved" as const) : process.env[SPOTIFY.secretEnvName(app.label)] ? ("env" as const) : ("none" as const),
          secretSetAt: saved?.setAt ?? null,
          secretSetBy: saved?.setBy ?? null,
          checkedAt: app.checkedAt ?? null,
          checkOk: app.checkOk ?? null,
          counts: group.counts,
          emailsToAdd: group.toAdd.sort((a, b) => a.requestedAt - b.requestedAt).map((row) => row.spotifyEmail),
        };
      }),
    );
    apps.sort((a, b) => a.label.localeCompare(b.label));
    const appById = new Map(usage.map(({ app }) => [app._id, app]));

    const search = (args.search ?? "").trim().toLowerCase();
    const matching = access.filter((row) => {
      if (args.status !== undefined && adminStatus(row) !== args.status) return false;
      if (args.appId === "none" && row.spotifyAppId !== undefined) return false;
      if (args.appId !== undefined && args.appId !== "none" && row.spotifyAppId !== args.appId) return false;
      if (search.length > 0) {
        const user = users.get(row.userId);
        const haystack = [row.spotifyEmail, user?.email ?? "", user?.firstName ?? ""].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
    // Rows that need someone first, then oldest first, so the next job is always at the top.
    const order = (row: Doc<"spotifyAccess">) => ADMIN_STATUSES.indexOf(adminStatus(row));
    matching.sort((a, b) => order(a) - order(b) || a.requestedAt - b.requestedAt);
    const limit = Math.min(Math.max(1, Math.floor(args.limit ?? QUEUE_PAGE)), QUEUE_PAGE_MAX);

    return {
      rows: matching.slice(0, limit).map((row) => {
        const user = users.get(row.userId) ?? null;
        const app = row.spotifyAppId ? appById.get(row.spotifyAppId) : undefined;
        return {
          accessId: row._id,
          userId: row.userId,
          firstName: user?.firstName ?? null,
          schoolEmail: user?.email ?? null,
          spotifyEmail: row.spotifyEmail,
          appId: app?._id ?? null,
          appLabel: app?.label ?? null,
          appOwner: app?.ownerName ?? null,
          status: adminStatus(row),
          requestedAt: row.requestedAt,
          allowlistedAt: row.allowlistedAt ?? null,
          allowlistedBy: row.allowlistedBy ?? null,
          refusedAt: row.refusedAt ?? null,
          emailed: row.notifiedAt !== undefined,
          isTeam: isTeamEmail(user?.email),
        };
      }),
      total: matching.length,
      apps,
      counts,
      redirectUris: [SITE.prodUrl, SITE.devUrl].map((site) => `${site}${SPOTIFY.callbackPath}`),
    };
  },
});

// "Mark added": the app owner added this Spotify email to their app's allow-list.
// Idempotent; the ready email goes out exactly once per student.
export const markAdded = internalMutation({
  args: { accessId: v.id("spotifyAccess"), adminEmail: v.string() },
  returns: v.object({ changed: v.boolean(), emailQueued: v.boolean() }),
  handler: async (ctx, { accessId, adminEmail }) => {
    const row = await ctx.db.get(accessId);
    if (row === null || row.status !== "requested" || row.spotifyAppId === undefined) {
      return { changed: false, emailQueued: false };
    }
    const now = Date.now();
    await ctx.db.patch(accessId, {
      status: "allowlisted",
      allowlistedAt: now,
      allowlistedBy: adminEmail,
      refusedAt: undefined,
    });
    const user = await ctx.db.get(row.userId);
    // S06 updates live; a student still on S05 skips S06 when they finish it.
    if (user?.onboarding === "waiting_for_spotify") {
      await ctx.db.patch(row.userId, { onboarding: "needs_spotify_connect" });
    }
    if (row.notifiedAt !== undefined || user?.email === undefined) {
      return { changed: true, emailQueued: false };
    }
    await ctx.db.patch(accessId, { notifiedAt: now });
    await emailPool.enqueueAction(ctx, internal.onboarding.admin.sendReadyEmail, {
      to: user.email,
      firstName: user.firstName ?? null,
    });
    return { changed: true, emailQueued: true };
  },
});

export const sendReadyEmail = internalAction({
  args: { to: v.string(), firstName: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (_ctx, { to, firstName }) => {
    await sendEmail({
      to,
      subject: "Spotify is ready to connect",
      text: [
        firstName ? `Hi ${firstName},` : "Hi,",
        `Spotify is ready to connect. Open ${SITE.prodUrl} to connect it and see your taste read.`,
      ].join("\n\n"),
    });
    return null;
  },
});

// A student who was told Spotify is ready goes back to waiting when that's no longer true.
async function backToWaiting(ctx: MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (user?.onboarding === "needs_spotify_connect") await ctx.db.patch(userId, { onboarding: "waiting_for_spotify" });
}

async function slotsUsed(ctx: MutationCtx, appId: Id<"spotifyApps">): Promise<number> {
  return (
    await ctx.db
      .query("spotifyAccess")
      .withIndex("by_app", (q) => q.eq("spotifyAppId", appId))
      .collect()
  ).length;
}

const CONNECTED_REFUSAL = "They're connected through this app, so their Spotify sign-in belongs to it. They need to disconnect first.";

// "Undo added": back to waiting for the app owner. Not once connected. The ready email isn't sent
// again when they're marked added later (notifiedAt stays).
export const undoAdded = internalMutation({
  args: { accessId: v.id("spotifyAccess") },
  returns: v.null(),
  handler: async (ctx, { accessId }) => {
    const row = await ctx.db.get(accessId);
    if (row === null) fail("validation_failed", "That request is gone.");
    if (row.status === "connected") fail("validation_failed", CONNECTED_REFUSAL);
    if (row.status !== "allowlisted") return null;
    await ctx.db.patch(accessId, { status: "requested", allowlistedAt: undefined, allowlistedBy: undefined });
    await backToWaiting(ctx, row.userId);
    return null;
  },
});

// "Move to another app": the request takes a slot on the new app and waits for that owner to add it.
export const moveRequest = internalMutation({
  args: { accessId: v.id("spotifyAccess"), appId: v.id("spotifyApps") },
  returns: v.null(),
  handler: async (ctx, { accessId, appId }) => {
    const row = await ctx.db.get(accessId);
    if (row === null) fail("validation_failed", "That request is gone.");
    if (row.status === "connected") fail("validation_failed", CONNECTED_REFUSAL);
    if (row.spotifyAppId === appId) return null;
    const app = await ctx.db.get(appId);
    if (app === null) fail("validation_failed", "That app is gone.");
    if (!app.active) fail("validation_failed", `${app.label} is turned off. Turn it on first.`);
    if ((await slotsUsed(ctx, appId)) >= app.capacity) fail("validation_failed", `${app.label} has no free slot.`);
    await ctx.db.patch(accessId, {
      spotifyAppId: appId,
      status: "requested",
      allowlistedAt: undefined,
      allowlistedBy: undefined,
      refusedAt: undefined,
    });
    await backToWaiting(ctx, row.userId);
    // The old app has a free slot now.
    await assignWaitingRequests(ctx);
    return null;
  },
});

// "Remove request": frees the slot. A student still onboarding goes back to About you and can ask again.
export const removeRequest = internalMutation({
  args: { accessId: v.id("spotifyAccess") },
  returns: v.null(),
  handler: async (ctx, { accessId }) => {
    const row = await ctx.db.get(accessId);
    if (row === null) return null;
    if (row.status === "connected") fail("validation_failed", CONNECTED_REFUSAL);
    await ctx.db.delete(accessId);
    const user = await ctx.db.get(row.userId);
    const beforeConnect = ["needs_preferences", "waiting_for_spotify", "needs_spotify_connect"];
    if (user?.onboarding !== undefined && beforeConnect.includes(user.onboarding)) {
      await ctx.db.patch(row.userId, { onboarding: "needs_about_you" });
    }
    await assignWaitingRequests(ctx);
    return null;
  },
});

// Spotify shows both as 32 letters and digits; this only catches pasting mistakes like spaces or an empty field.
const SECRET_SHAPE = /^\S{8,128}$/;
const CLIENT_ID_SHAPE = /^\S{8,128}$/;

async function writeSecret(ctx: MutationCtx, appId: Id<"spotifyApps">, raw: string, adminEmail: string) {
  const secret = raw.trim();
  if (!SECRET_SHAPE.test(secret)) fail("validation_failed", "That doesn't look like a Spotify client secret. Copy it again from the app's settings.");
  const existing = await ctx.db
    .query("spotifyAppSecrets")
    .withIndex("by_appId", (q) => q.eq("appId", appId))
    .collect();
  for (const row of existing) await ctx.db.delete(row._id);
  await ctx.db.insert("spotifyAppSecrets", { appId, secret, setAt: Date.now(), setBy: adminEmail });
  // A new secret hasn't been checked yet.
  await ctx.db.patch(appId, { checkedAt: undefined, checkOk: undefined });
}

// Add or edit a teammate's Spotify Development Mode app. The label is its key and never changes.
// Redirect URIs are fixed per §8.9 (see lib/config SITE and SPOTIFY.callbackPath). The client secret,
// when given, is stored write-only in spotifyAppSecrets.
export const upsertSpotifyApp = internalMutation({
  args: {
    label: v.string(),
    ownerName: v.string(),
    clientId: v.string(),
    active: v.optional(v.boolean()),
    secret: v.optional(v.string()),
    adminEmail: v.optional(v.string()),
  },
  returns: v.object({
    appId: v.id("spotifyApps"),
    created: v.boolean(),
    redirectUris: v.array(v.string()),
    assignedWaiting: v.number(),
  }),
  handler: async (ctx, args) => {
    const label = args.label.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(label)) fail("validation_failed", "Labels use lowercase letters, digits, and dashes, like melos-alex.");
    const ownerName = args.ownerName.trim();
    if (ownerName.length === 0) fail("validation_failed", "Add the owner's name.");
    const clientId = args.clientId.trim();
    if (!CLIENT_ID_SHAPE.test(clientId)) fail("validation_failed", "That doesn't look like a Spotify client ID. Copy it again from the app's settings.");
    const existing = await ctx.db
      .query("spotifyApps")
      .withIndex("by_label", (q) => q.eq("label", label))
      .unique();
    let appId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        ownerName,
        clientId,
        active: args.active ?? existing.active,
        // A new client ID needs a new check.
        ...(existing.clientId !== clientId ? { checkedAt: undefined, checkOk: undefined } : {}),
      });
      appId = existing._id;
    } else {
      appId = await ctx.db.insert("spotifyApps", {
        label,
        ownerName,
        clientId,
        capacity: SPOTIFY.appCapacity,
        active: args.active ?? true,
      });
    }
    if (args.secret !== undefined && args.secret.trim() !== "") {
      await writeSecret(ctx, appId, args.secret, args.adminEmail ?? "team");
    }
    const assignedWaiting = await assignWaitingRequests(ctx);
    return {
      appId,
      created: existing === null,
      redirectUris: [SITE.prodUrl, SITE.devUrl].map((site) => `${site}${SPOTIFY.callbackPath}`),
      assignedWaiting,
    };
  },
});

export const setAppSecret = internalMutation({
  args: { appId: v.id("spotifyApps"), secret: v.string(), adminEmail: v.string() },
  returns: v.null(),
  handler: async (ctx, { appId, secret, adminEmail }) => {
    if ((await ctx.db.get(appId)) === null) fail("validation_failed", "That app is gone.");
    await writeSecret(ctx, appId, secret, adminEmail);
    return null;
  },
});

// Turning an app off stops new assignments here, and its students can't connect until it's back on.
export const setAppActive = internalMutation({
  args: { appId: v.id("spotifyApps"), active: v.boolean() },
  returns: v.object({ assignedWaiting: v.number() }),
  handler: async (ctx, { appId, active }) => {
    if ((await ctx.db.get(appId)) === null) fail("validation_failed", "That app is gone.");
    await ctx.db.patch(appId, { active });
    return { assignedWaiting: active ? await assignWaitingRequests(ctx) : 0 };
  },
});

// Only an empty app can be deleted, so no student ever loses the app their request or sign-in belongs to.
export const deleteApp = internalMutation({
  args: { appId: v.id("spotifyApps") },
  returns: v.null(),
  handler: async (ctx, { appId }) => {
    if ((await ctx.db.get(appId)) === null) return null;
    if ((await slotsUsed(ctx, appId)) > 0) fail("validation_failed", "Move or remove its students first.");
    const secrets = await ctx.db
      .query("spotifyAppSecrets")
      .withIndex("by_appId", (q) => q.eq("appId", appId))
      .collect();
    for (const row of secrets) await ctx.db.delete(row._id);
    await ctx.db.delete(appId);
    return null;
  },
});

// Server-only credentials for "Check app"; read only by checkApp below.
export const appCredentials = internalQuery({
  args: { appId: v.id("spotifyApps") },
  returns: v.union(v.null(), v.object({ clientId: v.string(), secret: v.union(v.string(), v.null()) })),
  handler: async (ctx, { appId }) => {
    const app = await ctx.db.get(appId);
    if (app === null) return null;
    const secret = (await savedSecret(ctx, appId)) ?? process.env[SPOTIFY.secretEnvName(app.label)] ?? null;
    return { clientId: app.clientId, secret };
  },
});

export const recordCheck = internalMutation({
  args: { appId: v.id("spotifyApps"), ok: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { appId, ok }) => {
    if ((await ctx.db.get(appId)) !== null) await ctx.db.patch(appId, { checkedAt: Date.now(), checkOk: ok });
    return null;
  },
});

// "Check app": asks Spotify for an app token with this client ID and secret (client credentials grant).
export const checkApp = internalAction({
  args: { appId: v.id("spotifyApps") },
  returns: v.union(v.literal("accepted"), v.literal("rejected"), v.literal("no_secret")),
  handler: async (ctx, { appId }): Promise<"accepted" | "rejected" | "no_secret"> => {
    const credentials = await ctx.runQuery(internal.onboarding.admin.appCredentials, { appId });
    if (credentials === null) fail("validation_failed", "That app is gone.");
    if (credentials.secret === null) return "no_secret";
    let result: "accepted" | "rejected";
    try {
      result = await checkClientCredentials(credentials.clientId, credentials.secret);
    } catch {
      fail("retryable", "We couldn't reach Spotify. Try again.");
    }
    await ctx.runMutation(internal.onboarding.admin.recordCheck, { appId, ok: result === "accepted" });
    return result;
  },
});
