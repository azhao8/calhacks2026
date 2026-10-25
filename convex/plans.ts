import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { notBuilt } from "./lib/errors";
import { vPlanView } from "./lib/views";

// Stream C (matching) owns this file. Contract stubs: names and types are final; bodies come next.

// S11–S14: the student's current plan, with withholding by stage (CLAUDE.md §8.7).
export const current = query({
  args: {},
  returns: v.union(v.null(), vPlanView),
  handler: async () => null,
});

export const accept = mutation({
  args: { seatId: v.id("meetupMembers") },
  returns: v.null(),
  handler: async () => notBuilt("plans.accept"),
});

export const nextTime = mutation({
  args: { seatId: v.id("meetupMembers") },
  returns: v.null(),
  handler: async () => notBuilt("plans.nextTime"),
});

// "Got my ticket", or "I couldn't get one" (which gives up the seat like "I can't make it").
export const setTicket = mutation({
  args: { seatId: v.id("meetupMembers"), ticket: v.union(v.literal("got"), v.literal("couldnt")) },
  returns: v.null(),
  handler: async () => notBuilt("plans.setTicket"),
});

export const cantMakeIt = mutation({
  args: { seatId: v.id("meetupMembers") },
  returns: v.null(),
  handler: async () => notBuilt("plans.cantMakeIt"),
});

// From the meeting time on: "I need to leave".
export const leave = mutation({
  args: { seatId: v.id("meetupMembers") },
  returns: v.null(),
  handler: async () => notBuilt("plans.leave"),
});
