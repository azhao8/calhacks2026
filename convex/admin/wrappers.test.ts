/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("/convex/**/*.ts");

const TEAM_EMAIL = "team@berkeley.edu";

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", TEAM_EMAIL);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function users(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ({
    team: await ctx.db.insert("users", { email: TEAM_EMAIL, verifiedAt: 1, onboarding: "ready" }),
    student: await ctx.db.insert("users", { email: "student@berkeley.edu", verifiedAt: 1, onboarding: "ready" }),
  }));
}

const as = (t: ReturnType<typeof convexTest>, userId: Id<"users">) => t.withIdentity({ subject: `${userId}|session` });

test("every admin wrapper refuses a student who isn't on the team list", async () => {
  const t = convexTest(schema, modules);
  const { student } = await users(t);
  const s = as(t, student);
  // Real rows, so every call gets past argument validation to the admin check itself.
  const { someEvent, someAccess } = await t.run(async (ctx) => ({
    someAccess: await ctx.db.insert("spotifyAccess", {
      userId: student,
      spotifyEmail: "student@example.com",
      status: "requested",
      requestedAt: 1,
    }),
    someEvent: await ctx.db.insert("events", {
      title: "Show",
      kind: "concert",
      startsAt: Date.now() + 86_400_000,
      priceMin: null,
      priceMax: null,
      priceSource: null,
      sourceName: "test",
      sourceUrl: "https://example.com",
      performers: [],
      tags: [],
      ageLimit: null,
      meetOffsetMinutes: 30,
      status: "published",
      featured: false,
      dedupeKey: "show",
      scrapedAt: 1,
      lastSeenAt: 1,
    }),
  }));

  const calls: [string, () => Promise<unknown>][] = [
    ["queue.list", () => s.query(api.admin.queue.list, {})],
    ["queue.markAdded", () => s.mutation(api.admin.queue.markAdded, { accessId: someAccess })],
    ["queue.upsertSpotifyApp", () => s.mutation(api.admin.queue.upsertSpotifyApp, { label: "x", ownerName: "x", clientId: "x" })],
    ["events.imports", () => s.query(api.admin.events.imports, {})],
    ["events.list", () => s.query(api.admin.events.list, {})],
    ["events.pull", () => s.mutation(api.admin.events.pull, { eventId: someEvent })],
    ["events.restore", () => s.mutation(api.admin.events.restore, { eventId: someEvent })],
    ["events.feature", () => s.mutation(api.admin.events.feature, { eventId: someEvent, featured: true })],
    ["events.edit", () => s.mutation(api.admin.events.edit, { eventId: someEvent, patch: {} })],
    ["events.findNow", () => s.action(api.admin.events.findNow, {})],
    ["matching.runNow", () => s.mutation(api.admin.matching.runNow, {})],
    ["matching.runs", () => s.query(api.admin.matching.runs, {})],
    ["demo.overview", () => s.query(api.admin.demo.overview, {})],
    ["demo.seed", () => s.mutation(api.admin.demo.seed, {})],
    ["demo.reset", () => s.mutation(api.admin.demo.reset, {})],
    ["demo.setClockOffset", () => s.mutation(api.admin.demo.setClockOffset, { offsetMs: 0 })],
    ["demo.actAs", () => s.mutation(api.admin.demo.actAs, { userId: student, action: "accept" })],
  ];
  for (const [name, call] of calls) {
    await expect(call(), name).rejects.toThrow(/forbidden/);
  }
  await expect(t.query(api.admin.queue.list, {})).rejects.toThrow(/not_signed_in/);
});

test("team accounts can read the admin views", async () => {
  const t = convexTest(schema, modules);
  const { team } = await users(t);
  const a = as(t, team);
  expect(await a.query(api.admin.queue.list, {})).toMatchObject({ rows: [], apps: [] });
  expect(await a.query(api.admin.events.list, {})).toEqual([]);
  expect(await a.query(api.admin.matching.runs, {})).toEqual([]);
  expect(await a.query(api.admin.demo.overview, {})).toEqual({ students: [], clockOffsetMs: 0 });
});
