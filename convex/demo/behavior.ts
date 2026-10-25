import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { isAppError } from "../lib/errors";
import { acceptSeat, setTicketGot } from "../plans/model";

// Demo students act like real students (§6.7): they accept offers after a short delay and tap
// "Got my ticket" about a minute after a plan is set. A seat that changed in the meantime is skipped.

export const autoAccept = internalMutation({
  args: { seatId: v.id("meetupMembers") },
  returns: v.boolean(),
  handler: async (ctx, { seatId }) => {
    const seat = await ctx.db.get(seatId);
    if (seat === null || seat.seat !== "offered") return false;
    const user = await ctx.db.get(seat.userId);
    if (!user?.isDemo) return false;
    try {
      await acceptSeat(ctx, seat);
      return true;
    } catch (error) {
      if (isAppError(error)) return false;
      throw error;
    }
  },
});

export const autoTicket = internalMutation({
  args: { seatId: v.id("meetupMembers") },
  returns: v.boolean(),
  handler: async (ctx, { seatId }) => {
    const seat = await ctx.db.get(seatId);
    if (seat === null || seat.seat !== "in" || seat.ticket === "got") return false;
    const user = await ctx.db.get(seat.userId);
    if (!user?.isDemo) return false;
    try {
      await setTicketGot(ctx, seat);
      return true;
    } catch (error) {
      if (isAppError(error)) return false;
      throw error;
    }
  },
});
