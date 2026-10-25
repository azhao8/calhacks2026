import { ConvexError } from "convex/values";
import { ERROR_CODES, type ErrorCode } from "../../convex/lib/errors";

// Error codes from the server (CLAUDE.md §8.8) mapped to recovery copy. Says what happened and
// what to do next, never blames the student.

const COPY: Record<ErrorCode, string> = {
  validation_failed: "Check what you entered and try again.",
  not_signed_in: "You're signed out. Sign in again to keep going.",
  not_edu_email: "Melos is only open to students with a .edu email right now.",
  code_cooldown: "We just sent a code. You can ask for a new one in a few seconds.",
  forbidden: "That isn't available on your account.",
  spotify_not_ready: "Spotify isn't ready for your account yet. We'll email you when it is.",
  spotify_refused: "Spotify hasn't let us in yet.",
  offer_expired: "This invitation ran out. We will keep looking.",
  seat_unavailable: "That seat isn't open anymore. We will keep looking.",
  already_seated: "You already have a plan. You can hold one seat at a time.",
  ai_failure: "We couldn't write that just now. Try again.",
  retryable: "Something went wrong on our side. Try again.",
};

const OFFLINE = "You're offline. Check your connection and try again.";

export function errorCode(error: unknown): ErrorCode | null {
  if (!(error instanceof ConvexError)) return null;
  const data: unknown = error.data;
  if (typeof data === "object" && data !== null && "code" in data) {
    const code = (data as { code: unknown }).code;
    if (typeof code === "string" && (ERROR_CODES as readonly string[]).includes(code)) return code as ErrorCode;
  }
  return null;
}

function serverMessage(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const data: unknown = error.data;
  if (typeof data === "object" && data !== null && "message" in data) {
    const message = (data as { message: unknown }).message;
    return typeof message === "string" ? message : null;
  }
  return null;
}

// Copy for a failed call. Validation messages written by our own functions are shown as they are;
// everything else uses the fixed copy above. `fallback` replaces the generic line for unknown errors.
export function errorCopy(error: unknown, options: { fallback?: string; online?: boolean } = {}): string {
  const online = options.online ?? (typeof navigator === "undefined" ? true : navigator.onLine);
  if (!online) return OFFLINE;
  const code = errorCode(error);
  if (code === "validation_failed") {
    const message = serverMessage(error);
    if (message && message !== code) return message;
  }
  if (code !== null && code !== "retryable") return COPY[code];
  return options.fallback ?? COPY.retryable;
}
