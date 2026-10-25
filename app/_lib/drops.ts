import type { DropView, Reveal } from "@/convex/drops/views";

// The Drops contract (convex/drops/views.ts). Screens call api.drops.* directly; these are the
// types navigation and the reveal read.
export type { DropView };
export type RevealStep = Reveal["steps"][number];
