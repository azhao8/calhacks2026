import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { requireAdmin } from "../lib/access";
import { demoClockOffsetMs } from "../lib/clock";
import { heldSeats } from "../plans/model";
import type {
  actAs as actAsFn,
  generate as generateFn,
  reset as resetFn,
  seed as seedFn,
  setClockOffset as setClockOffsetFn,
} from "../demo/admin";
import type { ReturnsOf } from "../lib/registered";

// S17 demo controls (§6.7). They touch only demo records; the internal functions enforce that too.
// Team only: every function checks ADMIN_EMAILS on the server.

// The demo students, what each holds right now (for "act as"), and the demo clock offset.
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db
      .query("users")
      .withIndex("by_demoKey", (q) => q.gt("demoKey", ""))
      .collect();
    const students = await Promise.all(
      users
        .filter((user) => user.isDemo === true)
        .map(async (user) => {
          const seats = await Promise.all(
            (await heldSeats(ctx.db, user._id)).map(async ({ seat, plan }) => {
              const event = await ctx.db.get(plan.eventId);
              return {
                seatId: seat._id,
                seat: seat.seat,
                ticket: seat.ticket,
                planStatus: plan.status,
                eventTitle: event?.title ?? "Unknown event",
              };
            }),
          );
          return { userId: user._id, firstName: user.firstName ?? "Demo", onboarding: user.onboarding ?? null, seats };
        }),
    );
    return { students, clockOffsetMs: await demoClockOffsetMs(ctx.db) };
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx): Promise<ReturnsOf<typeof seedFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.demo.admin.seed, {});
  },
});

// Adds 1 to 50 new demo students with unique names and generated listening data.
export const generate = mutation({
  args: { count: v.number() },
  handler: async (ctx, { count }): Promise<ReturnsOf<typeof generateFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.demo.admin.generate, { count });
  },
});

export const reset = mutation({
  args: {},
  handler: async (ctx): Promise<ReturnsOf<typeof resetFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.demo.admin.reset, {});
  },
});

// Moves the demo clock for demo plans only; plans with a real student keep real time.
export const setClockOffset = mutation({
  args: { offsetMs: v.number() },
  handler: async (ctx, { offsetMs }): Promise<ReturnsOf<typeof setClockOffsetFn>> => {
    const admin = await requireAdmin(ctx);
    return await ctx.runMutation(internal.demo.admin.setClockOffset, { offsetMs, updatedBy: admin.email ?? "team" });
  },
});

export const actAs = mutation({
  args: {
    userId: v.id("users"),
    action: v.union(v.literal("accept"), v.literal("next_time"), v.literal("cant_make_it"), v.literal("got_ticket")),
    seatId: v.optional(v.id("meetupMembers")),
  },
  handler: async (ctx, args): Promise<ReturnsOf<typeof actAsFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.demo.admin.actAs, args);
  },
});
