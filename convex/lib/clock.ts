import type { DatabaseReader } from "../_generated/server";

// The one injectable clock (CLAUDE.md §6.6, §6.7). The demo offset applies only to demo plans.

export async function demoClockOffsetMs(db: DatabaseReader): Promise<number> {
  const settings = await db.query("demoSettings").first();
  return settings?.clockOffsetMs ?? 0;
}

export async function now(db: DatabaseReader, forDemo: boolean): Promise<number> {
  const real = Date.now();
  return forDemo ? real + (await demoClockOffsetMs(db)) : real;
}

// For actions, which have no db: pass the offset read through a query.
export function nowWithOffset(offsetMs: number): number {
  return Date.now() + offsetMs;
}
