import { describe, expect, test } from "vitest";
import {
  areaFor,
  cleanNote,
  isHttpUrl,
  placeMatches,
  titlesOverlap,
  sameShowTitles,
  looksLikeAddress,
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
    const looked = item({ price: { min: null, max: null, source: "not_found", checked: ["listing", "ticket_page", "search"] } });
    expect(priceFields(looked).priceSource).toBe("not_found (checked listing, ticket_page, search)");
    expect(basicRejectReason(item({ price: { min: 10, max: 10, source: "not_found" } }), NOW)).toBe(
      "Price has no recorded source",
    );
    expect(priceFields(item({ price: { min: 15, max: null, source: "ticket_page", sourceUrl: "https://x.test" } }))).toEqual({
      priceMin: 15,
      priceMax: null,
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

describe("review fixes", () => {
  test("a summer offset after the November clock change is corrected to the listed wall-clock time", () => {
    // Nov 5, 8 pm Pacific is 04:00Z on Nov 6 (PST, -08:00).
    const correct = Date.parse("2026-11-06T04:00:00Z");
    expect(parseStart("2026-11-05T20:00:00-08:00")).toBe(correct);
    expect(parseStart("2026-11-05T20:00:00-07:00")).toBe(correct);
    // And a winter offset in October.
    expect(parseStart("2026-10-29T20:00:00-08:00")).toBe(Date.parse("2026-10-30T03:00:00Z"));
    // UTC and other offsets are true instants.
    expect(parseStart("2026-11-21T20:30:00Z")).toBe(Date.parse("2026-11-21T20:30:00Z"));
    expect(parseStart("2026-11-21T15:30:00-05:00")).toBe(Date.parse("2026-11-21T20:30:00Z"));
  });

  test("more ways of writing 21+", () => {
    for (const tag of ["21 and older", "21 &amp; over", "Over 21 only", "21 and up", "21 & over"]) {
      expect(basicRejectReason(item({ tags: [tag] }), NOW)).toBe("21+ event");
    }
    expect(basicRejectReason(item({ tags: ["all ages"] }), NOW)).toBeNull();
  });

  test("only http(s) links count, and free entry notes stay short and plain", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("https://tickets.test")).toBe(true);
    expect(basicRejectReason(item({ ticketUrl: "javascript:alert(1)" }), NOW)).toBe(
      "No official ticket or RSVP link and no free entry note",
    );
    expect(cleanNote("<b>Free</b>\n entry")).toBe("Free entry");
    expect(cleanNote("   ")).toBeUndefined();
    expect(cleanNote("x".repeat(500))?.length).toBe(160);
  });

  test("a map result must match the venue's name and city", () => {
    const scraped = { name: "Starry Plough", address: "3101 Shattuck Ave, Berkeley, CA" };
    expect(placeMatches(scraped, { name: "Berkeley Rep Peet's Theatre", address: "2025 Addison St, Berkeley" })).toBe(false);
    expect(placeMatches(scraped, { name: "The Starry Plough Pub", address: "3101, Shattuck Avenue, Berkeley, CA" })).toBe(true);
    expect(placeMatches(scraped, { name: "Starry Plough", address: "Dublin, Ireland" })).toBe(false);
    expect(placeMatches({ name: "Fox Theater", address: "" }, { name: "Fox Theater", address: "Oakland" })).toBe(true);
  });

  test("same-show titles: the Iestyn Davies pair, and unrelated shows stay apart", () => {
    const a = normalizeTitle("Iestyn Davies, countertenor; Oliver Wass, harp");
    const b = normalizeTitle("Iestyn Davies, countertenor Oliver Wass, Baroque triple lever harp and modern harp");
    expect(sameShowTitles(a, b)).toBe(true);
    expect(sameShowTitles(normalizeTitle("Big Thief"), normalizeTitle("Khruangbin"))).toBe(false);
    expect(sameShowTitles(normalizeTitle("Jazz night"), normalizeTitle("Folk night"))).toBe(false);
    expect(looksLikeAddress("2121 Allston Way")).toBe(true);
    expect(looksLikeAddress("The UC Theatre")).toBe(false);
  });

  test("titles overlap only on whole words", () => {
    expect(titlesOverlap(normalizeTitle("Yo-Yo Ma"), normalizeTitle("Cal Performances presents Yo-Yo Ma, cello"))).toBe(true);
    expect(titlesOverlap("art", "party night")).toBe(false);
  });
});
