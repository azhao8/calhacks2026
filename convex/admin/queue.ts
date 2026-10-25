import { action, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { requireAdmin } from "../lib/access";
import type {
  checkApp as checkAppFn,
  deleteApp as deleteAppFn,
  markAdded as markAddedFn,
  moveRequest as moveRequestFn,
  queue as queueFn,
  removeRequest as removeRequestFn,
  setAppActive as setAppActiveFn,
  setAppSecret as setAppSecretFn,
  undoAdded as undoAddedFn,
  upsertSpotifyApp as upsertSpotifyAppFn,
} from "../onboarding/admin";
import type { ReturnsOf } from "../lib/registered";

// S17 allow-list and Spotify apps. Team only: every function checks ADMIN_EMAILS on the server.
// No function here returns a client secret; the page only learns whether one is saved and when.

const vStatus = v.union(
  v.literal("needs_adding"),
  v.literal("refused"),
  v.literal("no_app"),
  v.literal("added"),
  v.literal("connected"),
  v.literal("disconnected"),
);

export const list = query({
  args: {
    status: v.optional(vStatus),
    appId: v.optional(v.union(v.id("spotifyApps"), v.literal("none"))),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ReturnsOf<typeof queueFn>> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.onboarding.admin.queue, args);
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

export const undoAdded = mutation({
  args: { accessId: v.id("spotifyAccess") },
  handler: async (ctx, args): Promise<ReturnsOf<typeof undoAddedFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.onboarding.admin.undoAdded, args);
  },
});

export const moveRequest = mutation({
  args: { accessId: v.id("spotifyAccess"), appId: v.id("spotifyApps") },
  handler: async (ctx, args): Promise<ReturnsOf<typeof moveRequestFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.onboarding.admin.moveRequest, args);
  },
});

export const removeRequest = mutation({
  args: { accessId: v.id("spotifyAccess") },
  handler: async (ctx, args): Promise<ReturnsOf<typeof removeRequestFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.onboarding.admin.removeRequest, args);
  },
});

// Adds or edits a teammate's Spotify app. The client secret is optional on edit and write-only.
export const upsertSpotifyApp = mutation({
  args: {
    label: v.string(),
    ownerName: v.string(),
    clientId: v.string(),
    active: v.optional(v.boolean()),
    secret: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ReturnsOf<typeof upsertSpotifyAppFn>> => {
    const admin = await requireAdmin(ctx);
    return await ctx.runMutation(internal.onboarding.admin.upsertSpotifyApp, { ...args, adminEmail: admin.email ?? "team" });
  },
});

export const setAppSecret = mutation({
  args: { appId: v.id("spotifyApps"), secret: v.string() },
  handler: async (ctx, args): Promise<ReturnsOf<typeof setAppSecretFn>> => {
    const admin = await requireAdmin(ctx);
    return await ctx.runMutation(internal.onboarding.admin.setAppSecret, { ...args, adminEmail: admin.email ?? "team" });
  },
});

export const setAppActive = mutation({
  args: { appId: v.id("spotifyApps"), active: v.boolean() },
  handler: async (ctx, args): Promise<ReturnsOf<typeof setAppActiveFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.onboarding.admin.setAppActive, args);
  },
});

export const deleteApp = mutation({
  args: { appId: v.id("spotifyApps") },
  handler: async (ctx, args): Promise<ReturnsOf<typeof deleteAppFn>> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.onboarding.admin.deleteApp, args);
  },
});

// "Check app": does Spotify accept this app's client ID and secret.
export const checkApp = action({
  args: { appId: v.id("spotifyApps") },
  handler: async (ctx, args): Promise<ReturnsOf<typeof checkAppFn>> => {
    await ctx.runQuery(internal.admin.events.assertAdmin, {});
    return await ctx.runAction(internal.onboarding.admin.checkApp, args);
  },
});
