import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
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
    // Spotify-derived text outside the taste tables (Spotify Developer Policy: delete on disconnect):
    // the private reasons the ask picker wrote from this student's taste, and the shared items in matcher logs.
    const asks = await ctx.db
      .query("asks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const ask of asks) if (ask.pickReason !== undefined) await ctx.db.patch(ask._id, { pickReason: undefined });
    // Matcher logs can grow without bound, so they're scrubbed outside this transaction, a batch at a time,
    // through the per-event index for every event the student was asked about (decisions only involve yes-voters).
    const eventIds = [...new Set(asks.map((ask) => ask.eventId))];
    if (eventIds.length > 0) await ctx.scheduler.runAfter(0, internal.settings.scrubMatchLogs, { userId, eventIds, cursor: null });

    const access = await accessFor(ctx, userId);
    if (access && access.status !== "requested") await ctx.db.patch(access._id, { status: "revoked" });

    const reachedConnect =
      user.onboarding === "needs_spotify_connect" ||
      user.onboarding === "analyzing" ||
      user.onboarding === "needs_review" ||
      user.onboarding === "ready";
    if (reachedConnect) await ctx.db.patch(userId, { onboarding: "needs_spotify_connect" });

    // Gives up any seat (it reopens for the partner) and closes asks, in the same transaction.
    await ctx.runMutation(internal.plans.release.forUser, { userId });
    return null;
  },
});

const SCRUB_BATCH = 50;

// Empties the shared items in matcher decisions that involve a disconnected student, one page of one
// event's runs per transaction, rescheduling itself until every listed event is done.
export const scrubMatchLogs = internalMutation({
  args: { userId: v.id("users"), eventIds: v.array(v.id("events")), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { userId, eventIds, cursor }) => {
    const [eventId, ...rest] = eventIds;
    if (eventId === undefined) return null;
    const page = await ctx.db
      .query("matchRuns")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .paginate({ numItems: SCRUB_BATCH, cursor });
    for (const run of page.page) {
      if (!run.decisions.some((d) => (d.a === userId || d.b === userId) && d.shared.length > 0)) continue;
      await ctx.db.patch(run._id, {
        decisions: run.decisions.map((d) => (d.a === userId || d.b === userId ? { ...d, shared: [] } : d)),
      });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.settings.scrubMatchLogs, { userId, eventIds, cursor: page.continueCursor });
    } else if (rest.length > 0) {
      await ctx.scheduler.runAfter(0, internal.settings.scrubMatchLogs, { userId, eventIds: rest, cursor: null });
    }
    return null;
  },
});
