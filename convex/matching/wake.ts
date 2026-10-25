import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { legacyAsksOn, TIMING } from "../lib/config";

// Wakes the matcher for one event (CLAUDE.md §6.4). A yes or a reopened seat runs it about 15 seconds
// later; changes inside that window join the same run through `events.matcherWakeAt`.
export async function wakeMatcher(
  ctx: MutationCtx,
  eventId: Id<"events">,
  trigger: "yes" | "seat_open",
): Promise<void> {
  // Drops: no live matching on a yes. Reopened seats still wake it, for the demo refill.
  if (trigger === "yes" && !legacyAsksOn()) return;
  const event = await ctx.db.get(eventId);
  if (event === null) return;
  const real = Date.now();
  if (event.matcherWakeAt !== undefined && event.matcherWakeAt > real) return;
  await ctx.db.patch(eventId, { matcherWakeAt: real + TIMING.matcherWakeDelayMs });
  await ctx.scheduler.runAfter(TIMING.matcherWakeDelayMs, internal.matching.run.forEvent, { eventId, trigger });
}

// A real student alone on an event gets a demo partner once the demo-fill wait runs out.
export async function wakeForDemoFill(ctx: MutationCtx, eventId: Id<"events">, delayMs: number): Promise<void> {
  // A little slack so the wait has fully passed when the run checks it.
  await ctx.scheduler.runAfter(Math.max(0, delayMs) + 1000, internal.matching.run.forEvent, {
    eventId,
    trigger: "demo_wait",
  });
}

export const DEMO_FILL_DELAY_MS = TIMING.demoFillWaitMs;
