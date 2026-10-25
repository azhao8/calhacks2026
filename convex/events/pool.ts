// Apify imports run on the one shared syncPool client (convex/lib/pools.ts), so a failed import retries with backoff.
export { syncPool as importPool } from "../lib/pools";

// Imports wait longer between attempts than the pool default: a fresh Apify dataset can lag a few seconds.
export const IMPORT_RETRY = { maxAttempts: 3, initialBackoffMs: 30_000, base: 2 };
