import { internalMutation, internalQuery } from "../_generated/server";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { refreshTokens, SpotifyAuthError } from "../services/spotify";
import { accessFor, savedSecret } from "./apps";

// Spotify tokens are server-only: only internal functions read them, and no query returns them (§8.8).

const REFRESH_MARGIN_MS = 60 * 1000;

const vTokenSet = v.object({
  accessToken: v.string(),
  refreshToken: v.string(),
  expiresAt: v.number(),
  scopes: v.array(v.string()),
});

export const tokensFor = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      tokenId: v.id("spotifyTokens"),
      accessToken: v.string(),
      refreshToken: v.string(),
      expiresAt: v.number(),
      app: v.object({ clientId: v.string(), label: v.string(), secret: v.union(v.string(), v.null()) }),
    }),
  ),
  handler: async (ctx, { userId }) => {
    const tokens = await ctx.db
      .query("spotifyTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (tokens === null) return null;
    const app = await ctx.db.get(tokens.appId);
    if (app === null) return null;
    return {
      tokenId: tokens._id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      app: { clientId: app.clientId, label: app.label, secret: await savedSecret(ctx, app._id) },
    };
  },
});

export const saveRefreshed = internalMutation({
  args: { tokenId: v.id("spotifyTokens"), tokens: vTokenSet },
  returns: v.null(),
  handler: async (ctx, { tokenId, tokens }) => {
    if ((await ctx.db.get(tokenId)) !== null) await ctx.db.patch(tokenId, tokens);
    return null;
  },
});

// A valid access token, refreshed only when a fetch needs it (never polled).
export async function accessToken(ctx: ActionCtx, userId: Id<"users">): Promise<string> {
  const stored = await ctx.runQuery(internal.onboarding.tokens.tokensFor, { userId });
  if (stored === null) throw new SpotifyAuthError("No Spotify connection");
  if (stored.expiresAt - REFRESH_MARGIN_MS > Date.now()) return stored.accessToken;
  const fresh = await refreshTokens(stored.app, stored.refreshToken);
  await ctx.runMutation(internal.onboarding.tokens.saveRefreshed, { tokenId: stored.tokenId, tokens: fresh });
  return fresh.accessToken;
}

// Spotify answered 403: back to S06 ("Spotify hasn't let us in yet") with a flag on the admin page.
export const refuse = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    await refuseAccess(ctx, userId);
    return null;
  },
});

// Any status, including "revoked" after a disconnect: the request goes back on the queue with its app slot,
// and notifiedAt clears so the next "Mark added" emails the student again, as S06 promises.
export async function refuseAccess(ctx: MutationCtx, userId: Id<"users">) {
  const access = await accessFor(ctx, userId);
  if (access) {
    await ctx.db.patch(access._id, {
      status: "requested",
      refusedAt: Date.now(),
      allowlistedAt: undefined,
      allowlistedBy: undefined,
      notifiedAt: undefined,
    });
  }
  const tokens = await ctx.db
    .query("spotifyTokens")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const row of tokens) await ctx.db.delete(row._id);
  const user = await ctx.db.get(userId);
  if (user && user.onboarding !== "ready") await ctx.db.patch(userId, { onboarding: "waiting_for_spotify" });
}

export async function markRefused(ctx: ActionCtx, userId: Id<"users">) {
  await ctx.runMutation(internal.onboarding.tokens.refuse, { userId });
}
