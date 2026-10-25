import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireUser } from "../lib/access";
import { fail } from "../lib/errors";

// Every student function needs a verified school email (S03), checked on the server.
// INTEGRATION: move into convex/lib/access.ts as requireVerifiedUser so every stream shares it.
export async function requireVerifiedUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.verifiedAt === undefined) fail("forbidden", "Verify your school email first.");
  if (user.isDemo) fail("forbidden", "Demo students never sign in.");
  return user;
}
