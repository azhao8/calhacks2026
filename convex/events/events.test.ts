/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { httpRouter } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { apifyWebhook, SECRET_HEADER } from "./webhook";
import { PULLED_REASON } from "./config";

// Outside services are mocked at their convex/services seams.
const apify = vi.hoisted(() => ({
  items: [] as unknown[],
  summary: null as unknown,
}));
vi.mock("../services/apify", () => ({
  getRun: vi.fn(async (id: string) => ({ id, status: "SUCCEEDED", defaultDatasetId: `ds-${id}`, defaultKeyValueStoreId: `kv-${id}` })),
  listDatasetItems: vi.fn(async () => apify.items),
  getRecord: vi.fn(async () => apify.summary),
  startRun: vi.fn(async () => ({ id: "newrun", status: "READY", defaultDatasetId: "d", defaultKeyValueStoreId: "k" })),
  scoutActorId: () => "test~scout",
}));
const geocode = vi.hoisted(() => ({ searchPlaces: vi.fn() }));
vi.mock("../services/geocode", () => geocode);
// The syncPool itself is a component; here we only check that the import is enqueued once.
const pool = vi.hoisted(() => ({ enqueueAction: vi.fn(async () => "work1") }));
vi.mock("./pool", () => ({ importPool: pool, IMPORT_RETRY: {} }));
const voyage = vi.hoisted(() => ({ embed: vi.fn() }));
vi.mock("../services/voyage", () => voyage);

// Vite lists this folder's files as "./x.ts"; convex-test needs every path from the convex root.
const baseModules = Object.fromEntries(
  Object.entries(import.meta.glob("../**/*.ts")).map(([path, load]) => [
    path.startsWith("./") ? `../events/${path.slice(2)}` : path,
    load,
  ]),
);
// Route the webhook in a test router; the coordinator registers it in convex/http.ts.
const modules = {
  ...baseModules,
  "../http.ts": async () => {
    const http = httpRouter();
    http.route({ path: "/apify/webhook", method: "POST", handler: apifyWebhook });
    return { default: http };
  },
};

const DAY = 24 * 60 * 60 * 1000;

function iso(ms: number): string {
  // An explicit Pacific offset (PDT in late October).
  return new Date(ms - 7 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "-07:00");
}

const UC_THEATRE = { name: "The UC Theatre", address: "2036 University Ave, Berkeley, CA", osmId: "way/111", lat: 37.8716, lng: -122.2707 };
const FOX = { name: "Fox Theater", address: "1807 Telegraph Ave, Oakland, CA", osmId: "way/222", lat: 37.808, lng: -122.2703 };

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
    meetingSpot: {
      name: "Bench left of the main doors",
      howToFind: "The bench left of the main doors on University Ave.",
      lat: 37.87165,
      lng: -122.27085,
      osmId: null,
      isTransitStop: false,
      travelMinutes: 0,
    },
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

async function importRun(t: Awaited<ReturnType<typeof setup>>, runId: string, items: unknown[], summary: unknown = null) {
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T19:00:00Z"));
  process.env.APIFY_WEBHOOK_SECRET = "s3cret";
  pool.enqueueAction.mockClear();
  geocode.searchPlaces.mockReset();
  geocode.searchPlaces.mockResolvedValue([]);
  voyage.embed.mockReset();
  voyage.embed.mockImplementation(async (texts: string[]) => texts.map(() => new Array(1024).fill(0.01)));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("webhook", () => {
  test("refuses a wrong secret and ignores a repeated run", async () => {
    const t = await setup();
    const body = JSON.stringify({ eventType: "ACTOR.RUN.SUCCEEDED", resource: { id: "run1", defaultDatasetId: "ds1" } });
    const bad = await t.fetch("/apify/webhook", { method: "POST", headers: { [SECRET_HEADER]: "nope" }, body });
    expect(bad.status).toBe(401);
    expect(await t.run((ctx) => ctx.db.query("eventImports").collect())).toHaveLength(0);

    const first = await t.fetch("/apify/webhook", { method: "POST", headers: { [SECRET_HEADER]: "s3cret" }, body });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, duplicate: false });
    const again = await t.fetch("/apify/webhook", { method: "POST", headers: { [SECRET_HEADER]: "s3cret" }, body });
    expect(await again.json()).toEqual({ ok: true, duplicate: true });

    const rows = await t.run((ctx) => ctx.db.query("eventImports").collect());
    expect(rows).toHaveLength(1);
    expect(pool.enqueueAction).toHaveBeenCalledTimes(1);
    expect(rows[0].apifyRunId).toBe("run1");
  });

  test("a failed run is recorded and the catalog is untouched", async () => {
    const t = await setup();
    const body = JSON.stringify({ eventType: "ACTOR.RUN.FAILED", resource: { id: "run2" } });
    const response = await t.fetch("/apify/webhook", { method: "POST", headers: { [SECRET_HEADER]: "s3cret" }, body });
    expect(response.status).toBe(200);
    const imports = await t.query(internal.events.admin.imports, {});
    expect(imports[0]).toMatchObject({ apifyRunId: "run2", status: "failed" });
  });
});

describe("import", () => {
  test("publishes good events, rejects the rest with reasons, and merges duplicates", async () => {
    const t = await setup();
    geocode.searchPlaces.mockResolvedValue([FOX]);
    const row = await importRun(t, "runA", [
      scoutItem(),
      // The same show from a weaker source: one event.
      scoutItem({ title: "BIG THIEF — live", sourceName: "eventbrite", sourceKind: "listing", sourceUrl: "https://eventbrite.com/e/1" }),
      scoutItem({ title: "Late night DJ set", ageLimit: 21, sourceUrl: "https://theuctheatre.org/events/dj" }),
      scoutItem({ title: "Mystery show", ticketUrl: null, sourceUrl: "https://theuctheatre.org/events/m" }),
      scoutItem({ title: "Someday", startsAt: "2026-10-30", sourceUrl: "https://theuctheatre.org/events/s" }),
      scoutItem({
        title: "LA show",
        venue: { name: "Hollywood Bowl", address: "Los Angeles", osmId: "way/999", lat: 34.1122, lng: -118.3391 },
        sourceUrl: "https://example.com/la",
      }),
      // No OSM ID: found through the map lookup; no price found anywhere.
      scoutItem({
        title: "Cal Jazz Orchestra",
        venue: { name: "Fox Theater", address: "Oakland", osmId: null, lat: null, lng: null },
        price: { min: null, max: null, source: "not_found", sourceUrl: null },
        meetingSpot: null,
        sourceUrl: "https://foxoakland.org/events/jazz",
        sourceName: "fox_theater",
      }),
      { title: "garbage" },
    ]);

    expect(row.status).toBe("done");
    expect(row.counts).toEqual({ received: 8, published: 2, updated: 0, rejected: 5, duplicates: 1 });

    const events = await t.query(internal.events.admin.list, {});
    const byTitle = Object.fromEntries(events.map((e) => [e.title, e]));
    expect(byTitle["Big Thief"]).toMatchObject({ status: "published", area: "campus", hasEmbedding: true });
    expect(byTitle["Big Thief"].meetingSpot).toMatchObject({ name: "Bench left of the main doors", chosenBy: "agent" });
    expect(byTitle["Late night DJ set"]).toMatchObject({ status: "rejected", rejectReason: "21+ event" });
    expect(byTitle["Mystery show"].rejectReason).toBe("No official ticket or RSVP link and no free entry note");
    expect(byTitle["LA show"].rejectReason).toBe("Venue is outside our areas");
    expect(byTitle["Cal Jazz Orchestra"]).toMatchObject({
      status: "published",
      area: "berkeley_oakland",
      priceMin: null,
      priceMax: null,
      priceSource: "not_found",
    });
    // No usable spot from the agent: the venue's main entrance.
    expect(byTitle["Cal Jazz Orchestra"].meetingSpot?.name).toBe("Main entrance of Fox Theater");
    expect(geocode.searchPlaces).toHaveBeenCalledTimes(1);
    expect(row.errors[0]).toMatch(/Item 7/);
  });

  test("a later run updates price and time, flags events missing twice, and keeps pulls and team prices", async () => {
    const t = await setup();
    const start = Date.now() + 3 * DAY;
    const other = scoutItem({ title: "Folk night", startsAt: iso(start + DAY), sourceUrl: "https://theuctheatre.org/events/folk" });
    const pulled = scoutItem({ title: "Pulled show", startsAt: iso(start + 2 * DAY), sourceUrl: "https://theuctheatre.org/events/p" });
    await importRun(t, "run1", [scoutItem({ startsAt: iso(start) }), other, pulled]);

    let events = await t.query(internal.events.admin.list, {});
    const pulledId = events.find((e) => e.title === "Pulled show")!.eventId;
    const folkId = events.find((e) => e.title === "Folk night")!.eventId;
    await t.mutation(internal.events.admin.pull, { eventId: pulledId });
    await t.mutation(internal.events.admin.edit, { eventId: folkId, patch: { priceMin: 5, priceMax: 5 }, editedBy: "nick" });

    // Run 2: Big Thief moved an hour later and costs more; Folk night's listing changes price; Pulled show reappears.
    vi.setSystemTime(Date.now() + 60_000);
    const summary = { sources: [{ name: "uc_theatre", kind: "venue_site", status: "succeeded" }] };
    const second = await importRun(
      t,
      "run2",
      [
        scoutItem({ startsAt: iso(start + 60 * 60 * 1000), price: { min: 25, max: 35, source: "listing", sourceUrl: null } }),
        scoutItem({ ...other, price: { min: 40, max: 40, source: "listing", sourceUrl: null } }),
        pulled,
      ],
      summary,
    );
    expect(second.counts).toMatchObject({ published: 0, updated: 1, duplicates: 2 });
    events = await t.query(internal.events.admin.list, { includePast: true });
    const thief = events.filter((e) => e.title === "Big Thief");
    expect(thief).toHaveLength(1);
    expect(thief[0]).toMatchObject({ priceMin: 25, priceMax: 35, startsAt: start + 60 * 60 * 1000 });
    expect(events.find((e) => e.title === "Folk night")).toMatchObject({ priceMin: 5, priceSource: "team nick" });
    expect(events.find((e) => e.title === "Pulled show")).toMatchObject({ status: "rejected", rejectReason: PULLED_REASON });

    // Runs 3 and 4: Folk night disappears from its source.
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "run3", [scoutItem({ startsAt: iso(start + 60 * 60 * 1000) })], summary);
    let folk = (await t.query(internal.events.admin.list, {})).find((e) => e.title === "Folk night")!;
    expect(folk.missingSince).not.toBeNull();
    expect(folk.flaggedMissing).toBe(false);
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "run4", [scoutItem({ startsAt: iso(start + 60 * 60 * 1000) })], summary);
    folk = (await t.query(internal.events.admin.list, {})).find((e) => e.title === "Folk night")!;
    expect(folk).toMatchObject({ status: "published", flaggedMissing: true });
    expect((await t.query(internal.events.admin.list, { flaggedOnly: true })).map((e) => e.title)).toEqual(["Folk night"]);

    // It comes back: the flag clears.
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "run5", [other], summary);
    folk = (await t.query(internal.events.admin.list, {})).find((e) => e.title === "Folk night")!;
    expect(folk).toMatchObject({ missingSince: null, flaggedMissing: false });
  });

  test("an embedding failure keeps the event published without a vector", async () => {
    const t = await setup();
    voyage.embed.mockRejectedValue(new Error("Voyage is down"));
    const row = await importRun(t, "runV", [scoutItem()]);
    expect(row.counts.published).toBe(1);
    expect(row.errors.some((e) => e.includes("Voyage is down"))).toBe(true);
    const [event] = await t.query(internal.events.admin.list, {});
    expect(event).toMatchObject({ status: "published", hasEmbedding: false });
  });
});

describe("venues and meeting spots", () => {
  async function resolve(t: Awaited<ReturnType<typeof setup>>, args: Record<string, unknown>) {
    return await t.mutation(internal.events.venues.resolve, {
      ...UC_THEATRE,
      spot: null,
      now: Date.now(),
      ...args,
    } as never);
  }

  test("one venue per OSM ID, with the other name kept as an alias", async () => {
    const t = await setup();
    const a = await resolve(t, {});
    const b = await resolve(t, { name: "UC Theatre Taube Family Music Hall" });
    expect(a.ok && b.ok && a.venueId === b.venueId).toBe(true);
    const venues = await t.run((ctx) => ctx.db.query("venues").collect());
    expect(venues).toHaveLength(1);
    expect(venues[0].aliases).toEqual(["UC Theatre Taube Family Music Hall"]);
    expect(venues[0].distanceFromCampusMeters).toBeGreaterThan(800);
    expect(venues[0].distanceFromCampusMeters).toBeLessThan(1300);
    const found = await t.query(internal.events.venues.findByName, { name: "uc theatre taube family music hall" });
    expect(found?.osmId).toBe("way/111");
  });

  test("a spot too far from the venue falls back to the main entrance; a transit stop adds travel time", async () => {
    const t = await setup();
    const far = await resolve(t, {
      spot: { name: "Far cafe", howToFind: "Somewhere", lat: 37.876, lng: -122.27, osmId: null, isTransitStop: false, travelMinutes: 0 },
    });
    const venue = await t.run((ctx) => ctx.db.get((far as { venueId: Id<"venues"> }).venueId));
    const spot = await t.run((ctx) => ctx.db.get(venue!.meetingSpotId!));
    expect(spot?.name).toBe("Main entrance of The UC Theatre");

    const transit = await resolve(t, {
      ...FOX,
      spot: {
        name: "19th St Oakland BART plaza",
        howToFind: "Street-level entrance",
        lat: 37.80801,
        lng: -122.26901,
        osmId: null,
        isTransitStop: true,
        travelMinutes: 15,
      },
    });
    const fox = await t.run((ctx) => ctx.db.get((transit as { venueId: Id<"venues"> }).venueId));
    expect(fox?.meetOffsetMinutes).toBe(45);
    // The team-seeded BART plaza is reused rather than duplicated.
    const reused = await t.run((ctx) => ctx.db.get(fox!.meetingSpotId!));
    expect(reused?.chosenBy).toBe("team");
  });
});

describe("admin", () => {
  test("find events now starts a scout run", async () => {
    const t = await setup();
    expect(await t.action(internal.events.admin.findNow, {})).toEqual({ apifyRunId: "newrun" });
  });
});
