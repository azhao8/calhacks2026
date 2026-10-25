import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

// The one client per Workpool (CLAUDE.md §8.3), shared by every stream. A pool's settings live only
// here, so two modules can't fight over the same component's parallelism. Names match convex.config.ts.
// Retries back off; paid work that already succeeded is never repeated, because each step checks saved state first.
const retry = { maxAttempts: 3, initialBackoffMs: 2000, base: 2 };

// Claude and Voyage: caps how many paid model calls run at once.
export const aiPool = new Workpool(components.aiPool, {
  maxParallelism: 5,
  retryActionsByDefault: true,
  defaultRetryBehavior: retry,
});

// Resend: the free plan allows about 2 requests a second.
export const emailPool = new Workpool(components.emailPool, {
  maxParallelism: 2,
  retryActionsByDefault: true,
  defaultRetryBehavior: retry,
});

// Spotify fetches and Apify imports.
export const syncPool = new Workpool(components.syncPool, {
  maxParallelism: 3,
  retryActionsByDefault: true,
  defaultRetryBehavior: retry,
});
