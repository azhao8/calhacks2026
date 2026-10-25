import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { afterSeatOut, heldSeats, isActivePlan, planClock, seatsOf } from "./model";

// Spotify disconnect (S16): gives up any seat the student was offered or holds (it reopens for the
// partner) and closes their open asks, so no new asks or offers reach them.
// INTEGRATION: stream A's settings.disconnectSpotify calls this.
export const forUser = internalMutation({
  args: { userId: v.id("users") },
  returns: v.object({ seatsReleased: v.number(), asksClosed: v.number() }),
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    let seatsReleased = 0;
    for (const { seat, plan } of await heldSeats(ctx.db, userId)) {
      await ctx.db.patch(seat._id, {
        seat: "out",
        outReason: seat.seat === "offered" ? "next_time" : "cant_make_it",
        outAt: now,
      });
      await afterSeatOut(ctx, plan._id);
      seatsReleased += 1;
    }
    let asksClosed = 0;
    const asks = await ctx.db
      .query("asks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const ask of asks) {
      if (ask.closedReason === undefined || ask.closedReason === "seated") {
        await ctx.db.patch(ask._id, { closedReason: "dropped" });
        asksClosed += 1;
      }
    }
    return { seatsReleased, asksClosed };
  },
});

// The team pulled an event (S17): open asks for it close, and every plan for it that is still forming
// or set is called off. An offer is withdrawn, not declined, so it goes out as no_answer.
// INTEGRATION: stream B's convex/events/admin.ts calls this when an event is pulled.
export const forEvent = internalMutation({
  args: { eventId: v.id("events") },
  returns: v.object({ asksClosed: v.number(), plansCalledOff: v.number(), offersWithdrawn: v.number() }),
  handler: async (ctx, { eventId }) => {
    let asksClosed = 0;
    for (const answer of ["pending", "yes", "no"] as const) {
      const asks = await ctx.db
        .query("asks")
        .withIndex("by_event_answer", (q) => q.eq("eventId", eventId).eq("answer", answer))
        .collect();
      for (const ask of asks) {
        if (ask.closedReason !== undefined) continue;
        await ctx.db.patch(ask._id, { closedReason: "event_pulled" });
        asksClosed += 1;
      }
    }
    let plansCalledOff = 0;
    let offersWithdrawn = 0;
    for (const status of ["forming", "set"] as const) {
      const plans = await ctx.db
        .query("meetups")
        .withIndex("by_event_status", (q) => q.eq("eventId", eventId).eq("status", status))
        .collect();
      for (const plan of plans) {
        if (!isActivePlan(plan)) continue;
        const { now } = await planClock(ctx.db, plan);
        for (const seat of await seatsOf(ctx.db, plan._id)) {
          if (seat.seat !== "offered") continue;
          await ctx.db.patch(seat._id, { seat: "out", outReason: "no_answer", outAt: now });
          offersWithdrawn += 1;
        }
        await ctx.db.patch(plan._id, { status: "called_off", endReason: "event_pulled" });
        plansCalledOff += 1;
      }
    }
    return { asksClosed, plansCalledOff, offersWithdrawn };
  },
});
