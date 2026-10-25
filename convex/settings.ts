import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireVerifiedUser } from "./lib/access";
import { accessFor } from "./onboarding/apps";

// Stream A (onboarding) owns this file.

// S16: deletes Spotify tokens, snapshot, taste profile and vector; gives up any seat; closes asks.
// Reconnecting starts again at S07 (the student stays on the app's allow-list).
export const disconnectSpotify = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireVerifiedUser(ctx);
    const userId = user._id;
    for (const table of ["spotifyTokens", "tasteSnapshots", "tasteProfiles", "analysisJobs"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
    const access = await accessFor(ctx, userId);
    if (access && access.status !== "requested") await ctx.db.patch(access._id, { status: "revoked" });

    const reachedConnect =
      user.onboarding === "needs_spotify_connect" ||
      user.onboarding === "analyzing" ||
      user.onboarding === "needs_review" ||
      user.onboarding === "ready";
    if (reachedConnect) await ctx.db.patch(userId, { onboarding: "needs_spotify_connect" });

    // INTEGRATION: await ctx.runMutation(internal.plans.release.forUser, { userId }); gives up any seat (it reopens) and closes asks.
    return null;
  },
});
