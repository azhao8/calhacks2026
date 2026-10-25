import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { eventTimes, isActivePlan, scheduleBoundaries } from "./model";
import { reconcilePlan } from "./reconcile";

// An event's start time or meeting offset changed: every plan still forming or set gets the new
// meeting time and cutoff, is reconciled at once (offers now past the cutoff expire, an empty seat past
// it calls the plan off), and has its time boundaries rescheduled. Reconcile reads now(forDemo).
// INTEGRATION: stream B's convex/events/imports.ts and admin edits call this after changing the times.
export const forEvent = internalMutation({
  args: { eventId: v.id("events") },
  returns: v.object({ plansRetimed: v.number() }),
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (event === null) return { plansRetimed: 0 };
    const times = eventTimes(event);
    let plansRetimed = 0;
    for (const status of ["forming", "set"] as const) {
      const plans = await ctx.db
        .query("meetups")
        .withIndex("by_event_status", (q) => q.eq("eventId", eventId).eq("status", status))
        .collect();
      for (const plan of plans) {
        await ctx.db.patch(plan._id, { meetAt: times.meetAt, cutoffAt: times.cutoffAt });
        await reconcilePlan(ctx, plan._id);
        const current = await ctx.db.get(plan._id);
        if (current !== null && isActivePlan(current)) await scheduleBoundaries(ctx, current);
        plansRetimed += 1;
      }
    }
    return { plansRetimed };
  },
});
