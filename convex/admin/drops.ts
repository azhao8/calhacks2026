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

// `email: false` makes the drop quiet: no start or match emails, for rehearsals.
export const start = mutation({
  args: { email: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    const admin = await requireAdmin(ctx);
    await startDrop(ctx, admin.email ?? "admin", email === false);
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
  args: { email: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    await requireAdmin(ctx);
    await requestMatchNow(ctx, email === false);
    return null;
  },
});
