import { ConvexError } from "convex/values";

// Error codes the UI maps to recovery copy (CLAUDE.md §8.8).
export const ERROR_CODES = [
  "validation_failed",
  "not_signed_in",
  "not_edu_email",
  "code_cooldown",
  "forbidden",
  "spotify_not_ready",
  "spotify_refused",
  "offer_expired",
  "seat_unavailable",
  "already_seated",
  "ai_failure",
  "retryable",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type AppErrorData = { code: ErrorCode; message: string };

export function fail(code: ErrorCode, message?: string): never {
  throw new ConvexError<AppErrorData>({ code, message: message ?? code });
}

// Contract stubs throw this until their stream builds them.
export function notBuilt(functionName: string): never {
  fail("retryable", `${functionName} is not built yet`);
}

export function isAppError(error: unknown): error is ConvexError<AppErrorData> {
  return (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    "code" in error.data
  );
}
