/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { pacificMidnight } from "./plans/model";
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

// Thursday, Oct 29, 2026, 8:00 pm Pacific; meeting 7:30 pm; cutoff 5:30 pm.
const STARTS = Date.UTC(2026, 9, 30, 3, 0);
const MEET = STARTS - 30 * MINUTE;
const CUTOFF = MEET - 2 * HOUR;

async function pairUp(t: T, extra: { aEmail?: string; bEmail?: string } = {}) {
  const eventId = await makeEvent(t, { startsAt: STARTS });
  const maya = await makeStudent(t, { firstName: "Maya", email: extra.aEmail });
  const sam = await makeStudent(t, { firstName: "Sam", email: extra.bEmail });
  await makeAsk(t, maya, eventId);
  await makeAsk(t, sam, eventId);
  await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
  const [plan] = await plansFor(t, eventId);
  const seats = await seatsFor(t, plan._id);
  const seatOf = (userId: Id<"users">) => seats.find((s) => s.userId === userId)!._id;
  return { eventId, maya, sam, meetupId: plan._id, mayaSeat: seatOf(maya), samSeat: seatOf(sam) };
}

async function bothIn(t: T, p: Awaited<ReturnType<typeof pairUp>>) {
  await asUser(t, p.maya).mutation(api.plans.accept, { seatId: p.mayaSeat });
  await asUser(t, p.sam).mutation(api.plans.accept, { seatId: p.samSeat });
}

async function reconcileAt(t: T, meetupId: Id<"meetups">, at: number) {
  vi.setSystemTime(at);
  await t.mutation(internal.plans.reconcile.run, { meetupId });
}

async function plan(t: T, meetupId: Id<"meetups">) {
  return (await t.run(async (ctx) => ctx.db.get(meetupId)))!;
}

describe("offers and withholding", () => {
  test("an offer shows the partner's first name, event, price, and hook, never the meeting spot", async () => {
    const t = await setup();
    const p = await pairUp(t);
    const view = (await asUser(t, p.maya).query(api.plans.current, {}))!;
    expect(view.stage).toBe("offer");
    expect(view.partner?.firstName).toBe("Sam");
    expect(view.event.title).toBe("Indie folk night");
    expect(view.event.priceLabel).toBe("$18 to $25");
    expect(view.hook).toBe("You both have Big Thief on repeat.");
    expect(view.meeting).toBeNull();
    expect(view.ticketUrl).toBeNull();
    expect(view.marker).toBeNull();
    expect(view.icebreaker).toBeNull();
    expect(view.me.offerExpiresAt).not.toBeNull();
    expect(view.previousPartnerFirstName).toBeNull();
    expect(view.beforeCutoff).toBe(true);
    // Nothing about the partner beyond the first name.
    expect(JSON.stringify(view)).not.toContain("berkeley.edu");
  });

  test("accept is idempotent; one accepted seat waits on the partner; both in sets the plan", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await asUser(t, p.maya).mutation(api.plans.accept, { seatId: p.mayaSeat });
    await asUser(t, p.maya).mutation(api.plans.accept, { seatId: p.mayaSeat });
    const waiting = (await asUser(t, p.maya).query(api.plans.current, {}))!;
    expect(waiting.stage).toBe("waiting");
    expect(waiting.meeting).toBeNull();

    await asUser(t, p.sam).mutation(api.plans.accept, { seatId: p.samSeat });
    expect((await plan(t, p.meetupId)).status).toBe("set");
    const maya = (await asUser(t, p.maya).query(api.plans.current, {}))!;
    const sam = (await asUser(t, p.sam).query(api.plans.current, {}))!;
    expect(maya.stage).toBe("set");
    expect(maya.meeting?.spotName).toBe("Sather Gate");
    expect(maya.meeting?.meetTimeLabel).toBe("7:30 pm");
    expect(sam.meeting).toEqual(maya.meeting);
    expect(maya.ticketUrl).toBe("https://example.com/tickets");
    // The marker and icebreaker wait for meetup day.
    expect(maya.marker).toBeNull();
    expect(maya.icebreaker).toBeNull();

    // An unrelated account can't read the plan or touch its seats.
    const stranger = await makeStudent(t, { firstName: "Lee" });
    expect(await asUser(t, stranger).query(api.plans.current, {})).toBeNull();
    await expect(asUser(t, stranger).mutation(api.plans.accept, { seatId: p.mayaSeat })).rejects.toThrow(/forbidden/);
  });

  test("Got my ticket on both", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await bothIn(t, p);
    await asUser(t, p.maya).mutation(api.plans.setTicket, { seatId: p.mayaSeat, ticket: "got" });
    await asUser(t, p.sam).mutation(api.plans.setTicket, { seatId: p.samSeat, ticket: "got" });
    const view = (await asUser(t, p.maya).query(api.plans.current, {}))!;
    expect(view.me.ticket).toBe("got");
    expect(view.partner?.ticket).toBe("got");
  });

  test("simultaneous accepts never double-book anyone or overfill a plan", async () => {
    const t = await setup();
    const p = await pairUp(t);
    // A second plan offers Maya another seat (the matcher never does; this forces the race).
    const other = await makeEvent(t, { title: "Other", startsAt: STARTS + 24 * HOUR });
    const lee = await makeStudent(t, { firstName: "Lee" });
    const otherSeat = await t.run(async (ctx) => {
      const meetupId = await ctx.db.insert("meetups", {
        eventId: other,
        status: "forming",
        marker: 42,
        meetAt: STARTS + 24 * HOUR - 30 * MINUTE,
        cutoffAt: STARTS + 22 * HOUR - 30 * MINUTE,
        hook: "",
        icebreaker: "",
        hookFromClaude: false,
        isDemoPlan: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("meetupMembers", {
        meetupId,
        userId: lee,
        seat: "offered",
        offeredAt: Date.now(),
        offerExpiresAt: Date.now() + HOUR,
        ticket: "none",
      });
      return await ctx.db.insert("meetupMembers", {
        meetupId,
        userId: p.maya,
        seat: "offered",
        offeredAt: Date.now(),
        offerExpiresAt: Date.now() + HOUR,
        ticket: "none",
      });
    });
    const results = await Promise.allSettled([
      asUser(t, p.maya).mutation(api.plans.accept, { seatId: p.mayaSeat }),
      asUser(t, p.maya).mutation(api.plans.accept, { seatId: otherSeat }),
      asUser(t, p.sam).mutation(api.plans.accept, { seatId: p.samSeat }),
    ]);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const inSeats = await t.run(async (ctx) =>
      ctx.db
        .query("meetupMembers")
        .withIndex("by_user_seat", (q) => q.eq("userId", p.maya).eq("seat", "in"))
        .collect(),
    );
    expect(inSeats).toHaveLength(1);
    expect((await seatsFor(t, p.meetupId)).filter((s) => s.seat !== "out").length).toBeLessThanOrEqual(2);
  });

  test("an offer that runs out reopens only that seat", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await asUser(t, p.maya).mutation(api.plans.accept, { seatId: p.mayaSeat });
    await advance(t, 2 * HOUR + MINUTE);
    const seats = await seatsFor(t, p.meetupId);
    expect(seats.find((s) => s._id === p.samSeat)!.outReason).toBe("no_answer");
    expect(seats.find((s) => s._id === p.mayaSeat)!.seat).toBe("in");
    await expect(asUser(t, p.sam).mutation(api.plans.accept, { seatId: p.samSeat })).rejects.toThrow(/offer_expired/);
    expect((await asUser(t, p.maya).query(api.plans.current, {}))!.notice).toBe("partner_dropped");
  });
});

describe("withholding across states", () => {
  test("previousPartnerFirstName is null unless a partner dropped; beforeCutoff flips at the cutoff", async () => {
    const t = await setup();
    const p = await pairUp(t);
    const views = async () => [
      (await asUser(t, p.maya).query(api.plans.current, {}))!,
      (await asUser(t, p.sam).query(api.plans.current, {}))!,
    ];
    for (const view of await views()) expect(view.previousPartnerFirstName).toBeNull(); // offer
    await asUser(t, p.maya).mutation(api.plans.accept, { seatId: p.mayaSeat });
    for (const view of await views()) expect(view.previousPartnerFirstName).toBeNull(); // waiting / offer
    await asUser(t, p.sam).mutation(api.plans.accept, { seatId: p.samSeat });
    for (const view of await views()) {
      expect(view.stage).toBe("set");
      expect(view.previousPartnerFirstName).toBeNull();
      expect(view.beforeCutoff).toBe(true);
    }
    await reconcileAt(t, p.meetupId, CUTOFF - 1);
    for (const view of await views()) expect(view.beforeCutoff).toBe(true);
    await reconcileAt(t, p.meetupId, CUTOFF);
    for (const view of await views()) expect(view.beforeCutoff).toBe(false);
    await reconcileAt(t, p.meetupId, MEET);
    await asUser(t, p.sam).mutation(api.plans.leave, { seatId: p.samSeat });
    for (const view of await views()) {
      expect(view.previousPartnerFirstName).toBeNull(); // meetup day, partner left
      expect(view.beforeCutoff).toBe(false);
    }
    await reconcileAt(t, p.meetupId, STARTS + 4 * HOUR);
    for (const view of await views()) {
      expect(view.stage).toBe("after");
      expect(view.previousPartnerFirstName).toBeNull();
      expect(view.beforeCutoff).toBe(false);
    }
  });

  test("an unverified account sees no plan and can't change a seat", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await t.run(async (ctx) => ctx.db.patch(p.maya, { verifiedAt: undefined }));
    expect(await asUser(t, p.maya).query(api.plans.current, {})).toBeNull();
    expect(await asUser(t, p.maya).query(api.week.mine, {})).toEqual([]);
    await expect(asUser(t, p.maya).mutation(api.plans.accept, { seatId: p.mayaSeat })).rejects.toThrow(/forbidden/);
  });
});

describe("changes of plan", () => {
  test("Next time reopens the seat, refills it from the same event, and frees the decliner at once", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await asUser(t, p.maya).mutation(api.plans.accept, { seatId: p.mayaSeat });
    const lee = await makeStudent(t, { firstName: "Lee" });
    await makeAsk(t, lee, p.eventId);

    await asUser(t, p.sam).mutation(api.plans.nextTime, { seatId: p.samSeat });
    const samAsk = await t.run(async (ctx) =>
      ctx.db
        .query("asks")
        .withIndex("by_user_event", (q) => q.eq("userId", p.sam).eq("eventId", p.eventId))
        .unique(),
    );
    expect(samAsk!.closedReason).toBe("dropped");
    await advance(t, 16_000);

    const seats = await seatsFor(t, p.meetupId);
    expect(seats.find((s) => s.userId === lee)!.seat).toBe("offered");
    expect(seats.find((s) => s.userId === p.maya)!.seat).toBe("in");
    const mayaView = (await asUser(t, p.maya).query(api.plans.current, {}))!;
    expect(mayaView.partner?.firstName).toBe("Lee");
    expect(mayaView.notice).toBe("partner_replaced");
    expect(mayaView.previousPartnerFirstName).toBe("Sam");
    // The new person doesn't see the meeting spot until they're in.
    expect((await asUser(t, lee).query(api.plans.current, {}))!.meeting).toBeNull();

    // No cooldown: Sam can be offered a seat for another event right away.
    const other = await makeEvent(t, { title: "Other", startsAt: STARTS + 24 * HOUR });
    const kai = await makeStudent(t, { firstName: "Kai" });
    await makeAsk(t, p.sam, other);
    await makeAsk(t, kai, other);
    await t.mutation(internal.matching.run.forEvent, { eventId: other, trigger: "admin" });
    expect((await asUser(t, p.sam).query(api.plans.current, {}))!.event.title).toBe("Other");
  });

  test("a reopened seat never goes back to the person who just left it", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await asUser(t, p.maya).mutation(api.plans.accept, { seatId: p.mayaSeat });
    await asUser(t, p.sam).mutation(api.plans.nextTime, { seatId: p.samSeat });
    // Sam says yes again through a fresh ask row; the matcher must still skip Sam for this plan.
    await makeAsk(t, p.sam, p.eventId);
    await t.mutation(internal.matching.run.forEvent, { eventId: p.eventId, trigger: "admin" });
    const seats = await seatsFor(t, p.meetupId);
    expect(seats.filter((s) => s.userId === p.sam)).toHaveLength(1);
  });

  test("I can't make it before the cutoff: the other person stays in and keeps the meeting spot", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await bothIn(t, p);
    await asUser(t, p.sam).mutation(api.plans.cantMakeIt, { seatId: p.samSeat });
    expect((await plan(t, p.meetupId)).status).toBe("forming");
    const view = (await asUser(t, p.maya).query(api.plans.current, {}))!;
    expect(view.notice).toBe("partner_dropped");
    expect(view.previousPartnerFirstName).toBe("Sam");
    expect(view.partner).toBeNull();
    expect(view.meeting?.spotName).toBe("Sather Gate");

    const lee = await makeStudent(t, { firstName: "Lee" });
    await makeAsk(t, lee, p.eventId);
    await t.mutation(internal.matching.run.forEvent, { eventId: p.eventId, trigger: "seat_open" });
    const leeSeat = (await seatsFor(t, p.meetupId)).find((s) => s.userId === lee)!;
    await asUser(t, lee).mutation(api.plans.accept, { seatId: leeSeat._id });
    expect((await plan(t, p.meetupId)).status).toBe("set");
  });

  test("after the cutoff nobody new is added and the remaining person gets the kind notice", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await bothIn(t, p);
    vi.setSystemTime(CUTOFF + MINUTE);
    const lee = await makeStudent(t, { firstName: "Lee" });
    await makeAsk(t, lee, p.eventId);
    await asUser(t, p.sam).mutation(api.plans.setTicket, { seatId: p.samSeat, ticket: "couldnt" });
    expect((await plan(t, p.meetupId)).status).toBe("called_off");
    await t.mutation(internal.matching.run.forEvent, { eventId: p.eventId, trigger: "admin" });
    expect((await seatsFor(t, p.meetupId)).some((s) => s.userId === lee)).toBe(false);
    const view = (await asUser(t, p.maya).query(api.plans.current, {}))!;
    expect(view.stage).toBe("called_off");
    expect(view.notice).toBe("nobody_by_cutoff");
    expect(view.previousPartnerFirstName).toBeNull();
    expect(view.beforeCutoff).toBe(false);
  });

  test("an empty seat at the cutoff calls the plan off", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await bothIn(t, p);
    await asUser(t, p.sam).mutation(api.plans.cantMakeIt, { seatId: p.samSeat });
    await reconcileAt(t, p.meetupId, CUTOFF);
    const current = await plan(t, p.meetupId);
    expect(current.status).toBe("called_off");
    expect(current.endReason).toBe("nobody_by_cutoff");
  });

  test("I can't make it isn't allowed from the meeting time on", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await bothIn(t, p);
    await reconcileAt(t, p.meetupId, MEET);
    await expect(asUser(t, p.sam).mutation(api.plans.cantMakeIt, { seatId: p.samSeat })).rejects.toThrow(
      /validation_failed/,
    );
  });
});

describe("meetup day, leaving, and completion", () => {
  test("the marker and icebreaker are withheld until midnight Pacific on the event date", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await bothIn(t, p);
    const midnight = pacificMidnight(STARTS);
    expect(midnight).toBe(Date.UTC(2026, 9, 29, 7, 0)); // 00:00 PDT
    await reconcileAt(t, p.meetupId, midnight - 1);
    expect((await asUser(t, p.maya).query(api.plans.current, {}))!.marker).toBeNull();
    await reconcileAt(t, p.meetupId, midnight);
    const maya = (await asUser(t, p.maya).query(api.plans.current, {}))!;
    const sam = (await asUser(t, p.sam).query(api.plans.current, {}))!;
    expect(maya.stage).toBe("meetup_day");
    expect(maya.marker).not.toBeNull();
    expect(maya.marker).toBe(sam.marker);
    expect(maya.icebreaker).toBe("Which Big Thief song would you play for someone who's never heard them?");
    expect(maya.canLeave).toBe(false);
    expect(maya.canCantMakeIt).toBe(true);
  });

  test("the scheduler reveals meetup day on its own", async () => {
    const t = await setup();
    vi.setSystemTime(pacificMidnight(STARTS) - 30 * MINUTE);
    const p = await pairUp(t);
    await bothIn(t, p);
    await advance(t, 31 * MINUTE);
    expect((await plan(t, p.meetupId)).dayRevealedAt).toBeDefined();
  });

  test("I need to leave notifies the partner neutrally and the plan continues", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await bothIn(t, p);
    await expect(asUser(t, p.sam).mutation(api.plans.leave, { seatId: p.samSeat })).rejects.toThrow(/validation_failed/);
    await reconcileAt(t, p.meetupId, MEET);
    expect((await asUser(t, p.sam).query(api.plans.current, {}))!.canLeave).toBe(true);
    await asUser(t, p.sam).mutation(api.plans.leave, { seatId: p.samSeat });
    expect((await plan(t, p.meetupId)).status).toBe("set");
    const view = (await asUser(t, p.maya).query(api.plans.current, {}))!;
    expect(view.notice).toBe("partner_left");
    expect(view.canShare).toBe(true);
  });

  test("the plan is done at start + 4 hours, never because one person left", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await bothIn(t, p);
    await reconcileAt(t, p.meetupId, MEET);
    await asUser(t, p.sam).mutation(api.plans.leave, { seatId: p.samSeat });
    await reconcileAt(t, p.meetupId, STARTS + 4 * HOUR - 1);
    expect((await plan(t, p.meetupId)).status).toBe("set");
    await reconcileAt(t, p.meetupId, STARTS + 4 * HOUR);
    expect((await plan(t, p.meetupId)).status).toBe("done");
    expect((await asUser(t, p.maya).query(api.plans.current, {}))!.stage).toBe("after");
  });

  test("reconcile is idempotent", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await bothIn(t, p);
    await reconcileAt(t, p.meetupId, MEET + MINUTE);
    const once = await plan(t, p.meetupId);
    await t.mutation(internal.plans.reconcile.run, { meetupId: p.meetupId });
    await t.mutation(internal.plans.reconcile.run, { meetupId: p.meetupId });
    const twice = await plan(t, p.meetupId);
    expect(twice).toEqual(once);
    expect(await seatsFor(t, p.meetupId)).toHaveLength(2);
  });
});

describe("the demo clock", () => {
  test("jumping the clock reveals meetup day at once for demo plans only", async () => {
    process.env.ADMIN_EMAILS = "team1@berkeley.edu,team2@berkeley.edu";
    const t = await setup();
    const demo = await pairUp(t, { aEmail: "team1@berkeley.edu", bEmail: "team2@berkeley.edu" });
    await bothIn(t, demo);
    expect((await plan(t, demo.meetupId)).isDemoPlan).toBe(true);

    const realEvent = await makeEvent(t, { startsAt: STARTS });
    const ana = await makeStudent(t, { firstName: "Ana" });
    const ben = await makeStudent(t, { firstName: "Ben" });
    await makeAsk(t, ana, realEvent);
    await makeAsk(t, ben, realEvent);
    await t.mutation(internal.matching.run.forEvent, { eventId: realEvent, trigger: "admin" });
    const [realPlan] = await plansFor(t, realEvent);
    for (const seat of await seatsFor(t, realPlan._id)) {
      await asUser(t, seat.userId).mutation(api.plans.accept, { seatId: seat._id });
    }

    const offset = pacificMidnight(STARTS) + HOUR - Date.now();
    await t.mutation(internal.demo.admin.setClockOffset, { offsetMs: offset });
    const view = (await asUser(t, demo.maya).query(api.plans.current, {}))!;
    expect(view.stage).toBe("meetup_day");
    expect(view.marker).not.toBeNull();
    expect((await plan(t, realPlan._id)).dayRevealedAt).toBeUndefined();
    expect((await asUser(t, ana).query(api.plans.current, {}))!.marker).toBeNull();
  });
});

describe("Spotify disconnect", () => {
  test("release gives up the seat (it reopens for the partner) and closes asks", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await bothIn(t, p);
    const result = await t.mutation(internal.plans.release.forUser, { userId: p.sam });
    expect(result.seatsReleased).toBe(1);
    expect((await plan(t, p.meetupId)).status).toBe("forming");
    expect((await asUser(t, p.sam).query(api.plans.current, {}))).toBeNull();
    expect((await asUser(t, p.maya).query(api.plans.current, {}))!.notice).toBe("partner_dropped");
    const asks = await t.run(async (ctx) =>
      ctx.db
        .query("asks")
        .withIndex("by_user", (q) => q.eq("userId", p.sam))
        .collect(),
    );
    expect(asks.every((ask) => ask.closedReason === "dropped")).toBe(true);
  });
});

describe("event changes", () => {
  test("pulling an event closes its asks, calls off its plans, and withdraws offers", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await asUser(t, p.maya).mutation(api.plans.accept, { seatId: p.mayaSeat });
    const lee = await makeStudent(t, { firstName: "Lee" });
    await makeAsk(t, lee, p.eventId, "pending");

    const result = await t.mutation(internal.plans.release.forEvent, { eventId: p.eventId });
    expect(result).toEqual({ asksClosed: 2, plansCalledOff: 1, offersWithdrawn: 1 });
    const current = await plan(t, p.meetupId);
    expect(current.status).toBe("called_off");
    expect(current.endReason).toBe("event_pulled");
    const samSeat = (await seatsFor(t, p.meetupId)).find((s) => s._id === p.samSeat)!;
    expect(samSeat.seat).toBe("out");
    expect(samSeat.outReason).toBe("no_answer");

    const view = (await asUser(t, p.maya).query(api.plans.current, {}))!;
    expect(view.stage).toBe("called_off");
    expect(view.notice).toBe("event_pulled");
    expect(view.meeting).toBeNull();
    expect(view.beforeCutoff).toBe(false);
    expect(await asUser(t, p.sam).query(api.plans.current, {})).toBeNull();
    const leeAsk = await t.run(async (ctx) =>
      ctx.db
        .query("asks")
        .withIndex("by_user_event", (q) => q.eq("userId", lee).eq("eventId", p.eventId))
        .unique(),
    );
    expect(leeAsk!.closedReason).toBe("event_pulled");
    // Running it again changes nothing.
    expect(await t.mutation(internal.plans.release.forEvent, { eventId: p.eventId })).toEqual({
      asksClosed: 0,
      plansCalledOff: 0,
      offersWithdrawn: 0,
    });
  });

  test("a new start time moves the meeting time and cutoff, and reconciles at once", async () => {
    const t = await setup();
    const p = await pairUp(t);
    await bothIn(t, p);
    // The show moves one day later: the plan follows.
    await t.run(async (ctx) => ctx.db.patch(p.eventId, { startsAt: STARTS + 24 * HOUR }));
    expect(await t.mutation(internal.plans.retime.forEvent, { eventId: p.eventId })).toEqual({ plansRetimed: 1 });
    let current = await plan(t, p.meetupId);
    expect(current.meetAt).toBe(MEET + 24 * HOUR);
    expect(current.cutoffAt).toBe(CUTOFF + 24 * HOUR);
    vi.setSystemTime(pacificMidnight(STARTS));
    await t.mutation(internal.plans.reconcile.run, { meetupId: p.meetupId });
    expect((await plan(t, p.meetupId)).dayRevealedAt).toBeUndefined();

    // The show moves earlier, to before now's cutoff, while one seat is only offered: it is called off.
    const q = await pairUp(t);
    await asUser(t, q.maya).mutation(api.plans.accept, { seatId: q.mayaSeat });
    await t.run(async (ctx) => ctx.db.patch(q.eventId, { startsAt: Date.now() + 2 * HOUR }));
    await t.mutation(internal.plans.retime.forEvent, { eventId: q.eventId });
    current = await plan(t, q.meetupId);
    expect(current.status).toBe("called_off");
    expect(current.endReason).toBe("nobody_by_cutoff");
  });
});
