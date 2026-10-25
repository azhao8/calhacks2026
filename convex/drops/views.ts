import { v, type Infer } from "convex/values";
import { vDropStatus, vEventKind } from "../lib/validators";

// Return validators for the Drops contract (DECISIONS.md, Oct 25). The screens build against these.

// A card before See more: only the date and time and the price. Never the count or the other choices.
export const vDropCard = v.object({ startsAt: v.number(), price: v.string() });

// After See more: the event itself.
export const vDropEvent = v.object({
  title: v.string(),
  venue: v.string(),
  startsAt: v.number(),
  price: v.string(),
  kind: vEventKind,
});

// `endsAt` is choosingEndsAt while choosing is open, then matchAt.
export const vDropView = v.union(
  v.object({ kind: v.literal("none") }),
  v.object({ kind: v.literal("choosing"), endsAt: v.number(), card: vDropCard }),
  v.object({ kind: v.literal("deciding"), endsAt: v.number(), acceptBy: v.number(), event: vDropEvent }),
  v.object({ kind: v.literal("accepted"), endsAt: v.number(), matchAt: v.number(), event: vDropEvent }),
  v.object({ kind: v.literal("done"), endsAt: v.number() }),
  v.object({ kind: v.literal("reveal"), meetupId: v.id("meetups") }),
);
export type DropView = Infer<typeof vDropView>;

export const vRevealStep = v.union(
  v.object({ kind: v.literal("going") }),
  v.object({ kind: v.literal("artist"), name: v.string() }),
  v.object({ kind: v.literal("label"), name: v.string() }),
  v.object({ kind: v.literal("song"), title: v.string(), artist: v.string() }),
  v.object({ kind: v.literal("name"), firstName: v.string() }),
);
export const vReveal = v.object({ steps: v.array(vRevealStep) });
export type Reveal = Infer<typeof vReveal>;

export const vDropCounts = v.object({
  eligible: v.number(),
  choosing: v.number(),
  deciding: v.number(),
  accepted: v.number(),
  passed: v.number(),
  declined: v.number(),
  turnedAway: v.number(),
  matched: v.number(),
  unmatched: v.number(),
  demo: v.number(),
});

export const vAdminDropStatus = v.object({
  drop: v.union(
    v.null(),
    v.object({
      status: vDropStatus,
      startedAt: v.number(),
      choosingEndsAt: v.number(),
      matchAt: v.number(),
      counts: vDropCounts,
    }),
  ),
});
