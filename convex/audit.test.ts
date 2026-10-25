/// <reference types="vite/client" />
// Regression tests from the acceptance audit (privacy and stage-demo items).
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
  delete process.env.ADMIN_EMAILS;
});

const STARTS = Date.UTC(2026, 9, 30, 3, 0); // Thu Oct 29, 8:00 pm PT

async function pairOn(t: T, a: Id<"users">, b: Id<"users">, eventId: Id<"events">) {
  await makeAsk(t, a, eventId);
  await makeAsk(t, b, eventId);
  await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
  const plans = await plansFor(t, eventId);
  const plan = plans[plans.length - 1];
  const seats = await seatsFor(t, plan._id);
  const seatOf = (userId: Id<"users">) => seats.find((s) => s.userId === userId)!._id;
  return { meetupId: plan._id, seatOf };
}

describe("a refilled seat never learns who dropped", () => {
  for (const how of ["next_time", "cant_make_it", "couldnt"] as const) {
    test(`newcomer after ${how}: no notice and no previous name; the stayer is told`, async () => {
      const t = await setup();
      const eventId = await makeEvent(t, { startsAt: STARTS });
      const maya = await makeStudent(t, { firstName: "Maya" });
      const sam = await makeStudent(t, { firstName: "Sam" });
      const p = await pairOn(t, maya, sam, eventId);
      await asUser(t, maya).mutation(api.plans.accept, { seatId: p.seatOf(maya) });
      if (how !== "next_time") await asUser(t, sam).mutation(api.plans.accept, { seatId: p.seatOf(sam) });
      if (how === "next_time") await asUser(t, sam).mutation(api.plans.nextTime, { seatId: p.seatOf(sam) });
      if (how === "cant_make_it") await asUser(t, sam).mutation(api.plans.cantMakeIt, { seatId: p.seatOf(sam) });
      if (how === "couldnt") {
        await asUser(t, sam).mutation(api.plans.setTicket, { seatId: p.seatOf(sam), ticket: "couldnt" });
      }

      const stayerBefore = (await asUser(t, maya).query(api.plans.current, {}))!;
      expect(stayerBefore.notice).toBe("partner_dropped");
      expect(stayerBefore.previousPartnerFirstName).toBe("Sam");

      await advance(t, 1000);
      const lee = await makeStudent(t, { firstName: "Lee" });
      await makeAsk(t, lee, eventId);
      await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "seat_open" });

      const newcomer = (await asUser(t, lee).query(api.plans.current, {}))!;
      expect(newcomer.stage).toBe("offer");
      expect(newcomer.partner?.firstName).toBe("Maya");
      expect(newcomer.notice).toBeNull();
      expect(newcomer.previousPartnerFirstName).toBeNull();
      expect(JSON.stringify(newcomer)).not.toContain("Sam");

      const stayer = (await asUser(t, maya).query(api.plans.current, {}))!;
      expect(stayer.notice).toBe("partner_replaced");
      expect(stayer.previousPartnerFirstName).toBe("Sam");
      expect(stayer.partner?.firstName).toBe("Lee");

      // Once Lee accepts, Lee still never sees Sam's name.
      const leeSeat = (await seatsFor(t, p.meetupId)).find((s) => s.userId === lee)!;
      await asUser(t, lee).mutation(api.plans.accept, { seatId: leeSeat._id });
      const leeIn = (await asUser(t, lee).query(api.plans.current, {}))!;
      expect(leeIn.notice).toBeNull();
      expect(leeIn.previousPartnerFirstName).toBeNull();
    });
  }
});

describe("stage demo", () => {
  test("Reset demo gives both team phones the featured stage event", async () => {
    process.env.ADMIN_EMAILS = "t1@berkeley.edu,t2@berkeley.edu";
    const t = await setup();
    const t1 = await makeStudent(t, { firstName: "Alex", email: "t1@berkeley.edu", artists: ["Big Thief"] });
    const t2 = await makeStudent(t, { firstName: "John", email: "t2@berkeley.edu", artists: ["Kendrick Lamar"] });
    // Plenty of events that rank above the stage event for each phone.
    for (let i = 0; i < 4; i++) {
      await makeEvent(t, { title: `Folk ${i}`, performers: ["Big Thief"], startsAt: STARTS + i * HOUR });
      await makeEvent(t, { title: `Rap ${i}`, performers: ["Kendrick Lamar"], startsAt: STARTS + i * HOUR });
    }
    const stage = await makeEvent(t, { title: "Stage", performers: ["Someone else"], featured: true, startsAt: STARTS + DAY });
    await t.mutation(internal.demo.admin.reset, {});
    await advance(t, 5000);
    for (const userId of [t1, t2]) {
      const asks = await t.run(async (ctx) =>
        ctx.db
          .query("asks")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
      );
      expect(asks.map((a) => a.eventId)).toContain(stage);
      expect(asks).toHaveLength(3);
    }
  });

  test("a demo student never holds a plan alone, so the next real yeses pair with each other", async () => {
    process.env.ADMIN_EMAILS = "t1@berkeley.edu,t2@berkeley.edu";
    const t = await setup();
    await t.mutation(internal.demo.admin.seed, {});
    const eventId = await makeEvent(t, { startsAt: STARTS, performers: [] });
    const ana = await makeStudent(t, { firstName: "Ana" });
    await makeAsk(t, ana, eventId);
    await advance(t, 2 * MINUTE);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    const [plan] = await plansFor(t, eventId);
    const anaSeat = (await seatsFor(t, plan._id)).find((s) => s.userId === ana)!;
    await asUser(t, ana).mutation(api.plans.nextTime, { seatId: anaSeat._id });

    const after = await t.run(async (ctx) => ctx.db.get(plan._id));
    expect(after!.status).toBe("called_off");
    expect((await seatsFor(t, plan._id)).every((s) => s.seat === "out")).toBe(true);

    const t1 = await makeStudent(t, { firstName: "Alex", email: "t1@berkeley.edu" });
    const t2 = await makeStudent(t, { firstName: "John", email: "t2@berkeley.edu" });
    await makeAsk(t, t1, eventId);
    await makeAsk(t, t2, eventId);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    const t1View = (await asUser(t, t1).query(api.plans.current, {}))!;
    expect(t1View.partner?.firstName).toBe("John");
  });

  test("an expired offer next to a demo student also calls the plan off", async () => {
    const t = await setup();
    await t.mutation(internal.demo.admin.seed, {});
    const eventId = await makeEvent(t, { startsAt: STARTS, performers: [] });
    const ana = await makeStudent(t, { firstName: "Ana" });
    await makeAsk(t, ana, eventId);
    await advance(t, 2 * MINUTE);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    const [plan] = await plansFor(t, eventId);
    await advance(t, 2 * HOUR + MINUTE);
    expect((await t.run(async (ctx) => ctx.db.get(plan._id)))!.status).toBe("called_off");
  });

  test("Reset demo puts the demo clock back to 0, and a skipped pair is logged", async () => {
    process.env.ADMIN_EMAILS = "t1@berkeley.edu,t2@berkeley.edu";
    const t = await setup();
    const t1 = await makeStudent(t, { firstName: "Alex", email: "t1@berkeley.edu" });
    const t2 = await makeStudent(t, { firstName: "John", email: "t2@berkeley.edu" });
    const eventId = await makeEvent(t, { startsAt: STARTS });
    await t.mutation(internal.demo.admin.setClockOffset, { offsetMs: 6 * DAY });
    await makeAsk(t, t1, eventId);
    await makeAsk(t, t2, eventId);
    const runId = await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    const run = await t.run(async (ctx) => ctx.db.get(runId!));
    expect(run!.pairsCreated).toBe(0);
    expect(run!.errors.join(" ")).toContain("demo clock is past the cutoff");

    await t.mutation(internal.demo.admin.reset, {});
    const settings = await t.run(async (ctx) => ctx.db.query("demoSettings").first());
    expect(settings!.clockOffsetMs).toBe(0);
    await makeAsk(t, t1, eventId);
    await makeAsk(t, t2, eventId);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    expect((await asUser(t, t1).query(api.plans.current, {}))!.partner?.firstName).toBe("John");
  });
});
