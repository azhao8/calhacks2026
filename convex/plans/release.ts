import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { afterSeatOut, heldSeats } from "./model";

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
