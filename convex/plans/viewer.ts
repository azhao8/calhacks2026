import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Live queries return nothing (rather than throwing) until the viewer is a verified student, matching
// requireVerifiedUser in convex/lib/access.ts for mutations.
export async function verifiedViewerId(ctx: QueryCtx): Promise<Id<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (user === null || user.verifiedAt === undefined || user.isDemo) return null;
  return userId;
}
