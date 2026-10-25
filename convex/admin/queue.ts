import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { requireAdmin } from "../lib/access";
import type { markAdded as markAddedFn, queue as queueFn, upsertSpotifyApp as upsertSpotifyAppFn } from "../onboarding/admin";
import type { ReturnsOf } from "../lib/registered";

// S17 allow-list queue. Team only: every function checks ADMIN_EMAILS on the server.

export const list = query({
  args: {},
  handler: async (ctx): Promise<ReturnsOf<typeof queueFn>> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.onboarding.admin.queue, {});
  },
});

// "Mark added": the app owner added this Spotify email to their app. Sends the ready email once.
export const markAdded = mutation({
  args: { accessId: v.id("spotifyAccess") },
  handler: async (ctx, { accessId }): Promise<ReturnsOf<typeof markAddedFn>> => {
    const admin = await requireAdmin(ctx);
    return await ctx.runMutation(internal.onboarding.admin.markAdded, { accessId, adminEmail: admin.email ?? "team" });
  },
});

// Registers or updates a teammate's Spotify app. Client IDs aren't secret; client secrets stay in Convex env vars.
export const upsertSpotifyApp = mutation({
  args: { label: v.string(), ownerName: v.string(), clientId: v.string(), active: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<ReturnsOf<typeof upsertSpotifyAppFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.onboarding.admin.upsertSpotifyApp, args);
  },
});
