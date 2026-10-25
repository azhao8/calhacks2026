/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { DEMO_FIXTURES, demoPhone } from "./demo/fixtures";
import { advance, asUser, makeAsk, makeEvent, makeStudent, MINUTE, plansFor, seatsFor, setup, type T } from "./testing.helpers";

// These suites cover the pre-drop asks and live matching, which drops gate off (DECISIONS.md, Oct 25).
process.env.MELOS_LEGACY_ASKS = "1";

vi.mock("./services/claude", () => ({
  generateJson: vi.fn(async () => {
    throw new Error("Claude is not available in tests");
  }),
}));

afterEach(() => {
  vi.useRealTimers();
});

const STARTS = Date.UTC(2026, 9, 30, 3, 0);

async function demoUsers(t: T) {
  return await t.run(async (ctx) => (await ctx.db.query("users").collect()).filter((u) => u.isDemo));
}

describe("demo students", () => {
  test("seeding creates six fictional students with .invalid emails and confirmed taste; it's idempotent", async () => {
    const t = await setup();
    expect(await t.mutation(internal.demo.admin.seed, {})).toEqual({ created: 6, updated: 0 });
    // Claude is unavailable in this file, so the fixture summaries stand in after the fallback wait.
    await advance(t, 3 * MINUTE);
    expect(await t.mutation(internal.demo.admin.seed, {})).toEqual({ created: 0, updated: 6 });
    const users = await demoUsers(t);
    expect(users).toHaveLength(6);
    expect(users.every((u) => u.email!.endsWith(".invalid") && u.onboarding === "ready")).toBe(true);
    expect(new Set(users.map((u) => u.gender)).size).toBeGreaterThanOrEqual(3);
    const profiles = await t.run(async (ctx) => ctx.db.query("tasteProfiles").collect());
    expect(profiles.filter((p) => p.confirmedAt !== undefined)).toHaveLength(6);
  });

  test("demo phone numbers stay inside 555-0100 to 555-0199", () => {
    for (const fixture of DEMO_FIXTURES) {
      const phone = demoPhone(fixture.key)!;
      const line = Number(phone.slice(-4));
      expect(phone).toMatch(/^\(510\) 555-01\d\d$/);
      expect(line).toBeGreaterThanOrEqual(100);
      expect(line).toBeLessThanOrEqual(199);
    }
  });

  test("a demo partner accepts after 5 to 20 seconds, gets a ticket, and shares only a fictional number", async () => {
    const t = await setup();
    await t.mutation(internal.demo.admin.seed, {});
    const eventId = await makeEvent(t, { startsAt: STARTS, performers: [] });
    const ana = await makeStudent(t, { firstName: "Ana", artists: ["Big Thief"] });
    await makeAsk(t, ana, eventId);
    await advance(t, 2 * MINUTE);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    const [plan] = await plansFor(t, eventId);
    const demoSeat = (await seatsFor(t, plan._id)).find((s) => s.userId !== ana)!;
    expect(demoSeat.seat).toBe("offered");

    await advance(t, 21_000);
    expect((await seatsFor(t, plan._id)).find((s) => s._id === demoSeat._id)!.seat).toBe("in");
    const anaSeat = (await seatsFor(t, plan._id)).find((s) => s.userId === ana)!;
    await asUser(t, ana).mutation(api.plans.accept, { seatId: anaSeat._id });
    await advance(t, 61_000);
    expect((await seatsFor(t, plan._id)).find((s) => s._id === demoSeat._id)!.ticket).toBe("got");

    vi.setSystemTime(STARTS - 30 * MINUTE);
    await t.mutation(internal.plans.reconcile.run, { meetupId: plan._id });
    const [contact] = await asUser(t, ana).query(api.contacts.list, {});
    expect(contact.shares).toHaveLength(1);
    expect(contact.shares[0].kind).toBe("phone");
    expect(contact.shares[0].value).toMatch(/555-01\d\d$/);
  });

  test("act as works only for demo students", async () => {
    const t = await setup();
    await t.mutation(internal.demo.admin.seed, {});
    const eventId = await makeEvent(t, { startsAt: STARTS });
    const ana = await makeStudent(t, { firstName: "Ana" });
    await makeAsk(t, ana, eventId);
    await advance(t, 2 * MINUTE);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    const [plan] = await plansFor(t, eventId);
    const demoSeat = (await seatsFor(t, plan._id)).find((s) => s.userId !== ana)!;
    await expect(t.mutation(internal.demo.admin.actAs, { userId: ana, action: "accept" })).rejects.toThrow(/forbidden/);
    await t.mutation(internal.demo.admin.actAs, { userId: demoSeat.userId, action: "next_time" });
    expect((await seatsFor(t, plan._id)).find((s) => s._id === demoSeat._id)!.outReason).toBe("next_time");
  });

  test("reset never deletes a real student's records; a demo seat in their plan reopens", async () => {
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
    const before = await demoUsers(t);

    const result = await t.mutation(internal.demo.admin.reset, {});
    expect(result.deletedStudents).toBe(6);
    expect(result.reopenedSeats).toBe(1);
    expect(result.deletedPlans).toBe(0);
    const after = await demoUsers(t);
    expect(after).toHaveLength(6);
    expect(after.map((u) => u._id)).not.toEqual(expect.arrayContaining(before.map((u) => u._id)));

    // Ana, her ask history, and her seat survive; the plan waits for a new partner.
    const stillThere = await t.run(async (ctx) => ctx.db.get(ana));
    expect(stillThere?.firstName).toBe("Ana");
    const seats = await seatsFor(t, plan._id);
    expect(seats.find((s) => s.userId === ana)!.seat).toBe("in");
    const demoSeat = seats.find((s) => s.userId !== ana)!;
    expect(demoSeat.seat).toBe("out");
    expect(demoSeat.outReason).toBe("cant_make_it");
    const view = (await asUser(t, ana).query(api.plans.current, {}))!;
    expect(view.stage).toBe("waiting");
    expect(view.notice).toBe("partner_dropped");
  });
});
