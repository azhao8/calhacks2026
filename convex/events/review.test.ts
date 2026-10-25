/// <reference types="vite/client" />
// The PR #10 review probes, kept as regression tests.
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const apify = vi.hoisted(() => ({ items: [] as unknown[], summary: null as unknown }));
vi.mock("../services/apify", () => ({
  getRun: vi.fn(async (id: string) => ({ id, status: "SUCCEEDED", defaultDatasetId: `ds-${id}`, defaultKeyValueStoreId: `kv-${id}` })),
  listDatasetItems: vi.fn(async () => apify.items),
  getRecord: vi.fn(async () => apify.summary),
  startRun: vi.fn(async () => ({ id: "newrun", status: "READY", defaultDatasetId: "d", defaultKeyValueStoreId: "k" })),
  scoutActorId: () => "test~scout",
}));
const geocode = vi.hoisted(() => ({ searchPlaces: vi.fn() }));
vi.mock("../services/geocode", () => geocode);
const pool = vi.hoisted(() => ({ enqueueAction: vi.fn(async () => "work1") }));
vi.mock("./pool", () => ({ importPool: pool, IMPORT_RETRY: {} }));
const voyage = vi.hoisted(() => ({ embed: vi.fn() }));
vi.mock("../services/voyage", () => voyage);

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../**/*.ts")).map(([path, load]) => [
    path.startsWith("./") ? `../events/${path.slice(2)}` : path,
    load,
  ]),
);

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
function iso(ms: number): string {
  return new Date(ms - 7 * HOUR).toISOString().replace(/\.\d{3}Z$/, "-07:00");
}
const UC_THEATRE = { name: "The UC Theatre", address: "2036 University Ave, Berkeley, CA", osmId: "way/111", lat: 37.8716, lng: -122.2707 };

function scoutItem(overrides: Record<string, unknown> = {}) {
  return {
    title: "Big Thief",
    kind: "concert",
    startsAt: iso(Date.now() + 3 * DAY),
    venue: UC_THEATRE,
    price: { min: 22, max: 30, source: "listing", sourceUrl: null },
    ticketUrl: "https://theuctheatre.org/events/big-thief",
    freeEntryNote: null,
    performers: ["Big Thief"],
    tags: ["indie folk"],
    ageLimit: null,
    meetingSpot: null,
    sourceName: "uc_theatre",
    sourceKind: "venue_site",
    sourceUrl: "https://theuctheatre.org/events/big-thief",
    ...overrides,
  };
}

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.run, {});
  return t;
}
type T = Awaited<ReturnType<typeof setup>>;

async function importRun(t: T, runId: string, items: unknown[], summary: unknown = null) {
  apify.items = items;
  apify.summary = summary;
  const importId = await t.run((ctx) =>
    ctx.db.insert("eventImports", {
      apifyRunId: runId,
      receivedAt: Date.now(),
      status: "received",
      counts: { received: 0, published: 0, updated: 0, rejected: 0, duplicates: 0 },
      errors: [],
    }),
  );
  await t.action(internal.events.imports.run, { importId, apifyRunId: runId });
  return (await t.run((ctx) => ctx.db.get(importId)))!;
}

async function allEvents(t: T) {
  return await t.run((ctx) => ctx.db.query("events").collect());
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T19:00:00Z"));
  geocode.searchPlaces.mockReset();
  geocode.searchPlaces.mockResolvedValue([]);
  voyage.embed.mockReset();
  voyage.embed.mockImplementation(async (texts: string[]) => texts.map(() => new Array(1024).fill(0.01)));
});
afterEach(() => vi.useRealTimers());

describe("probe: dedupe merges distinct performances", () => {
  test("a two-night stand listed under one URL", async () => {
    const t = await setup();
    const start = Date.now() + 3 * DAY;
    const url = "https://theuctheatre.org/events/";
    await importRun(t, "runM", [
      scoutItem({ title: "Khruangbin", startsAt: iso(start), sourceUrl: url }),
      scoutItem({ title: "Khruangbin", startsAt: iso(start + DAY), sourceUrl: url }),
    ]);
    const rows = (await allEvents(t)).filter((e) => e.title === "Khruangbin");
    
    expect(rows).toHaveLength(2);
  });

  test("early and late shows the same night with their own URLs", async () => {
    const t = await setup();
    const start = Date.now() + 3 * DAY;
    await importRun(t, "runEL", [
      scoutItem({ title: "Ali Wong", startsAt: iso(start), sourceUrl: "https://theuctheatre.org/events/ali-7pm" }),
      scoutItem({ title: "Ali Wong", startsAt: iso(start + 2.5 * HOUR), sourceUrl: "https://theuctheatre.org/events/ali-930pm" }),
    ]);
    const rows = (await allEvents(t)).filter((e) => e.title === "Ali Wong");
    
    expect(rows).toHaveLength(2);
  });
});

describe("probe: 21+ from the official source", () => {
  const eventbrite = { sourceName: "eventbrite", sourceKind: "listing", sourceUrl: "https://www.eventbrite.com/e/dj-night-1", ticketUrl: "https://www.eventbrite.com/e/dj-night-1" };

  test("venue site says 21+, then a weaker listing without an age", async () => {
    const t = await setup();
    const start = Date.now() + 2 * DAY;
    await importRun(t, "run21a", [
      scoutItem({ title: "DJ Night", startsAt: iso(start), ageLimit: 21, sourceUrl: "https://theuctheatre.org/events/dj" }),
      scoutItem({ title: "DJ Night", startsAt: iso(start), ...eventbrite }),
    ]);
    const published = (await allEvents(t)).filter((e) => e.title === "DJ Night" && e.status === "published");
    
    expect(published).toHaveLength(0);
  });

  test("published first, then the official source says 21+", async () => {
    const t = await setup();
    const start = Date.now() + 2 * DAY;
    await importRun(t, "run21b", [scoutItem({ title: "DJ Night", startsAt: iso(start), sourceUrl: "https://theuctheatre.org/events/dj" })]);
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "run21c", [scoutItem({ title: "DJ Night", startsAt: iso(start), ageLimit: 21, sourceUrl: "https://theuctheatre.org/events/dj" })]);
    const rows = (await allEvents(t)).filter((e) => e.title === "DJ Night");
    
    expect(rows.filter((e) => e.status === "published")).toHaveLength(0);
  });
});

describe("probe: team edits", () => {
  test("a team fix to the start time and ticket link survives the next import", async () => {
    const t = await setup();
    const start = Date.now() + 3 * DAY;
    await importRun(t, "runE1", [scoutItem({ startsAt: iso(start) })]);
    const [event] = await allEvents(t);
    await t.mutation(internal.events.admin.edit, {
      eventId: event._id,
      patch: { startsAt: start + HOUR, ticketUrl: "https://www.ticketmaster.com/real" },
      editedBy: "nick",
    });
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "runE2", [scoutItem({ startsAt: iso(start) })]);
    const after = (await t.run((ctx) => ctx.db.get(event._id)))!;
    
    expect(after.startsAt).toBe(start + HOUR);
  });
});

describe("probe: missing flags", () => {
  test("one miss, then a run where that source didn't run, is not 'two runs in a row'", async () => {
    const t = await setup();
    const uc = { sources: [{ name: "uc_theatre", kind: "venue_site", status: "succeeded" }] };
    const other = scoutItem({ title: "Folk night", startsAt: iso(Date.now() + 4 * DAY), sourceUrl: "https://theuctheatre.org/events/folk" });
    await importRun(t, "r1", [scoutItem(), other], uc);
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "r2", [scoutItem()], uc); // Folk night missed once
    vi.setSystemTime(Date.now() + 60_000);
    // A "Find events now" run for Eventbrite only: the UC Theatre source didn't run at all.
    const eb = { sources: [{ name: "eventbrite", kind: "listing", status: "succeeded" }] };
    await importRun(t, "r3", [scoutItem({ title: "Other show", sourceName: "eventbrite", sourceKind: "listing", sourceUrl: "https://www.eventbrite.com/e/2", venue: { ...UC_THEATRE } })], eb);
    const folk = (await t.query(internal.events.admin.list, {})).find((e) => e.title === "Folk night")!;
    
    expect(folk.flaggedMissing).toBe(false);
  });
});

describe("probe: validation gaps", () => {
  test("a non-http ticket link with a free entry note is stored", async () => {
    const t = await setup();
    await importRun(t, "runJ", [scoutItem({ ticketUrl: "javascript:alert(document.cookie)", freeEntryNote: "Free", price: { min: 0, max: 0, source: "listing", sourceUrl: null } })]);
    const [event] = await allEvents(t);
    
    expect(event.ticketUrl?.startsWith("https://") ?? true).toBe(true);
  });

  test("a 'transit stop' 20 km from the venue becomes its meeting spot", async () => {
    const t = await setup();
    const result = await t.mutation(internal.events.venues.resolve, {
      ...UC_THEATRE,
      spot: { name: "Somewhere far", howToFind: "Far away.", lat: 37.69, lng: -122.2, osmId: null, isTransitStop: true, travelMinutes: 0 },
      now: Date.now(),
    });
    const venue = await t.run((ctx) => ctx.db.get((result as { venueId: Id<"venues"> }).venueId));
    const spot = await t.run((ctx) => ctx.db.get(venue!.meetingSpotId!));
    
    expect(spot?.name).not.toBe("Somewhere far");
  });

  test("a venue the scout couldn't find takes the map's first hit under the scraped name", async () => {
    const t = await setup();
    geocode.searchPlaces.mockResolvedValue([{ osmId: "node/42", name: "Berkeley Rep Peet's Theatre", address: "2025 Addison St, Berkeley", lat: 37.8706, lng: -122.2690 }]);
    await importRun(t, "runG", [scoutItem({ title: "Open mic", venue: { name: "Starry Plough", address: "", osmId: null, lat: null, lng: null } })]);
    const events = await allEvents(t);
    
    expect(events[0].status).not.toBe("published");
  });
});

describe("probe: extra", () => {
  test("a stronger source after a weaker one takes over", async () => {
    const t = await setup();
    const start = Date.now() + 3 * DAY;
    await importRun(t, "runS", [
      scoutItem({ startsAt: iso(start), sourceName: "eventbrite", sourceKind: "listing", sourceUrl: "https://www.eventbrite.com/e/9", ticketUrl: "https://www.eventbrite.com/e/9", price: { min: 30, max: 30, source: "listing", sourceUrl: null } }),
      scoutItem({ startsAt: iso(start) }),
    ]);
    const rows = await allEvents(t);
    
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceName).toBe("venue_site:uc_theatre");
  });

  test("the campus calendar and the venue site describe one show with slightly different titles", async () => {
    const t = await setup();
    const start = Date.now() + 3 * DAY;
    await importRun(t, "runD", [
      scoutItem({ title: "Yo-Yo Ma", startsAt: iso(start), sourceName: "cal_performances", sourceUrl: "https://calperformances.org/events/yo-yo-ma" }),
      scoutItem({ title: "Cal Performances presents Yo-Yo Ma, cello", startsAt: iso(start), sourceName: "uc_berkeley_events", sourceUrl: "https://events.berkeley.edu/e/123" }),
    ]);
    const rows = (await allEvents(t)).filter((e) => e.status === "published");
    
    expect(rows).toHaveLength(1);
  });

  test("main-entrance copy when the venue address is a map display name", async () => {
    const t = await setup();
    const r = await t.mutation(internal.events.venues.resolve, {
      osmId: "way/222", name: "Fox Theater", address: "Fox Theater, 1807, Telegraph Avenue, Uptown, Oakland, Alameda County, California, 94612, United States",
      lat: 37.808, lng: -122.2703, spot: null, now: Date.now(),
    });
    const venue = await t.run((ctx) => ctx.db.get((r as { venueId: Id<"venues"> }).venueId));
    const spot = await t.run((ctx) => ctx.db.get(venue!.meetingSpotId!));
    
    expect(spot?.howToFind).not.toContain("Fox Theater, Fox Theater");
  });
});
