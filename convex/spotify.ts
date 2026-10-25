import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { fail } from "./lib/errors";
import { SITE, SPOTIFY } from "./lib/config";
import {
  authorizeUrl,
  currentUserId,
  exchangeCode,
  SpotifyAuthError,
  SpotifyRefusedError,
} from "./services/spotify";
import { signState, verifyState } from "./onboarding/oauthState";
import { markRefused } from "./onboarding/tokens";
import type { ConnectContext } from "./onboarding/connect";

// Stream A (onboarding). Spotify redirects to {site}/spotify/callback; that page passes code and state to completeConnect.

// Only our own callback pages, registered on every Spotify app (§8.9).
function allowedRedirect(redirectUri: string): boolean {
  const sites: string[] = [SITE.prodUrl, SITE.devUrl];
  if (process.env.SITE_URL) sites.push(process.env.SITE_URL.replace(/\/$/, ""));
  return sites.some((site) => redirectUri === `${site}${SPOTIFY.callbackPath}`);
}

// S07: the Spotify consent URL for the student's assigned app, with a signed state.
export const connectUrl = action({
  args: { redirectUri: v.string() },
  returns: v.string(),
  handler: async (ctx, { redirectUri }): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) fail("not_signed_in");
    if (!allowedRedirect(redirectUri)) fail("validation_failed", "Unknown Spotify callback address.");
    const target: ConnectContext = await ctx.runQuery(internal.onboarding.connect.connectContext, { userId });
    if (!target.ok) fail(target.code);
    const state = await signState(userId, target.appId, Date.now());
    return authorizeUrl({ clientId: target.clientId, redirectUri, state });
  },
});

// /spotify/callback: swaps the code for tokens (stored server-only) and starts the analysis job.
export const completeConnect = action({
  args: { code: v.string(), state: v.string(), redirectUri: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, state, redirectUri }): Promise<null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) fail("not_signed_in");
    if (!allowedRedirect(redirectUri)) fail("validation_failed", "Unknown Spotify callback address.");
    const payload = await verifyState(state, Date.now());
    // The state must be this student's, so a callback can't be replayed or crossed between students.
    if (payload === null || payload.userId !== userId) fail("forbidden", "That Spotify link expired. Try connecting again.");
    const target: ConnectContext = await ctx.runQuery(internal.onboarding.connect.connectContext, { userId });
    if (!target.ok) fail(target.code);
    if (target.appId !== payload.appId) fail("forbidden", "That Spotify link expired. Try connecting again.");

    let tokens;
    let spotifyUserId;
    try {
      tokens = await exchangeCode(target, code, redirectUri);
      spotifyUserId = await currentUserId(tokens.accessToken);
    } catch (error) {
      if (error instanceof SpotifyRefusedError) {
        // Not on the allow-list, or signed into a different Spotify account than the one we added.
        await markRefused(ctx, userId);
        fail("spotify_refused", "Spotify hasn't let us in yet.");
      }
      if (error instanceof SpotifyAuthError) fail("validation_failed", "Spotify didn't accept that sign-in. Try again.");
      fail("retryable", "We couldn't reach Spotify. Try again.");
    }
    await ctx.runMutation(internal.onboarding.connect.storeConnection, {
      userId,
      appId: target.appId,
      spotifyUserId,
      tokens,
    });
    return null;
  },
});
