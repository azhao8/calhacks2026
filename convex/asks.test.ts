/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { knownPrice, withinArea, withinBudget } from "./asks/rules";
import { advance, asUser, DAY, HOUR, makeAsk, makeEvent, makeStudent, setup, type T } from "./testing.helpers";

const mocks = vi.hoisted(() => ({ generateJson: vi.fn() }));
vi.mock("./services/claude", () => ({ generateJson: mocks.generateJson }));

afterEach(() => {
  mocks.generateJson.mockReset();
  vi.useRealTimers();
});

function unit(index: number): number[] {
  const vector = new Array(1024).fill(0);
  vector[index] = 1;
  return vector;
}

async function asksOf(t: T, userId: Id<"users">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("asks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  );
}

async function titlesAsked(t: T, userId: Id<"users">) {
  const asks = await asksOf(t, userId);
  return await t.run(async (ctx) => {
    const titles = [];
    for (const ask of asks) titles.push((await ctx.db.get(ask.eventId))!.title);
    return titles.sort();
  });
}

describe("candidate rules", () => {
  test("budget, unknown price, free entry, and areas", () => {
    expect(withinBudget(18, 25)).toBe(true);
    expect(withinBudget(30, 25)).toBe(false);
    expect(withinBudget(null, 0)).toBe(true);
    expect(withinBudget(40, null)).toBe(true);
    expect(knownPrice({ priceMin: null, priceMax: null, freeEntryNote: "Free with RSVP" })).toBe(0);
    expect(withinArea("campus", "berkeley_oakland")).toBe(true);
    expect(withinArea("bart", "berkeley_oakland")).toBe(false);
  });
});

describe("the ask picker", () => {
  test("up to 3 asks within budget, area, age, and the next 7 days", async () => {
    const t = await setup();
    mocks.generateJson.mockRejectedValue(new Error("Claude is down"));
    const student = await makeStudent(t, { firstName: "Maya", maxTicketPrice: 25, area: "berkeley_oakland" });
    await makeEvent(t, { title: "Cheap" });
    await makeEvent(t, { title: "Free", priceMin: 0, priceMax: 0 });
    await makeEvent(t, { title: "Unknown price", priceMin: null, priceMax: null, startsAt: Date.now() + 2 * DAY });
    await makeEvent(t, { title: "Too pricey", priceMin: 40, priceMax: 60 });
    await makeEvent(t, { title: "Too far", area: "bart" });
    await makeEvent(t, { title: "21 plus", ageLimit: 21 });
    await makeEvent(t, { title: "Next month", startsAt: Date.now() + 20 * DAY });
    await makeEvent(t, { title: "Past cutoff", startsAt: Date.now() + HOUR });
    await makeEvent(t, { title: "Rejected", status: "rejected" });

    await t.mutation(internal.asks.picker.pickForUser, { userId: student });
    await advance(t, 5000);
    expect(await titlesAsked(t, student)).toEqual(["Cheap", "Free", "Unknown price"]);

    // The weekly limit holds even when more events arrive.
    await makeEvent(t, { title: "Another" });
    await t.mutation(internal.asks.picker.pickAfterImport, {});
    await advance(t, 5000);
    expect(await asksOf(t, student)).toHaveLength(3);
  });

  test("an unknown price passes but ranks lower; performers the student plays rank higher", async () => {
    const t = await setup();
    const student = await makeStudent(t, { firstName: "Maya", artists: ["Big Thief"] });
    await makeEvent(t, { title: "Unknown", priceMin: null, priceMax: null, performers: ["Someone"] });
    await makeEvent(t, { title: "Known", performers: ["Someone"] });
    await makeEvent(t, { title: "Big Thief live", performers: ["Big Thief"] });
    const shortlist = await t.query(internal.asks.picker.shortlist, { userId: student, similarities: [] });
    expect(shortlist.map((c) => c.title)).toEqual(["Big Thief live", "Known", "Unknown"]);
  });

  test("vector search ranks events closest to the student's taste vector", async () => {
    const t = await setup();
    mocks.generateJson.mockRejectedValue(new Error("Claude is down"));
    const student = await makeStudent(t, { firstName: "Maya", embedding: unit(1), artists: ["Nobody Shared"] });
    for (let i = 0; i < 5; i++) {
      await makeEvent(t, { title: `Far ${i}`, embedding: unit(500 + i), performers: [] });
    }
    await makeEvent(t, { title: "Close", embedding: unit(1), performers: [] });
    await t.mutation(internal.asks.picker.pickForUser, { userId: student });
    await advance(t, 5000);
    expect(await titlesAsked(t, student)).toContain("Close");
  });

  test("Claude picks from the shortlist; IDs outside it are ignored", async () => {
    const t = await setup();
    const student = await makeStudent(t, { firstName: "Maya" });
    const ids: Id<"events">[] = [];
    for (let i = 0; i < 5; i++) ids.push(await makeEvent(t, { title: `Event ${i}`, performers: [] }));
    const rejected = await makeEvent(t, { title: "Not allowed", status: "rejected" });
    mocks.generateJson.mockResolvedValue({
      picks: [
        { id: rejected, reason: "nope" },
        { id: ids[4], reason: "Fits the folk side" },
        { id: ids[4], reason: "duplicate" },
        { id: ids[3], reason: "Good live band" },
      ],
    });
    await t.mutation(internal.asks.picker.pickForUser, { userId: student });
    await advance(t, 5000);
    const asks = await asksOf(t, student);
    expect(asks).toHaveLength(3);
    expect(asks.map((a) => a.eventId)).toEqual(expect.arrayContaining([ids[4], ids[3]]));
    expect(asks.map((a) => a.eventId)).not.toContain(rejected);
    expect(asks.find((a) => a.eventId === ids[4])!.pickReason).toBe("Fits the folk side");
    // Claude sees taste names and public listings only.
    const prompt = mocks.generateJson.mock.calls[0][0].prompt as string;
    expect(prompt).not.toContain("berkeley.edu");
    expect(prompt).not.toContain(student);
  });

  test("Claude judges games and plays too, not only the events closest to the student's music", async () => {
    const t = await setup();
    const student = await makeStudent(t, { firstName: "Maya", embedding: unit(1), artists: ["Big Thief"] });
    // Twelve concerts by an artist the student plays, close to their taste vector, outrank a game
    // with no performers and no listed price in the rerank.
    for (let i = 0; i < 12; i++) {
      await makeEvent(t, { title: `Big Thief night ${i}`, embedding: unit(1), performers: ["Big Thief"] });
    }
    const game = await makeEvent(t, {
      title: "Cal Volleyball vs Stanford",
      embedding: unit(700),
      performers: [],
      priceMin: null,
      priceMax: null,
    });
    await t.run(async (ctx) => ctx.db.patch(game, { kind: "game" }));
    mocks.generateJson.mockResolvedValue({ picks: [{ id: game, reason: "Loud crowds suit them" }] });
    await t.mutation(internal.asks.picker.pickForUser, { userId: student });
    await advance(t, 5000);

    const call = mocks.generateJson.mock.calls[0][0];
    const sent = JSON.parse(call.prompt as string) as { candidates: { id: string; kind: string }[] };
    expect(sent.candidates).toHaveLength(13);
    expect(sent.candidates.find((c) => c.id === game)?.kind).toBe("game");
    // The prompt asks for what the student would enjoy, not only direct music matches.
    expect(call.system).not.toMatch(/only on their music taste/);
    const asks = await asksOf(t, student);
    expect(asks).toHaveLength(3);
    expect(asks.find((a) => a.eventId === game)?.pickReason).toBe("Loud crowds suit them");
  });

  test("demo students say yes to every ask", async () => {
    const t = await setup();
    mocks.generateJson.mockRejectedValue(new Error("Claude is down"));
    const demo = await makeStudent(t, { firstName: "Rowan", isDemo: true, demoKey: "demo-5" });
    await makeEvent(t);
    await t.mutation(internal.asks.picker.pickForUser, { userId: demo });
    await advance(t, 5000);
    const [ask] = await asksOf(t, demo);
    expect(ask.answer).toBe("yes");
  });

  test("a student who isn't ready gets no asks", async () => {
    const t = await setup();
    const student = await makeStudent(t, { firstName: "Maya" });
    await t.run(async (ctx) => ctx.db.patch(student, { onboarding: "needs_review" }));
    await makeEvent(t);
    await t.mutation(internal.asks.picker.pickForUser, { userId: student });
    await advance(t, 5000);
    expect(await asksOf(t, student)).toHaveLength(0);
  });
});

describe("your week", () => {
  test("cards hold only day, time, price, and distance; no event name, venue, or performers", async () => {
    const t = await setup();
    const student = await makeStudent(t, { firstName: "Maya" });
    const eventId = await makeEvent(t, { title: "Secret show", performers: ["Big Thief"] });
    const askId = await makeAsk(t, student, eventId, "pending");
    const cards = await asUser(t, student).query(api.week.mine, {});
    expect(cards).toEqual([
      {
        askId,
        dayLabel: "Thursday, Oct 29",
        timeLabel: "8:00 pm",
        priceLabel: "$18 to $25",
        distanceLabel: "0.6 mi from campus",
        answer: "pending",
        locked: false,
      },
    ]);
    const raw = JSON.stringify(cards);
    expect(raw).not.toContain("Secret show");
    expect(raw).not.toContain("Big Thief");
    expect(raw).not.toContain("UC Theatre");
  });

  test("answers can change until a seat is held; only your own asks", async () => {
    const t = await setup();
    const maya = await makeStudent(t, { firstName: "Maya" });
    const sam = await makeStudent(t, { firstName: "Sam" });
    const eventId = await makeEvent(t);
    const mayaAsk = await makeAsk(t, maya, eventId, "pending");
    const samAsk = await makeAsk(t, sam, eventId, "pending");
    await expect(asUser(t, sam).mutation(api.week.answer, { askId: mayaAsk, answer: "yes" })).rejects.toThrow(/forbidden/);
    await asUser(t, maya).mutation(api.week.answer, { askId: mayaAsk, answer: "yes" });
    await asUser(t, maya).mutation(api.week.answer, { askId: mayaAsk, answer: "no" });
    await asUser(t, maya).mutation(api.week.answer, { askId: mayaAsk, answer: "yes" });
    await asUser(t, sam).mutation(api.week.answer, { askId: samAsk, answer: "yes" });
    await advance(t, 16_000);
    const [card] = await asUser(t, maya).query(api.week.mine, {});
    expect(card.locked).toBe(true);
    await expect(asUser(t, maya).mutation(api.week.answer, { askId: mayaAsk, answer: "no" })).rejects.toThrow(
      /already_seated/,
    );
  });

  test("an ask past its cutoff closes quietly", async () => {
    const t = await setup();
    const student = await makeStudent(t, { firstName: "Maya" });
    const eventId = await makeEvent(t, { startsAt: Date.now() + 3 * HOUR + 60_000 });
    await makeAsk(t, student, eventId, "pending");
    expect(await asUser(t, student).query(api.week.mine, {})).toHaveLength(1);
    vi.setSystemTime(Date.now() + 2 * HOUR);
    expect(await asUser(t, student).query(api.week.mine, {})).toHaveLength(0);
    await t.mutation(internal.matching.run.sweep, {});
    const [ask] = await asksOf(t, student);
    expect(ask.closedReason).toBe("cutoff");
  });
});
