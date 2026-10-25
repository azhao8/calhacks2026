import type { Doc } from "../_generated/dataModel";
import { ASK_RERANK } from "../matching/config";
import { normalizeName } from "../matching/taste";
import type { Area } from "../lib/validators";

// Candidate rules and the rerank for "Can you make it?" asks (CLAUDE.md §6.2). Pure functions.

const AREA_ORDER: Record<Area, number> = { campus: 0, berkeley_oakland: 1, bart: 2 };

// A student's distance choice includes smaller areas.
export function withinArea(venueArea: Area, studentArea: Area): boolean {
  return AREA_ORDER[venueArea] <= AREA_ORDER[studentArea];
}

// The lowest price we know, or null when no price was found. A clear free-entry note counts as free.
export function knownPrice(event: Pick<Doc<"events">, "priceMin" | "priceMax" | "freeEntryNote">): number | null {
  const price = event.priceMin ?? event.priceMax;
  if (price !== null) return price;
  return event.freeEntryNote ? 0 : null;
}

// An unknown price passes, but ranks lower.
export function withinBudget(price: number | null, maxTicketPrice: number | null): boolean {
  if (maxTicketPrice === null || price === null) return true;
  return price <= maxTicketPrice;
}

export function isAdultOnly(ageLimit: number | null): boolean {
  return ageLimit !== null && ageLimit >= 21;
}

export function performerOverlap(performers: string[], artists: Set<string>): number {
  return performers.filter((name) => artists.has(normalizeName(name))).length;
}

export function rerankScore(input: {
  similarity: number;
  performerOverlap: number;
  featured: boolean;
  closeFitYes: number;
  priceKnown: boolean;
}): number {
  const w = ASK_RERANK;
  return (
    w.similarity * input.similarity +
    w.performerOverlap * Math.min(input.performerOverlap, w.performerOverlapCap) +
    (input.featured ? w.featured : 0) +
    w.closeFitYes * Math.min(input.closeFitYes, w.closeFitYesCap) -
    (input.priceKnown ? 0 : w.unknownPricePenalty)
  );
}
