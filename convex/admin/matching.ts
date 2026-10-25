import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { requireAdmin } from "../lib/access";
import type { runNow as runNowFn, runs as runsFn } from "../matching/admin";
import type { ReturnsOf } from "../lib/registered";

// S17 matching: "Run matching now" and the matching inspector. Team only: every function checks
// ADMIN_EMAILS on the server.

export const runNow = mutation({
  args: { eventId: v.optional(v.id("events")) },
  handler: async (ctx, args): Promise<ReturnsOf<typeof runNowFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.matching.admin.runNow, args);
  },
});

// Recent runs with each pair's similarity, shared items and their rarity weights, and the reason.
export const runs = query({
  args: { eventId: v.optional(v.id("events")), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<ReturnsOf<typeof runsFn>> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.matching.admin.runs, args);
  },
});
