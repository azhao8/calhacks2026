import { z } from "zod";

// One dataset item from the event scout, in the `save_event` format (CLAUDE.md §7).
// Mirrors apify/src/schema.ts; the import re-validates every item because the dataset is outside input.

export const scoutPlace = z.object({
  name: z.string().min(1),
  address: z.string().default(""),
  // OpenStreetMap ID from the map lookup, e.g. "way/123456". Missing when the scout couldn't confirm one.
  osmId: z.string().regex(/^(node|way|relation)\/\d+$/).nullable().default(null),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
});

export const scoutMeetingSpot = z.object({
  name: z.string().min(1),
  howToFind: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  osmId: z.string().nullable().default(null),
  isTransitStop: z.boolean().default(false),
  // Extra minutes before the usual 30, for a transit stop on a long trip.
  travelMinutes: z.number().int().min(0).max(120).default(0),
});

export const scoutItem = z.object({
  title: z.string().min(1),
  kind: z.enum(["concert", "game", "performance", "other"]),
  // ISO 8601 with an offset, e.g. "2026-10-29T20:00:00-07:00". Null when the listing shows no start time.
  startsAt: z.string().nullable(),
  venue: scoutPlace,
  price: z.object({
    min: z.number().min(0).nullable(),
    max: z.number().min(0).nullable(),
    // Where the price was found, or "not_found" after checking the listing, the ticket page, and a search.
    source: z.enum(["listing", "ticket_page", "search", "not_found"]),
    sourceUrl: z.string().nullable().default(null),
    // Where the scout looked, e.g. ["listing", "ticket_page", "search"]; recorded when nothing was found.
    checked: z.array(z.string()).default([]),
  }),
  // Checked on import: only an http(s) link counts as a ticket or RSVP link.
  ticketUrl: z.string().nullable(),
  freeEntryNote: z.string().nullable().default(null),
  performers: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  // Minimum age, e.g. 21 or 18; null for all ages or not stated.
  ageLimit: z.number().int().nullable(),
  meetingSpot: scoutMeetingSpot.nullable().default(null),
  sourceName: z.string().min(1),
  sourceKind: z.enum(["official_feed", "venue_site", "listing", "web"]),
  sourceUrl: z.string().url(),
  scrapedAt: z.string().optional(),
});

export type ScoutItem = z.infer<typeof scoutItem>;
export type ScoutMeetingSpot = z.infer<typeof scoutMeetingSpot>;
