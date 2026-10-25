/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { maxMatching } from "./matching/blossom";
import { accepts, cosine, rarityWeight, similarYear } from "./matching/taste";
import { containsPronoun, templateHook, validateHook } from "./ai/hooks";
import { advance, asUser, makeAsk, makeEvent, makeStudent, MINUTE, plansFor, seatsFor, setup } from "./testing.helpers";

// These suites cover the pre-drop asks and live matching, which drops gate off (DECISIONS.md, Oct 25).
process.env.MELOS_LEGACY_ASKS = "1";

const mocks = vi.hoisted(() => ({ generateJson: vi.fn() }));
vi.mock("./services/claude", () => ({ generateJson: mocks.generateJson }));

afterEach(() => {
  mocks.generateJson.mockReset();
  vi.useRealTimers();
});

describe("pair scoring helpers", () => {
  test("blossom pairs as many people as possible before the best total fit", () => {
    // a–b is the single best edge, but taking it leaves c and d alone; a–c + b–d pairs everyone.
    const pairs = maxMatching(
      ["a", "b", "c", "d"],
      [
        { a: "a", b: "b", score: 10 },
        { a: "a", b: "c", score: 1 },
        { a: "b", b: "d", score: 1 },
      ],
    );
    expect(pairs.map((p) => p.join("")).sort()).toEqual(["ac", "bd"]);
  });

  test("blossom is deterministic regardless of input order", () => {
    const edges = [
      { a: "x", b: "y", score: 1 },
      { a: "y", b: "z", score: 1 },
      { a: "x", b: "z", score: 1 },
    ];
    expect(maxMatching(["z", "y", "x"], edges)).toEqual(maxMatching(["x", "y", "z"], [...edges].reverse()));
  });

  test("rarer shared items weigh more", () => {
    expect(rarityWeight(2, 100)).toBeCloseTo(1);
    expect(rarityWeight(90, 100)).toBeLessThan(0.3);
    expect(rarityWeight(5, 100)).toBeGreaterThan(rarityWeight(50, 100));
  });

  test("cosine similarity and missing vectors", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine(undefined, [1, 0])).toBe(0);
  });

  test("who you'd like to meet, and prefer not to say", () => {
    expect(accepts("anyone", undefined)).toBe(true);
    expect(accepts(["woman"], "woman")).toBe(true);
    expect(accepts(["woman"], "man")).toBe(false);
    expect(accepts(["woman", "man", "non_binary"], "prefer_not_to_say")).toBe(false);
  });

  test("similar year only counts when someone asks for it", () => {
    expect(similarYear({ year: "second", prefersSimilarYear: true }, { year: "third", prefersSimilarYear: false })).toBe(true);
    expect(similarYear({ year: "second", prefersSimilarYear: false }, { year: "third", prefersSimilarYear: false })).toBe(false);
    expect(similarYear({ year: "first", prefersSimilarYear: true }, { year: "grad", prefersSimilarYear: true })).toBe(false);
  });

  test("hooks name only shared items and never use pronouns", () => {
    const shared = [{ kind: "artist" as const, name: "Big Thief" }];
    const known = new Set(["big thief", "mitski"]);
    expect(validateHook({ hook: "You both have Big Thief on repeat.", icebreaker: "Which Big Thief song first got you?" }, shared, known)).not.toBeNull();
    expect(validateHook({ hook: "You both have Big Thief and Mitski on repeat.", icebreaker: "Hi?" }, shared, known)).toBeNull();
    expect(validateHook({ hook: "She loves Big Thief too.", icebreaker: "Hi?" }, shared, known)).toBeNull();
    expect(validateHook({ hook: "You both have Big Thief on repeat!", icebreaker: "Hi?" }, shared, known)).toBeNull();
    expect(validateHook({ hook: "You both like music.", icebreaker: "Hi?" }, shared, known)).toBeNull();
    const template = templateHook(shared);
    expect(template.hook).toBe("You both have Big Thief on repeat.");
    expect(containsPronoun(template.hook + template.icebreaker)).toBe(false);
  });
});

describe("the matcher", () => {
  test("two compatible yeses become a plan with two offered seats, logged for the inspector", async () => {
    const t = await setup();
    const eventId = await makeEvent(t);
    const maya = await makeStudent(t, { firstName: "Maya", artists: ["Big Thief", "Mitski"] });
    const sam = await makeStudent(t, { firstName: "Sam", artists: ["Big Thief", "Bon Iver"] });
    await makeAsk(t, maya, eventId);
    await makeAsk(t, sam, eventId);

    const runId = await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    const [plan] = await plansFor(t, eventId);
    expect(plan.status).toBe("forming");
    expect(plan.marker).toBeGreaterThanOrEqual(10);
    expect(plan.marker).toBeLessThanOrEqual(99);
    expect(plan.hook).toBe("You both have Big Thief on repeat.");
    const seats = await seatsFor(t, plan._id);
    expect(seats.map((s) => s.seat)).toEqual(["offered", "offered"]);
    // The offer runs out at the earlier of 2 hours or the cutoff.
    expect(seats[0].offerExpiresAt).toBe(seats[0].offeredAt + 2 * 60 * MINUTE);

    const run = await t.run(async (ctx) => ctx.db.get(runId!));
    expect(run!.pairsCreated).toBe(1);
    expect(run!.decisions[0].shared.map((s) => s.name)).toEqual(["big thief"]);
    expect(run!.decisions[0].reason).toContain("blossom");

    const runs = await t.query(internal.matching.admin.runs, {});
    expect(runs[0].decisions[0].aName).toMatch(/Maya|Sam/);
  });

  test("a pair needs at least one real shared artist, track, or label", async () => {
    const t = await setup();
    const eventId = await makeEvent(t);
    const a = await makeStudent(t, { firstName: "Ana", artists: ["Mitski"] });
    const b = await makeStudent(t, { firstName: "Ben", artists: ["Kendrick Lamar"] });
    await makeAsk(t, a, eventId);
    await makeAsk(t, b, eventId);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    expect(await plansFor(t, eventId)).toHaveLength(0);
  });

  test("who you'd like to meet must accept the other person, both ways", async () => {
    const t = await setup();
    const eventId = await makeEvent(t);
    const a = await makeStudent(t, { firstName: "Ana", gender: "woman", meetWho: ["woman"] });
    const b = await makeStudent(t, { firstName: "Ben", gender: "man", meetWho: "anyone" });
    await makeAsk(t, a, eventId);
    await makeAsk(t, b, eventId);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    expect(await plansFor(t, eventId)).toHaveLength(0);
  });

  test("people paired in the last 7 days aren't paired again", async () => {
    const t = await setup();
    const first = await makeEvent(t, { title: "First" });
    const second = await makeEvent(t, { title: "Second", startsAt: Date.UTC(2026, 9, 31, 3, 0) });
    const a = await makeStudent(t, { firstName: "Ana" });
    const b = await makeStudent(t, { firstName: "Ben" });
    await makeAsk(t, a, first);
    await makeAsk(t, b, first);
    await t.mutation(internal.matching.run.forEvent, { eventId: first, trigger: "admin" });
    const [plan] = await plansFor(t, first);
    for (const seat of await seatsFor(t, plan._id)) {
      await asUser(t, seat.userId).mutation(api.plans.nextTime, { seatId: seat._id });
    }
    await makeAsk(t, a, second);
    await makeAsk(t, b, second);
    await t.mutation(internal.matching.run.forEvent, { eventId: second, trigger: "admin" });
    expect(await plansFor(t, second)).toHaveLength(0);
  });

  test("a yes wakes the matcher about 15 seconds later; both see the offer live with first names", async () => {
    const t = await setup();
    const eventId = await makeEvent(t);
    const maya = await makeStudent(t, { firstName: "Maya" });
    const sam = await makeStudent(t, { firstName: "Sam" });
    const mayaAsk = await makeAsk(t, maya, eventId, "pending");
    const samAsk = await makeAsk(t, sam, eventId, "pending");
    await asUser(t, maya).mutation(api.week.answer, { askId: mayaAsk, answer: "yes" });
    await advance(t, 5000);
    await asUser(t, sam).mutation(api.week.answer, { askId: samAsk, answer: "yes" });
    expect(await asUser(t, maya).query(api.plans.current, {})).toBeNull();
    await advance(t, 11_000);
    const mayaView = await asUser(t, maya).query(api.plans.current, {});
    const samView = await asUser(t, sam).query(api.plans.current, {});
    expect(mayaView?.stage).toBe("offer");
    expect(mayaView?.partner?.firstName).toBe("Sam");
    expect(samView?.partner?.firstName).toBe("Maya");
    // Both changes within the window joined one run.
    const runs = await t.run(async (ctx) => ctx.db.query("matchRuns").collect());
    expect(runs.filter((run) => run.trigger === "yes")).toHaveLength(1);
  });

  test("demo students are never paired with each other", async () => {
    const t = await setup();
    const eventId = await makeEvent(t);
    const d1 = await makeStudent(t, { firstName: "Demo1", isDemo: true, demoKey: "demo-1" });
    const d2 = await makeStudent(t, { firstName: "Demo2", isDemo: true, demoKey: "demo-2" });
    await makeAsk(t, d1, eventId);
    await makeAsk(t, d2, eventId);
    await advance(t, 5 * MINUTE);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    expect(await plansFor(t, eventId)).toHaveLength(0);
  });

  test("a real student alone past the demo-fill wait gets a demo partner, not before", async () => {
    const t = await setup();
    const eventId = await makeEvent(t);
    const demo = await makeStudent(t, { firstName: "Rowan", isDemo: true, demoKey: "demo-5" });
    const real = await makeStudent(t, { firstName: "Ana" });
    const ask = await makeAsk(t, real, eventId, "pending");
    await asUser(t, real).mutation(api.week.answer, { askId: ask, answer: "yes" });
    await advance(t, 20_000);
    expect(await plansFor(t, eventId)).toHaveLength(0);
    await advance(t, 45_000);
    const [plan] = await plansFor(t, eventId);
    const seats = await seatsFor(t, plan._id);
    expect(seats.map((s) => s.userId).sort()).toEqual([demo, real].sort());
    const runs = await t.run(async (ctx) => ctx.db.query("matchRuns").collect());
    expect(runs.some((run) => run.demoFills === 1)).toBe(true);
  });

  test("real students pair with each other before anyone gets a demo partner", async () => {
    const t = await setup();
    const eventId = await makeEvent(t);
    await makeStudent(t, { firstName: "Rowan", isDemo: true, demoKey: "demo-5" });
    const a = await makeStudent(t, { firstName: "Ana" });
    const b = await makeStudent(t, { firstName: "Ben" });
    await makeAsk(t, a, eventId);
    await makeAsk(t, b, eventId);
    await advance(t, 2 * MINUTE);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    const plans = await plansFor(t, eventId);
    expect(plans).toHaveLength(1);
    expect((await seatsFor(t, plans[0]._id)).map((s) => s.userId).sort()).toEqual([a, b].sort());
  });

  test("Claude's hook replaces the template only when it validates", async () => {
    const t = await setup();
    mocks.generateJson.mockResolvedValue({
      hook: "You both keep coming back to Big Thief.",
      icebreaker: "Which Big Thief song would you play first?",
    });
    const eventId = await makeEvent(t);
    const a = await makeStudent(t, { firstName: "Ana", artists: ["Big Thief", "Mitski"] });
    const b = await makeStudent(t, { firstName: "Ben", artists: ["Big Thief"] });
    await makeAsk(t, a, eventId);
    await makeAsk(t, b, eventId);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    await advance(t, 10_000);
    const [plan] = await plansFor(t, eventId);
    expect(plan.hook).toBe("You both keep coming back to Big Thief.");
    expect(plan.hookFromClaude).toBe(true);
    // Claude saw only shared items and public event details.
    const prompt = mocks.generateJson.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Big Thief");
    expect(prompt).not.toContain("Mitski");
    expect(prompt).not.toContain("berkeley.edu");
  });

  test("an invalid Claude hook keeps the template", async () => {
    const t = await setup();
    mocks.generateJson.mockResolvedValue({ hook: "She has Big Thief on repeat.", icebreaker: "Ask her about it." });
    const eventId = await makeEvent(t);
    const a = await makeStudent(t, { firstName: "Ana" });
    const b = await makeStudent(t, { firstName: "Ben" });
    await makeAsk(t, a, eventId);
    await makeAsk(t, b, eventId);
    await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
    await advance(t, 10_000);
    const [plan] = await plansFor(t, eventId);
    expect(plan.hook).toBe("You both have Big Thief on repeat.");
    expect(plan.hookFromClaude).toBe(false);
  });
});
