/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { TASTE_LABELS } from "./ai/labels";
import { demoPhone } from "./demo/fixtures";
import { CLUSTERS, generatedFixture, NAME_POOL, pickNames } from "./demo/generate";
import { advance, asUser, MINUTE, makeStudent, setup, type T } from "./testing.helpers";

vi.mock("./services/claude", () => ({
  generateJson: vi.fn(async () => {
    throw new Error("Claude is not available in tests");
  }),
}));

afterEach(() => {
  vi.useRealTimers();
  delete process.env.ADMIN_EMAILS;
});

const labels = new Set(TASTE_LABELS);

async function demoUsers(t: T) {
  return await t.run(async (ctx) => (await ctx.db.query("users").collect()).filter((u) => u.isDemo));
}

describe("generated listening data", () => {
  test("the pools are big enough and every cluster label is on the fixed list", () => {
    expect(new Set(NAME_POOL).size).toBeGreaterThanOrEqual(100);
    expect(NAME_POOL.every((name) => !name.includes(" "))).toBe(true);
    for (const cluster of CLUSTERS) {
      for (const label of cluster.labels) expect(labels.has(label)).toBe(true);
    }
  });

  test("valid, reproducible per key, and different across keys", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const fixture = generatedFixture(`gen-test-${i}`);
      expect(new Set(fixture.topArtists).size).toBeGreaterThanOrEqual(5);
      expect(fixture.topTracks.length).toBeGreaterThanOrEqual(5);
      expect(fixture.likedSongs.length).toBeGreaterThanOrEqual(5);
      expect(fixture.labels.length).toBeGreaterThanOrEqual(3);
      expect(fixture.labels.length).toBeLessThanOrEqual(6);
      expect(fixture.labels.every((label) => labels.has(label))).toBe(true);
      expect(fixture.summary.length).toBeLessThanOrEqual(240);
      // Every track belongs to one of the student's own artists.
      for (const [, artist] of [...fixture.topTracks, ...fixture.likedSongs]) expect(fixture.topArtists).toContain(artist);
      seen.add(fixture.topArtists.join("|"));
      expect(generatedFixture(`gen-test-${i}`)).toEqual(fixture);
    }
    expect(seen.size).toBeGreaterThan(150);
  });

  test("names avoid the ones in use and add a second first name when the pool runs out", () => {
    const taken = new Set(NAME_POOL.slice(0, NAME_POOL.length - 3));
    const names = pickNames(10, taken, "seed");
    expect(new Set(names).size).toBe(10);
    expect(names.every((name) => !taken.has(name))).toBe(true);
    expect(names.slice(0, 3).every((name) => !name.includes(" "))).toBe(true);
    for (const name of names.slice(3)) {
      const [a, b] = name.split(" ");
      expect(NAME_POOL).toContain(a);
      expect(NAME_POOL).toContain(b);
    }
  });

  test("generated phone numbers stay inside 555-0100 to 555-0199", () => {
    for (let i = 0; i < 100; i++) {
      const phone = demoPhone(`gen-abc-${i}`)!;
      expect(phone).toMatch(/^\(510\) 555-01\d\d$/);
      const line = Number(phone.slice(-4));
      expect(line).toBeGreaterThanOrEqual(107);
      expect(line).toBeLessThanOrEqual(199);
    }
  });
});

describe("generate demo students", () => {
  test("count must be a whole number from 1 to 50", async () => {
    const t = await setup();
    for (const count of [0, 51, 2.5, -1]) {
      await expect(t.mutation(internal.demo.admin.generate, { count })).rejects.toThrow(/validation_failed/);
    }
    expect(await demoUsers(t)).toHaveLength(0);
  });

  test("adds new unique students without touching existing ones; each becomes ready", async () => {
    const t = await setup();
    await t.mutation(internal.demo.admin.seed, {});
    await advance(t, 3 * MINUTE);
    const base = await demoUsers(t);

    const first = await t.mutation(internal.demo.admin.generate, { count: 5 });
    await advance(t, 1000);
    const second = await t.mutation(internal.demo.admin.generate, { count: 5 });
    expect(first.created).toBe(5);
    expect(second.created).toBe(5);

    const all = await demoUsers(t);
    expect(all).toHaveLength(16);
    expect(new Set(all.map((u) => u.demoKey)).size).toBe(16);
    expect(new Set(all.map((u) => u.firstName)).size).toBe(16);
    expect([...first.firstNames, ...second.firstNames].sort()).toEqual(
      all.filter((u) => u.demoKey!.startsWith("gen-")).map((u) => u.firstName).sort(),
    );
    // The base students are unchanged.
    for (const user of base) {
      expect(all.find((u) => u._id === user._id)).toEqual(user);
    }

    const generated = all.filter((u) => u.demoKey!.startsWith("gen-"));
    expect(generated.every((u) => u.email === `demo-${u.demoKey}@melos.invalid`)).toBe(true);
    expect(new Set(generated.map((u) => u.gender)).size).toBeGreaterThanOrEqual(3);
    const prefs = await t.run(async (ctx) => ctx.db.query("preferences").collect());
    for (const user of generated) {
      const pref = prefs.find((p) => p.userId === user._id)!;
      expect(pref.meetWho).toBe("anyone");
      expect(pref.source).toBe("surprise_me");
    }

    // With Claude unavailable, the fallback profile and the usual confirm make them ready.
    await advance(t, 3 * MINUTE);
    const ready = (await demoUsers(t)).filter((u) => u.demoKey!.startsWith("gen-"));
    expect(ready.every((u) => u.onboarding === "ready")).toBe(true);
    const profiles = await t.run(async (ctx) => ctx.db.query("tasteProfiles").collect());
    for (const user of ready) {
      const profile = profiles.find((p) => p.userId === user._id)!;
      expect(profile.confirmedAt).toBeDefined();
      expect(profile.labels.every((label) => labels.has(label))).toBe(true);
    }
    const snapshots = await t.run(async (ctx) => ctx.db.query("tasteSnapshots").collect());
    expect(snapshots.filter((s) => ready.some((u) => u._id === s.userId))).toHaveLength(10);
  });

  test("Reset demo deletes generated students too and reseeds only the six fixtures", async () => {
    const t = await setup();
    await t.mutation(internal.demo.admin.seed, {});
    await t.mutation(internal.demo.admin.generate, { count: 4 });
    expect(await demoUsers(t)).toHaveLength(10);
    await t.mutation(internal.demo.admin.reset, {});
    const after = await demoUsers(t);
    expect(after).toHaveLength(6);
    expect(after.every((u) => !u.demoKey!.startsWith("gen-"))).toBe(true);
  });

  test("only team accounts can generate, and the funnel never counts generated students", async () => {
    process.env.ADMIN_EMAILS = "admin@berkeley.edu";
    const t = await setup();
    const admin = await makeStudent(t, { firstName: "Admin", email: "admin@berkeley.edu" });
    const student = await makeStudent(t, { firstName: "Ana" });
    await expect(asUser(t, student).mutation(api.admin.demo.generate, { count: 3 })).rejects.toThrow(/forbidden/);
    await expect(t.mutation(api.admin.demo.generate, { count: 3 })).rejects.toThrow(/not_signed_in/);

    const before = await asUser(t, admin).query(api.admin.funnel, {});
    const result = await asUser(t, admin).mutation(api.admin.demo.generate, { count: 3 });
    expect(result.created).toBe(3);
    expect(result.firstNames).toHaveLength(3);
    await advance(t, 3 * MINUTE);
    expect(await asUser(t, admin).query(api.admin.funnel, {})).toEqual(before);
  });
});
