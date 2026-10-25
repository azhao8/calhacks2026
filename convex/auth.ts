import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";
import { SIGN_IN } from "./lib/config";
import { normalizeEmail } from "./lib/edu";
import { sendEmail } from "./services/resend";
import { createOrUpdateUser, generateCode, OTP_PROVIDER_ID } from "./onboarding/signIn";

// S03: 6-digit email codes for any .edu address (§8.2). The UI signs in with provider "resend-otp".
const ResendOTP = Email({
  id: OTP_PROVIDER_ID,
  maxAge: SIGN_IN.codeTtlSeconds,
  generateVerificationToken: async () => generateCode(),
  // The callback validated and stored normalizeEmail(input); the code goes to exactly that address.
  sendVerificationRequest: async ({ identifier, token }) => {
    await sendEmail({
      to: normalizeEmail(identifier),
      subject: `Your Melos code is ${token}`,
      text: [
        `Your Melos code is ${token}.`,
        "It works for 15 minutes.",
        "If you didn't ask for it, you can ignore this email.",
      ].join("\n\n"),
    });
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendOTP],
  signIn: { maxFailedAttempsPerHour: SIGN_IN.maxFailedAttemptsPerHour },
  callbacks: { createOrUpdateUser },
});
