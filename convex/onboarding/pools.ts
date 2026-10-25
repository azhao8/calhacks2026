import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

// Workpools for stream A's outside calls (§8.3). Each pool's name matches convex.config.ts.
// Retries back off; paid work that already succeeded is never repeated, because every step checks saved state first.
export const emailPool = new Workpool(components.emailPool, {
  maxParallelism: 5,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 2000, base: 2 },
});

export const aiPool = new Workpool(components.aiPool, {
  maxParallelism: 5,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 2000, base: 2 },
});
