import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { eventCutoff } from "../plans/model";

// Admin "Run matching now" and the matching inspector's data (S17). The admin page wraps these in
// server-checked ADMIN_EMAILS functions.

// One event, or every published event before its cutoff that has open yeses.
export const runNow = internalMutation({
  args: { eventId: v.optional(v.id("events")) },
  returns: v.number(),
  handler: async (ctx, { eventId }) => {
    const eventIds = new Set<Id<"events">>();
    if (eventId) {
      eventIds.add(eventId);
    } else {
      const now = Date.now();
      const events = await ctx.db
        .query("events")
        .withIndex("by_status_startsAt", (q) => q.eq("status", "published").gt("startsAt", now))
        .collect();
      for (const event of events) if (now < eventCutoff(event)) eventIds.add(event._id);
    }
    for (const id of eventIds) {
      await ctx.scheduler.runAfter(0, internal.matching.run.forEvent, { eventId: id, trigger: "admin" });
    }
    return eventIds.size;
  },
});

// Recent matcher runs, newest first, with each pair's score breakdown.
export const runs = internalQuery({
  args: { eventId: v.optional(v.id("events")), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("matchRuns"),
      eventId: v.id("events"),
      eventTitle: v.string(),
      trigger: v.string(),
      startedAt: v.number(),
      finishedAt: v.union(v.number(), v.null()),
      seatsRefilled: v.number(),
      pairsCreated: v.number(),
      demoFills: v.number(),
      decisions: v.array(
        v.object({
          a: v.id("users"),
          aName: v.string(),
          aIsDemo: v.boolean(),
          b: v.id("users"),
          bName: v.string(),
          bIsDemo: v.boolean(),
          score: v.number(),
          similarity: v.number(),
          shared: v.array(v.object({ kind: v.string(), name: v.string(), weight: v.number() })),
          reason: v.string(),
        }),
      ),
      errors: v.array(v.string()),
    }),
  ),
  handler: async (ctx, { eventId, limit }) => {
    const take = Math.min(limit ?? 20, 100);
    const runs = eventId
      ? await ctx.db
          .query("matchRuns")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .order("desc")
          .take(take)
      : await ctx.db.query("matchRuns").order("desc").take(take);
    const result = [];
    for (const run of runs) {
      const event = await ctx.db.get(run.eventId);
      const decisions = [];
      for (const decision of run.decisions) {
        const a = await ctx.db.get(decision.a);
        const b = await ctx.db.get(decision.b);
        decisions.push({
          ...decision,
          aName: a?.firstName ?? "(deleted)",
          aIsDemo: a?.isDemo === true,
          bName: b?.firstName ?? "(deleted)",
          bIsDemo: b?.isDemo === true,
        });
      }
      result.push({
        _id: run._id,
        eventId: run.eventId,
        eventTitle: event?.title ?? "(deleted)",
        trigger: run.trigger,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt ?? null,
        seatsRefilled: run.seatsRefilled,
        pairsCreated: run.pairsCreated,
        demoFills: run.demoFills,
        decisions,
        errors: run.errors,
      });
    }
    return result;
  },
});
