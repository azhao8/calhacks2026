import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { notBuilt } from "./lib/errors";

// Stream A (onboarding) owns this file. Contract stubs: names and types are final; bodies come next.

// S16: deletes Spotify tokens, snapshot, taste profile and vector; gives up any seat; closes asks.
export const disconnectSpotify = mutation({
  args: {},
  returns: v.null(),
  handler: async () => notBuilt("settings.disconnectSpotify"),
});
