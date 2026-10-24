// B's local copy of the CLAUDE.md §6 timing baselines. Placeholder until the foundation
// provides the one shared timing configuration and injectable clock (rules note, question 12).
// All values are epoch milliseconds in UTC.

const HOUR_MS = 60 * 60 * 1000

export const TIMING = {
  initialLeadMs: 12 * HOUR_MS,
  cutoffBeforeStartMs: 2 * HOUR_MS,
  pendingTtlMs: 6 * HOUR_MS,
  declineCooldownMs: 1 * HOUR_MS,
} as const

export function cutoffFor(startAt: number): number {
  return startAt - TIMING.cutoffBeforeStartMs
}

// A pending invitation expires at the earlier of 6 hours after issue or the reservation cutoff.
export function invitationExpiry(issuedAt: number, startAt: number): number {
  return Math.min(issuedAt + TIMING.pendingTtlMs, cutoffFor(startAt))
}
