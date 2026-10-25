import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

// Apify imports run through the shared syncPool (convex.config.ts), so a failed import retries with backoff.
export const importPool = new Workpool(components.syncPool, { maxParallelism: 2 });

export const IMPORT_RETRY = { maxAttempts: 3, initialBackoffMs: 30_000, base: 2 };
