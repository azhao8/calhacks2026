import { describe, expect, test } from "vitest";
import {
  areaFor,
  basicRejectReason,
  dedupeKey,
  eventDocument,
  normalizeTitle,
  pacificDay,
  parseStart,
  priceFields,
} from "./checks";
import { scoutItem, type ScoutItem } from "./item";

const NOW = Date.parse("2026-10-25T12:00:00-07:00");

function item(overrides: Record<string, unknown> = {}): ScoutItem {
  return scoutItem.parse({
    title: "Big Thief",
    kind: "concert",
    startsAt: "2026-10-29T20:00:00-07:00",
    venue: { name: "The UC Theatre", address: "2036 University Ave, Berkeley", osmId: "way/1", lat: 37.8716, lng: -122.2707 },
    price: { min: 22, max: 30, source: "listing", sourceUrl: null },
    ticketUrl: "https://theuctheatre.org/events/big-thief",
    ageLimit: null,
    sourceName: "uc_theatre",
    sourceKind: "venue_site",
    sourceUrl: "https://theuctheatre.org/events/big-thief",
    ...overrides,
  });
}

describe("import checks", () => {
  test("a complete listing passes", () => {
    expect(basicRejectReason(item(), NOW)).toBeNull();
  });

  test("each rule gives its own reason", () => {
    expect(basicRejectReason(item({ startsAt: null }), NOW)).toBe("No date");
    expect(basicRejectReason(item({ startsAt: "2026-10-29" }), NOW)).toBe("No start time");
    expect(basicRejectReason(item({ startsAt: "2026-10-29T20:00:00" }), NOW)).toBe("No start time");
    expect(basicRejectReason(item({ startsAt: "2026-10-20T20:00:00-07:00" }), NOW)).toBe("Already started");
    expect(basicRejectReason(item({ ageLimit: 21 }), NOW)).toBe("21+ event");
    expect(basicRejectReason(item({ tags: ["21+"] }), NOW)).toBe("21+ event");
    expect(basicRejectReason(item({ ticketUrl: null }), NOW)).toBe(
      "No official ticket or RSVP link and no free entry note",
    );
    expect(basicRejectReason(item({ ticketUrl: null, freeEntryNote: "Free, no RSVP needed" }), NOW)).toBeNull();
    expect(basicRejectReason(item({ ageLimit: 18 }), NOW)).toBeNull();
  });

  test("a price nobody found stays unknown", () => {
    const unknown = item({ price: { min: null, max: null, source: "not_found" } });
    expect(priceFields(unknown)).toEqual({ priceMin: null, priceMax: null, priceSource: "not_found" });
    expect(basicRejectReason(item({ price: { min: 10, max: 10, source: "not_found" } }), NOW)).toBe(
      "Price has no recorded source",
    );
    expect(priceFields(item({ price: { min: 15, max: null, source: "ticket_page", sourceUrl: "https://x.test" } }))).toEqual({
      priceMin: 15,
      priceMax: 15,
      priceSource: "ticket_page https://x.test",
    });
  });
});

describe("areas", () => {
  test("campus, Berkeley and Oakland, BART, and outside", () => {
    expect(areaFor({ lat: 37.8716, lng: -122.2707 })).toBe("campus"); // The UC Theatre
    expect(areaFor({ lat: 37.808, lng: -122.2703 })).toBe("berkeley_oakland"); // Fox Theater
    expect(areaFor({ lat: 37.7786, lng: -122.4193 })).toBe("bart"); // San Francisco
    expect(areaFor({ lat: 34.0522, lng: -118.2437 })).toBeNull(); // Los Angeles
  });
});

describe("dedupe keys", () => {
  test("titles normalize so the same show matches", () => {
    expect(normalizeTitle("Big Thief — LIVE at The UC Theatre!")).toBe(normalizeTitle("big thief at uc theatre"));
    expect(dedupeKey("v1", 1, "Cal vs. Stanford")).toBe(dedupeKey("v1", 1, "CAL VS STANFORD"));
    expect(dedupeKey("v1", 1, "Cal vs. Stanford")).not.toBe(dedupeKey("v1", 2, "Cal vs. Stanford"));
  });

  test("Pacific dates ignore the server timezone", () => {
    expect(pacificDay(Date.parse("2026-10-30T02:30:00Z"))).toBe("2026-10-29");
    expect(parseStart("2026-10-29T20:00:00-07:00")).toBe(Date.parse("2026-10-30T03:00:00Z"));
  });

  test("the embedded document holds title, performers, kind, and tags", () => {
    expect(eventDocument({ title: "Folk night", performers: ["A", "B"], kind: "concert", tags: ["folk"] })).toBe(
      "Folk night\nPerformers: A, B\nKind: concert\nTags: folk",
    );
  });
});
