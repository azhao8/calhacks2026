/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { clientSecret } from "../services/spotify";

const modules = import.meta.glob("/convex/**/*.ts");

const TEAM_EMAIL = "team@berkeley.edu";
const SECRET = "0123456789abcdef0123456789abcdef";

// Spotify's token endpoint for "Check app": accepts only SECRET.
const tokenCalls: string[] = [];
async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url !== "https://accounts.spotify.com/api/token") return new Response("{}", { status: 500 });
  const auth = new Headers(init?.headers).get("Authorization") ?? "";
  tokenCalls.push(auth);
  const [, secret] = atob(auth.replace("Basic ", "")).split(":");
  return secret === SECRET
    ? new Response(JSON.stringify({ access_token: "app-token", expires_in: 3600 }), { status: 200 })
    : new Response(JSON.stringify({ error: "invalid_client" }), { status: 400 });
}

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", TEAM_EMAIL);
  vi.stubGlobal("fetch", fakeFetch);
  tokenCalls.length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type T = ReturnType<typeof convexTest>;
const as = (t: T, userId: Id<"users">) => t.withIdentity({ subject: `${userId}|session` });

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    team: await ctx.db.insert("users", { email: TEAM_EMAIL, verifiedAt: 1, onboarding: "ready" as const }),
    student: await ctx.db.insert("users", { email: "student@berkeley.edu", verifiedAt: 1, onboarding: "ready" as const }),
  }));
  return { t, ...ids, admin: as(t, ids.team) };
}

async function addApp(t: T, team: Id<"users">, label: string, secret?: string) {
  const result = await as(t, team).mutation(api.admin.queue.upsertSpotifyApp, {
    label,
    ownerName: "Alex",
    clientId: `client-${label}`,
    ...(secret ? { secret } : {}),
  });
  return result.appId;
}

// A student who asked for access, in the given state.
async function request(
  t: T,
  options: { email: string; appId?: Id<"spotifyApps">; status?: "requested" | "allowlisted" | "connected" | "revoked"; onboarding?: "waiting_for_spotify" | "needs_spotify_connect" | "ready"; requestedAt?: number },
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: options.email,
      firstName: options.email.split("@")[0],
      verifiedAt: 1,
      onboarding: options.onboarding ?? "waiting_for_spotify",
    });
    const accessId = await ctx.db.insert("spotifyAccess", {
      userId,
      spotifyEmail: `spotify-${options.email}`,
      spotifyAppId: options.appId,
      status: options.status ?? "requested",
      requestedAt: options.requestedAt ?? 1,
      ...(options.status === "allowlisted" || options.status === "connected" ? { allowlistedAt: 2, notifiedAt: 2 } : {}),
    });
    return { userId, accessId };
  });
}

test("every new admin function refuses a student who isn't on the team list", async () => {
  const { t, team, student } = await setup();
  const appId = await addApp(t, team, "melos-alex");
  const { accessId } = await request(t, { email: "x@berkeley.edu", appId });
  const s = as(t, student);
  const calls: [string, () => Promise<unknown>][] = [
    ["list", () => s.query(api.admin.queue.list, { status: "needs_adding", search: "x" })],
    ["undoAdded", () => s.mutation(api.admin.queue.undoAdded, { accessId })],
    ["moveRequest", () => s.mutation(api.admin.queue.moveRequest, { accessId, appId })],
    ["removeRequest", () => s.mutation(api.admin.queue.removeRequest, { accessId })],
    ["upsertSpotifyApp", () => s.mutation(api.admin.queue.upsertSpotifyApp, { label: "melos-x", ownerName: "X", clientId: "abcdefgh12", secret: SECRET })],
    ["setAppSecret", () => s.mutation(api.admin.queue.setAppSecret, { appId, secret: SECRET })],
    ["setAppActive", () => s.mutation(api.admin.queue.setAppActive, { appId, active: false })],
    ["deleteApp", () => s.mutation(api.admin.queue.deleteApp, { appId })],
    ["checkApp", () => s.action(api.admin.queue.checkApp, { appId })],
  ];
  for (const [name, call] of calls) await expect(call(), name).rejects.toThrow(/forbidden/);
  await expect(t.mutation(api.admin.queue.setAppSecret, { appId, secret: SECRET })).rejects.toThrow(/not_signed_in/);
  // Nothing changed.
  await t.run(async (ctx) => {
    expect(await ctx.db.query("spotifyAppSecrets").collect()).toHaveLength(0);
    expect((await ctx.db.get(appId))?.active).toBe(true);
    expect(await ctx.db.get(accessId)).not.toBeNull();
  });
});

test("a saved secret is write-only: no admin query returns it", async () => {
  const { t, team, admin } = await setup();
  const appId = await addApp(t, team, "melos-alex", SECRET);
  await admin.mutation(api.admin.queue.setAppSecret, { appId, secret: SECRET });
  await request(t, { email: "a@berkeley.edu", appId });

  const reads = [
    await admin.query(api.admin.queue.list, {}),
    await admin.query(api.admin.queue.list, { appId }),
    await admin.query(api.admin.whoami, {}),
    await admin.query(api.admin.funnel, {}),
    await admin.query(api.admin.helpNotes, {}),
    await admin.query(api.admin.events.list, {}),
    await admin.query(api.admin.demo.overview, {}),
  ];
  for (const read of reads) expect(JSON.stringify(read)).not.toContain(SECRET);

  const app = (await admin.query(api.admin.queue.list, {})).apps[0];
  expect(app.secret).toBe("saved");
  expect(app.secretSetBy).toBe(TEAM_EMAIL);
  expect(app.secretSetAt).toEqual(expect.any(Number));
});

test("the saved secret wins over the env var; the env var is the fallback", async () => {
  const { t, team, admin } = await setup();
  vi.stubEnv("SPOTIFY_CLIENT_SECRET_MELOS_OLD", "env-secret-value");
  const oldApp = await addApp(t, team, "melos-old");
  expect((await admin.query(api.admin.queue.list, {})).apps[0].secret).toBe("env");
  expect(clientSecret({ label: "melos-old", secret: null })).toBe("env-secret-value");

  await admin.mutation(api.admin.queue.setAppSecret, { appId: oldApp, secret: SECRET });
  expect((await admin.query(api.admin.queue.list, {})).apps[0].secret).toBe("saved");

  // The connect flow and token refreshes read the saved secret.
  const { userId } = await request(t, { email: "c@berkeley.edu", appId: oldApp, status: "allowlisted", onboarding: "needs_spotify_connect" });
  const context = await t.query(internal.onboarding.connect.connectContext, { userId });
  expect(context).toMatchObject({ ok: true, secret: SECRET });
  if (context.ok) expect(clientSecret(context)).toBe(SECRET);

  expect(() => clientSecret({ label: "melos-none", secret: null })).toThrow(/No client secret/);
  await expect(admin.mutation(api.admin.queue.setAppSecret, { appId: oldApp, secret: "has space" })).rejects.toThrow(/client secret/);
});

test("check app asks Spotify with the app's credentials and records the answer", async () => {
  const { t, team, admin } = await setup();
  const good = await addApp(t, team, "melos-good", SECRET);
  const bad = await addApp(t, team, "melos-bad", "wrongwrongwrong1");
  const none = await addApp(t, team, "melos-none");
  expect(await admin.action(api.admin.queue.checkApp, { appId: good })).toBe("accepted");
  expect(await admin.action(api.admin.queue.checkApp, { appId: bad })).toBe("rejected");
  expect(await admin.action(api.admin.queue.checkApp, { appId: none })).toBe("no_secret");
  expect(tokenCalls).toHaveLength(2);
  const apps = new Map((await admin.query(api.admin.queue.list, {})).apps.map((app) => [app.label, app]));
  expect(apps.get("melos-good")).toMatchObject({ checkOk: true, checkedAt: expect.any(Number) });
  expect(apps.get("melos-bad")).toMatchObject({ checkOk: false });
  expect(apps.get("melos-none")).toMatchObject({ checkOk: null, secret: "none" });

  // A new secret clears the old result.
  await admin.mutation(api.admin.queue.setAppSecret, { appId: bad, secret: SECRET });
  expect((await admin.query(api.admin.queue.list, { })).apps.find((app) => app.label === "melos-bad")?.checkOk).toBeNull();
});

test("statuses read in plain words, grouped by app with emails to add", async () => {
  const { t, team, admin } = await setup();
  const alex = await addApp(t, team, "melos-alex");
  await request(t, { email: "a@berkeley.edu", appId: alex, requestedAt: 5 });
  await request(t, { email: "b@berkeley.edu", appId: alex, requestedAt: 3 });
  await request(t, { email: "c@berkeley.edu", appId: alex, status: "allowlisted" });
  await request(t, { email: "d@berkeley.edu", appId: alex, status: "connected", onboarding: "ready" });
  await request(t, { email: "e@berkeley.edu", appId: alex, status: "revoked" });
  const refused = await request(t, { email: "f@berkeley.edu", appId: alex });
  await t.run((ctx) => ctx.db.patch(refused.accessId, { refusedAt: 9 }));

  const queue = await admin.query(api.admin.queue.list, {});
  expect(queue.rows.map((row) => row.status)).toEqual(["needs_adding", "needs_adding", "refused", "added", "connected", "disconnected"]);
  expect(queue.apps[0]).toMatchObject({ used: 6, counts: { needs_adding: 2, refused: 1, added: 1, connected: 1, disconnected: 1, no_app: 0 } });
  expect(queue.apps[0].emailsToAdd).toEqual(["spotify-f@berkeley.edu", "spotify-b@berkeley.edu", "spotify-a@berkeley.edu"]);
  expect(queue.redirectUris).toHaveLength(2);
});

test("undo added sends them back to waiting and never sends a second ready email", async () => {
  const { t, team, admin } = await setup();
  const alex = await addApp(t, team, "melos-alex");
  const { accessId, userId } = await request(t, { email: "a@berkeley.edu", appId: alex, status: "allowlisted", onboarding: "needs_spotify_connect" });
  await admin.mutation(api.admin.queue.undoAdded, { accessId });
  await t.run(async (ctx) => {
    expect(await ctx.db.get(accessId)).toMatchObject({ status: "requested", notifiedAt: 2 });
    expect((await ctx.db.get(userId))?.onboarding).toBe("waiting_for_spotify");
  });
  const again = await admin.mutation(api.admin.queue.markAdded, { accessId });
  expect(again).toEqual({ changed: true, emailQueued: false });

  const connected = await request(t, { email: "b@berkeley.edu", appId: alex, status: "connected", onboarding: "ready" });
  await expect(admin.mutation(api.admin.queue.undoAdded, { accessId: connected.accessId })).rejects.toThrow(/disconnect first/);
});

test("move: to a free, active app only, and never a connected student", async () => {
  const { t, team, admin } = await setup();
  const alex = await addApp(t, team, "melos-alex");
  const sam = await addApp(t, team, "melos-sam");
  const off = await addApp(t, team, "melos-off");
  await admin.mutation(api.admin.queue.setAppActive, { appId: off, active: false });

  const added = await request(t, { email: "a@berkeley.edu", appId: alex, status: "allowlisted", onboarding: "needs_spotify_connect" });
  await admin.mutation(api.admin.queue.moveRequest, { accessId: added.accessId, appId: sam });
  await t.run(async (ctx) => {
    expect(await ctx.db.get(added.accessId)).toMatchObject({ spotifyAppId: sam, status: "requested" });
    expect((await ctx.db.get(added.userId))?.onboarding).toBe("waiting_for_spotify");
  });

  await expect(admin.mutation(api.admin.queue.moveRequest, { accessId: added.accessId, appId: off })).rejects.toThrow(/turned off/);
  for (let i = 0; i < 5; i += 1) await request(t, { email: `full${i}@berkeley.edu`, appId: alex });
  await expect(admin.mutation(api.admin.queue.moveRequest, { accessId: added.accessId, appId: alex })).rejects.toThrow(/no free slot/);

  const connected = await request(t, { email: "c@berkeley.edu", appId: sam, status: "connected", onboarding: "ready" });
  await expect(admin.mutation(api.admin.queue.moveRequest, { accessId: connected.accessId, appId: off })).rejects.toThrow(/disconnect first/);
});

test("moving or removing frees a slot that a waiting student gets right away", async () => {
  const { t, team, admin } = await setup();
  const alex = await addApp(t, team, "melos-alex");
  const first = await request(t, { email: "a@berkeley.edu", appId: alex });
  for (let i = 0; i < 4; i += 1) await request(t, { email: `s${i}@berkeley.edu`, appId: alex });
  const waiting = await request(t, { email: "late@berkeley.edu" });
  expect((await admin.query(api.admin.queue.list, { appId: "none" })).total).toBe(1);

  await admin.mutation(api.admin.queue.removeRequest, { accessId: first.accessId });
  await t.run(async (ctx) => {
    expect(await ctx.db.get(first.accessId)).toBeNull();
    expect((await ctx.db.get(first.userId))?.onboarding).toBe("needs_about_you");
    expect((await ctx.db.get(waiting.accessId))?.spotifyAppId).toBe(alex);
  });

  const connected = await t.run(async (ctx) => (await ctx.db.query("spotifyAccess").collect())[1]._id);
  await t.run((ctx) => ctx.db.patch(connected, { status: "connected" }));
  await expect(admin.mutation(api.admin.queue.removeRequest, { accessId: connected })).rejects.toThrow(/disconnect first/);
});

test("apps: edit keeps the active flag, turning on assigns waiting students, delete only when empty", async () => {
  const { t, team, admin } = await setup();
  const alex = await addApp(t, team, "melos-alex");
  await admin.mutation(api.admin.queue.setAppActive, { appId: alex, active: false });
  await admin.mutation(api.admin.queue.upsertSpotifyApp, { label: "melos-alex", ownerName: "Alex Z", clientId: "client-melos-alex" });
  await t.run(async (ctx) => {
    expect(await ctx.db.get(alex)).toMatchObject({ active: false, ownerName: "Alex Z" });
  });

  const waiting = await request(t, { email: "w@berkeley.edu" });
  expect(await admin.mutation(api.admin.queue.setAppActive, { appId: alex, active: true })).toEqual({ assignedWaiting: 1 });
  await expect(admin.mutation(api.admin.queue.deleteApp, { appId: alex })).rejects.toThrow(/Move or remove/);

  await admin.mutation(api.admin.queue.removeRequest, { accessId: waiting.accessId });
  await admin.mutation(api.admin.queue.setAppSecret, { appId: alex, secret: SECRET });
  await admin.mutation(api.admin.queue.deleteApp, { appId: alex });
  await t.run(async (ctx) => {
    expect(await ctx.db.get(alex)).toBeNull();
    expect(await ctx.db.query("spotifyAppSecrets").collect()).toHaveLength(0);
  });
  await expect(admin.mutation(api.admin.queue.upsertSpotifyApp, { label: "Bad Label", ownerName: "X", clientId: "abcdefgh12" })).rejects.toThrow(/Labels use/);
});

test("200 requests: the page gets one filtered, searchable page at a time", async () => {
  const { t, team, admin } = await setup();
  const apps: Id<"spotifyApps">[] = [];
  for (let i = 0; i < 10; i += 1) apps.push(await addApp(t, team, `melos-${i}`));
  await t.run(async (ctx) => {
    for (let i = 0; i < 200; i += 1) {
      const userId = await ctx.db.insert("users", { email: `s${i}@berkeley.edu`, firstName: `Student${i}`, verifiedAt: 1, onboarding: "waiting_for_spotify" });
      await ctx.db.insert("spotifyAccess", {
        userId,
        spotifyEmail: `s${i}@gmail.com`,
        spotifyAppId: i < 50 ? apps[i % 10] : undefined,
        status: "requested",
        requestedAt: i,
      });
    }
  });
  const first = await admin.query(api.admin.queue.list, {});
  expect(first.rows).toHaveLength(25);
  expect(first.total).toBe(200);
  expect(first.counts).toMatchObject({ needs_adding: 50, no_app: 150 });
  expect((await admin.query(api.admin.queue.list, { limit: 50 })).rows).toHaveLength(50);
  expect((await admin.query(api.admin.queue.list, { status: "no_app", limit: 500 })).rows).toHaveLength(150);
  expect((await admin.query(api.admin.queue.list, { appId: apps[3] })).total).toBe(5);
  const search = await admin.query(api.admin.queue.list, { search: "student199" });
  expect(search.rows.map((row) => row.spotifyEmail)).toEqual(["s199@gmail.com"]);
  expect((await admin.query(api.admin.queue.list, { search: "S42@GMAIL" })).total).toBe(1);
});
