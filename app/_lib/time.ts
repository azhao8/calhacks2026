import { dayLabel, timeLabel } from "../../convex/lib/format";

// Offer expiry in plain words, in Pacific time like every other time in Melos.
export function offerExpiryText(expiresAt: number | null, now: number): string | null {
  if (expiresAt === null) return null;
  if (expiresAt <= now) return "This invitation ran out.";
  const sameDay = dayLabel(expiresAt) === dayLabel(now);
  return sameDay
    ? `Answer by ${timeLabel(expiresAt)} to keep this seat.`
    : `Answer by ${dayLabel(expiresAt)} at ${timeLabel(expiresAt)} to keep this seat.`;
}

// Seconds left before a new code can be sent.
export function secondsLeft(until: number, now: number, max = Infinity): number {
  return Math.min(max, Math.max(0, Math.ceil((until - now) / 1000)));
}
