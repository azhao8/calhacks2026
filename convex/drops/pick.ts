import type { Doc, Id } from "../_generated/dataModel";
import { DROP } from "../lib/config";
import { cosine } from "../matching/taste";
import { isAdultOnly, knownPrice, withinArea, withinBudget } from "../asks/rules";
import type { Area } from "../lib/validators";

// Picking each student's 1 to 4 choices (DECISIONS.md, Oct 25). Pure math, no model calls: hard
// filters, cosine against the event's audience vector (or its own vector), a featured boost, an MMR
// pass that penalizes repeating a kind, then a softmax sample from the top of the ranking.

export type PickEvent = Pick<
  Doc<"events">,
  "_id" | "kind" | "startsAt" | "featured" | "status" | "priceMin" | "priceMax" | "freeEntryNote" | "ageLimit" | "embedding" | "audienceEmbedding"
> & { area: Area | null };

export type PickInput = {
  events: PickEvent[];
  embedding: number[] | undefined;
  maxTicketPrice: number | null;
  area: Area;
  isTeam: boolean;
  matchAt: number;
  rng?: () => number;
};

export function eligibleEvents(input: Pick<PickInput, "events" | "maxTicketPrice" | "area" | "matchAt">): PickEvent[] {
  const earliest = input.matchAt + DROP.minLeadMs;
  const latest = input.matchAt + DROP.horizonMs;
  return input.events.filter(
    (event) =>
      event.status === "published" &&
      event.startsAt >= earliest &&
      event.startsAt <= latest &&
      withinBudget(knownPrice(event), input.maxTicketPrice) &&
      event.area !== null &&
      withinArea(event.area, input.area) &&
      !isAdultOnly(event.ageLimit),
  );
}

export function baseScore(event: PickEvent, embedding: number[] | undefined): number {
  return cosine(embedding, event.audienceEmbedding ?? event.embedding) + (event.featured ? DROP.featuredBoost : 0);
}

export function pickChoices(input: PickInput): Id<"events">[] {
  const rng = input.rng ?? Math.random;
  const eligible = eligibleEvents(input);
  if (eligible.length === 0) return [];
  const count = Math.min(eligible.length, DROP.minChoices + Math.floor(rng() * (DROP.maxChoices - DROP.minChoices + 1)));
  const scored = eligible
    .map((event) => ({ event, score: baseScore(event, input.embedding) }))
    .sort((a, b) => b.score - a.score || a.event._id.localeCompare(b.event._id));
  const picked: PickEvent[] = [];
  let remaining = scored;
  // Team accounts see featured events first, so the stage demo lands on the event we chose.
  if (input.isTeam) {
    for (const { event } of scored.filter((item) => item.event.featured)) {
      if (picked.length < count) picked.push(event);
    }
    remaining = remaining.filter((item) => !picked.includes(item.event));
  }
  while (picked.length < count && remaining.length > 0) {
    const adjusted = remaining
      .map((item) => ({
        item,
        score: item.score - DROP.sameKindPenalty * picked.filter((event) => event.kind === item.event.kind).length,
      }))
      .sort((a, b) => b.score - a.score || a.item.event._id.localeCompare(b.item.event._id))
      .slice(0, DROP.sampleTop);
    const top = adjusted[0].score;
    const weights = adjusted.map((entry) => Math.exp((entry.score - top) / DROP.softmaxTemperature));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = rng() * total;
    let chosen = adjusted[adjusted.length - 1].item;
    for (let i = 0; i < adjusted.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        chosen = adjusted[i].item;
        break;
      }
    }
    picked.push(chosen.event);
    remaining = remaining.filter((item) => item !== chosen);
  }
  return picked.map((event) => event._id);
}
