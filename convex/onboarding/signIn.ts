import type { GenericMutationCtx, AnyDataModel } from "convex/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { SIGN_IN } from "../lib/config";
import { emailDomain, isEduEmail, normalizeEmail } from "../lib/edu";
import { fail } from "../lib/errors";

export const OTP_PROVIDER_ID = "resend-otp";

type CallbackArgs = {
  existingUserId: Id<"users"> | null;
  type: "oauth" | "credentials" | "email" | "phone" | "verification";
  profile: Record<string, unknown> & { email?: string };
};

// Convex Auth's createOrUpdateUser callback (§8.2 Sign-in). It runs inside the mutation that stores the
// code, before the code is saved or sent, so throwing here stores nothing and sends nothing.
export async function createOrUpdateUser(
  genericCtx: GenericMutationCtx<AnyDataModel>,
  args: CallbackArgs,
): Promise<Id<"users">> {
  const ctx = genericCtx as unknown as MutationCtx;
  const raw = typeof args.profile.email === "string" ? args.profile.email : "";
  const email = normalizeEmail(raw);
  if (!isEduEmail(email)) fail("not_edu_email", "Melos is only open to students with a .edu email right now.");

  const userId = args.existingUserId ?? (await userByEmail(ctx, email));

  if (args.type === "email") {
    // A code was requested. Enforce the 30-second wait across every account for this address.
    if (userId !== null) await enforceCodeCooldown(ctx, userId);
    if (userId !== null) {
      await ctx.db.patch(userId, { email, emailDomain: emailDomain(email) });
      return userId;
    }
    return await ctx.db.insert("users", {
      email,
      emailDomain: emailDomain(email),
      onboarding: "needs_verification",
    });
  }

  if (args.type === "verification") {
    // The code checked out: the address is verified.
    const now = Date.now();
    const id = userId ?? (await ctx.db.insert("users", { email, emailDomain: emailDomain(email) }));
    const user = await ctx.db.get(id);
    const universityId = user?.universityId ?? (await defaultSchoolId(ctx, email));
    await ctx.db.patch(id, {
      email,
      emailDomain: emailDomain(email),
      emailVerificationTime: user?.emailVerificationTime ?? now,
      verifiedAt: user?.verifiedAt ?? now,
      ...(universityId ? { universityId } : {}),
      onboarding:
        user?.onboarding === undefined || user.onboarding === "needs_verification"
          ? "needs_about_you"
          : user.onboarding,
    });
    return id;
  }

  fail("forbidden", `Sign-in type ${args.type} is not supported`);
}

async function userByEmail(ctx: MutationCtx, email: string): Promise<Id<"users"> | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .first();
  return user?._id ?? null;
}

async function enforceCodeCooldown(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", OTP_PROVIDER_ID))
    .collect();
  for (const account of accounts) {
    const code = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .first();
    if (code !== null && Date.now() - code._creationTime < SIGN_IN.resendCooldownMs) {
      fail("code_cooldown", "Wait a few seconds before asking for a new code.");
    }
  }
}

// Melos is built for UC Berkeley: a matching open school if one lists this domain, otherwise the open school.
async function defaultSchoolId(ctx: MutationCtx, email: string): Promise<Id<"universities"> | null> {
  const domain = emailDomain(email);
  const open = (await ctx.db.query("universities").collect()).filter((school) => school.status === "open");
  const match = open.find((school) =>
    school.emailDomains.some((d) => domain === d || domain.endsWith(`.${d}`)),
  );
  return (match ?? open[0])?._id ?? null;
}

// Six digits from a secure random source.
export function generateCode(): string {
  const max = 10 ** SIGN_IN.codeLength;
  const limit = Math.floor(0xffffffff / max) * max;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while (buffer[0] >= limit);
  return String(buffer[0] % max).padStart(SIGN_IN.codeLength, "0");
}
