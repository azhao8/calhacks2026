/// <reference types="vite/client" />
// The PR #11 review probes (docs/review/pr11-probes.test.ts.txt), turned into regression tests.
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { pacificMidnight } from "./plans/model";
import { validateHook } from "./ai/hooks";
import {
  advance,
  asUser,
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
  delete process.env.ADMIN_EMAILS;
});

const STARTS = Date.UTC(2026, 9, 30, 3, 0); // Thu Oct 29, 8:00 pm PT
const MEET = STARTS - 30 * MINUTE;
const CUTOFF = MEET - 2 * HOUR;

async function pair(t: T, a: Id<"users">, b: Id<"users">, eventId: Id<"events">) {
  await makeAsk(t, a, eventId);
  await makeAsk(t, b, eventId);
  await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
  const plans = await plansFor(t, eventId);
  return plans[0];
}

async function acceptAll(t: T, meetupId: Id<"meetups">) {
  for (const seat of await seatsFor(t, meetupId)) {
    if (seat.seat === "offered") await asUser(t, seat.userId).mutation(api.plans.accept, { seatId: seat._id });
  }
}

const getPlan = (t: T, meetupId: Id<"meetups">) => t.run(async (ctx) => (await ctx.db.get(meetupId))!);

describe("review fixes", () => {
  test("P1: team accounts who rehearsed together pair again on stage after reset, with fresh asks", async () => {
    process.env.ADMIN_EMAILS = "t1@berkeley.edu,t2@berkeley.edu";
    const t = await setup();
    await t.mutation(internal.demo.admin.seed, {});
    const t1 = await makeStudent(t, { firstName: "Alex", email: "t1@berkeley.edu" });
    const t2 = await makeStudent(t, { firstName: "John", email: "t2@berkeley.edu" });
    const rehearsal = await makeEvent(t, { title: "Rehearsal", startsAt: STARTS });
    const plan = await pair(t, t1, t2, rehearsal);
    for (const seat of await seatsFor(t, plan._id)) {
      await asUser(t, seat.userId).mutation(api.plans.nextTime, { seatId: seat._id });
    }
    const result = await t.mutation(internal.demo.admin.reset, {});
    expect(result.deletedPlans).toBe(1);
    expect(result.teamAsksDeleted).toBe(2);
    expect((await t.query(internal.asks.picker.context, { userId: t1 })).slots).toBe(3);

    const stage = await makeEvent(t, { title: "Stage", startsAt: STARTS + 24 * HOUR });
    const stagePlan = await pair(t, t1, t2, stage);
    expect(stagePlan).toBeDefined();
    expect((await seatsFor(t, stagePlan._id)).map((s) => s.userId).sort()).toEqual([t1, t2].sort());
  });

  test("P1: the 7-day block still applies to real students", async () => {
    const t = await setup();
    const a = await makeStudent(t, { firstName: "Ana" });
    const b = await makeStudent(t, { firstName: "Ben" });
    const first = await makeEvent(t, { startsAt: STARTS });
    const plan = await pair(t, a, b, first);
    for (const seat of await seatsFor(t, plan._id)) {
      await asUser(t, seat.userId).mutation(api.plans.nextTime, { seatId: seat._id });
    }
    const second = await makeEvent(t, { startsAt: STARTS + 24 * HOUR });
    expect(await pair(t, a, b, second)).toBeUndefined();
  });

  test("P2: can't make it on an offered seat fails and never reveals the meeting spot", async () => {
    const t = await setup();
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const a = await makeStudent(t, { firstName: "Ana" });
    const b = await makeStudent(t, { firstName: "Ben" });
    const plan = await pair(t, a, b, eventId);
    const seats = await seatsFor(t, plan._id);
    const aSeat = seats.find((s) => s.userId === a)!._id;
    const bSeat = seats.find((s) => s.userId === b)!._id;
    await asUser(t, a).mutation(api.plans.accept, { seatId: aSeat });
    await expect(asUser(t, b).mutation(api.plans.cantMakeIt, { seatId: bSeat })).rejects.toThrow(/seat_unavailable/);
    await expect(asUser(t, b).mutation(api.plans.setTicket, { seatId: bSeat, ticket: "couldnt" })).rejects.toThrow(
      /seat_unavailable/,
    );
    // "Next time" is the way to decline an offer; it doesn't reveal the spot either.
    await asUser(t, b).mutation(api.plans.nextTime, { seatId: bSeat });
    const view = (await asUser(t, a).query(api.plans.current, {}))!;
    expect(view.meeting).toBeNull();
    expect(view.ticketUrl).toBeNull();
  });

  test("P3: a plan set on the event day shows meetup day at once", async () => {
    const t = await setup();
    vi.setSystemTime(pacificMidnight(STARTS) + 9 * HOUR);
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const a = await makeStudent(t, { firstName: "Ana" });
    const b = await makeStudent(t, { firstName: "Ben" });
    const plan = await pair(t, a, b, eventId);
    await acceptAll(t, plan._id);
    const view = (await asUser(t, a).query(api.plans.current, {}))!;
    expect(view.stage).toBe("meetup_day");
    expect(view.marker).not.toBeNull();
  });

  test("P4: after reset the real student keeps the meeting spot and is told the partner can't make it", async () => {
    const t = await setup();
    await t.mutation(internal.demo.admin.seed, {});
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const ana = await makeStudent(t, { firstName: "Ana" });
    await makeAsk(t, ana, eventId);
    await advance(t, 2 * MINUTE);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    const [plan] = await plansFor(t, eventId);
    const anaSeat = (await seatsFor(t, plan._id)).find((s) => s.userId === ana)!;
    await asUser(t, ana).mutation(api.plans.accept, { seatId: anaSeat._id });
    await advance(t, 25_000);
    expect((await asUser(t, ana).query(api.plans.current, {}))!.stage).toBe("set");
    await t.mutation(internal.demo.admin.reset, {});
    const after = (await asUser(t, ana).query(api.plans.current, {}))!;
    expect(after.stage).toBe("waiting");
    expect(after.notice).toBe("partner_dropped");
    expect(after.meeting?.spotName).toBe("Sather Gate");
    expect(after.beforeCutoff).toBe(true);
  });

  test("P5: a Spotify disconnect after the meeting time is like leaving; the plan and contacts continue", async () => {
    const t = await setup();
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const a = await makeStudent(t, { firstName: "Ana" });
    const b = await makeStudent(t, { firstName: "Ben" });
    const plan = await pair(t, a, b, eventId);
    await acceptAll(t, plan._id);
    vi.setSystemTime(MEET + 10 * MINUTE);
    await t.mutation(internal.plans.reconcile.run, { meetupId: plan._id });
    await asUser(t, b).mutation(api.contacts.share, { meetupId: plan._id, kind: "phone", value: "5105550123" });
    await t.mutation(internal.plans.release.forUser, { userId: b });
    const p = await getPlan(t, plan._id);
    expect(p.status).toBe("set");
    const view = (await asUser(t, a).query(api.plans.current, {}))!;
    expect(view.notice).toBe("partner_left");
    expect(view.canShare).toBe(true);
    expect(await asUser(t, a).query(api.contacts.list, {})).toHaveLength(1);
  });

  test("P6: a real student refilling a jumped demo plan doesn't see the marker early", async () => {
    process.env.ADMIN_EMAILS = "t1@berkeley.edu";
    const t = await setup();
    await t.mutation(internal.demo.admin.seed, {});
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const team = await makeStudent(t, { firstName: "Alex", email: "t1@berkeley.edu" });
    await makeAsk(t, team, eventId);
    await advance(t, 2 * MINUTE);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    const [plan] = await plansFor(t, eventId);
    const teamSeat = (await seatsFor(t, plan._id)).find((s) => s.userId === team)!;
    await asUser(t, team).mutation(api.plans.accept, { seatId: teamSeat._id });
    await advance(t, 25_000);
    await t.mutation(internal.demo.admin.setClockOffset, {
      offsetMs: pacificMidnight(STARTS) + 9 * HOUR - Date.now(),
    });
    expect((await getPlan(t, plan._id)).dayRevealedAt).toBeDefined();
    const demoSeat = (await seatsFor(t, plan._id)).find((s) => s.userId !== team)!;
    await t.mutation(internal.demo.admin.actAs, { userId: demoSeat.userId, action: "cant_make_it" });
    const real = await makeStudent(t, { firstName: "Ana" });
    await makeAsk(t, real, eventId);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "seat_open" });
    const realSeat = (await seatsFor(t, plan._id)).find((s) => s.userId === real)!;
    await asUser(t, real).mutation(api.plans.accept, { seatId: realSeat._id });
    const p = await getPlan(t, plan._id);
    expect(p.isDemoPlan).toBe(false);
    expect(p.dayRevealedAt).toBeUndefined();
    const view = (await asUser(t, real).query(api.plans.current, {}))!;
    expect(view.stage).toBe("set");
    expect(view.marker).toBeNull();
    expect(view.icebreaker).toBeNull();
  });

  test("P8: only labels both students have may appear in a hook or icebreaker", () => {
    const shared = [{ kind: "artist" as const, name: "Big Thief" }];
    const known = new Set(["big thief", "mitski", "jazz", "indie folk"]);
    expect(
      validateHook(
        { hook: "You both have Big Thief on repeat, plus a soft spot for jazz.", icebreaker: "Which jazz record got you started?" },
        shared,
        known,
      ),
    ).toBeNull();
    const sharedLabel = [...shared, { kind: "label" as const, name: "indie folk" }];
    expect(
      validateHook(
        { hook: "You both have Big Thief on repeat.", icebreaker: "What got you into indie folk?" },
        sharedLabel,
        known,
      ),
    ).not.toBeNull();
  });

  test("P9: giving up a seat sends the student's other yeses back to the matcher right away", async () => {
    const t = await setup();
    const e1 = await makeEvent(t, { title: "E1", startsAt: STARTS });
    const e2 = await makeEvent(t, { title: "E2", startsAt: STARTS + 24 * HOUR });
    const a = await makeStudent(t, { firstName: "Ana" });
    const b = await makeStudent(t, { firstName: "Ben" });
    const c = await makeStudent(t, { firstName: "Cy" });
    const plan = await pair(t, a, b, e1);
    const aE2 = await makeAsk(t, a, e2, "pending");
    const cE2 = await makeAsk(t, c, e2, "pending");
    await asUser(t, a).mutation(api.week.answer, { askId: aE2, answer: "yes" });
    await asUser(t, c).mutation(api.week.answer, { askId: cE2, answer: "yes" });
    await advance(t, 2 * MINUTE);
    expect(await plansFor(t, e2)).toHaveLength(0);
    const aSeat = (await seatsFor(t, plan._id)).find((s) => s.userId === a)!;
    await asUser(t, a).mutation(api.plans.nextTime, { seatId: aSeat._id });
    await advance(t, 16_000);
    const [e2Plan] = await plansFor(t, e2);
    expect((await seatsFor(t, e2Plan._id)).map((s) => s.userId).sort()).toEqual([a, c].sort());
  });

  test("12: when the partner's offer goes out first, my offer stays and names who dropped", async () => {
    const t = await setup();
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const a = await makeStudent(t, { firstName: "Ana" });
    const b = await makeStudent(t, { firstName: "Ben" });
    const plan = await pair(t, a, b, eventId);
    const bSeat = (await seatsFor(t, plan._id)).find((s) => s.userId === b)!;
    await asUser(t, b).mutation(api.plans.nextTime, { seatId: bSeat._id });
    const view = (await asUser(t, a).query(api.plans.current, {}))!;
    expect(view.stage).toBe("offer");
    expect(view.notice).toBe("partner_dropped");
    expect(view.previousPartnerFirstName).toBe("Ben");
    expect(view.partner).toBeNull();
  });

  test("5: beforeCutoff and week cards update live at the cutoff, through the scheduler", async () => {
    const t = await setup();
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const a = await makeStudent(t, { firstName: "Ana" });
    const b = await makeStudent(t, { firstName: "Ben" });
    const plan = await pair(t, a, b, eventId);
    await acceptAll(t, plan._id);
    // A third student with an open ask made by the picker, which schedules its close.
    const c = await makeStudent(t, { firstName: "Cy" });
    await t.mutation(internal.asks.picker.save, { userId: c, picks: [{ eventId, reason: "test" }] });
    expect(await asUser(t, c).query(api.week.mine, {})).toHaveLength(1);
    expect((await asUser(t, a).query(api.plans.current, {}))!.beforeCutoff).toBe(true);

    await advance(t, CUTOFF - Date.now() + 1000);
    expect((await getPlan(t, plan._id)).cutoffPassedAt).toBeDefined();
    expect((await asUser(t, a).query(api.plans.current, {}))!.beforeCutoff).toBe(false);
    const asks = await t.run(async (ctx) =>
      ctx.db
        .query("asks")
        .withIndex("by_user", (q) => q.eq("userId", c))
        .collect(),
    );
    expect(asks[0].closedReason).toBe("cutoff");
  });
});
