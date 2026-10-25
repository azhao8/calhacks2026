/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

const TEAM_EMAIL = "team@berkeley.edu";
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", ` ${TEAM_EMAIL.toUpperCase()} , other@berkeley.edu`);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

function as(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

const fingerprint = { topArtists: ["big thief"], likedArtists: [], tracks: [], labels: ["indie folk"] };

async function seedJourneys(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const now = Date.now();
    const user = (email: string, extra: { verified?: boolean; isDemo?: boolean } = {}) =>
      ctx.db.insert("users", {
        email,
        firstName: email.split("@")[0],
        verifiedAt: extra.verified === false ? undefined : now,
        isDemo: extra.isDemo,
      });
    const team = await user(TEAM_EMAIL);
    const demo = await user("demo-maya@melos.invalid", { isDemo: true });
    const a = await user("a@berkeley.edu");
    const b = await user("b@stanford.edu");
    const c = await user("c@berkeley.edu");
    await user("d@berkeley.edu", { verified: false });

    for (const [userId, status] of [
      [team, "connected"],
      [demo, "connected"],
      [a, "connected"],
      [b, "revoked"],
      [c, "allowlisted"],
    ] as const) {
      await ctx.db.insert("spotifyAccess", { userId, spotifyEmail: "x@example.com", status, requestedAt: now });
    }
    for (const userId of [team, demo, a]) {
      await ctx.db.insert("tasteProfiles", {
        userId,
        summary: "Quiet, lyric-heavy indie.",
        labels: ["indie folk"],
        artists: ["Big Thief"],
        revision: 0,
        confirmedAt: now,
        fingerprint,
      });
    }

    const eventId = await ctx.db.insert("events", {
      title: "Indie folk night",
      kind: "concert",
      startsAt: now + 48 * HOUR,
      priceMin: 15,
      priceMax: 30,
      priceSource: "listing",
      sourceName: "test",
      sourceUrl: "https://example.com",
      performers: ["Big Thief"],
      tags: [],
      ageLimit: null,
      meetOffsetMinutes: 30,
      status: "published",
      featured: false,
      dedupeKey: "test",
      scrapedAt: now,
      lastSeenAt: now,
    });
    for (const [userId, answer] of [
      [team, "yes"],
      [demo, "yes"],
      [a, "yes"],
      [b, "pending"],
      [c, "yes"],
    ] as const) {
      await ctx.db.insert("asks", { userId, eventId, createdAt: now, answer });
    }

    const plan = (status: "forming" | "set", revealed: boolean) =>
      ctx.db.insert("meetups", {
        eventId,
        status,
        marker: 12,
        meetAt: now + 47 * HOUR,
        cutoffAt: now + 45 * HOUR,
        hook: "You both have Big Thief on repeat.",
        icebreaker: "Which Big Thief song would you play first?",
        hookFromClaude: false,
        isDemoPlan: false,
        dayRevealedAt: revealed ? now : undefined,
        createdAt: now,
      });
    const seat = (meetupId: Id<"meetups">, userId: Id<"users">, state: "offered" | "in", ticket: "none" | "got") =>
      ctx.db.insert("meetupMembers", {
        meetupId,
        userId,
        seat: state,
        offeredAt: now,
        offerExpiresAt: now + 2 * HOUR,
        ticket,
      });
    // A and C: set, both ticketed, meetup day revealed.
    const setPlan = await plan("set", true);
    await seat(setPlan, a, "in", "got");
    await seat(setPlan, c, "in", "got");
    // B offered a seat next to a demo student who is already in.
    const forming = await plan("forming", false);
    await seat(forming, demo, "in", "none");
    await seat(forming, b, "offered", "none");
    // The team account and a demo student go all the way and must not count.
    const teamPlan = await plan("set", true);
    await seat(teamPlan, team, "in", "got");
    await seat(teamPlan, demo, "in", "got");

    return { team, demo, a, b };
  });
}

test("admin functions refuse signed-out and non-team accounts on the server", async () => {
  const t = convexTest(schema, modules);
  const { a, team } = await seedJourneys(t);
  const noteId = await t.run((ctx) => ctx.db.insert("helpNotes", { userId: a, text: "Help", createdAt: 1 }));

  await expect(t.query(api.admin.funnel, {})).rejects.toThrow(/not_signed_in/);
  await expect(as(t, a).query(api.admin.funnel, {})).rejects.toThrow(/forbidden/);
  await expect(as(t, a).query(api.admin.helpNotes, {})).rejects.toThrow(/forbidden/);
  await expect(as(t, a).mutation(api.admin.markHelpNoteHandled, { noteId })).rejects.toThrow(/forbidden/);

  expect(await as(t, a).query(api.admin.whoami, {})).toMatchObject({ signedIn: true, isAdmin: false });
  // ADMIN_EMAILS is matched after trimming and lowercasing.
  expect(await as(t, team).query(api.admin.whoami, {})).toMatchObject({ signedIn: true, isAdmin: true });
});

test("the funnel counts real students only", async () => {
  const t = convexTest(schema, modules);
  const { team } = await seedJourneys(t);

  const funnel = await as(t, team).query(api.admin.funnel, {});
  expect(funnel).toEqual([
    { stage: "Signed up", count: 4 },
    { stage: "Verified", count: 3 },
    { stage: "Spotify connected", count: 2 },
    { stage: "Taste confirmed", count: 1 },
    { stage: "Asked", count: 3 },
    { stage: "Said yes", count: 2 },
    { stage: "Offered a seat", count: 3 },
    { stage: "Plan set", count: 2 },
    { stage: "Both got tickets", count: 2 },
    { stage: "Meetup day reached", count: 2 },
  ]);
});

test("help notes list newest first and marking handled is idempotent", async () => {
  const t = convexTest(schema, modules);
  const { team, a } = await seedJourneys(t);
  await as(t, a).mutation(api.help.submit, { text: "  First note  " });
  await as(t, a).mutation(api.help.submit, { text: "Second note" });

  const notes = await as(t, team).query(api.admin.helpNotes, {});
  expect(notes.map((note) => [note.text, note.firstName, note.handledAt])).toEqual([
    ["Second note", "a", null],
    ["First note", "a", null],
  ]);

  await as(t, team).mutation(api.admin.markHelpNoteHandled, { noteId: notes[1]._id });
  const handled = (await as(t, team).query(api.admin.helpNotes, {}))[1].handledAt;
  expect(handled).toEqual(expect.any(Number));
  await as(t, team).mutation(api.admin.markHelpNoteHandled, { noteId: notes[1]._id });
  expect((await as(t, team).query(api.admin.helpNotes, {}))[1].handledAt).toBe(handled);
});
