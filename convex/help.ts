import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/access";
import { fail } from "./lib/errors";

// S16 "Tell us about a problem": a private note the team reads on the admin page.
export const submit = mutation({
  args: { text: v.string(), meetupId: v.optional(v.id("meetups")) },
  returns: v.null(),
  handler: async (ctx, { text, meetupId }) => {
    const userId = await requireUserId(ctx);
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) fail("validation_failed", "Write between 1 and 2000 characters.");
    await ctx.db.insert("helpNotes", { userId, meetupId, text: trimmed, createdAt: Date.now() });
    return null;
  },
});
