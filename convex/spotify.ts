import { action } from "./_generated/server";
import { v } from "convex/values";
import { notBuilt } from "./lib/errors";

// Stream A (onboarding) owns this file. Contract stubs: names and types are final; bodies come next.
// Spotify redirects to {site}/spotify/callback; that page passes code and state to completeConnect.

// S07: the Spotify consent URL for the student's assigned app, with a signed state.
export const connectUrl = action({
  args: { redirectUri: v.string() },
  returns: v.string(),
  handler: async () => notBuilt("spotify.connectUrl"),
});

// /spotify/callback: swaps the code for tokens (stored server-only) and starts the analysis job.
export const completeConnect = action({
  args: { code: v.string(), state: v.string(), redirectUri: v.string() },
  returns: v.null(),
  handler: async () => notBuilt("spotify.completeConnect"),
});
