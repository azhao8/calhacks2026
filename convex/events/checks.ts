import type { Area } from "../lib/validators";
import { PLACES } from "../lib/config";
import { metersBetween } from "../lib/format";
import { ADULT_REASON, AREAS, SOURCE_RANK } from "./config";
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

const laParts = new Intl.DateTimeFormat("en-US", {
  timeZone: PLACES.timezone,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// Pacific time's UTC offset in minutes at an instant (-420 in summer, -480 in winter).
export function pacificOffsetMinutes(ms: number): number {
  const parts = Object.fromEntries(laParts.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

const START = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|([+-])(\d{2}):?(\d{2}))$/;

// The instant an event starts. Requires a time and an explicit offset, so the server's timezone never shifts an
// event. A Pacific offset (-07:00 or -08:00) that is wrong for that date, such as a summer offset after the
// November clock change, is corrected: the listed wall-clock time is what the venue means.
export function parseStart(startsAt: string | null): number | null {
  if (startsAt === null) return null;
  const m = START.exec(startsAt.trim());
  if (m === null) return null;
  const [, y, mo, d, h, mi, s, zone, sign, oh, om] = m;
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  if (Number.isNaN(wall)) return null;
  if (zone === "Z") return wall;
  const given = (sign === "-" ? -1 : 1) * (+oh * 60 + +om);
  if (given !== -420 && given !== -480) return wall - given * 60000;
  for (const offset of [given, given === -420 ? -480 : -420]) {
    const instant = wall - offset * 60000;
    if (pacificOffsetMinutes(instant) === offset) return instant;
  }
  // A wall-clock time that doesn't exist in Pacific time (inside the spring-forward gap).
  return null;
}

export function titlesOverlap(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && ` ${long} `.includes(` ${short} `);
}

export function isHttpUrl(value: string | null | undefined): value is string {
  if (value === null || value === undefined) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function looksAdultOnly(item: ScoutItem): boolean {
  if (item.ageLimit !== null && item.ageLimit >= 21) return true;
  const text = [item.title, ...item.tags, item.freeEntryNote ?? ""]
    .join(" ")
    .toLowerCase()
    .replace(/&amp;/g, "&");
  return /\b21\s*\+|\b21\s*(and|&)\s*(over|up|older)\b|\bover\s*21\b|\bages?\s*21\b|\b21\s*(years?\s*)?(of age\s*)?or older\b/.test(text);
}

// Checks that need no venue lookup. Returns the reason shown on the admin page, or null when the item passes.
export function basicRejectReason(item: ScoutItem, now: number): string | null {
  const start = parseStart(item.startsAt);
  if (item.startsAt === null || !/^\d{4}-\d{2}-\d{2}/.test(item.startsAt)) return "No date";
  if (start === null) return "No start time";
  if (start <= now) return "Already started";
  if (looksAdultOnly(item)) return ADULT_REASON;
  const hasTicket = isHttpUrl(item.ticketUrl);
  const hasFreeNote = cleanNote(item.freeEntryNote) !== undefined;
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
  if (item.price.source === "not_found") {
    const checked = item.price.checked.length > 0 ? ` (checked ${item.price.checked.join(", ")})` : "";
    return { priceMin: null, priceMax: null, priceSource: `not_found${checked}` };
  }
  // Stored as listed: "From $15" keeps the maximum unknown (null); a single price has min equal to max.
  const min = item.price.min;
  const max = item.price.max;
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

// A short plain free-entry note, or undefined when there is none.
export function cleanNote(note: string | null | undefined): string | undefined {
  if (!note) return undefined;
  const text = note
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return text.length > 0 ? text : undefined;
}

// The city part of a scraped address: "2036 University Ave, Berkeley, CA" gives "berkeley".
export function cityOf(address: string): string | null {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 2 && !/\d/.test(part) && !/^(ca|california|usa|united states)$/i.test(part));
  return parts.length > 0 ? parts[parts.length - 1].toLowerCase() : null;
}

// A map result counts only if its name matches the scraped name and, when the scrape gives a city, it is there.
export function placeMatches(
  scraped: { name: string; address: string },
  candidate: { name: string; address: string },
): boolean {
  const a = normalizeName(scraped.name);
  const b = normalizeName(candidate.name);
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  const shared = [...tokensA].filter((token) => tokensB.has(token)).length;
  const jaccard = shared / Math.max(1, new Set([...tokensA, ...tokensB]).size);
  const nameOk = titlesOverlap(a, b) || jaccard >= 0.5;
  const city = cityOf(scraped.address);
  const cityOk = city === null || candidate.address.toLowerCase().includes(city);
  return nameOk && cityOk;
}
