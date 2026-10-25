import { Resend } from "resend";
import { EMAIL } from "../lib/config";

// The one module that sends email (CLAUDE.md §8.1). Email is limited to sign-in codes and the
// Spotify-ready notice, because Resend's free plan allows 100 a day. Call it only from actions.

export function resendApiKey(): string {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) throw new Error("AUTH_RESEND_KEY is not set on this Convex deployment");
  return apiKey;
}

export async function sendEmail(message: { to: string; subject: string; text: string }): Promise<void> {
  const resend = new Resend(resendApiKey());
  const { error } = await resend.emails.send({
    from: EMAIL.from,
    to: [message.to],
    subject: message.subject,
    text: message.text,
  });
  if (error) throw new Error(`Resend failed: ${JSON.stringify(error)}`);
}
