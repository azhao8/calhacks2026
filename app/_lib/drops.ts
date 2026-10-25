import { makeFunctionReference } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";

// The Drops contract (backend: convex/drops). Typed by hand until api.drops.* lands; then these can
// become plain `api.drops.*` imports with the same types.

// Navigation only reads `kind` and `meetupId`; the drop screen (Drop 2) owns the card and event shapes.
type DropEvent = { title: string; venue: string; startsAt: number; price: unknown; kind: string };

export type DropView =
  | { kind: "none" }
  | { kind: "choosing"; endsAt: number; card: { startsAt: number; price: unknown } }
  | { kind: "deciding"; endsAt: number; acceptBy: number; event: DropEvent }
  | { kind: "accepted"; endsAt: number; matchAt: number; event: DropEvent }
  | { kind: "done"; endsAt: number }
  | { kind: "reveal"; meetupId: Id<"meetups"> };

export type RevealStep =
  | { kind: "going" }
  | { kind: "artist"; name: string }
  | { kind: "label"; name: string }
  | { kind: "song"; title: string; artist: string }
  | { kind: "name"; firstName: string };

export const dropsMine = makeFunctionReference<"query", Record<string, never>, DropView>("drops:mine");
export const dropsReveal = makeFunctionReference<"query", { meetupId: Id<"meetups"> }, { steps: RevealStep[] }>(
  "drops:reveal",
);
export const dropsRevealed = makeFunctionReference<"mutation", { meetupId: Id<"meetups"> }, null>("drops:revealed");
