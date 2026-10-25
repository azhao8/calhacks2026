import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireVerifiedUser } from "./lib/access";
import { vDropView, vReveal } from "./drops/views";
import { acceptEntry, dropView, nextTimeEntry, markRevealed, passEntry, revealFor, seeMoreEntry } from "./drops/model";

// The student side of Drops (DECISIONS.md, Oct 25). Every function acts on the caller's own entry in
// the open drop. Queries withhold in the response: no event details before See more, never the count
// or the other choices.

export const mine = query({
  args: {},
  returns: vDropView,
  handler: async (ctx) => {
    const user = await requireVerifiedUser(ctx);
    return await dropView(ctx.db, user._id);
  },
});

export const seeMore = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireVerifiedUser(ctx);
    await seeMoreEntry(ctx, user._id);
    return null;
  },
});

export const passForever = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireVerifiedUser(ctx);
    await passEntry(ctx, user._id);
    return null;
  },
});

export const accept = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireVerifiedUser(ctx);
    await acceptEntry(ctx, user._id);
    return null;
  },
});

export const nextTime = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireVerifiedUser(ctx);
    await nextTimeEntry(ctx, user._id);
    return null;
  },
});

// The reveal, one step at a time, for the caller's own plan only.
export const reveal = query({
  args: { meetupId: v.id("meetups") },
  returns: vReveal,
  handler: async (ctx, { meetupId }) => {
    const user = await requireVerifiedUser(ctx);
    return await revealFor(ctx.db, user._id, meetupId);
  },
});

export const revealed = mutation({
  args: { meetupId: v.id("meetups") },
  returns: v.null(),
  handler: async (ctx, { meetupId }) => {
    const user = await requireVerifiedUser(ctx);
    await markRevealed(ctx, user._id, meetupId);
    return null;
  },
});
