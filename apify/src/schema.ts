import { z } from "zod";

// The `save_event` format (CLAUDE.md §7). The tool input is what the model fills in; the dataset item adds
// where it came from. Mirrored by convex/events/item.ts, which re-validates every item on import.

export const placeInput = z.object({
  name: z.string().describe("The venue's public name, as on the listing"),
  address: z.string().describe("Street address with city, or an empty string if unknown"),
  osmId: z
    .string()
    .nullable()
    .describe('The OpenStreetMap ID from find_place, like "way/123456"; null if find_place found nothing'),
  lat: z.number().nullable().describe("Latitude from find_place; null if unknown"),
  lng: z.number().nullable().describe("Longitude from find_place; null if unknown"),
});

export const meetingSpotInput = z.object({
  name: z.string().describe('A short name, like "Bench left of the main doors"'),
  howToFind: z
    .string()
    .describe('One sentence a first-timer can follow, like "The bench left of the main doors on University Ave."'),
  lat: z.number().describe("Latitude confirmed with find_place"),
  lng: z.number().describe("Longitude confirmed with find_place"),
  osmId: z.string().nullable().describe("The spot's OpenStreetMap ID if find_place returned one"),
  isTransitStop: z.boolean().describe("True only for a BART or transit stop chosen because the trip is long"),
  travelMinutes: z
    .number()
    .int()
    .min(0)
    .max(120)
    .describe("Minutes from the transit stop to the venue; 0 unless isTransitStop"),
});

export const saveEventInput = z.object({
  title: z.string().min(1).describe("The event title as listed"),
  kind: z.enum(["concert", "game", "performance", "other"]),
  startsAt: z
    .string()
    .nullable()
    .describe('Start time in ISO 8601 with the local offset, like "2026-10-29T20:00:00-07:00"; null if not listed'),
  venue: placeInput,
  price: z.object({
    min: z.number().min(0).nullable().describe("Lowest ticket price in US dollars; 0 for free; null if not found"),
    max: z.number().min(0).nullable().describe("Highest ticket price in US dollars; null if not found"),
    source: z
      .enum(["listing", "ticket_page", "search", "not_found"])
      .describe("Where the price was found; not_found only after checking the listing, the ticket page, and a search"),
    sourceUrl: z.string().nullable().describe("The page the price came from; null if not_found"),
  }),
  ticketUrl: z.string().nullable().describe("The official ticket or RSVP link; null if none"),
  freeEntryNote: z.string().nullable().describe('A clear free entry note from the listing, like "Free, no tickets required"'),
  performers: z.array(z.string()).describe("Performers or teams, as listed"),
  tags: z.array(z.string()).describe("A few short genre or type tags taken from the listing"),
  ageLimit: z.number().int().nullable().describe("Minimum age if stated (18, 21); null for all ages or not stated"),
  meetingSpot: meetingSpotInput
    .nullable()
    .describe("A meeting spot, only for a venue not already given one in this run; otherwise null"),
  sourceUrl: z.string().url().describe("The listing page for this event"),
});

export type SaveEventInput = z.infer<typeof saveEventInput>;

export const SOURCE_KINDS = ["official_feed", "venue_site", "listing", "web"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type ScoutItem = SaveEventInput & {
  sourceName: string;
  sourceKind: SourceKind;
  scrapedAt: string;
};
