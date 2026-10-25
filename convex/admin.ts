import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { isTeamEmail } from "./lib/access";

// S17 admin (stream E). Every admin function checks ADMIN_EMAILS on the server with requireAdmin.

export const whoami = query({
  args: {},
  returns: v.object({ signedIn: v.boolean(), isAdmin: v.boolean() }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { signedIn: false, isAdmin: false };
    const user = await ctx.db.get(userId);
    return { signedIn: true, isAdmin: isTeamEmail(user?.email) };
  },
});
