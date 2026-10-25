/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id, TableNames } from "../_generated/dataModel";
import { createOrUpdateUser } from "../onboarding/signIn";
import { advance, asUser, makeAsk, makeEvent, makeStudent, plansFor, seatsFor, setup, MINUTE, type T } from "../testing.helpers";

vi.mock("../services/claude", () => ({
  generateJson: vi.fn(async () => {
    throw new Error("Claude is not available in tests");
  }),
}));

const TEAM = "team@berkeley.edu";

beforeEach(() => {
  process.env.ADMIN_EMAILS = TEAM;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.ADMIN_EMAILS;
});

async function countFor(t: T, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    const out: Record<string, number> = {};
    for (const table of ["preferences", "tasteProfiles", "asks", "meetupMembers", "contactShares", "helpNotes", "spotifyAccess", "authAccounts", "authSessions"] as TableNames[]) {
      out[table] = (await ctx.db.query(table).collect()).filter((row) => (row as { userId?: string }).userId === userId).length;
    }
    out.user = (await ctx.db.get(userId)) === null ? 0 : 1;
    return out;
  });
}

async function paired(t: T) {
  const eventId = await makeEvent(t);
  const maya = await makeStudent(t, { firstName: "Maya" });
  const sam = await makeStudent(t, { firstName: "Sam" });
  await makeAsk(t, maya, eventId);
  await makeAsk(t, sam, eventId);
  await t.mutation(internal.matching.run.forEvent, { eventId, trigger: "admin" });
  const [plan] = await plansFor(t, eventId);
  return { eventId, maya, sam, meetupId: plan._id };
}

test("every students and danger zone function refuses someone who isn't on the team list", async () => {
  const t = await setup();
  const student = await makeStudent(t, { firstName: "Alex" });
  const other = await makeStudent(t, { firstName: "Jo" });
  const s = asUser(t, student);
  const calls: [string, () => Promise<unknown>][] = [
    ["list", () => s.query(api.admin.students.list, {})],
    ["dangerCounts", () => s.query(api.admin.students.dangerCounts, {})],
    ["deleteStudent", () => s.mutation(api.admin.students.deleteStudent, { userId: other })],
    ["nuke", () => s.mutation(api.admin.students.nuke, { scope: "everything", confirm: "delete everything" })],
  ];
  for (const [name, call] of calls) await expect(call(), name).rejects.toThrow(/forbidden/);
  await expect(t.query(api.admin.students.list, {})).rejects.toThrow(/not_signed_in/);
  expect((await countFor(t, other)).user).toBe(1);
});

test("the list shows every account with its kind, stage and seat, with search and paging", async () => {
  const t = await setup();
  const team = await makeStudent(t, { firstName: "Team", email: TEAM });
  const { maya } = await paired(t);
  await makeStudent(t, { firstName: "Riley", isDemo: true, demoKey: "riley" });
  await t.run((ctx) => ctx.db.insert("users", { email: "new@berkeley.edu", onboarding: "needs_about_you", verifiedAt: 1 }));
  for (let i = 0; i < 30; i += 1) await makeStudent(t, { firstName: `Bulk${i}` });

  const admin = asUser(t, team);
  const first = await admin.query(api.admin.students.list, {});
  expect(first.rows).toHaveLength(25);
  expect(first.kinds).toEqual({ real: 33, demo: 1, team: 1 });
  expect(first.total).toBe(35);
  expect((await admin.query(api.admin.students.list, { kind: "real", limit: 100 })).rows).toHaveLength(33);
  expect((await admin.query(api.admin.students.list, { stage: "needs_about_you" })).rows.map((row) => row.email)).toEqual(["new@berkeley.edu"]);
  const found = await admin.query(api.admin.students.list, { search: "maya" });
  expect(found.rows).toHaveLength(1);
  expect(found.rows[0]).toMatchObject({ userId: maya, kind: "real", stage: "ready", seat: { seat: "offered", planStatus: "forming" } });
  expect((await admin.query(api.admin.students.list, { kind: "team" })).rows[0].isYou).toBe(true);

  // The Spotify email the app owner adds shows on the row, and search finds it.
  await t.run((ctx) => ctx.db.insert("spotifyAccess", { userId: maya, spotifyEmail: "maya.listens@gmail.com", status: "requested", requestedAt: 1 }));
  const bySpotify = await admin.query(api.admin.students.list, { search: "maya.listens" });
  expect(bySpotify.rows.map((row) => [row.userId, row.spotifyEmail, row.spotify])).toEqual([[maya, "maya.listens@gmail.com", "no_app"]]);
});

test("deleting a student removes all their data and reopens their partner's seat", async () => {
  const t = await setup();
  const team = await makeStudent(t, { firstName: "Team", email: TEAM });
  const { maya, sam, meetupId } = await paired(t);
  await t.run(async (ctx) => {
    await ctx.db.insert("contactShares", { meetupId, userId: maya, kind: "phone", value: "5105550100", sharedAt: 1 });
    await ctx.db.insert("helpNotes", { userId: maya, text: "Help", createdAt: 1 });
    await ctx.db.insert("spotifyAccess", { userId: maya, spotifyEmail: "maya@gmail.com", status: "connected", requestedAt: 1 });
    const accountId = await ctx.db.insert("authAccounts", { userId: maya, provider: "resend-otp", providerAccountId: "maya@berkeley.edu" });
    await ctx.db.insert("authVerificationCodes", { accountId, provider: "resend-otp", code: "hash", expirationTime: 1 });
    const sessionId = await ctx.db.insert("authSessions", { userId: maya, expirationTime: Date.now() + 1e6 });
    await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 1e6 });
  });

  await asUser(t, team).mutation(api.admin.students.deleteStudent, { userId: maya });
  await advance(t, MINUTE);

  expect(await countFor(t, maya)).toEqual({
    preferences: 0, tasteProfiles: 0, asks: 0, meetupMembers: 0, contactShares: 0, helpNotes: 0, spotifyAccess: 0, authAccounts: 0, authSessions: 0, user: 0,
  });
  await t.run(async (ctx) => {
    expect(await ctx.db.query("authVerificationCodes").collect()).toHaveLength(0);
    expect(await ctx.db.query("authRefreshTokens").collect()).toHaveLength(0);
    for (const run of await ctx.db.query("matchRuns").collect()) {
      expect(run.decisions.some((d) => d.a === maya || d.b === maya)).toBe(false);
    }
  });
  // Sam keeps his place in the plan, which reopens for someone new.
  const seats = await seatsFor(t, meetupId);
  expect(seats.map((seat) => seat.userId)).toContain(sam);
  expect(seats.some((seat) => seat.userId === maya)).toBe(false);
  // Sam's own plan view still works without a partner record.
  await expect(asUser(t, sam).query(api.plans.current, {})).resolves.not.toBeUndefined();
});

// What Convex Auth does when a code checks out: our createOrUpdateUser callback finds or makes the user.
async function signInAgain(t: T, email: string): Promise<Id<"users">> {
  return await t.run(async (ctx) =>
    createOrUpdateUser(ctx as never, { existingUserId: null, type: "verification", profile: { email } }),
  );
}

test("you can delete your own account: its sessions go, the old session is refused, and signing in again makes a fresh admin", async () => {
  const t = await setup();
  const team = await makeStudent(t, { firstName: "Team", email: TEAM });
  await t.run(async (ctx) => {
    const sessionId = await ctx.db.insert("authSessions", { userId: team, expirationTime: Date.now() + 1e6 });
    await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 1e6 });
    await ctx.db.insert("authVerifiers", { sessionId });
    await ctx.db.insert("authAccounts", { userId: team, provider: "resend-otp", providerAccountId: TEAM });
  });
  const me = asUser(t, team);
  expect(await me.mutation(api.admin.students.deleteStudent, { userId: team })).toEqual({ deletedSelf: true });

  await t.run(async (ctx) => {
    expect(await ctx.db.get(team)).toBeNull();
    for (const table of ["authSessions", "authRefreshTokens", "authVerifiers", "authAccounts"] as const) {
      expect(await ctx.db.query(table).collect(), table).toHaveLength(0);
    }
  });
  // A token for the deleted account reads as signed out and can't use the admin page.
  expect(await me.query(api.admin.whoami, {})).toEqual({ signedIn: false, isAdmin: false, email: null, orphaned: true });
  expect(await t.query(api.admin.whoami, {})).toEqual({ signedIn: false, isAdmin: false, email: null, orphaned: false });
  await expect(me.query(api.admin.students.list, {})).rejects.toThrow(/not_signed_in/);

  const fresh = await signInAgain(t, TEAM);
  expect(fresh).not.toBe(team);
  expect(await asUser(t, fresh).query(api.admin.whoami, {})).toEqual({ signedIn: true, isAdmin: true, email: TEAM, orphaned: false });
  await t.run(async (ctx) => {
    expect((await ctx.db.get(fresh))?.onboarding).toBe("needs_about_you");
  });
});

test("nukes need the exact phrase; deleting students or everything removes team accounts too, the caller included", async () => {
  const t = await setup();
  const team = await makeStudent(t, { firstName: "Team", email: TEAM });
  const admin = asUser(t, team);
  await paired(t);
  await makeStudent(t, { firstName: "Riley", isDemo: true, demoKey: "riley" });
  await t.run((ctx) => ctx.db.insert("spotifyApps", { label: "melos-alex", ownerName: "Alex", clientId: "client", capacity: 5, active: true }));

  await expect(admin.mutation(api.admin.students.nuke, { scope: "events", confirm: "delete events" })).rejects.toThrow(/to confirm/);

  await admin.mutation(api.admin.students.nuke, { scope: "events", confirm: "Delete all events" });
  await advance(t, MINUTE);
  expect(await admin.query(api.admin.students.dangerCounts, {})).toMatchObject({ events: 0, plans: 0, asks: 0, students: 3, teamAccounts: 1 });

  await admin.mutation(api.admin.students.nuke, { scope: "students", confirm: "delete all students" });
  await advance(t, MINUTE);
  await t.run(async (ctx) => {
    expect(await ctx.db.query("users").collect()).toHaveLength(0);
    expect(await ctx.db.get(team)).toBeNull();
    expect(await ctx.db.query("spotifyApps").collect()).toHaveLength(1);
    expect((await ctx.db.query("universities").collect()).length).toBeGreaterThan(0);
  });
  expect(await admin.query(api.admin.whoami, {})).toMatchObject({ signedIn: false, orphaned: true });

  // Sign in again, then wipe everything: the new account goes too.
  const again = asUser(t, await signInAgain(t, TEAM));
  await makeStudent(t, { firstName: "Late" });
  await makeEvent(t);
  await again.mutation(api.admin.students.nuke, { scope: "everything", confirm: "delete everything" });
  await advance(t, MINUTE);
  const last = asUser(t, await signInAgain(t, TEAM));
  expect(await last.query(api.admin.students.dangerCounts, {})).toEqual({ students: 0, teamAccounts: 1, events: 0, plans: 0, asks: 0, helpNotes: 0 });
});
