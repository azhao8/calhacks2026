import { action, internalQuery, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { requireAdmin } from "../lib/access";
import { vEventKind, vEventStatus } from "../lib/validators";
import type { edit as editFn, feature as featureFn, findNow as findNowFn, imports as importsFn, list as listFn, overrideSpot as overrideSpotFn, pull as pullFn, restore as restoreFn } from "../events/admin";
import type { ReturnsOf } from "../lib/registered";

// S17 events: imports, the catalog, and the team's controls. Team only: every function checks
// ADMIN_EMAILS on the server.

export const imports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<ReturnsOf<typeof importsFn>> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.events.admin.imports, args);
  },
});

export const list = query({
  args: {
    status: v.optional(vEventStatus),
    flaggedOnly: v.optional(v.boolean()),
    includePast: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ReturnsOf<typeof listFn>> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.events.admin.list, args);
  },
});

export const pull = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args): Promise<ReturnsOf<typeof pullFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.events.admin.pull, args);
  },
});

export const restore = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args): Promise<ReturnsOf<typeof restoreFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.events.admin.restore, args);
  },
});

export const feature = mutation({
  args: { eventId: v.id("events"), featured: v.boolean() },
  handler: async (ctx, args): Promise<ReturnsOf<typeof featureFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.events.admin.feature, args);
  },
});

// Edit any field, such as filling in a price the agent couldn't find.
export const edit = mutation({
  args: {
    eventId: v.id("events"),
    patch: v.object({
      title: v.optional(v.string()),
      kind: v.optional(vEventKind),
      startsAt: v.optional(v.number()),
      priceMin: v.optional(v.union(v.number(), v.null())),
      priceMax: v.optional(v.union(v.number(), v.null())),
      ticketUrl: v.optional(v.union(v.string(), v.null())),
      freeEntryNote: v.optional(v.union(v.string(), v.null())),
      performers: v.optional(v.array(v.string())),
      tags: v.optional(v.array(v.string())),
      ageLimit: v.optional(v.union(v.number(), v.null())),
      meetOffsetMinutes: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { eventId, patch }): Promise<ReturnsOf<typeof editFn>> => {
    const admin = await requireAdmin(ctx);
    return await ctx.runMutation(internal.events.admin.edit, { eventId, patch, editedBy: admin.email ?? "team" });
  },
});

// The team overrides a venue's meeting spot (§6.1).
export const overrideSpot = mutation({
  args: {
    venueId: v.id("venues"),
    name: v.string(),
    howToFind: v.string(),
    lat: v.number(),
    lng: v.number(),
    meetOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ReturnsOf<typeof overrideSpotFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.events.admin.overrideSpot, args);
  },
});

// Actions can't read the database, so the admin check runs as a query with the caller's identity.
export const assertAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

// "Find events now": starts an event scout run on Apify. Its webhook brings the results back.
export const findNow = action({
  args: { sources: v.optional(v.array(v.string())) },
  handler: async (ctx, args): Promise<ReturnsOf<typeof findNowFn>> => {
    await ctx.runQuery(internal.admin.events.assertAdmin, {});
    return await ctx.runAction(internal.events.admin.findNow, args);
  },
});
