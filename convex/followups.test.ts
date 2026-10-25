/// <reference types="vite/client" />
// Regression tests for the acceptance audit's follow-up items (PR 2).
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  advance,
  asUser,
  DAY,
  HOUR,
  makeAsk,
  makeEvent,
  makeStudent,
  MINUTE,
  plansFor,
  seatsFor,
  setup,
  type T,
} from "./testing.helpers";

vi.mock("./services/claude", () => ({
  generateJson: vi.fn(async () => {
    throw new Error("Claude is not available in tests");
  }),
}));

afterEach(() => {
  vi.useRealTimers();
});

const STARTS = Date.UTC(2026, 9, 30, 3, 0); // Thu Oct 29, 8:00 pm PT
const MEET = STARTS - 30 * MINUTE;
const CUTOFF = MEET - 2 * HOUR;

async function pairOn(t: T, a: Id<"users">, b: Id<"users">, eventId: Id<"events">) {
  await makeAsk(t, a, eventId);
  await makeAsk(t, b, eventId);
  await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
  const plans = await plansFor(t, eventId);
  const plan = plans[plans.length - 1];
  const seats = await seatsFor(t, plan._id);
  return { meetupId: plan._id, seatOf: (userId: Id<"users">) => seats.find((s) => s.userId === userId)!._id };
}

describe("stay in touch and contacts", () => {
  test("shareable lists a completed plan even after a newer offer arrives; mine lists my shares", async () => {
    const t = await setup();
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const maya = await makeStudent(t, { firstName: "Maya" });
    const sam = await makeStudent(t, { firstName: "Sam" });
    const p = await pairOn(t, maya, sam, eventId);
    await asUser(t, maya).mutation(api.plans.accept, { seatId: p.seatOf(maya) });
    await asUser(t, sam).mutation(api.plans.accept, { seatId: p.seatOf(sam) });
    expect(await asUser(t, maya).query(api.contacts.shareable, {})).toEqual([]);

    vi.setSystemTime(STARTS + 4 * HOUR);
    await t.mutation(internal.plans.reconcile.run, { meetupId: p.meetupId });
    // A newer offer for another event takes over home.
    const next = await makeEvent(t, { title: "Next", startsAt: STARTS + 3 * DAY });
    const lee = await makeStudent(t, { firstName: "Lee" });
    await pairOn(t, maya, lee, next);
    expect((await asUser(t, maya).query(api.plans.current, {}))!.event.title).toBe("Next");

    const shareable = await asUser(t, maya).query(api.contacts.shareable, {});
    expect(shareable).toEqual([
      { meetupId: p.meetupId, partnerFirstName: "Sam", eventTitle: "Indie folk night", startsAt: STARTS },
    ]);
    await asUser(t, maya).mutation(api.contacts.share, { meetupId: p.meetupId, kind: "instagram", value: "@maya" });
    expect(await asUser(t, maya).query(api.contacts.mine, {})).toEqual([
      { meetupId: p.meetupId, partnerFirstName: "Sam", kind: "instagram", value: "@maya" },
    ]);
    await asUser(t, maya).mutation(api.contacts.stopSharing, { meetupId: p.meetupId, kind: "instagram" });
    expect(await asUser(t, maya).query(api.contacts.mine, {})).toEqual([]);
    // Lee was never in a plan with Maya at a meeting time.
    expect(await asUser(t, lee).query(api.contacts.shareable, {})).toEqual([]);

    // Old plans fall out of shareable after a week.
    vi.setSystemTime(STARTS + 8 * DAY);
    expect(await asUser(t, maya).query(api.contacts.shareable, {})).toEqual([]);
  });
});

describe("the meeting spot needs a plan that was set", () => {
  test("never set: the remaining student doesn't keep a spot they never had", async () => {
    const t = await setup();
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const maya = await makeStudent(t, { firstName: "Maya" });
    const sam = await makeStudent(t, { firstName: "Sam" });
    const p = await pairOn(t, maya, sam, eventId);
    await asUser(t, maya).mutation(api.plans.accept, { seatId: p.seatOf(maya) });
    await asUser(t, maya).mutation(api.plans.cantMakeIt, { seatId: p.seatOf(maya) });
    await asUser(t, sam).mutation(api.plans.accept, { seatId: p.seatOf(sam) });
    const sam1 = (await asUser(t, sam).query(api.plans.current, {}))!;
    expect(sam1.stage).toBe("waiting");
    expect(sam1.meeting).toBeNull();
    expect(sam1.ticketUrl).toBeNull();
  });

  test("called off by the cutoff before it was ever set: no spot", async () => {
    const t = await setup();
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const maya = await makeStudent(t, { firstName: "Maya" });
    const sam = await makeStudent(t, { firstName: "Sam" });
    const p = await pairOn(t, maya, sam, eventId);
    await asUser(t, maya).mutation(api.plans.accept, { seatId: p.seatOf(maya) });
    vi.setSystemTime(CUTOFF);
    await t.mutation(internal.plans.reconcile.run, { meetupId: p.meetupId });
    const view = (await asUser(t, maya).query(api.plans.current, {}))!;
    expect(view.notice).toBe("nobody_by_cutoff");
    expect(view.meeting).toBeNull();
  });

  test("set, then a drop: the student who was in keeps the spot", async () => {
    const t = await setup();
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const maya = await makeStudent(t, { firstName: "Maya" });
    const sam = await makeStudent(t, { firstName: "Sam" });
    const p = await pairOn(t, maya, sam, eventId);
    await asUser(t, maya).mutation(api.plans.accept, { seatId: p.seatOf(maya) });
    await asUser(t, sam).mutation(api.plans.accept, { seatId: p.seatOf(sam) });
    expect((await t.run(async (ctx) => ctx.db.get(p.meetupId)))!.setAt).toBeDefined();
    await asUser(t, sam).mutation(api.plans.cantMakeIt, { seatId: p.seatOf(sam) });
    expect((await asUser(t, maya).query(api.plans.current, {}))!.meeting?.spotName).toBe("Sather Gate");
  });
});

describe("smaller fixes", () => {
  test("demo students' yeses don't count toward the close-fit boost", async () => {
    const t = await setup();
    const student = await makeStudent(t, { firstName: "Maya", artists: ["Big Thief"] });
    const demo = await makeStudent(t, { firstName: "Rowan", isDemo: true, demoKey: "demo-5", artists: ["Big Thief"] });
    const early = await makeEvent(t, { title: "Early", performers: [], startsAt: STARTS });
    const late = await makeEvent(t, { title: "Late", performers: [], startsAt: STARTS + HOUR });
    await makeAsk(t, demo, late);
    const shortlist = await t.query(internal.asks.picker.shortlist, { userId: student, similarities: [] });
    expect(shortlist.map((c) => c.eventId)).toEqual([early, late]);
    expect(shortlist[0].score).toBe(shortlist[1].score);
  });

  test("a free-entry event with no listed price reads Free", async () => {
    const t = await setup();
    const student = await makeStudent(t, { firstName: "Maya" });
    const eventId = await makeEvent(t, { priceMin: null, priceMax: null, startsAt: STARTS });
    await t.run(async (ctx) => ctx.db.patch(eventId, { freeEntryNote: "Free with RSVP" }));
    await makeAsk(t, student, eventId, "pending");
    expect((await asUser(t, student).query(api.week.mine, {}))[0].priceLabel).toBe("Free");
  });

  test("I can't make it and I need to leave follow the plan clock, even before reconcile runs", async () => {
    const t = await setup();
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const maya = await makeStudent(t, { firstName: "Maya" });
    const sam = await makeStudent(t, { firstName: "Sam" });
    const p = await pairOn(t, maya, sam, eventId);
    await asUser(t, maya).mutation(api.plans.accept, { seatId: p.seatOf(maya) });
    await asUser(t, sam).mutation(api.plans.accept, { seatId: p.seatOf(sam) });
    vi.setSystemTime(MEET);
    const view = (await asUser(t, maya).query(api.plans.current, {}))!;
    expect(view.canCantMakeIt).toBe(false);
    expect(view.canLeave).toBe(true);
    // And leave works: it reconciles first.
    await asUser(t, maya).mutation(api.plans.leave, { seatId: p.seatOf(maya) });
  });

  test("student-facing errors read as student copy", async () => {
    const t = await setup();
    const student = await makeStudent(t, { firstName: "Maya" });
    const eventId = await makeEvent(t, { startsAt: Date.now() + 3 * HOUR + MINUTE });
    const askId = await makeAsk(t, student, eventId, "pending");
    vi.setSystemTime(Date.now() + HOUR);
    await expect(asUser(t, student).mutation(api.week.answer, { askId, answer: "yes" })).rejects.toThrow(
      /This one has closed/,
    );
  });

  test("the repeat-pair block only counts people who held seats at the same time", async () => {
    const t = await setup();
    const first = await makeEvent(t, { startsAt: STARTS });
    const maya = await makeStudent(t, { firstName: "Maya" });
    const sam = await makeStudent(t, { firstName: "Sam" });
    const p = await pairOn(t, maya, sam, first);
    await asUser(t, maya).mutation(api.plans.accept, { seatId: p.seatOf(maya) });
    await asUser(t, sam).mutation(api.plans.nextTime, { seatId: p.seatOf(sam) });
    await advance(t, 1000);
    const lee = await makeStudent(t, { firstName: "Lee" });
    await makeAsk(t, lee, first);
    await t.mutation(internal.matching.run.forEvent, { eventId: first, trigger: "seat_open" });
    expect((await seatsFor(t, p.meetupId)).some((s) => s.userId === lee)).toBe(true);

    // Sam and Lee were in the same plan, but never at the same time.
    const second = await makeEvent(t, { title: "Second", startsAt: STARTS + DAY });
    await makeAsk(t, sam, second);
    const leeSeat = (await seatsFor(t, p.meetupId)).find((s) => s.userId === lee)!;
    await asUser(t, lee).mutation(api.plans.nextTime, { seatId: leeSeat._id });
    await makeAsk(t, lee, second);
    await t.mutation(internal.matching.run.forEvent, { eventId: second, trigger: "admin" });
    expect(await plansFor(t, second)).toHaveLength(1);
  });

  test("a resumed yes waits the full demo-fill wait before a demo partner", async () => {
    const t = await setup();
    await t.mutation(internal.demo.admin.seed, {});
    const e1 = await makeEvent(t, { title: "E1", startsAt: STARTS });
    const e2 = await makeEvent(t, { title: "E2", startsAt: STARTS + DAY, performers: [] });
    const ana = await makeStudent(t, { firstName: "Ana" });
    const ben = await makeStudent(t, { firstName: "Ben" });
    const p = await pairOn(t, ana, ben, e1);
    await makeAsk(t, ana, e2); // a yes given long before she's free
    await advance(t, 10 * MINUTE);
    await asUser(t, ana).mutation(api.plans.nextTime, { seatId: p.seatOf(ana) });
    await advance(t, 20_000);
    expect(await plansFor(t, e2)).toHaveLength(0);
    await advance(t, 50_000);
    expect(await plansFor(t, e2)).toHaveLength(1);
  });
});
