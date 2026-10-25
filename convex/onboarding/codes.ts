import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { OTP_PROVIDER_ID } from "./signIn";

// Sign-in code helpers around Convex Auth (S03).

// Resend failed, so no email went out: delete the code Convex Auth just stored. Otherwise the 30 second
// cooldown (which reads that row) would refuse the student's retry for a code they never received.
export const discardCode = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", OTP_PROVIDER_ID).eq("providerAccountId", email))
      .unique();
    if (account === null) return null;
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const code of codes) await ctx.db.delete(code._id);
    return null;
  },
});
