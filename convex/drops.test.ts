/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DROP } from "./lib/config";
import { pickChoices, type PickEvent } from "./drops/pick";
import { validateAudience } from "./drops/audience";
import { advance, asUser, DAY, HOUR, makeEvent, makeStudent, seatsFor, setup, T0, type T } from "./testing.helpers";

const mocks = vi.hoisted(() => ({ generateJson: vi.fn(), embed: vi.fn(), sendEmail: vi.fn() }));
vi.mock("./services/claude", () => ({ generateJson: mocks.generateJson }));
vi.mock("./services/voyage", () => ({ embed: mocks.embed }));
vi.mock("./services/resend", () => ({ sendEmail: mocks.sendEmail, resendApiKey: () => "test" }));

const ADMIN = "admin@berkeley.edu";

beforeEach(() => {
  delete process.env.MELOS_LEGACY_ASKS;
  process.env.ADMIN_EMAILS = ADMIN;
  mocks.generateJson.mockRejectedValue(new Error("no claude in tests"));
  mocks.sendEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  mocks.generateJson.mockReset();
  mocks.embed.mockReset();
  mocks.sendEmail.mockReset();
  vi.useRealTimers();
});

// Starts on match day + a few days, so events sit inside the window (matchAt + 3h to + 7 days).
const START = T0 + DROP.choosingMs + DROP.confirmMs + 2 * DAY;

async function world() {
  const t = await setup();
  const workpoolTest = "@convex-dev/workpool/test";
  const workpool = (await import(/* @vite-ignore */ workpoolTest)) as {
    default: { register: (t: T, name: string) => unknown };
  };
  workpool.default.register(t, "emailPool");
  const admin = await makeStudent(t, { firstName: "Ada", email: ADMIN, artists: ["Nobody Shares This"] });
  return { t, admin: asUser(t, admin), adminId: admin };
}

async function entryOf(t: T, userId: Id<"users">) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("dropEntries").collect()).find((entry) => entry.userId === userId) ?? null,
  );
}

async function startDrop(t: T, admin: ReturnType<typeof asUser>) {
  await admin.mutation(api.admin.drops.start, {});
  await advance(t, 1000);
}

// Runs the work an admin button scheduled (and anything due within a second).
async function settle(t: T) {
  await advance(t, 1000);
}

describe("picking choices", () => {
  const base = (id: string, extra: Partial<PickEvent> = {}): PickEvent =>
    ({
      _id: id as Id<"events">,
      kind: "concert",
      startsAt: 1000 + 4 * HOUR,
      featured: false,
      status: "published",
      priceMin: 10,
      priceMax: 20,
      freeEntryNote: undefined,
      ageLimit: null,
      embedding: [1, 0],
      audienceEmbedding: undefined,
      area: "campus",
      ...extra,
    }) as PickEvent;
  const input = { embedding: [1, 0], maxTicketPrice: 25, area: "berkeley_oakland" as const, isTeam: false, matchAt: 1000 };

  test("hard filters: window, budget, area, 21+, status", () => {
    const events = [
      base("ok"),
      base("too_soon", { startsAt: 1000 + HOUR }),
      base("too_late", { startsAt: 1000 + 8 * DAY }),
      base("pricey", { priceMin: 40, priceMax: 60 }),
      base("unknown_price", { priceMin: null, priceMax: null }),
      base("far", { area: "bart" }),
      base("adult", { ageLimit: 21 }),
      base("pulled", { status: "rejected" }),
    ];
    const picked = pickChoices({ ...input, events, rng: () => 0.99 });
    expect(new Set(picked)).toEqual(new Set(["ok", "unknown_price"]));
  });

  test("1 to 4 choices, capped by what's eligible", () => {
    const events = Array.from({ length: 10 }, (_, i) => base(`e${i}`));
    expect(pickChoices({ ...input, events, rng: () => 0 })).toHaveLength(1);
    expect(pickChoices({ ...input, events, rng: () => 0.999 })).toHaveLength(4);
    expect(pickChoices({ ...input, events: events.slice(0, 2), rng: () => 0.999 })).toHaveLength(2);
    expect(pickChoices({ ...input, events: [], rng: () => 0.5 })).toEqual([]);
  });

  test("diversity: a second card of the same kind is penalized", () => {
    const events = [
      base("c1", { embedding: [1, 0] }),
      base("c2", { embedding: [0.98, 0.2] }),
      base("g1", { kind: "game", embedding: [0.9, 0.44] }),
    ];
    // rng 0.4 → 2 cards; then a near-zero roll takes the top of each round.
    let calls = 0;
    const rng = () => (calls++ === 0 ? 0.4 : 0);
    expect(pickChoices({ ...input, events, rng })).toEqual(["c1", "g1"]);
  });

  test("the audience vector wins; an event without one falls back to its embedding", () => {
    const events = [
      base("audience", { embedding: [0, 1], audienceEmbedding: [1, 0] }),
      base("plain", { embedding: [0, 1] }),
    ];
    let calls = 0;
    const rng = () => (calls++ === 0 ? 0 : 0);
    expect(pickChoices({ ...input, events, rng })).toEqual(["audience"]);
    calls = 0;
    expect(pickChoices({ ...input, embedding: [0, 1], events, rng })).toEqual(["plain"]);
  });

  test("team accounts get featured events first", () => {
    const events = [base("best", { embedding: [1, 0] }), base("featured", { embedding: [0, 1], featured: true })];
    expect(pickChoices({ ...input, isTeam: true, events, rng: () => 0 })).toEqual(["featured"]);
  });

  test("audience profiles keep only fixed-list labels and need at least 3", () => {
    expect(validateAudience({ audience: "Folk fans.", labels: ["indie folk", "indie pop", "dream pop", "made up"], energy: "low" }))
      .toEqual({ audience: "Folk fans.", labels: ["indie folk", "indie pop", "dream pop"], energy: "low" });
    expect(validateAudience({ audience: "Folk fans.", labels: ["indie folk", "made up"], energy: "low" })).toBeNull();
    expect(validateAudience({ audience: "x".repeat(301), labels: ["indie folk", "indie pop", "dream pop"], energy: "low" })).toBeNull();
  });
});

describe("the drop cycle", () => {
  test("lifecycle: start, choosing, see more, accept, end choosing, match", async () => {
    const { t, admin } = await world();
    const eventId = await makeEvent(t, { startsAt: START, performers: ["Big Thief"] });
    const sam = await makeStudent(t, { firstName: "Sam", artists: ["Big Thief", "Mitski"], tracks: ["Not|Big Thief"] });
    const kai = await makeStudent(t, { firstName: "Kai", artists: ["Big Thief", "Mitski"], tracks: ["Not|Big Thief"] });

    expect(await asUser(t, sam).query(api.drops.mine, {})).toEqual({ kind: "none" });
    await startDrop(t, admin);

    const view = await asUser(t, sam).query(api.drops.mine, {});
    expect(view.kind).toBe("choosing");
    if (view.kind !== "choosing") throw new Error();
    const drop = (await admin.query(api.admin.drops.status, {})).drop!;
    expect(view.endsAt).toBe(drop.choosingEndsAt);
    expect(drop.matchAt - drop.choosingEndsAt).toBe(DROP.confirmMs);
    expect(view.card).toEqual({ startsAt: START, price: "$18 to $25" });

    for (const id of [sam, kai]) {
      await asUser(t, id).mutation(api.drops.seeMore, {});
      await asUser(t, id).mutation(api.drops.seeMore, {}); // idempotent
      const deciding = await asUser(t, id).query(api.drops.mine, {});
      expect(deciding).toMatchObject({ kind: "deciding", acceptBy: drop.matchAt });
      if (deciding.kind === "deciding") expect(deciding.event).toMatchObject({ title: "Indie folk night", venue: "The UC Theatre" });
      await asUser(t, id).mutation(api.drops.accept, {});
      await asUser(t, id).mutation(api.drops.accept, {}); // idempotent
    }
    expect(await asUser(t, sam).query(api.drops.mine, {})).toMatchObject({ kind: "accepted", matchAt: drop.matchAt });

    await advance(t, DROP.choosingMs + 1000);
    expect((await admin.query(api.admin.drops.status, {})).drop?.status).toBe("confirming");
    expect(await asUser(t, sam).query(api.drops.mine, {})).toMatchObject({ kind: "accepted", endsAt: drop.matchAt });

    await advance(t, DROP.confirmMs);
    const status = await admin.query(api.admin.drops.status, {});
    expect(status.drop?.status).toBe("matched");
    const view2 = await asUser(t, sam).query(api.drops.mine, {});
    expect(view2.kind).toBe("reveal");
    if (view2.kind !== "reveal") throw new Error();
    const seats = await seatsFor(t, view2.meetupId);
    expect(seats.map((s) => s.seat)).toEqual(["in", "in"]);
    expect(new Set(seats.map((s) => s.userId))).toEqual(new Set([sam, kai]));
    const plan = await t.run(async (ctx) => ctx.db.get(view2.meetupId));
    expect(plan?.status).toBe("set");
    expect(plan?.eventId).toBe(eventId);

    // Reveal steps, then See your plan.
    const reveal = await asUser(t, sam).query(api.drops.reveal, { meetupId: view2.meetupId });
    expect(reveal.steps[0]).toEqual({ kind: "going" });
    expect(reveal.steps[1].kind).toBe("artist");
    expect(reveal.steps.find((s) => s.kind === "song")).toBeDefined();
    expect(reveal.steps.at(-1)).toEqual({ kind: "name", firstName: "Kai" });
    await asUser(t, sam).mutation(api.drops.revealed, { meetupId: view2.meetupId });
    expect(await asUser(t, sam).query(api.drops.mine, {})).toEqual({ kind: "none" });
    expect(await asUser(t, kai).query(api.drops.mine, {})).toMatchObject({ kind: "reveal" });
  });

  test("privacy: no event details before See more, never a count; reveal only for your own plan", async () => {
    const { t, admin } = await world();
    for (let i = 0; i < 4; i++) await makeEvent(t, { startsAt: START + i * HOUR, title: `Show ${i}` });
    const sam = await makeStudent(t, { firstName: "Sam" });
    const eve = await makeStudent(t, { firstName: "Eve" });
    await makeStudent(t, { firstName: "Demo", isDemo: true, demoKey: "d", email: "d@demo.invalid" });
    await startDrop(t, admin);
    const view = await asUser(t, sam).query(api.drops.mine, {});
    const text = JSON.stringify(view);
    expect(text).not.toContain("Show");
    expect(text).not.toContain("UC Theatre");
    expect(Object.keys(view).sort()).toEqual(["card", "endsAt", "kind"]);
    if (view.kind === "choosing") expect(Object.keys(view.card).sort()).toEqual(["price", "startsAt"]);

    // A plan Eve isn't in is forbidden to her.
    await asUser(t, sam).mutation(api.drops.seeMore, {});
    await asUser(t, sam).mutation(api.drops.accept, {});
    await admin.mutation(api.admin.drops.matchNow, {});
    await settle(t);
    const mine = await asUser(t, sam).query(api.drops.mine, {});
    if (mine.kind !== "reveal") throw new Error("expected a reveal");
    await expect(asUser(t, eve).query(api.drops.reveal, { meetupId: mine.meetupId })).rejects.toThrow(/forbidden/);
  });

  test("Pass forever moves through the cards; Next time is done; locked state survives reload", async () => {
    const { t, admin } = await world();
    for (let i = 0; i < 6; i++) await makeEvent(t, { startsAt: START + i * HOUR });
    const sam = await makeStudent(t, { firstName: "Sam" });
    const kai = await makeStudent(t, { firstName: "Kai" });
    await startDrop(t, admin);
    const total = (await entryOf(t, sam))!.choices.length;
    for (let i = 0; i < total; i++) {
      expect((await asUser(t, sam).query(api.drops.mine, {})).kind).toBe("choosing");
      await asUser(t, sam).mutation(api.drops.passForever, {});
    }
    expect(await asUser(t, sam).query(api.drops.mine, {})).toMatchObject({ kind: "done" });
    await asUser(t, sam).mutation(api.drops.passForever, {}); // no-op once passed
    await expect(asUser(t, sam).mutation(api.drops.seeMore, {})).rejects.toThrow(/validation_failed/);

    await asUser(t, kai).mutation(api.drops.seeMore, {});
    // Locked: the server state is deciding, whatever the screen does.
    expect((await asUser(t, kai).query(api.drops.mine, {})).kind).toBe("deciding");
    await expect(asUser(t, kai).mutation(api.drops.passForever, {})).rejects.toThrow(/validation_failed/);
    await asUser(t, kai).mutation(api.drops.nextTime, {});
    await asUser(t, kai).mutation(api.drops.nextTime, {});
    expect(await asUser(t, kai).query(api.drops.mine, {})).toMatchObject({ kind: "done" });
  });

  test("turned away: still on cards when choosing ends, or not accepted by matching", async () => {
    const { t, admin } = await world();
    await makeEvent(t, { startsAt: START });
    const cards = await makeStudent(t, { firstName: "Cards" });
    const late = await makeStudent(t, { firstName: "Late" });
    const slow = await makeStudent(t, { firstName: "Slow" });
    await startDrop(t, admin);
    await asUser(t, late).mutation(api.drops.seeMore, {});
    await asUser(t, slow).mutation(api.drops.seeMore, {});
    await admin.mutation(api.admin.drops.endChoosing, {});
    await settle(t);
    expect(await asUser(t, cards).query(api.drops.mine, {})).toEqual({ kind: "none" });
    expect((await entryOf(t, cards))!.state).toBe("turned_away");
    // On an event screen: still time to accept.
    expect((await asUser(t, late).query(api.drops.mine, {})).kind).toBe("deciding");
    await expect(asUser(t, cards).mutation(api.drops.seeMore, {})).rejects.toThrow(/validation_failed/);
    await asUser(t, late).mutation(api.drops.accept, {});
    await admin.mutation(api.admin.drops.matchNow, {});
    await settle(t);
    expect((await entryOf(t, slow))!.state).toBe("turned_away");
    expect(await asUser(t, slow).query(api.drops.mine, {})).toEqual({ kind: "none" });
  });

  test("admin runs transitions early; the scheduled runs then no-op", async () => {
    const { t, admin } = await world();
    await makeEvent(t, { startsAt: START });
    const sam = await makeStudent(t, { firstName: "Sam" });
    await startDrop(t, admin);
    await asUser(t, sam).mutation(api.drops.seeMore, {});
    await asUser(t, sam).mutation(api.drops.accept, {});
    await admin.mutation(api.admin.drops.matchNow, {});
    await settle(t);
    const plans = async () => t.run(async (ctx) => (await ctx.db.query("meetups").collect()).length);
    const before = await plans();
    expect((await admin.query(api.admin.drops.status, {})).drop?.status).toBe("matched");
    await advance(t, DROP.choosingMs + DROP.confirmMs + 1000);
    expect(await plans()).toBe(before);
    expect((await admin.query(api.admin.drops.status, {})).drop?.status).toBe("matched");
    // A new drop can start once the last one matched; a second one while open can't.
    await admin.mutation(api.admin.drops.start, {});
    await expect(admin.mutation(api.admin.drops.start, {})).rejects.toThrow(/validation_failed/);
  });

  test("a late joiner during choosing gets their own choices; a student with a plan skips the drop", async () => {
    const { t, admin } = await world();
    await makeEvent(t, { startsAt: START });
    await startDrop(t, admin);
    const newbie = await makeStudent(t, { firstName: "New" });
    expect(await entryOf(t, newbie)).toBeNull();
    await t.mutation(internal.asks.picker.pickForUser, { userId: newbie });
    expect((await asUser(t, newbie).query(api.drops.mine, {})).kind).toBe("choosing");
    // No asks are created any more.
    expect(await t.run(async (ctx) => (await ctx.db.query("asks").collect()).length)).toBe(0);
  });

  test("demo students act on their own, are fast-forwarded on Match now, and fill leftover seats", async () => {
    const { t, admin } = await world();
    const eventId = await makeEvent(t, { startsAt: START });
    const demoA = await makeStudent(t, { firstName: "Demo A", isDemo: true, demoKey: "a", email: "a@demo.invalid", artists: ["Big Thief"] });
    const demoB = await makeStudent(t, { firstName: "Demo B", isDemo: true, demoKey: "b", email: "b@demo.invalid", artists: ["Big Thief"] });
    const sam = await makeStudent(t, { firstName: "Sam", artists: ["Big Thief"] });
    await startDrop(t, admin);
    await advance(t, 25_000);
    expect((await entryOf(t, demoA))!.state).toBe("accepted");
    // Demo B is reset to cards; Match now fast-forwards it.
    await t.run(async (ctx) => {
      const entry = (await ctx.db.query("dropEntries").collect()).find((e) => e.userId === demoB)!;
      await ctx.db.patch(entry._id, { state: "choosing", eventId: undefined, index: 0 });
    });
    await asUser(t, sam).mutation(api.drops.seeMore, {});
    await asUser(t, sam).mutation(api.drops.accept, {});
    await admin.mutation(api.admin.drops.matchNow, {});
    await settle(t);

    const plans = await t.run(async (ctx) => ctx.db.query("meetups").collect());
    expect(plans).toHaveLength(1);
    expect(plans[0].eventId).toBe(eventId);
    expect(plans[0].status).toBe("set");
    const members = (await seatsFor(t, plans[0]._id)).map((s) => s.userId);
    expect(members).toContain(sam);
    // Never demo with demo: the other demo student is left unmatched.
    const states = [(await entryOf(t, demoA))!.state, (await entryOf(t, demoB))!.state].sort();
    expect(states).toEqual(["matched", "unmatched"]);
    const counts = (await admin.query(api.admin.drops.status, {})).drop!.counts;
    expect(counts).toMatchObject({ eligible: 4, demo: 2, matched: 2, unmatched: 1 });
  });

  test("a real pair on a shared event; a leftover real student gets a demo who accepted another event", async () => {
    const { t, admin } = await world();
    const eventId = await makeEvent(t, { startsAt: START });
    const real = await Promise.all(
      ["One", "Two", "Three"].map((name) => makeStudent(t, { firstName: name, artists: ["Big Thief"] })),
    );
    const demo = await makeStudent(t, { firstName: "Demo", isDemo: true, demoKey: "d", email: "d@demo.invalid", artists: ["Big Thief"] });
    await startDrop(t, admin);
    // Demo accepted "another" event: move its entry away.
    const other = await makeEvent(t, { startsAt: START + HOUR });
    await t.run(async (ctx) => {
      const entry = (await ctx.db.query("dropEntries").collect()).find((e) => e.userId === demo)!;
      await ctx.db.patch(entry._id, { state: "accepted", eventId: other });
    });
    for (const id of real) {
      await asUser(t, id).mutation(api.drops.seeMore, {});
      await asUser(t, id).mutation(api.drops.accept, {});
    }
    await admin.mutation(api.admin.drops.matchNow, {});
    await settle(t);
    const plans = (await t.run(async (ctx) => ctx.db.query("meetups").collect())).filter((p) => p.eventId === eventId);
    expect(plans).toHaveLength(2);
    expect(plans.every((p) => p.status === "set")).toBe(true);
    const pairs = await Promise.all(plans.map(async (p) => (await seatsFor(t, p._id)).map((s) => s.userId)));
    expect(pairs.filter((pair) => pair.includes(demo))).toHaveLength(1);
    expect(pairs.flat().filter((id) => real.includes(id))).toHaveLength(3);
  });

  test("the reveal skips the song step when there's no shared track, and falls back to a label", async () => {
    const { t, admin } = await world();
    await makeEvent(t, { startsAt: START });
    const a = await makeStudent(t, { firstName: "Ann", artists: ["Only Ann"], labels: ["indie folk"] });
    const b = await makeStudent(t, { firstName: "Ben", artists: ["Only Ben"], labels: ["indie folk"] });
    await startDrop(t, admin);
    for (const id of [a, b]) {
      await asUser(t, id).mutation(api.drops.seeMore, {});
      await asUser(t, id).mutation(api.drops.accept, {});
    }
    await admin.mutation(api.admin.drops.matchNow, {});
    await settle(t);
    const view = await asUser(t, a).query(api.drops.mine, {});
    if (view.kind !== "reveal") throw new Error("expected a reveal");
    const { steps } = await asUser(t, a).query(api.drops.reveal, { meetupId: view.meetupId });
    expect(steps).toEqual([{ kind: "going" }, { kind: "label", name: "indie folk" }, { kind: "name", firstName: "Ben" }]);
  });

  test("the admin gate", async () => {
    const { t } = await world();
    const sam = asUser(t, await makeStudent(t, { firstName: "Sam" }));
    await expect(sam.query(api.admin.drops.status, {})).rejects.toThrow(/forbidden/);
    await expect(sam.mutation(api.admin.drops.start, {})).rejects.toThrow(/forbidden/);
    await expect(sam.mutation(api.admin.drops.endChoosing, {})).rejects.toThrow(/forbidden/);
    await expect(sam.mutation(api.admin.drops.matchNow, {})).rejects.toThrow(/forbidden/);
  });

  test("emails go only to real students", async () => {
    const { t, admin } = await world();
    await makeEvent(t, { startsAt: START });
    await makeStudent(t, { firstName: "Demo", isDemo: true, demoKey: "d", email: "d@demo.invalid" });
    const sam = await makeStudent(t, { firstName: "Sam" });
    await startDrop(t, admin);
    await settle(t);
    const to = () => mocks.sendEmail.mock.calls.map(([message]) => message.to as string);
    expect(to().sort()).toEqual([ADMIN, "sam@berkeley.edu"].sort());
    expect(mocks.sendEmail.mock.calls[0][0].subject).toBe("Your Melos drop is open");
    expect(mocks.sendEmail.mock.calls.every(([m]) => !/!/.test(m.subject + m.text))).toBe(true);
    mocks.sendEmail.mockClear();
    await asUser(t, sam).mutation(api.drops.seeMore, {});
    await asUser(t, sam).mutation(api.drops.accept, {});
    await admin.mutation(api.admin.drops.matchNow, {});
    await advance(t, 10_000);
    expect((await entryOf(t, sam))!.state).toBe("matched");
    expect(to()).toEqual(["sam@berkeley.edu"]);
    expect(mocks.sendEmail.mock.calls[0][0].subject).toBe("You've been matched");
  });
});

describe("audience profiles", () => {
  test("the backfill writes a validated profile and its vector; Claude sees only public event data", async () => {
    const { t } = await world();
    const eventId = await makeEvent(t, { startsAt: START, performers: ["Big Thief"] });
    mocks.generateJson.mockResolvedValue({ audience: "Folk fans who like quiet rooms.", labels: ["indie folk", "indie pop", "dream pop"], energy: "low" });
    mocks.embed.mockResolvedValue([[0.1, 0.2]]);
    expect(await t.mutation(internal.drops.audience.backfill, {})).toBe(1);
    await advance(t, 5000);
    const event = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(event?.audienceProfile).toMatchObject({ energy: "low", labels: ["indie folk", "indie pop", "dream pop"] });
    expect(event?.audienceEmbedding).toEqual([0.1, 0.2]);
    const prompt = mocks.generateJson.mock.calls[0][0].prompt as string;
    expect(JSON.parse(prompt)).toEqual({ title: "Indie folk night", kind: "concert", performers: ["Big Thief"], tags: [], venue: "The UC Theatre" });
    // Up to date: nothing more to queue.
    expect(await t.mutation(internal.drops.audience.backfill, {})).toBe(0);
  });
});

describe("the runtime switch", () => {
  test("DROP_ENABLED=false brings back the old asks and refuses Start drop", async () => {
    const { t, admin } = await world();
    await makeStudent(t, { firstName: "Sam" });
    expect(await t.mutation(internal.asks.picker.pickAfterImport, {})).toBe(0);
    process.env.DROP_ENABLED = "false";
    try {
      expect(await t.mutation(internal.asks.picker.pickAfterImport, {})).toBeGreaterThan(0);
      expect(await t.mutation(internal.drops.audience.backfill, {})).toBe(0);
      await expect(admin.mutation(api.admin.drops.start, {})).rejects.toThrow(/validation_failed/);
    } finally {
      delete process.env.DROP_ENABLED;
    }
  });
});

describe("quiet drops", () => {
  test("a quiet drop queues no emails at start or at the scheduled match", async () => {
    const { t, admin } = await world();
    await makeEvent(t, { startsAt: START });
    await makeStudent(t, { firstName: "Demo", isDemo: true, demoKey: "d", email: "d@demo.invalid" });
    const sam = await makeStudent(t, { firstName: "Sam" });
    await admin.mutation(api.admin.drops.start, { email: false });
    await advance(t, 1000);
    await asUser(t, sam).mutation(api.drops.seeMore, {});
    await asUser(t, sam).mutation(api.drops.accept, {});
    await advance(t, DROP.choosingMs + DROP.confirmMs);
    expect((await entryOf(t, sam))!.state).toBe("matched");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  test("Match now with email false silences the match email", async () => {
    const { t, admin } = await world();
    await makeEvent(t, { startsAt: START });
    await makeStudent(t, { firstName: "Demo", isDemo: true, demoKey: "d", email: "d@demo.invalid" });
    const sam = await makeStudent(t, { firstName: "Sam" });
    await startDrop(t, admin);
    await advance(t, 5000);
    mocks.sendEmail.mockClear();
    await asUser(t, sam).mutation(api.drops.seeMore, {});
    await asUser(t, sam).mutation(api.drops.accept, {});
    await admin.mutation(api.admin.drops.matchNow, { email: false });
    await advance(t, 10_000);
    expect((await entryOf(t, sam))!.state).toBe("matched");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
