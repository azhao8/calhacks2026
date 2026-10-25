import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { isTeamEmail } from "./lib/access";
import { vMeView } from "./lib/views";

// The signed-in student's own basics. Home uses `onboarding` to pick the screen (CLAUDE.md §5).
export const get = query({
  args: {},
  returns: vMeView,
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (user === null) return null;
    const school = user.universityId ? await ctx.db.get(user.universityId) : null;
    return {
      userId,
      email: user.email ?? null,
      firstName: user.firstName ?? null,
      onboarding: user.onboarding ?? "needs_verification",
      school: school ? { name: school.name, themeId: school.themeId } : null,
      isAdmin: isTeamEmail(user.email),
    };
  },
});
