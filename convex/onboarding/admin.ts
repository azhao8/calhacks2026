import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { SITE, SPOTIFY } from "../lib/config";
import { vAccessStatus } from "../lib/validators";
import { sendEmail } from "../services/resend";
import { appUsage, assignWaitingRequests } from "./apps";
import { emailPool } from "../lib/pools";

// S17 allow-list queue internals. The admin page wraps these with requireAdmin (ADMIN_EMAILS, server-side).

export const queue = internalQuery({
  args: {},
  returns: v.object({
    rows: v.array(
      v.object({
        accessId: v.id("spotifyAccess"),
        userId: v.id("users"),
        firstName: v.union(v.string(), v.null()),
        spotifyEmail: v.string(),
        appLabel: v.union(v.string(), v.null()),
        appOwner: v.union(v.string(), v.null()),
        requestedAt: v.number(),
        status: vAccessStatus,
        // Spotify refused this account at connect time: it isn't on the allow-list, or the student used another account.
        refused: v.boolean(),
        // Every app was full when the student asked.
        noCapacity: v.boolean(),
      }),
    ),
    apps: v.array(
      v.object({
        appId: v.id("spotifyApps"),
        label: v.string(),
        ownerName: v.string(),
        used: v.number(),
        capacity: v.number(),
        active: v.boolean(),
      }),
    ),
    flags: v.object({ refused: v.number(), noCapacity: v.number() }),
  }),
  handler: async (ctx) => {
    const usage = await appUsage(ctx);
    const apps = new Map(usage.map(({ app }) => [app._id, app]));
    const access = await ctx.db.query("spotifyAccess").collect();
    const rows = await Promise.all(
      access.map(async (row) => {
        const user = await ctx.db.get(row.userId);
        const app = row.spotifyAppId ? apps.get(row.spotifyAppId) : undefined;
        return {
          accessId: row._id,
          userId: row.userId,
          firstName: user?.firstName ?? null,
          spotifyEmail: row.spotifyEmail,
          appLabel: app?.label ?? null,
          appOwner: app?.ownerName ?? null,
          requestedAt: row.requestedAt,
          status: row.status,
          refused: row.status === "requested" && row.refusedAt !== undefined,
          noCapacity: row.status === "requested" && row.spotifyAppId === undefined,
        };
      }),
    );
    // Waiting requests first, oldest first.
    rows.sort((a, b) => Number(b.status === "requested") - Number(a.status === "requested") || a.requestedAt - b.requestedAt);
    return {
      rows,
      apps: usage.map(({ app, used }) => ({
        appId: app._id,
        label: app.label,
        ownerName: app.ownerName,
        used,
        capacity: app.capacity,
        active: app.active,
      })),
      flags: {
        refused: rows.filter((row) => row.refused).length,
        noCapacity: rows.filter((row) => row.noCapacity).length,
      },
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

// Register or update a teammate's Spotify Development Mode app. Its client secret is the Convex env var
// SPOTIFY_CLIENT_SECRET_<LABEL>. Redirect URIs are fixed per §8.9 (see lib/config SITE and SPOTIFY.callbackPath).
export const upsertSpotifyApp = internalMutation({
  args: {
    label: v.string(),
    ownerName: v.string(),
    clientId: v.string(),
    active: v.optional(v.boolean()),
  },
  returns: v.object({
    appId: v.id("spotifyApps"),
    created: v.boolean(),
    secretEnvName: v.string(),
    redirectUris: v.array(v.string()),
    assignedWaiting: v.number(),
  }),
  handler: async (ctx, args) => {
    const label = args.label.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Labels use lowercase letters, digits, and dashes");
    const fields = {
      label,
      ownerName: args.ownerName.trim(),
      clientId: args.clientId.trim(),
      capacity: SPOTIFY.appCapacity,
      active: args.active ?? true,
    };
    const existing = await ctx.db
      .query("spotifyApps")
      .withIndex("by_label", (q) => q.eq("label", label))
      .unique();
    let appId;
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      appId = existing._id;
    } else {
      appId = await ctx.db.insert("spotifyApps", fields);
    }
    const assignedWaiting = await assignWaitingRequests(ctx);
    return {
      appId,
      created: existing === null,
      secretEnvName: SPOTIFY.secretEnvName(label),
      redirectUris: [SITE.prodUrl, SITE.devUrl].map((site) => `${site}${SPOTIFY.callbackPath}`),
      assignedWaiting,
    };
  },
});
