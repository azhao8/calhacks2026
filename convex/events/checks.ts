import type { Area } from "../lib/validators";
import { PLACES } from "../lib/config";
import { metersBetween } from "../lib/format";
import { AREAS, SOURCE_RANK } from "./config";
import type { ScoutItem } from "./item";

// Pure import rules (CLAUDE.md §6.1). No database or network here, so every rule is unit-tested directly.

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|live|presents)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeName(name: string): string {
  return normalizeTitle(name);
}

// The same venue, start time, and normalized title is one event.
export function dedupeKey(venueKey: string, startsAt: number, title: string): string {
  return `${venueKey}|${startsAt}|${normalizeTitle(title)}`;
}

const pacificDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: PLACES.timezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// "2026-10-29", in Pacific time whatever the server's timezone.
export function pacificDay(ms: number): string {
  return pacificDate.format(new Date(ms));
}

export function sourceRank(sourceKind: string): number {
  return SOURCE_RANK[sourceKind] ?? 0;
}

export function distanceFromCampus(point: { lat: number; lng: number }): number {
  return Math.round(metersBetween(PLACES.campus, point));
}

// The smallest area that contains the point, or null when it is outside all of them.
export function areaFor(point: { lat: number; lng: number }): Area | null {
  const meters = metersBetween(PLACES.campus, point);
  if (meters <= AREAS.campusMaxMeters) return "campus";
  const box = AREAS.berkeleyOaklandBox;
  if (point.lat >= box.minLat && point.lat <= box.maxLat && point.lng >= box.minLng && point.lng <= box.maxLng) {
    return "berkeley_oakland";
  }
  if (meters <= AREAS.bartMaxMeters) return "bart";
  return null;
}

export function parseStart(startsAt: string | null): number | null {
  if (startsAt === null) return null;
  // A date with no time ("2026-10-29") has no start time.
  if (!/T\d{2}:\d{2}/.test(startsAt)) return null;
  // Require an explicit offset so the server's timezone never shifts an event.
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(startsAt)) return null;
  const ms = Date.parse(startsAt);
  return Number.isNaN(ms) ? null : ms;
}

function isHttpUrl(value: string | null): boolean {
  if (value === null) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function looksAdultOnly(item: ScoutItem): boolean {
  if (item.ageLimit !== null && item.ageLimit >= 21) return true;
  const text = [item.title, ...item.tags, item.freeEntryNote ?? ""].join(" ").toLowerCase();
  return /\b21\s*\+|\b21 and (over|up)\b|\bages? 21\b/.test(text);
}

// Checks that need no venue lookup. Returns the reason shown on the admin page, or null when the item passes.
export function basicRejectReason(item: ScoutItem, now: number): string | null {
  const start = parseStart(item.startsAt);
  if (item.startsAt === null || !/^\d{4}-\d{2}-\d{2}/.test(item.startsAt)) return "No date";
  if (start === null) return "No start time";
  if (start <= now) return "Already started";
  if (looksAdultOnly(item)) return "21+ event";
  const hasTicket = isHttpUrl(item.ticketUrl);
  const hasFreeNote = (item.freeEntryNote ?? "").trim().length > 0;
  if (!hasTicket && !hasFreeNote) return "No official ticket or RSVP link and no free entry note";
  if (item.price.min !== null && item.price.max !== null && item.price.min > item.price.max) {
    return "Price range is inverted";
  }
  if (item.price.source === "not_found" && (item.price.min !== null || item.price.max !== null)) {
    return "Price has no recorded source";
  }
  return null;
}

// Prices are whole or cent amounts; "not found" stays null rather than being guessed.
export function priceFields(item: ScoutItem): {
  priceMin: number | null;
  priceMax: number | null;
  priceSource: string;
} {
  if (item.price.source === "not_found") return { priceMin: null, priceMax: null, priceSource: "not_found" };
  const min = item.price.min ?? item.price.max;
  const max = item.price.max ?? item.price.min;
  const where = item.price.sourceUrl ? `${item.price.source} ${item.price.sourceUrl}` : item.price.source;
  return { priceMin: min, priceMax: max, priceSource: where };
}

// The text embedded for an event: title, performers, kind, and tags (§6.3).
export function eventDocument(event: { title: string; performers: string[]; kind: string; tags: string[] }): string {
  const parts = [event.title];
  if (event.performers.length > 0) parts.push(`Performers: ${event.performers.join(", ")}`);
  parts.push(`Kind: ${event.kind}`);
  if (event.tags.length > 0) parts.push(`Tags: ${event.tags.join(", ")}`);
  return parts.join("\n");
}

export function cleanList(values: string[], max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim().slice(0, 120);
    const key = value.toLowerCase();
    if (value.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}
