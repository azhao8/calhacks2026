/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { httpRouter } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { apifyWebhook, SECRET_HEADER } from "./webhook";
import { PULLED_REASON } from "./config";
import realRun from "./fixtures/uc-theatre-run.json";
import fullRunDuplicates from "./fixtures/full-run-duplicates.json";
import devDuplicatePairs from "./fixtures/dev-duplicate-pairs.json";

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

describe("review regressions", () => {
  test("team-edited fields stay locked, and other fields still update", async () => {
    const t = await setup();
    await importRun(t, "l1", [scoutItem()]);
    const [event] = await t.query(internal.events.admin.list, {});
    await t.mutation(internal.events.admin.edit, { eventId: event.eventId, patch: { ticketUrl: "https://www.ticketmaster.com/real", priceMin: 20, priceMax: 20 } });
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "l2", [scoutItem({ performers: ["Big Thief", "Opener"], price: { min: 40, max: 40, source: "listing", sourceUrl: null } })]);
    const [after] = await t.query(internal.events.admin.list, {});
    expect(after).toMatchObject({ ticketUrl: "https://www.ticketmaster.com/real", priceMin: 20, priceMax: 20, performers: ["Big Thief", "Opener"] });
    expect(after.teamFields.sort()).toEqual(["priceMax", "priceMin", "ticketUrl"]);
  });

  test("a venue the scout didn't place gets the main entrance, not the agent's spot", async () => {
    const t = await setup();
    geocode.searchPlaces.mockResolvedValue([FOX]);
    await importRun(t, "s1", [scoutItem({ venue: { name: "Fox Theater", address: "Oakland, CA", osmId: null, lat: null, lng: null } })]);
    const [event] = await t.query(internal.events.admin.list, {});
    expect(event.meetingSpot?.name).toBe("Main entrance of Fox Theater");
    expect(event.meetingSpot?.howToFind).toBe("Out front of the main entrance of Fox Theater on 1807 Telegraph Ave.");
  });

  test("a venue missing from the map is looked up once, not on every run", async () => {
    const t = await setup();
    const unknown = (title: string) =>
      scoutItem({ title, sourceUrl: `https://x.test/${title}`, venue: { name: "Nowhere Hall", address: "Berkeley, CA", osmId: null, lat: null, lng: null } });
    await importRun(t, "g1", [unknown("A"), unknown("B")]);
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "g2", [unknown("C")]);
    expect(geocode.searchPlaces).toHaveBeenCalledTimes(1);
    const rows = await t.query(internal.events.admin.list, { status: "rejected" });
    expect(rows.map((r) => r.rejectReason)).toEqual(["Venue not found on the map", "Venue not found on the map", "Venue not found on the map"]);
  });
});

describe("a real scout run", () => {
  // Apify run 6L51sZ3WeSDFYMu4X (UC Theatre only, 5 events max), saved as a fixture.
  test("its four UC Theatre items import as four published events at one venue with the agent's spot", async () => {
    const t = await setup();
    const row = await importRun(t, "6L51sZ3WeSDFYMu4X", realRun, { sources: [{ name: "uc_theatre", kind: "venue_site", status: "succeeded" }] });
    expect(row.counts).toEqual({ received: 4, published: 4, updated: 0, rejected: 0, duplicates: 0 });
    const events = await t.query(internal.events.admin.list, {});
    expect(new Set(events.map((e) => e.venueName))).toEqual(new Set(["The UC Theatre"]));
    expect(new Set(events.map((e) => e.meetingSpot?.name))).toEqual(new Set(["University & Shattuck bus stop"]));
    const pigeons = events.find((e) => e.title === "Pigeons Playing Ping Pong")!;
    // Nov 1, 7 pm Pacific (PST) and "from $35".
    expect(pigeons).toMatchObject({ startsAt: Date.parse("2026-11-02T03:00:00Z"), priceMin: 35, priceMax: null, area: "campus" });
  });
});

describe("the first full run's defects", () => {
  // Items 0, 14, 18 and 16 of Apify run MgpZXJwxokLbeUuqc (all sources), saved as a fixture.
  test("Cal Performances and the campus calendar describe one Iestyn Davies recital; it publishes once", async () => {
    vi.setSystemTime(new Date("2026-10-25T05:00:00Z"));
    const t = await setup();
    const row = await importRun(t, "MgpZXJwxokLbeUuqc", fullRunDuplicates);
    const iestyn = (await t.query(internal.events.admin.list, {})).filter((e) => e.title.startsWith("Iestyn Davies"));
    expect(iestyn).toHaveLength(1);
    expect(iestyn[0]).toMatchObject({ title: "Iestyn Davies, countertenor; Oliver Wass, harp", priceMin: 75, priceMax: null });
    expect(row.counts).toMatchObject({ received: 4, published: 2, duplicates: 2, rejected: 0 });
  });

  test("an address is never a venue's display name once a real name turns up, and the team can rename", async () => {
    const t = await setup();
    const venue = { name: "2121 Allston Way", address: "2121 Allston Way, Berkeley, CA 94720", osmId: "way/37060579", lat: 37.869762, lng: -122.266885 };
    await importRun(t, "a1", [scoutItem({ title: "Other", venue, sourceUrl: "https://events.berkeley.edu/1" })]);
    expect((await t.query(internal.events.admin.list, {}))[0].venueName).toBe("2121 Allston Way");
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "a2", [scoutItem({ title: "Next", venue: { ...venue, name: "Hall Downtown" }, sourceUrl: "https://events.berkeley.edu/2" })]);
    const venues = await t.run((ctx) => ctx.db.query("venues").collect());
    expect(venues).toHaveLength(1);
    expect(venues[0]).toMatchObject({ name: "Hall Downtown", aliases: ["2121 Allston Way"] });
    // A later address-only listing doesn't undo the real name.
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "a3", [scoutItem({ title: "Third", venue, sourceUrl: "https://events.berkeley.edu/3" })]);
    expect((await t.run((ctx) => ctx.db.get(venues[0]._id)))!.name).toBe("Hall Downtown");
    await t.mutation(internal.events.admin.renameVenue, { venueId: venues[0]._id, name: "The Real Hall" });
    expect((await t.run((ctx) => ctx.db.get(venues[0]._id)))!).toMatchObject({ name: "The Real Hall", aliases: ["2121 Allston Way", "Hall Downtown"] });
  });

  test("a map result named only by its address never stands in for a named venue", async () => {
    const t = await setup();
    geocode.searchPlaces.mockResolvedValue([{ osmId: "way/5", name: "2121 Allston Way", address: "2121, Allston Way, Berkeley, CA", lat: 37.8697, lng: -122.2668 }]);
    // The names share nothing, so the event is rejected rather than placed at the wrong venue.
    await importRun(t, "u1", [scoutItem({ venue: { name: "Hall Downtown", address: "Berkeley, CA", osmId: null, lat: null, lng: null } })]);
    expect((await t.query(internal.events.admin.list, { status: "rejected" }))[0].rejectReason).toBe("Venue not found on the map");
  });

  test("mergeDuplicate folds one event into another for good", async () => {
    const t = await setup();
    await importRun(t, "d1", [
      scoutItem({ title: "Show A", price: { min: null, max: null, source: "not_found" }, sourceUrl: "https://x.test/a" }),
      scoutItem({ title: "Totally different", sourceUrl: "https://x.test/b" }),
    ]);
    const [a, b] = await t.query(internal.events.admin.list, {});
    const keep = a.title === "Show A" ? a : b;
    const drop = a.title === "Show A" ? b : a;
    await t.mutation(internal.events.admin.mergeDuplicate, { keepId: keep.eventId, dropId: drop.eventId });
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "d2", [scoutItem({ title: "Totally different", sourceUrl: "https://x.test/b" })]);
    const published = await t.query(internal.events.admin.list, { status: "published" });
    expect(published.map((e) => [e.title, e.priceMin])).toEqual([["Show A", 22]]);
  });
});

describe("meeting spot on a later event", () => {
  test("the agent's spot on the venue's fourth event replaces the main entrance from the first", async () => {
    const t = await setup();
    const start = Date.now() + 2 * DAY;
    const spot = scoutItem().meetingSpot;
    await importRun(t, "ms1", [
      scoutItem({ title: "A", startsAt: iso(start), meetingSpot: null, sourceUrl: "https://theuctheatre.org/a" }),
      scoutItem({ title: "B", startsAt: iso(start + DAY), meetingSpot: null, sourceUrl: "https://theuctheatre.org/b" }),
      scoutItem({ title: "C", startsAt: iso(start + 2 * DAY), meetingSpot: spot, sourceUrl: "https://theuctheatre.org/c" }),
    ]);
    const events = await t.query(internal.events.admin.list, {});
    expect(events.map((e) => e.meetingSpot?.name)).toEqual(Array(3).fill("Bench left of the main doors"));
    // The old fallback row is kept (past plans may point to it), but nothing current uses it.
    // A later spot never replaces one the agent already chose.
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "ms2", [scoutItem({ title: "D", startsAt: iso(start + 3 * DAY), meetingSpot: { ...spot, name: "Other bench" }, sourceUrl: "https://theuctheatre.org/d" })]);
    const after = await t.query(internal.events.admin.list, {});
    expect(new Set(after.map((e) => e.meetingSpot?.name))).toEqual(new Set(["Bench left of the main doors"]));
  });
});

describe("spot changes reach existing plans", () => {
  async function planFor(t: Awaited<ReturnType<typeof setup>>, eventId: Id<"events">, status: "forming" | "set" = "set") {
    return await t.run(async (ctx) => {
      const event = (await ctx.db.get(eventId))!;
      return await ctx.db.insert("meetups", {
        eventId,
        status,
        marker: 42,
        meetingSpotId: event.meetingSpotId,
        meetAt: event.startsAt - 30 * 60_000,
        cutoffAt: event.startsAt - 150 * 60_000,
        hook: "You both have Big Thief on repeat.",
        icebreaker: "Which song first?",
        hookFromClaude: false,
        isDemoPlan: false,
        createdAt: Date.now(),
      });
    });
  }

  test("an automatic spot replacement moves forming plans only; a set plan keeps the spot it was shown", async () => {
    const t = await setup();
    await importRun(t, "p1", [scoutItem({ meetingSpot: null })]);
    const [event] = await t.query(internal.events.admin.list, {});
    expect(event.meetingSpot?.name).toBe("Main entrance of The UC Theatre");
    const setPlan = await planFor(t, event.eventId, "set");
    const formingPlan = await planFor(t, event.eventId, "forming");
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "p2", [scoutItem({ title: "Another show", startsAt: iso(Date.now() + 4 * DAY), sourceUrl: "https://theuctheatre.org/other" })]);
    const spotOf = async (id: Id<"meetups">) => {
      const plan = (await t.run((ctx) => ctx.db.get(id)))!;
      return (await t.run((ctx) => ctx.db.get(plan.meetingSpotId!)))?.name;
    };
    // The set plan's spot still exists (it is never deleted) and is unchanged.
    expect(await spotOf(setPlan)).toBe("Main entrance of The UC Theatre");
    expect(await spotOf(formingPlan)).toBe("Bench left of the main doors");
  });

  test("an automatic transit-stop replacement never retimes a set plan", async () => {
    const t = await setup();
    const fox = { ...FOX };
    await importRun(t, "t1", [scoutItem({ venue: fox, meetingSpot: null, sourceName: "fox_theater", sourceUrl: "https://thefoxoakland.com/a" })]);
    const [event] = await t.query(internal.events.admin.list, {});
    const setPlan = await planFor(t, event.eventId, "set");
    const before = (await t.run((ctx) => ctx.db.get(setPlan)))!;
    vi.setSystemTime(Date.now() + 60_000);
    const transit = { name: "19th St Oakland BART plaza", howToFind: "Street-level entrance at Broadway and 19th St.", lat: 37.8086, lng: -122.2681, osmId: null, isTransitStop: true, travelMinutes: 15 };
    await importRun(t, "t2", [scoutItem({ title: "Later show", startsAt: iso(Date.now() + 5 * DAY), venue: fox, meetingSpot: transit, sourceName: "fox_theater", sourceUrl: "https://thefoxoakland.com/b" })]);
    const after = (await t.run((ctx) => ctx.db.get(setPlan)))!;
    expect(after).toMatchObject({ meetingSpotId: before.meetingSpotId, meetAt: before.meetAt });
    const events = await t.query(internal.events.admin.list, {});
    // The event with a set plan keeps its 30 minute offset; the new show uses the stop's 45.
    expect(events.map((e) => [e.title, e.meetOffsetMinutes])).toEqual([["Big Thief", 30], ["Later show", 45]]);
  });

  test("the team's override moves forming and set plans to the new spot and retimes them", async () => {
    const t = await setup();
    await importRun(t, "o1", [scoutItem()]);
    const [event] = await t.query(internal.events.admin.list, {});
    const setPlan = await planFor(t, event.eventId, "set");
    const formingPlan = await planFor(t, event.eventId, "forming");
    const spotId = await t.mutation(internal.events.admin.overrideSpot, {
      venueId: event.venueId!,
      name: "Box office window",
      howToFind: "The box office window under the marquee.",
      lat: 37.87172,
      lng: -122.27075,
      meetOffsetMinutes: 45,
    });
    for (const id of [setPlan, formingPlan]) {
      const plan = (await t.run((ctx) => ctx.db.get(id)))!;
      expect(plan.meetingSpotId).toBe(spotId);
      expect(plan.meetAt).toBe(event.startsAt - 45 * 60_000);
    }
  });
});

describe("admin list and edit", () => {
  test("rows carry venueId and restorable; edit refuses a price that isn't a number", async () => {
    const t = await setup();
    await importRun(t, "r1", [scoutItem(), scoutItem({ title: "Late set", ageLimit: 21, sourceUrl: "https://theuctheatre.org/late" })]);
    const rows = await t.query(internal.events.admin.list, {});
    const published = rows.find((r) => r.status === "published")!;
    const adult = rows.find((r) => r.status === "rejected")!;
    expect(published.venueId).not.toBeNull();
    expect(published.restorable).toBe(false);
    expect(adult.restorable).toBe(true);
    for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      await expect(
        t.mutation(internal.events.admin.edit, { eventId: published.eventId, patch: { priceMin: bad } }),
      ).rejects.toThrow(/price must be a number/);
    }
    await t.mutation(internal.events.admin.edit, { eventId: published.eventId, patch: { priceMin: 0, priceMax: null } });
    expect((await t.query(internal.events.admin.list, {})).find((r) => r.eventId === published.eventId)).toMatchObject({ priceMin: 0, priceMax: null });
  });
});

describe("audit items 4 to 7", () => {
  test("a 21+ rejection the team restores stays published on the next import", async () => {
    const t = await setup();
    const adult = scoutItem({ title: "Late set", ageLimit: 21, sourceUrl: "https://theuctheatre.org/late" });
    await importRun(t, "c1", [adult]);
    const [row] = await t.query(internal.events.admin.list, { status: "rejected" });
    await t.mutation(internal.events.admin.restore, { eventId: row.eventId });
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "c2", [adult]);
    const [after] = await t.query(internal.events.admin.list, {});
    expect(after).toMatchObject({ status: "published", ageLimit: null, rejectReason: null });
    expect(after.teamFields).toContain("ageLimit");
  });

  test("a cleared 21+ listing still fails its other checks", async () => {
    const t = await setup();
    await importRun(t, "c3", [scoutItem({ title: "Late set", ageLimit: 21, sourceUrl: "https://theuctheatre.org/late" })]);
    const [row] = await t.query(internal.events.admin.list, { status: "rejected" });
    await t.mutation(internal.events.admin.restore, { eventId: row.eventId });
    vi.setSystemTime(Date.now() + 60_000);
    // Same show, now with no ticket link: a softer check never unpublishes a published event.
    await importRun(t, "c4", [scoutItem({ title: "Late set", ageLimit: 21, ticketUrl: null, sourceUrl: "https://theuctheatre.org/late" })]);
    expect((await t.query(internal.events.admin.list, {}))[0].status).toBe("published");
  });

  test("rejected events with no start time appear on the rejected list, most recent first", async () => {
    const t = await setup();
    await importRun(t, "n1", [scoutItem({ title: "Someday", startsAt: null, sourceUrl: "https://x.test/someday" })]);
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "n2", [scoutItem({ title: "Mystery", ticketUrl: null, sourceUrl: "https://x.test/mystery" })]);
    const rejected = await t.query(internal.events.admin.list, { status: "rejected" });
    expect(rejected.map((r) => [r.title, r.rejectReason])).toEqual([
      ["Mystery", "No official ticket or RSVP link and no free entry note"],
      ["Someday", "No date"],
    ]);
  });

  test("one venue under two nearby OSM IDs stays one venue with one event", async () => {
    const t = await setup();
    await importRun(t, "v1", [
      scoutItem(),
      scoutItem({
        sourceName: "uc_berkeley_events",
        sourceUrl: "https://events.berkeley.edu/big-thief",
        venue: { name: "The UC Theatre Taube Family Music Hall", address: "2036 University Ave, Berkeley", osmId: "node/999", lat: 37.87166, lng: -122.27061 },
      }),
    ]);
    const venues = await t.run((ctx) => ctx.db.query("venues").collect());
    expect(venues).toHaveLength(1);
    expect(await t.query(internal.events.admin.list, {})).toHaveLength(1);
  });

  test("a more official source with no price keeps the price another source found", async () => {
    const t = await setup();
    await importRun(t, "pr1", [
      scoutItem({ sourceName: "eventbrite", sourceKind: "listing", sourceUrl: "https://eventbrite.com/e/1", price: { min: 30, max: 30, source: "listing", sourceUrl: null } }),
    ]);
    vi.setSystemTime(Date.now() + 60_000);
    await importRun(t, "pr2", [scoutItem({ price: { min: null, max: null, source: "not_found", checked: ["listing", "ticket_page", "search"] } })]);
    const [event] = await t.query(internal.events.admin.list, {});
    expect(event).toMatchObject({ sourceName: "venue_site:uc_theatre", priceMin: 30, priceMax: 30 });
  });
});

describe("one show, two titles (dev, before the fix)", () => {
  const HAAS = { name: "Haas Pavilion", address: "Haas Pavilion, Berkeley, CA", osmId: "way/1001", lat: 37.8693, lng: -122.262 };
  // Eight published rows read from dev (elated-barracuda-447): four shows, each published twice.
  function itemFrom(row: (typeof devDuplicatePairs)[number]) {
    const [sourceKind, sourceName] = row.sourceName.split(":");
    return scoutItem({
      title: row.title,
      kind: row.kind,
      startsAt: iso(row.startsAt),
      venue: row.venueName === "Haas Pavilion" ? HAAS : FOX,
      price:
        row.priceMin === null && row.priceMax === null
          ? { min: null, max: null, source: "not_found", sourceUrl: null }
          : { min: row.priceMin, max: row.priceMax, source: "listing", sourceUrl: null },
      ticketUrl: row.ticketUrl,
      performers: row.performers,
      tags: row.tags,
      meetingSpot: null,
      sourceName,
      sourceKind,
      sourceUrl: row.sourceUrl,
    });
  }

  test("Cal and California games, and reordered tour titles from one source, publish once each", async () => {
    const t = await setup();
    const row = await importRun(t, "dupes", devDuplicatePairs.map(itemFrom));
    const published = await t.query(internal.events.admin.list, {});
    expect(published.map((e) => e.title).sort()).toEqual([
      "A Little Vengeance Tour 2026: Jessie Reyez",
      "Burn The Setlist Tour (The All Request Tour): An Evening With Brandi Carlile",
      "California Volleyball vs Stanford",
      "California Women's Basketball vs Vanguard (Exhibition)",
    ].sort());
    expect(row.counts).toMatchObject({ received: 8, published: 4 });
    // The official feed wins over the open web, and keeps the price it found.
    expect(published.find((e) => e.title.includes("Vanguard"))).toMatchObject({ sourceName: "official_feed:cal_athletics", priceMin: 4 });
  });

  test("different shows at one venue at the same time stay separate", async () => {
    const t = await setup();
    const start = iso(Date.now() + 3 * DAY);
    await importRun(t, "sep", [
      scoutItem({ title: "Cal Volleyball vs Stanford", kind: "game", startsAt: start, venue: HAAS, sourceUrl: "https://x.test/1" }),
      scoutItem({ title: "Cal Volleyball vs UCLA", kind: "game", startsAt: start, venue: HAAS, sourceUrl: "https://x.test/2" }),
      scoutItem({ title: "Jazz Trio", startsAt: start, sourceUrl: "https://x.test/3" }),
      scoutItem({ title: "Folk Duo", startsAt: start, sourceUrl: "https://x.test/4" }),
    ]);
    expect(await t.query(internal.events.admin.list, {})).toHaveLength(4);
  });
});

describe("folding duplicates already published", () => {
  const HAAS = { name: "Haas Pavilion", address: "Haas Pavilion, Berkeley, CA", osmId: "way/1001", lat: 37.8693, lng: -122.262 };

  // Two copies of one game, as stored before the fix: published apart, then aligned to the same start.
  async function twoCopies(t: Awaited<ReturnType<typeof setup>>) {
    const start = Date.now() + 3 * DAY;
    await importRun(t, "old", [
      scoutItem({ title: "California Volleyball vs Stanford", kind: "game", startsAt: iso(start), venue: HAAS, sourceName: "cal_athletics", sourceKind: "official_feed", sourceUrl: "https://calbears.com/1" }),
      scoutItem({ title: "Cal Volleyball vs Stanford (Blue Out)", kind: "game", startsAt: iso(start + DAY), venue: HAAS, sourceName: "web", sourceKind: "web", sourceUrl: "https://x.test/vb" }),
    ]);
    const rows = await t.query(internal.events.admin.list, {});
    const official = rows.find((r) => r.sourceName.startsWith("official_feed"))!;
    const web = rows.find((r) => r.sourceName.startsWith("web"))!;
    await t.run((ctx) => ctx.db.patch(web.eventId, { startsAt: official.startsAt }));
    return { official, web };
  }

  async function holdAsk(t: Awaited<ReturnType<typeof setup>>, eventId: Id<"events">) {
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { firstName: "Sam" });
      await ctx.db.insert("asks", { userId, eventId, createdAt: Date.now(), answer: "yes" });
    });
  }

  async function holdPlan(t: Awaited<ReturnType<typeof setup>>, eventId: Id<"events">) {
    await t.run(async (ctx) => {
      const event = (await ctx.db.get(eventId))!;
      await ctx.db.insert("meetups", {
        eventId, status: "set", marker: 12, meetingSpotId: event.meetingSpotId,
        meetAt: event.startsAt - 30 * 60_000, cutoffAt: event.startsAt - 150 * 60_000,
        hook: "h", icebreaker: "i", hookFromClaude: false, isDemoPlan: false, createdAt: Date.now(),
      });
    });
  }

  test("a dry run reports and changes nothing; the copy people hold is kept", async () => {
    const t = await setup();
    const { official, web } = await twoCopies(t);
    await holdAsk(t, web.eventId);
    const dry = await t.mutation(internal.events.admin.mergeDuplicates, {});
    expect(dry).toEqual([
      { keep: { eventId: web.eventId, title: web.title }, drop: [{ eventId: official.eventId, title: official.title, openAsks: 0 }], skipped: null },
    ]);
    expect(await t.query(internal.events.admin.list, { status: "published" })).toHaveLength(2);
    await t.mutation(internal.events.admin.mergeDuplicates, { dryRun: false });
    const published = await t.query(internal.events.admin.list, { status: "published" });
    expect(published.map((e) => e.eventId)).toEqual([web.eventId]);
  });

  test("with no one holding either copy, the more official source is kept", async () => {
    const t = await setup();
    const { official } = await twoCopies(t);
    await t.mutation(internal.events.admin.mergeDuplicates, { dryRun: false });
    expect((await t.query(internal.events.admin.list, { status: "published" })).map((e) => e.eventId)).toEqual([official.eventId]);
  });

  test("two copies that both hold plans are left alone and reported", async () => {
    const t = await setup();
    const { official, web } = await twoCopies(t);
    await holdPlan(t, official.eventId);
    await holdPlan(t, web.eventId);
    const report = await t.mutation(internal.events.admin.mergeDuplicates, { dryRun: false });
    expect(report[0].skipped).toBe("Two copies both hold plans; merge by hand");
    expect(await t.query(internal.events.admin.list, { status: "published" })).toHaveLength(2);
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
