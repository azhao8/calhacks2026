import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

// Claude calls for stream C (ask picks, hooks) go through the shared aiPool component (§8.3).
// INTEGRATION: if the coordinator adds one shared Workpool client for aiPool in convex/lib, use it here.
export const aiPool = new Workpool(components.aiPool, {
  maxParallelism: 4,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 1000, base: 2 },
});
