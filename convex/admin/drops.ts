import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/access";
import { vAdminDropStatus } from "../drops/views";
import { adminStatus, requestEndChoosing, requestMatchNow, startDrop } from "../drops/cycle";

// S17 drop controls (DECISIONS.md, Oct 25). Team only, checked on the server. The buttons run the same
// transitions the scheduler runs, early; a later scheduled run then does nothing.

export const status = query({
  args: {},
  returns: vAdminDropStatus,
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await adminStatus(ctx.db);
  },
});

export const start = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    await startDrop(ctx, admin.email ?? "admin");
    return null;
  },
});

export const endChoosing = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    await requestEndChoosing(ctx);
    return null;
  },
});

export const matchNow = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    await requestMatchNow(ctx);
    return null;
  },
});
