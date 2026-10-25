// Stream C's tuning knobs (CLAUDE.md §6.2–§6.4). Timing constants and the base pair weights live in
// convex/lib/config.ts (TIMING, MATCHING); these are the ones that file doesn't have yet.
// INTEGRATION: the coordinator may move these into convex/lib/config.ts.

export const ASK_RERANK = {
  similarity: 1.0,
  // Per performer the student already listens to, capped.
  performerOverlap: 0.5,
  performerOverlapCap: 2,
  featured: 0.3,
  // Per close-fit student (shares at least one item) who already said yes, capped.
  closeFitYes: 0.15,
  closeFitYesCap: 4,
  // An unknown price passes the budget rule but ranks lower.
  unknownPricePenalty: 0.2,
} as const;

export const PAIR = {
  // Waiting boost counts at most this many matcher runs.
  waitingRunsCap: 10,
  // Blossom wants integer weights; scores are scaled by this before rounding.
  weightScale: 1_000_000,
} as const;
