import { internalMutation, internalQuery } from "../_generated/server";
import { v, type Infer } from "convex/values";
import { accessFor, savedSecret } from "./apps";
import { startJob } from "./analysis";
import { fail } from "../lib/errors";

// S07 internals behind spotify.connectUrl and spotify.completeConnect.

const vConnectContext = v.union(
  v.object({
    ok: v.literal(true),
    appId: v.id("spotifyApps"),
    clientId: v.string(),
    label: v.string(),
    secret: v.union(v.string(), v.null()),
  }),
  v.object({ ok: v.literal(false), code: v.union(v.literal("forbidden"), v.literal("spotify_not_ready")) }),
);

export type ConnectContext = Infer<typeof vConnectContext>;

// Connecting needs a verified student whose Spotify email the assigned app's owner already added.
// "revoked" means they disconnected; they stay on the app's allow-list, so they can reconnect.
export const connectContext = internalQuery({
  args: { userId: v.id("users") },
  returns: vConnectContext,
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (user === null || user.verifiedAt === undefined || user.isDemo) return { ok: false as const, code: "forbidden" as const };
    const access = await accessFor(ctx, userId);
    const added =
      access !== null &&
      access.spotifyAppId !== undefined &&
      (access.status === "allowlisted" || access.status === "connected" || (access.status === "revoked" && access.allowlistedAt !== undefined));
    if (!added) return { ok: false as const, code: "spotify_not_ready" as const };
    const app = await ctx.db.get(access.spotifyAppId!);
    if (app === null || !app.active) return { ok: false as const, code: "spotify_not_ready" as const };
    return { ok: true as const, appId: app._id, clientId: app.clientId, label: app.label, secret: await savedSecret(ctx, app._id) };
  },
});

// Tokens are stored server-side only; then the analysis job starts (or resumes, never re-running paid calls).
export const storeConnection = internalMutation({
  args: {
    userId: v.id("users"),
    appId: v.id("spotifyApps"),
    spotifyUserId: v.string(),
    tokens: v.object({
      accessToken: v.string(),
      refreshToken: v.string(),
      expiresAt: v.number(),
      scopes: v.array(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { userId, appId, spotifyUserId, tokens }) => {
    // The team may have moved or removed the request while Spotify answered: store nothing then.
    const current = await accessFor(ctx, userId);
    const stillAdded =
      current !== null &&
      current.spotifyAppId === appId &&
      (current.status === "allowlisted" || current.status === "connected" || (current.status === "revoked" && current.allowlistedAt !== undefined));
    if (!stillAdded) fail("validation_failed", "Your Spotify setup changed. Try connecting again.");

    const existing = await ctx.db
      .query("spotifyTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    await ctx.db.insert("spotifyTokens", { userId, appId, spotifyUserId, ...tokens });

    await ctx.db.patch(current._id, { status: "connected", refusedAt: undefined });

    const user = await ctx.db.get(userId);
    if (user && user.onboarding !== "ready" && user.onboarding !== "needs_review") {
      await ctx.db.patch(userId, { onboarding: "analyzing" });
    }
    if (user?.onboarding !== "ready") await startJob(ctx, userId);
    return null;
  },
});
