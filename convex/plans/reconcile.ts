import { internalMutation, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { demoPhone } from "../demo/fixtures";
import { afterSeatOut, closeAsk, eventTimes, freeStudent, isActivePlan, isActiveSeat, planClock, seatsOf } from "./model";

// The one reconcile step (CLAUDE.md §6.5): works out what should be true for a plan at the plan's
// clock and applies it idempotently. The scheduler calls it at every boundary; the demo clock calls
// it at once for every demo plan. Opening a screen never advances a state.

export async function reconcilePlan(ctx: MutationCtx, meetupId: Id<"meetups">): Promise<void> {
  const plan = await ctx.db.get(meetupId);
  if (plan === null || !isActivePlan(plan)) return;
  const event = await ctx.db.get(plan.eventId);
  if (event === null) return;
  const { now } = await planClock(ctx.db, plan);
  const times = eventTimes(event);

  // Offers that ran out: the seat goes out with no_answer and reopens.
  let reopened = false;
  for (const seat of await seatsOf(ctx.db, meetupId)) {
    if (seat.seat === "offered" && now >= Math.min(seat.offerExpiresAt, plan.cutoffAt)) {
      await ctx.db.patch(seat._id, { seat: "out", outReason: "no_answer", outAt: now });
      await closeAsk(ctx, seat.userId, plan.eventId, "dropped");
      await freeStudent(ctx, seat.userId, plan.eventId);
      reopened = true;
    }
  }
  if (reopened) await afterSeatOut(ctx, meetupId);

  const current = (await ctx.db.get(meetupId))!;
  if (!isActivePlan(current)) return;
  const active = (await seatsOf(ctx.db, meetupId)).filter(isActiveSeat);

  // The cutoff: nobody new is added after it (recorded so live views stop promising a refill), and an
  // empty seat calls the plan off.
  if (now >= current.cutoffAt && current.cutoffPassedAt === undefined) {
    await ctx.db.patch(meetupId, { cutoffPassedAt: now });
  }
  if (now >= current.cutoffAt && (active.length < 2 || active.some((seat) => seat.seat !== "in"))) {
    await ctx.db.patch(meetupId, { status: "called_off", endReason: "nobody_by_cutoff" });
    for (const seat of active) await freeStudent(ctx, seat.userId, plan.eventId);
    return;
  }
  if (current.status !== "set") return;

  const patch: { dayRevealedAt?: number; meetingStartedAt?: number } = {};
  if (now >= times.dayRevealAt && current.dayRevealedAt === undefined) patch.dayRevealedAt = now;
  if (now >= current.meetAt && current.meetingStartedAt === undefined) {
    patch.meetingStartedAt = now;
    patch.dayRevealedAt ??= current.dayRevealedAt ?? now;
    await demoMembersShare(ctx, meetupId);
  }
  if (Object.keys(patch).length > 0) await ctx.db.patch(meetupId, patch);

  // Both people left: nothing more happens in this plan. One leaving never ends it.
  if (active.length === 2 && active.every((seat) => seat.leftAt !== undefined)) {
    await ctx.db.patch(meetupId, { status: "called_off", endReason: "both_left" });
    for (const seat of active) await freeStudent(ctx, seat.userId, plan.eventId);
    return;
  }
  if (now >= times.completeAt) {
    await ctx.db.patch(meetupId, { status: "done", endReason: "completed" });
    for (const seat of active) await freeStudent(ctx, seat.userId, plan.eventId);
  }
}

// Demo students share a fictional 555-01xx number once Stay in touch opens (§6.7).
async function demoMembersShare(ctx: MutationCtx, meetupId: Id<"meetups">): Promise<void> {
  for (const seat of await seatsOf(ctx.db, meetupId)) {
    if (seat.seat !== "in") continue;
    const user = await ctx.db.get(seat.userId);
    if (!user?.isDemo || user.demoKey === undefined) continue;
    const phone = demoPhone(user.demoKey);
    if (phone === null) continue;
    const existing = await ctx.db
      .query("contactShares")
      .withIndex("by_user_meetup", (q) => q.eq("userId", user._id).eq("meetupId", meetupId))
      .first();
    if (existing === null) {
      await ctx.db.insert("contactShares", {
        meetupId,
        userId: user._id,
        kind: "phone",
        value: phone,
        sharedAt: Date.now(),
      });
    }
  }
}

export const run = internalMutation({
  args: { meetupId: v.id("meetups") },
  returns: v.null(),
  handler: async (ctx, { meetupId }) => {
    await reconcilePlan(ctx, meetupId);
    return null;
  },
});
