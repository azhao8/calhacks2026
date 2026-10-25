/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { DEMO_FIXTURES } from "./demo/fixtures";
import { TASTE_LABELS } from "./ai/labels";
import { EMBEDDING } from "./lib/config";
import { advance, setup } from "./testing.helpers";

// Demo students go through the same Claude summary and Voyage vector as real students (§6.7), and
// onboarding confirms them when the summary is done: well before the fixture fallback would fire.

const SUMMARY = "Warm, lyric heavy indie with a soft spot for live folk.";

vi.mock("./services/claude", () => ({
  generateJson: vi.fn(async () => ({
    summary: SUMMARY,
    labels: TASTE_LABELS.slice(0, 3),
    // validateTaste keeps only names in each student's own data, so every student keeps their own.
    artists: DEMO_FIXTURES.map((fixture) => fixture.topArtists[0]),
  })),
}));

vi.mock("./services/voyage", () => ({
  embed: vi.fn(async (texts: string[]) => texts.map(() => Array.from({ length: EMBEDDING.dimensions }, () => 0.01))),
}));

afterEach(() => {
  vi.useRealTimers();
});

test("seeded demo students get a Claude summary and a vector through onboarding, then become ready", async () => {
  const t = await setup();
  await t.mutation(internal.demo.admin.seed, {});

  // Well inside the fallback window: only the real pipeline can have confirmed them.
  await advance(t, 30_000);

  const { users, profiles } = await t.run(async (ctx) => ({
    users: (await ctx.db.query("users").collect()).filter((user) => user.isDemo),
    profiles: await ctx.db.query("tasteProfiles").collect(),
  }));
  expect(users).toHaveLength(6);
  expect(users.every((user) => user.onboarding === "ready")).toBe(true);
  const demoProfiles = profiles.filter((profile) => users.some((user) => user._id === profile.userId));
  expect(demoProfiles).toHaveLength(6);
  for (const profile of demoProfiles) {
    expect(profile.summary).toBe(SUMMARY);
    expect(profile.confirmedAt).toEqual(expect.any(Number));
    expect(profile.embedding).toHaveLength(EMBEDDING.dimensions);
    expect(profile.artists.length).toBeGreaterThan(0);
  }
});
