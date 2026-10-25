import { describe, expect, test } from "vitest";
import { crawlDelayMs, PoliteFetcher } from "../src/fetcher.js";
import { Geocoder } from "../src/geo.js";
import type { SaveEventInput } from "../src/schema.js";
import { selectSources } from "../src/sources.js";
import { htmlToText, plainToText } from "../src/text.js";
import { checkEvent, RunState } from "../src/tools.js";
import { FOX_SEARCH, stubWebFetch } from "./helpers.js";

const window = { from: Date.parse("2026-10-25T00:00:00-07:00"), to: Date.parse("2026-11-08T00:00:00-08:00") };

function event(overrides: Partial<SaveEventInput> = {}): SaveEventInput {
  return {
    title: "Khruangbin",
    kind: "concert",
    startsAt: "2026-10-30T20:00:00-07:00",
    venue: { name: "Fox Theater", address: "Oakland", osmId: "way/222", lat: 37.808, lng: -122.2703 },
    price: { min: 45, max: 89, source: "listing", sourceUrl: null },
    ticketUrl: "https://tickets.test/k",
    freeEntryNote: null,
    performers: [],
    tags: [],
    ageLimit: null,
    meetingSpot: null,
    sourceUrl: "https://thefoxoakland.com/events/k",
    ...overrides,
  };
}

function runWithFox(): RunState {
  const run = new RunState();
  run.confirmedPlaces.set("way/222", { osmId: "way/222", name: "Fox Theater", address: "", lat: 37.808, lng: -122.2703, category: "" });
  run.confirmedPlaces.set("node/9", { osmId: "node/9", name: "Fox Theater marquee", address: "", lat: 37.8082, lng: -122.2702, category: "" });
  run.confirmedPlaces.set("node/10", { osmId: "node/10", name: "Lake Merritt", address: "", lat: 37.8015, lng: -122.2573, category: "" });
  return run;
}

describe("save_event checks", () => {
  test("a complete event passes", () => {
    expect(checkEvent(event(), { run: runWithFox(), window })).toBeNull();
  });

  test("times need an offset and must fall in the window", () => {
    const run = runWithFox();
    expect(checkEvent(event({ startsAt: "2026-10-30T20:00:00" }), { run, window })).toMatch(/offset/);
    expect(checkEvent(event({ startsAt: "2026-12-30T20:00:00-08:00" }), { run, window })).toMatch(/outside the date range/);
    expect(checkEvent(event({ startsAt: null }), { run, window })).toBeNull();
  });

  test("prices are found with a source or explicitly not found", () => {
    const run = runWithFox();
    expect(checkEvent(event({ price: { min: 10, max: null, source: "not_found", sourceUrl: null } }), { run, window })).toMatch(/not_found/);
    expect(checkEvent(event({ price: { min: null, max: null, source: "listing", sourceUrl: null } }), { run, window })).toMatch(/needs min or max/);
    expect(checkEvent(event({ price: { min: null, max: null, source: "not_found", sourceUrl: null } }), { run, window })).toBeNull();
  });

  test("venues and spots must come from the map", () => {
    const run = runWithFox();
    expect(checkEvent(event({ venue: { name: "Fox", address: "", osmId: "way/999", lat: 1, lng: 1 } }), { run, window })).toMatch(/find_place/);
    const spot = { name: "Marquee", howToFind: "Under the marquee on Telegraph Ave.", lat: 37.8082, lng: -122.2702, osmId: "node/9", isTransitStop: false, travelMinutes: 0 };
    expect(checkEvent(event({ meetingSpot: spot }), { run, window })).toBeNull();
    expect(checkEvent(event({ meetingSpot: { ...spot, lat: 37.9, lng: -122.3 } }), { run, window })).toMatch(/confirmed on the map/);
    // Lake Merritt is confirmed but about 1.3 km away.
    expect(checkEvent(event({ meetingSpot: { ...spot, lat: 37.8015, lng: -122.2573 } }), { run, window })).toMatch(/within 250 m/);
    expect(checkEvent(event({ meetingSpot: { ...spot, lat: 37.8015, lng: -122.2573, isTransitStop: true, travelMinutes: 12 } }), { run, window })).toBeNull();
  });
});

describe("pages", () => {
  test("HTML becomes text, links, and any JSON-LD event data", () => {
    const html = `<html><head><title>Shows</title><script>alert(1)</script>
      <script type="application/ld+json">{"@type":"MusicEvent","startDate":"2026-10-30T20:00-07:00"}</script></head>
      <body><nav>Menu</nav><main><h2>Khruangbin</h2><p>Oct 30 · 8 pm</p><a href="/events/k">Tickets</a></main></body></html>`;
    const page = htmlToText(html, "https://thefoxoakland.com/events/", 10);
    expect(page.title).toBe("Shows");
    expect(page.text).toContain("Khruangbin");
    expect(page.text).not.toContain("alert(1)");
    expect(page.text).toContain('"startDate":"2026-10-30T20:00-07:00"');
    expect(page.links).toEqual([{ text: "Tickets", url: "https://thefoxoakland.com/events/k" }]);
  });

  test("ICS feeds unfold and drop noise", () => {
    const ics = "BEGIN:VEVENT\r\nUID:123\r\nSUMMARY:Football vs. Stanford\r\n  (Big Game)\r\nDTSTART:20261121T203000Z\r\nEND:VEVENT";
    const page = plainToText(ics, "https://calbears.com/calendar.ics");
    expect(page.text).toContain("SUMMARY:Football vs. Stanford (Big Game)");
    expect(page.text).not.toContain("UID");
  });

  test("robots rules and crawl delays are respected", async () => {
    expect(crawlDelayMs("User-agent: *\nCrawl-delay: 5\n")).toBe(5000);
    expect(crawlDelayMs("User-agent: MelosEventScout\nCrawl-delay: 2\nUser-agent: *\nCrawl-delay: 9")).toBe(2000);
    const calls: string[] = [];
    const fetcher = new PoliteFetcher(
      async () => undefined,
      stubWebFetch({
        calls,
        robots: { "https://venue.test": "User-agent: *\nDisallow: /private\nCrawl-delay: 0" },
        pages: { "https://venue.test/shows": { body: "<html><body><main>Show</main></body></html>" }, "https://venue.test/blocked": { status: 403, body: "no" } },
      }),
    );
    expect(await fetcher.read("https://venue.test/private/x")).toEqual({ ok: false, error: "robots.txt disallows this page; skip it" });
    const ok = await fetcher.read("https://venue.test/shows");
    expect(ok.ok && ok.page.text).toBe("Show");
    // A blocked page needs Apify Proxy; without one, the tool says so instead of failing the run.
    expect(await fetcher.read("https://venue.test/blocked")).toEqual({ ok: false, error: "The page blocks plain requests and no proxy is available" });
    expect(calls.filter((url) => url.endsWith("/robots.txt"))).toHaveLength(1);
  });
});

describe("find_place", () => {
  test("throttles to one request at a time and caches results", async () => {
    const calls: string[] = [];
    const stored = new Map<string, unknown>();
    const geocoder = new Geocoder(
      { get: async (k) => (stored.get(k) as never) ?? null, set: async (k, v) => void stored.set(k, v) },
      stubWebFetch({ calls, nominatim: FOX_SEARCH }),
      50,
    );
    const started = Date.now();
    const [a, b] = await Promise.all([geocoder.search("Fox Theater, Oakland"), geocoder.search("Fox Oakland")]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
    expect(a[0]).toMatchObject({ osmId: "way/222", lat: 37.808, lng: -122.2703 });
    expect(b).toHaveLength(1);
    await geocoder.search("Fox Theater, Oakland");
    expect(calls).toHaveLength(2);
    // A fresh geocoder reads the shared cache instead of the map.
    const again = new Geocoder({ get: async (k) => (stored.get(k) as never) ?? null, set: async () => {} }, stubWebFetch({ calls }), 0);
    await again.search("fox theater, oakland");
    expect(calls).toHaveLength(2);
  });
});

describe("sources", () => {
  test("presets by ID plus custom listing pages", () => {
    const chosen = selectSources(["uc_theatre", "web"], [{ name: "Ashkenaz", url: "https://ashkenaz.com/calendar" }]);
    expect(chosen.map((s) => s.id)).toEqual(["uc_theatre", "web", "ashkenaz"]);
    expect(selectSources(undefined, undefined).length).toBeGreaterThanOrEqual(9);
  });
});
