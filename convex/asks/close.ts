import { internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { eventCutoff } from "../plans/model";

// Each ask closes at its event's cutoff (or when the event is gone), so expired week cards leave the
// live view: a query never reruns just because time passed.

export async function scheduleAskClose(ctx: MutationCtx, askId: Id<"asks">, cutoffAt: number): Promise<void> {
  await ctx.scheduler.runAt(Math.max(cutoffAt, Date.now()), internal.asks.close.atCutoff, { askId });
}

export async function scheduleAskCloses(ctx: MutationCtx, eventId: Id<"events">): Promise<void> {
  const event = await ctx.db.get(eventId);
  if (event === null) return;
  for (const answer of ["pending", "yes", "no"] as const) {
    const asks = await ctx.db
      .query("asks")
      .withIndex("by_event_answer", (q) => q.eq("eventId", eventId).eq("answer", answer))
      .collect();
    for (const ask of asks) {
      if (ask.closedReason === undefined) await scheduleAskClose(ctx, ask._id, eventCutoff(event));
    }
  }
}

export const atCutoff = internalMutation({
  args: { askId: v.id("asks") },
  returns: v.boolean(),
  handler: async (ctx, { askId }) => {
    const ask = await ctx.db.get(askId);
    if (ask === null || ask.closedReason !== undefined) return false;
    const event = await ctx.db.get(ask.eventId);
    if (event !== null && event.status === "published" && Date.now() < eventCutoff(event)) {
      // The event moved later: close at the new cutoff instead.
      await scheduleAskClose(ctx, askId, eventCutoff(event));
      return false;
    }
    await ctx.db.patch(askId, {
      closedReason: event === null || event.status !== "published" ? "event_pulled" : "cutoff",
    });
    await ctx.scheduler.runAfter(0, internal.asks.picker.pickForUser, { userId: ask.userId });
    return true;
  },
});
