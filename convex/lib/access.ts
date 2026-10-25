import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { fail } from "./errors";
import { normalizeEmail } from "./edu";

// Identity comes only from the authenticated session (CLAUDE.md §8.8).

export async function requireUserId(ctx: Pick<QueryCtx, "auth">): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) fail("not_signed_in");
  return userId;
}

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const userId = await requireUserId(ctx);
  const user = await ctx.db.get(userId);
  if (user === null) fail("not_signed_in");
  return user;
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter((email) => email.length > 0);
}

// Team accounts are the emails on ADMIN_EMAILS (CLAUDE.md §6.7).
export function isTeamEmail(email: string | undefined): boolean {
  return email !== undefined && adminEmails().includes(normalizeEmail(email));
}

export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isTeamEmail(user.email)) fail("forbidden");
  return user;
}
