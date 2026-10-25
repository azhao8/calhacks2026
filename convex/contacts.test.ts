/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { normalizeShare } from "./contacts";
import { asUser, makeAsk, makeEvent, makeStudent, MINUTE, plansFor, seatsFor, setup, type T } from "./testing.helpers";

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
const MEET = STARTS - 30 * MINUTE;

async function setPlan(t: T) {
  const eventId = await makeEvent(t, { startsAt: STARTS });
  const maya = await makeStudent(t, { firstName: "Maya" });
  const sam = await makeStudent(t, { firstName: "Sam" });
  await makeAsk(t, maya, eventId);
  await makeAsk(t, sam, eventId);
  await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
  const [plan] = await plansFor(t, eventId);
  for (const seat of await seatsFor(t, plan._id)) {
    await asUser(t, seat.userId).mutation(api.plans.accept, { seatId: seat._id });
  }
  return { maya, sam, meetupId: plan._id };
}

describe("formats", () => {
  test("phone numbers and Instagram handles are checked, not verified", () => {
    expect(normalizeShare("phone", "510 555 0123")).toBe("(510) 555-0123");
    expect(normalizeShare("phone", "+1 (510) 555-0123")).toBe("(510) 555-0123");
    expect(normalizeShare("phone", "+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizeShare("phone", "call me")).toBeNull();
    expect(normalizeShare("phone", "12345")).toBeNull();
    expect(normalizeShare("instagram", "@Maya.Sings")).toBe("@maya.sings");
    expect(normalizeShare("instagram", "bad handle!")).toBeNull();
    expect(normalizeShare("instagram", "a..b")).toBeNull();
  });
});

describe("stay in touch and contacts", () => {
  test("sharing opens at the meeting time and needs each student's opt-in", async () => {
    const t = await setup();
    const p = await setPlan(t);
    await expect(
      asUser(t, p.maya).mutation(api.contacts.share, { meetupId: p.meetupId, kind: "phone", value: "5105550123" }),
    ).rejects.toThrow(/forbidden/);

    vi.setSystemTime(MEET);
    await t.mutation(internal.plans.reconcile.run, { meetupId: p.meetupId });
    await asUser(t, p.maya).mutation(api.contacts.share, { meetupId: p.meetupId, kind: "phone", value: "5105550123" });
    await expect(
      asUser(t, p.maya).mutation(api.contacts.share, { meetupId: p.meetupId, kind: "instagram", value: "no way!" }),
    ).rejects.toThrow(/validation_failed/);

    // Sam sees Maya's number; Maya sees nothing from Sam, who didn't share.
    const samContacts = await asUser(t, p.sam).query(api.contacts.list, {});
    expect(samContacts).toEqual([
      expect.objectContaining({ firstName: "Maya", shares: [{ kind: "phone", value: "(510) 555-0123" }] }),
    ]);
    expect(await asUser(t, p.maya).query(api.contacts.list, {})).toEqual([]);
    expect(await asUser(t, p.maya).query(api.contacts.myShares, { meetupId: p.meetupId })).toEqual({
      phone: "(510) 555-0123",
      instagram: null,
    });

    // Leaving after the meeting time keeps access; stopping removes future visibility.
    const samSeat = (await seatsFor(t, p.meetupId)).find((s) => s.userId === p.sam)!;
    await asUser(t, p.sam).mutation(api.plans.leave, { seatId: samSeat._id });
    expect(await asUser(t, p.sam).query(api.contacts.list, {})).toHaveLength(1);
    await asUser(t, p.maya).mutation(api.contacts.stopSharing, { meetupId: p.meetupId, kind: "phone" });
    expect(await asUser(t, p.sam).query(api.contacts.list, {})).toEqual([]);
  });

  test("someone outside the plan can't share into it or read it", async () => {
    const t = await setup();
    const p = await setPlan(t);
    vi.setSystemTime(MEET);
    await t.mutation(internal.plans.reconcile.run, { meetupId: p.meetupId });
    const lee = await makeStudent(t, { firstName: "Lee" });
    await expect(
      asUser(t, lee).mutation(api.contacts.share, { meetupId: p.meetupId, kind: "phone", value: "5105550123" }),
    ).rejects.toThrow(/forbidden/);
    await asUser(t, p.maya).mutation(api.contacts.share, { meetupId: p.meetupId, kind: "instagram", value: "maya" });
    expect(await asUser(t, lee).query(api.contacts.list, {})).toEqual([]);
  });
});
