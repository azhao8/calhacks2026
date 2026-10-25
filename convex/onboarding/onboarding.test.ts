/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// ---- Outside services, mocked at their convex/services seams ----

const emails: { to: string; subject: string; text: string }[] = [];
vi.mock("../services/resend", () => ({
  sendEmail: async (message: { to: string; subject: string; text: string }) => {
    emails.push(message);
  },
}));

const DEFAULT_ANSWER = {
  summary: "Quiet, lyric heavy indie with a soft spot for live folk.",
  labels: ["indie folk", "mellow", "Lyric Focused", "not a label"],
  artists: ["big thief", "Phoebe Bridgers", "Made Up Band"],
};
const claude = {
  calls: [] as { system: string; prompt: string }[],
  answer: DEFAULT_ANSWER as unknown,
  fail: false,
};
vi.mock("../services/claude", () => ({
  generateJson: async (options: { system: string; prompt: string }) => {
    claude.calls.push({ system: options.system, prompt: options.prompt });
    if (claude.fail) throw new Error("Claude is down");
    return claude.answer;
  },
}));

const voyage = { calls: [] as string[][], fail: false };
vi.mock("../services/voyage", () => ({
  embed: async (texts: string[]) => {
    voyage.calls.push(texts);
    if (voyage.fail) throw new Error("Voyage is down");
    return texts.map(() => Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0)));
  },
}));

// Spotify, through a stubbed fetch so the real service module runs.
const spotify = {
  meStatus: 200,
  artists: ["Big Thief", "Phoebe Bridgers", "Adrianne Lenker", "Bon Iver", "Fleet Foxes", "Clairo"],
  requests: [] as string[],
  // Runs while the liked-songs request is in flight, before Spotify answers.
  duringFetch: null as null | (() => Promise<void>),
};
async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  spotify.requests.push(url);
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  if (url === "https://accounts.spotify.com/api/token") {
    const body = new URLSearchParams(String(init?.body));
    if (body.get("code") === "bad") return json({ error: "invalid_grant" }, 400);
    return json({ access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600, scope: "user-top-read user-library-read" });
  }
  if (url === "https://api.spotify.com/v1/me") {
    return spotify.meStatus === 200 ? json({ id: "spotify-user-1" }) : json({ error: "forbidden" }, spotify.meStatus);
  }
  if (url.startsWith("https://api.spotify.com/v1/me/top/artists")) {
    return json({ items: spotify.artists.map((name, i) => ({ id: `a${i}`, name, genres: [] })) });
  }
  if (url.startsWith("https://api.spotify.com/v1/me/top/tracks")) {
    return json({ items: spotify.artists.map((name, i) => ({ id: `t${i}`, name: `Song ${i}`, artists: [{ id: `a${i}`, name }] })) });
  }
  if (url.startsWith("https://api.spotify.com/v1/me/tracks")) {
    if (spotify.duringFetch) await spotify.duringFetch();
    return json({ items: [{ track: { id: "l1", name: "Not", artists: [{ id: "a0", name: "Big Thief" }] } }], next: null });
  }
  return json({ error: "unexpected" }, 500);
}

const modules = import.meta.glob("/convex/**/*.ts");

// Loaded by name so the app's type check doesn't compile the package's TypeScript test helper.
const WORKPOOL_TEST = "@convex-dev/workpool/test";
type WorkpoolTest = { register: (t: unknown, name: string) => unknown };
const workpool: WorkpoolTest = ((await import(/* @vite-ignore */ WORKPOOL_TEST)) as { default: WorkpoolTest }).default;

beforeAll(() => {
  process.env.SPOTIFY_STATE_SECRET = "test-state-secret";
  process.env.SPOTIFY_CLIENT_SECRET_MELOS_ALEX = "client-secret";
  process.env.SPOTIFY_CLIENT_SECRET_MELOS_SAM = "client-secret";
});

beforeEach(() => {
  emails.length = 0;
  claude.calls.length = 0;
  claude.fail = false;
  voyage.calls.length = 0;
  voyage.fail = false;
  claude.answer = DEFAULT_ANSWER;
  spotify.meStatus = 200;
  spotify.requests.length = 0;
  spotify.duringFetch = null;
  spotify.artists = ["Big Thief", "Phoebe Bridgers", "Adrianne Lenker", "Bon Iver", "Fleet Foxes", "Clairo"];
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fakeFetch);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---- Helpers ----

async function setup() {
  const t = convexTest(schema, modules);
  workpool.register(t, "aiPool");
  workpool.register(t, "emailPool");
  workpool.register(t, "syncPool");
  await t.mutation(internal.seed.run, {});
  return t;
}
type T = Awaited<ReturnType<typeof setup>>;

async function student(t: T, email = "alex@berkeley.edu", verified = true) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email,
      emailDomain: email.split("@")[1],
      onboarding: verified ? "needs_about_you" : "needs_verification",
      ...(verified ? { verifiedAt: Date.now() } : {}),
    }),
  );
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

async function addApp(t: T, label = "melos-alex") {
  return await t.mutation(internal.onboarding.admin.upsertSpotifyApp, { label, ownerName: "Alex", clientId: `client-${label}` });
}

async function drain(t: T) {
  for (let i = 0; i < 20; i += 1) {
    vi.advanceTimersByTime(60_000);
    await t.finishInProgressScheduledFunctions();
  }
}

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return (error as { data?: { code?: string } }).data?.code ?? String(error);
  }
  return undefined;
}

async function onboardingOf(t: T, userId: Id<"users">) {
  return await t.run(async (ctx) => (await ctx.db.get(userId))?.onboarding);
}

// Signed in, about you, surprise me, added, connected through the callback.
async function connected(t: T, email = "alex@berkeley.edu") {
  const s = await student(t, email);
  await s.as.mutation(api.onboarding.saveAboutYou, { firstName: "Alex", spotifyEmail: email });
  await s.as.mutation(api.onboarding.surpriseMe, {});
  const queue = await t.query(internal.onboarding.admin.queue, {});
  const row = queue.rows.find((r) => r.userId === s.userId)!;
  await t.mutation(internal.onboarding.admin.markAdded, { accessId: row.accessId, adminEmail: "owner@berkeley.edu" });
  const url = new URL(await s.as.action(api.spotify.connectUrl, { redirectUri: "http://127.0.0.1:3000/spotify/callback" }));
  await s.as.action(api.spotify.completeConnect, {
    code: "good",
    state: url.searchParams.get("state")!,
    redirectUri: "http://127.0.0.1:3000/spotify/callback",
  });
  return s;
}

// ---- Tests ----

describe("verification is enforced on the server", () => {
  test("signed out or unverified students can't call onboarding functions", async () => {
    const t = await setup();
    expect(await errorCode(t.mutation(api.onboarding.surpriseMe, {}))).toBe("not_signed_in");
    const { as } = await student(t, "new@berkeley.edu", false);
    expect(await errorCode(as.mutation(api.onboarding.saveAboutYou, { firstName: "A", spotifyEmail: "a@b.co" }))).toBe("forbidden");
    expect(await errorCode(as.action(api.spotify.connectUrl, { redirectUri: "http://127.0.0.1:3000/spotify/callback" }))).toBe("forbidden");
  });
});

describe("school, about you, preferences", () => {
  test("chooseSchool accepts only open schools", async () => {
    const t = await setup();
    const { userId, as } = await student(t);
    const schools = await t.query(api.schools.list, {});
    const ucla = schools.find((s) => s.name === "UCLA")!;
    const berkeley = schools.find((s) => s.name === "UC Berkeley")!;
    expect(await errorCode(as.mutation(api.onboarding.chooseSchool, { universityId: ucla._id }))).toBe("validation_failed");
    await as.mutation(api.onboarding.chooseSchool, { universityId: berkeley._id });
    expect(await t.run(async (ctx) => (await ctx.db.get(userId))?.universityId)).toBe(berkeley._id);
  });

  test("about you assigns the app with the most free slots and moves to preferences", async () => {
    const t = await setup();
    await addApp(t, "melos-alex");
    await addApp(t, "melos-sam");
    const a = await student(t, "a@berkeley.edu");
    const b = await student(t, "b@berkeley.edu");
    await a.as.mutation(api.onboarding.saveAboutYou, { firstName: "  Maya ", spotifyEmail: " Maya@Gmail.com " });
    await b.as.mutation(api.onboarding.saveAboutYou, { firstName: "Sam", spotifyEmail: "sam@gmail.com" });
    const queue = await t.query(internal.onboarding.admin.queue, {});
    expect(queue.rows.map((r) => [r.firstName, r.spotifyEmail, r.appLabel, r.status])).toEqual([
      ["Maya", "maya@gmail.com", "melos-alex", "requested"],
      ["Sam", "sam@gmail.com", "melos-sam", "requested"],
    ]);
    expect(queue.apps.map((app) => [app.label, app.used, app.capacity])).toEqual([
      ["melos-alex", 1, 5],
      ["melos-sam", 1, 5],
    ]);
    expect(await onboardingOf(t, a.userId)).toBe("needs_preferences");
    expect(await a.as.query(api.onboarding.access, {})).toEqual({ status: "requested", refused: false, spotifyEmail: "maya@gmail.com" });
  });

  test("validation: blank names and bad emails are refused", async () => {
    const t = await setup();
    const { as } = await student(t);
    expect(await errorCode(as.mutation(api.onboarding.saveAboutYou, { firstName: "  ", spotifyEmail: "a@b.co" }))).toBe("validation_failed");
    expect(await errorCode(as.mutation(api.onboarding.saveAboutYou, { firstName: "A", spotifyEmail: "nope" }))).toBe("validation_failed");
  });

  test("every app full: honest no-capacity status, an admin flag, and assignment once an app is added", async () => {
    const t = await setup();
    await addApp(t, "melos-alex");
    for (let i = 0; i < 5; i += 1) {
      const s = await student(t, `s${i}@berkeley.edu`);
      await s.as.mutation(api.onboarding.saveAboutYou, { firstName: `S${i}`, spotifyEmail: `s${i}@gmail.com` });
    }
    const late = await student(t, "late@berkeley.edu");
    await late.as.mutation(api.onboarding.saveAboutYou, { firstName: "Late", spotifyEmail: "late@gmail.com" });
    expect(await late.as.query(api.onboarding.access, {})).toEqual({ status: "no_capacity", refused: false, spotifyEmail: "late@gmail.com" });
    const queue = await t.query(internal.onboarding.admin.queue, {});
    expect(queue.flags.noCapacity).toBe(1);
    // The capacity flow continues to preferences, so the wait isn't wasted.
    expect(await onboardingOf(t, late.userId)).toBe("needs_preferences");

    const result = await addApp(t, "melos-sam");
    expect(result.assignedWaiting).toBe(1);
    expect(await late.as.query(api.onboarding.access, {})).toEqual({ status: "requested", refused: false, spotifyEmail: "late@gmail.com" });
  });

  test("preferences: surprise me uses the confirmed defaults and moves to waiting", async () => {
    const t = await setup();
    await addApp(t);
    const { userId, as } = await student(t);
    expect(await errorCode(as.mutation(api.onboarding.surpriseMe, {}))).toBe("validation_failed"); // name first
    await as.mutation(api.onboarding.saveAboutYou, { firstName: "Alex", spotifyEmail: "alex@gmail.com" });
    await as.mutation(api.onboarding.surpriseMe, {});
    const prefs = await t.run(async (ctx) => ctx.db.query("preferences").withIndex("by_userId", (q) => q.eq("userId", userId)).unique());
    expect(prefs).toMatchObject({ maxTicketPrice: 25, meetWho: "anyone", area: "berkeley_oakland", prefersSimilarYear: false, source: "surprise_me" });
    expect(await onboardingOf(t, userId)).toBe("waiting_for_spotify");
  });

  test("custom preferences store private gender and year, and validate the budget", async () => {
    const t = await setup();
    await addApp(t);
    const { userId, as } = await student(t);
    await as.mutation(api.onboarding.saveAboutYou, { firstName: "Alex", spotifyEmail: "alex@gmail.com" });
    const base = { maxTicketPrice: 15, meetWho: ["woman", "non_binary", "woman"] as ("woman" | "non_binary")[], prefersSimilarYear: true, area: "campus" as const };
    expect(await errorCode(as.mutation(api.onboarding.savePreferences, { ...base, maxTicketPrice: 12.5 }))).toBe("validation_failed");
    expect(await errorCode(as.mutation(api.onboarding.savePreferences, { ...base, meetWho: [] }))).toBe("validation_failed");
    await as.mutation(api.onboarding.savePreferences, { ...base, gender: "woman", year: "third" });
    const { prefs, user } = await t.run(async (ctx) => ({
      prefs: await ctx.db.query("preferences").withIndex("by_userId", (q) => q.eq("userId", userId)).unique(),
      user: await ctx.db.get(userId),
    }));
    expect(prefs).toMatchObject({ maxTicketPrice: 15, meetWho: ["non_binary", "woman"], area: "campus", source: "custom" });
    expect(user).toMatchObject({ gender: "woman", year: "third", onboarding: "waiting_for_spotify" });
    expect(await as.query(api.onboarding.preferences, {})).toEqual({
      maxTicketPrice: 15,
      meetWho: ["non_binary", "woman"],
      gender: "woman",
      year: "third",
      prefersSimilarYear: true,
      area: "campus",
      source: "custom",
    });
    // Only the student's own record: someone else sees their own (none yet), and signed out sees nothing.
    const other = await student(t, "other@berkeley.edu");
    expect(await other.as.query(api.onboarding.preferences, {})).toBeNull();
    expect(await t.query(api.onboarding.preferences, {})).toBeNull();
    // Later changes don't move onboarding again.
    await as.mutation(api.onboarding.surpriseMe, {});
    expect(await onboardingOf(t, userId)).toBe("waiting_for_spotify");
  });
});

describe("allow-list queue and Mark added", () => {
  test("mark added flips waiting to connect, live, and queues exactly one ready email", async () => {
    const t = await setup();
    await addApp(t);
    const { userId, as } = await student(t);
    await as.mutation(api.onboarding.saveAboutYou, { firstName: "Alex", spotifyEmail: "alex@gmail.com" });
    await as.mutation(api.onboarding.surpriseMe, {});
    const { rows } = await t.query(internal.onboarding.admin.queue, {});
    const first = await t.mutation(internal.onboarding.admin.markAdded, { accessId: rows[0].accessId, adminEmail: "owner@berkeley.edu" });
    const again = await t.mutation(internal.onboarding.admin.markAdded, { accessId: rows[0].accessId, adminEmail: "owner@berkeley.edu" });
    expect(first).toEqual({ changed: true, emailQueued: true });
    expect(again).toEqual({ changed: false, emailQueued: false });
    expect(await onboardingOf(t, userId)).toBe("needs_spotify_connect");
    expect(await as.query(api.onboarding.access, {})).toEqual({ status: "allowlisted", refused: false, spotifyEmail: "alex@gmail.com" });
    await drain(t);
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("alex@berkeley.edu");
    expect(emails[0].text).not.toMatch(/[!–—]/);
  });

  test("added before finishing preferences skips the waiting screen", async () => {
    const t = await setup();
    await addApp(t);
    const { userId, as } = await student(t);
    await as.mutation(api.onboarding.saveAboutYou, { firstName: "Alex", spotifyEmail: "alex@gmail.com" });
    const { rows } = await t.query(internal.onboarding.admin.queue, {});
    await t.mutation(internal.onboarding.admin.markAdded, { accessId: rows[0].accessId, adminEmail: "owner@berkeley.edu" });
    expect(await onboardingOf(t, userId)).toBe("needs_preferences");
    await as.mutation(api.onboarding.surpriseMe, {});
    expect(await onboardingOf(t, userId)).toBe("needs_spotify_connect");
  });
});

describe("Spotify connect", () => {
  test("connect needs an allow-listed account and a known callback", async () => {
    const t = await setup();
    await addApp(t);
    const { as } = await student(t);
    await as.mutation(api.onboarding.saveAboutYou, { firstName: "Alex", spotifyEmail: "alex@gmail.com" });
    expect(await errorCode(as.action(api.spotify.connectUrl, { redirectUri: "http://127.0.0.1:3000/spotify/callback" }))).toBe("spotify_not_ready");
    const { rows } = await t.query(internal.onboarding.admin.queue, {});
    await t.mutation(internal.onboarding.admin.markAdded, { accessId: rows[0].accessId, adminEmail: "o@berkeley.edu" });
    expect(await errorCode(as.action(api.spotify.connectUrl, { redirectUri: "https://evil.example/spotify/callback" }))).toBe("validation_failed");
    const url = new URL(await as.action(api.spotify.connectUrl, { redirectUri: "https://melos.azhao.dev/spotify/callback" }));
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-melos-alex");
    expect(url.searchParams.get("scope")).toBe("user-top-read user-library-read");
    expect(url.searchParams.get("state")).toMatch(/^[\w-]+\.[\w-]+$/);
  });

  test("a state from another student, a forged state, or an expired state is refused", async () => {
    const t = await setup();
    await addApp(t);
    const redirectUri = "http://127.0.0.1:3000/spotify/callback";
    const ready = async (email: string) => {
      const s = await student(t, email);
      await s.as.mutation(api.onboarding.saveAboutYou, { firstName: "X", spotifyEmail: email });
      const { rows } = await t.query(internal.onboarding.admin.queue, {});
      const row = rows.find((r) => r.userId === s.userId)!;
      await t.mutation(internal.onboarding.admin.markAdded, { accessId: row.accessId, adminEmail: "o@berkeley.edu" });
      return s;
    };
    const a = await ready("a@berkeley.edu");
    const b = await ready("b@berkeley.edu");
    const stateA = new URL(await a.as.action(api.spotify.connectUrl, { redirectUri })).searchParams.get("state")!;
    expect(await errorCode(b.as.action(api.spotify.completeConnect, { code: "good", state: stateA, redirectUri }))).toBe("forbidden");
    const [body, sig] = stateA.split(".");
    expect(await errorCode(a.as.action(api.spotify.completeConnect, { code: "good", state: `${body}x.${sig}`, redirectUri }))).toBe("forbidden");
    // The exchange must use the same callback address as the consent, and only our two addresses are allowed.
    expect(
      await errorCode(a.as.action(api.spotify.completeConnect, { code: "good", state: stateA, redirectUri: "https://melos.azhao.dev/spotify/callback" })),
    ).toBe("forbidden");
    for (const bad of ["https://melos.azhao.dev.evil.com/spotify/callback", "http://localhost:3000/spotify/callback", "https://melos.azhao.dev/spotify/callback/"]) {
      expect(await errorCode(a.as.action(api.spotify.connectUrl, { redirectUri: bad }))).toBe("validation_failed");
      expect(await errorCode(a.as.action(api.spotify.completeConnect, { code: "good", state: stateA, redirectUri: bad }))).toBe("validation_failed");
    }
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(await errorCode(a.as.action(api.spotify.completeConnect, { code: "good", state: stateA, redirectUri }))).toBe("forbidden");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("spotifyTokens").collect()).toHaveLength(0);
    });
  });

  test("Spotify 403 sends the student back to waiting with a refusal flag", async () => {
    const t = await setup();
    await addApp(t);
    spotify.meStatus = 403;
    const s = await student(t);
    await s.as.mutation(api.onboarding.saveAboutYou, { firstName: "Alex", spotifyEmail: "alex@gmail.com" });
    await s.as.mutation(api.onboarding.surpriseMe, {});
    const { rows } = await t.query(internal.onboarding.admin.queue, {});
    await t.mutation(internal.onboarding.admin.markAdded, { accessId: rows[0].accessId, adminEmail: "o@berkeley.edu" });
    const redirectUri = "http://127.0.0.1:3000/spotify/callback";
    const state = new URL(await s.as.action(api.spotify.connectUrl, { redirectUri })).searchParams.get("state")!;
    expect(await errorCode(s.as.action(api.spotify.completeConnect, { code: "good", state, redirectUri }))).toBe("spotify_refused");
    expect(await onboardingOf(t, s.userId)).toBe("waiting_for_spotify");
    expect(await s.as.query(api.onboarding.access, {})).toEqual({ status: "requested", refused: true, spotifyEmail: "alex@gmail.com" });
    const queue = await t.query(internal.onboarding.admin.queue, {});
    expect(queue.flags.refused).toBe(1);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("spotifyTokens").collect()).toHaveLength(0);
    });
    // Marking added again doesn't send a second ready email.
    const again = await t.mutation(internal.onboarding.admin.markAdded, { accessId: rows[0].accessId, adminEmail: "o@berkeley.edu" });
    expect(again).toEqual({ changed: true, emailQueued: false });
  });
});

describe("analysis and taste review", () => {
  test("connect → fetch → summary → review; tokens and snapshots never reach the student", async () => {
    const t = await setup();
    await addApp(t);
    const s = await connected(t);
    expect(await onboardingOf(t, s.userId)).toBe("analyzing");
    expect(await s.as.query(api.taste.analysis, {})).toMatchObject({ status: "queued" });
    await drain(t);
    expect(await s.as.query(api.taste.analysis, {})).toEqual({ status: "done", error: null, failure: null });
    expect(await onboardingOf(t, s.userId)).toBe("needs_review");

    const profile = await s.as.query(api.taste.profile, {});
    // Labels are filtered to the fixed list; artists to names in the student's data, spelled as in the data.
    expect(profile).toEqual({
      summary: "Quiet, lyric heavy indie with a soft spot for live folk.",
      labels: ["indie folk", "mellow", "lyric focused"],
      artists: ["Big Thief", "Phoebe Bridgers"],
      revision: 0,
      confirmed: false,
    });
    expect(Object.keys(profile!)).not.toContain("fingerprint");

    // Claude saw names only: never the email, user ID, or Spotify IDs.
    expect(claude.calls).toHaveLength(1);
    const sentToClaude = claude.calls[0].system + claude.calls[0].prompt;
    expect(sentToClaude).toContain("Big Thief");
    expect(sentToClaude).not.toContain("alex@");
    expect(sentToClaude).not.toContain(s.userId);
    expect(sentToClaude).not.toContain("spotify-user-1");

    const stored = await t.run(async (ctx) => ({
      snapshot: await ctx.db.query("tasteSnapshots").first(),
      profile: await ctx.db.query("tasteProfiles").first(),
      access: await ctx.db.query("spotifyAccess").first(),
    }));
    expect(stored.snapshot?.topArtists[0]).toMatchObject({ name: "Big Thief", normalizedName: "big thief", rank: 1, range: "short_term" });
    expect(stored.profile?.fingerprint.topArtists).toContain("bon iver");
    expect(stored.profile?.fingerprint.labels).toEqual(["indie folk", "lyric focused", "mellow"]);
    expect(stored.access?.status).toBe("connected");
  });

  test("restarting analysis never repeats paid calls", async () => {
    const t = await setup();
    await addApp(t);
    const s = await connected(t);
    await drain(t);
    await s.as.mutation(api.taste.startAnalysis, {});
    await s.as.mutation(api.taste.startAnalysis, {});
    await drain(t);
    expect(claude.calls).toHaveLength(1);
    expect(spotify.requests.filter((u) => u.includes("/me/top/artists"))).toHaveLength(2); // short and medium term, once
  });

  test("a Claude failure after the snapshot keeps the snapshot; the retry only calls Claude", async () => {
    const t = await setup();
    await addApp(t);
    claude.fail = true;
    const s = await connected(t);
    await drain(t);
    expect(await s.as.query(api.taste.analysis, {})).toEqual({ status: "failed", error: "failed", failure: "other" });
    expect(await onboardingOf(t, s.userId)).toBe("analyzing"); // failures belong to the job
    const fetches = spotify.requests.length;
    claude.fail = false;
    await s.as.mutation(api.taste.startAnalysis, {});
    await drain(t);
    expect(await s.as.query(api.taste.analysis, {})).toEqual({ status: "done", error: null, failure: null });
    expect(spotify.requests.length).toBe(fetches);
  });

  test("too little listening data: no taste is invented", async () => {
    const t = await setup();
    await addApp(t);
    spotify.artists = ["Big Thief", "Clairo"];
    const s = await connected(t);
    await drain(t);
    expect(await s.as.query(api.taste.analysis, {})).toEqual({ status: "failed", error: "too_little_data", failure: "too_little_data" });
    expect(await s.as.query(api.taste.profile, {})).toBeNull();
    expect(claude.calls).toHaveLength(0);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("tasteSnapshots").collect()).toHaveLength(0);
    });
  });

  test("an answer that breaks the rules is never stored", async () => {
    const t = await setup();
    await addApp(t);
    claude.answer = { summary: "You love indie — and folk!", labels: ["indie folk", "mellow", "folk"], artists: ["Big Thief"] };
    const s = await connected(t);
    await drain(t);
    expect(await s.as.query(api.taste.profile, {})).toBeNull();
    expect(await s.as.query(api.taste.analysis, {})).toEqual({ status: "failed", error: "failed", failure: "other" });
  });

  test("Not quite revises the summary; the correction is kept and the revision counts up", async () => {
    const t = await setup();
    await addApp(t);
    const s = await connected(t);
    await drain(t);
    claude.answer = { summary: "Live folk first, with quiet indie for late nights.", labels: ["folk", "late night", "acoustic"], artists: ["Fleet Foxes"] };
    await s.as.mutation(api.taste.correct, { text: "More folk than indie, honestly" });
    expect(await s.as.query(api.taste.analysis, {})).toEqual({ status: "summarizing", error: null, failure: null });
    // A second tap while it runs is refused instead of double billing.
    expect(await errorCode(s.as.mutation(api.taste.correct, { text: "again" }))).toBe("retryable");
    await drain(t);
    expect(await s.as.query(api.taste.profile, {})).toMatchObject({
      summary: "Live folk first, with quiet indie for late nights.",
      labels: ["folk", "late night", "acoustic"],
      artists: ["Fleet Foxes"],
      revision: 1,
      confirmed: false,
    });
    expect(claude.calls.at(-1)?.prompt).toContain("More folk than indie, honestly");
    const correction = await t.run(async (ctx) => (await ctx.db.query("tasteProfiles").first())?.correction);
    expect(correction).toBe("More folk than indie, honestly");
  });

  test("a failed correction keeps the typed text and the old summary", async () => {
    const t = await setup();
    await addApp(t);
    const s = await connected(t);
    await drain(t);
    claude.fail = true;
    await s.as.mutation(api.taste.correct, { text: "More folk" });
    await drain(t);
    expect(await s.as.query(api.taste.analysis, {})).toEqual({ status: "failed", error: "correction_failed", failure: "other" });
    expect(await s.as.query(api.taste.profile, {})).toMatchObject({ revision: 0 });
    expect(await t.run(async (ctx) => (await ctx.db.query("tasteProfiles").first())?.correction)).toBe("More folk");
  });

  test("That's me: ready, with a Voyage vector of the taste document", async () => {
    const t = await setup();
    await addApp(t);
    const s = await connected(t);
    await drain(t);
    await s.as.mutation(api.taste.confirm, {});
    expect(await onboardingOf(t, s.userId)).toBe("ready");
    await drain(t);
    const profile = await t.run(async (ctx) => ctx.db.query("tasteProfiles").first());
    expect(profile?.embedding).toHaveLength(1024);
    expect(profile?.confirmedAt).toBeTypeOf("number");
    expect(voyage.calls).toHaveLength(1);
    expect(voyage.calls[0][0]).toContain("Labels: indie folk, mellow, lyric focused");
    expect(voyage.calls[0][0]).not.toContain("alex@");
    expect((await s.as.query(api.taste.profile, {}))?.confirmed).toBe(true);
  });

  test("a double tapped That's me queues one Voyage call; a correction then needs a new one", async () => {
    const t = await setup();
    await addApp(t);
    const s = await connected(t);
    await drain(t);
    await s.as.mutation(api.taste.confirm, {});
    await s.as.mutation(api.taste.confirm, {});
    expect(await s.as.query(api.taste.analysis, {})).toMatchObject({ status: "embedding" });
    await drain(t);
    await s.as.mutation(api.taste.confirm, {}); // already confirmed and embedded
    await drain(t);
    expect(voyage.calls).toHaveLength(1);
    expect(await s.as.query(api.taste.analysis, {})).toEqual({ status: "done", error: null, failure: null });

    // A revised summary drops the old vector and is embedded once on its own confirm.
    claude.answer = { summary: "Live folk first.", labels: ["folk", "acoustic", "mellow"], artists: ["Fleet Foxes"] };
    await s.as.mutation(api.taste.correct, { text: "More folk" });
    await drain(t);
    expect(await t.run(async (ctx) => (await ctx.db.query("tasteProfiles").first())?.embedding !== undefined)).toBe(false);
    await s.as.mutation(api.taste.confirm, {});
    await s.as.mutation(api.taste.confirm, {});
    await drain(t);
    expect(voyage.calls).toHaveLength(2);
    expect(voyage.calls[1][0]).toContain("Live folk first.");
  });

  test("a failed embedding can be retried by confirming again", async () => {
    const t = await setup();
    await addApp(t);
    voyage.fail = true;
    const s = await connected(t);
    await drain(t);
    await s.as.mutation(api.taste.confirm, {});
    await drain(t);
    const attempts = voyage.calls.length;
    voyage.fail = false;
    await s.as.mutation(api.taste.confirm, {});
    await drain(t);
    expect(voyage.calls).toHaveLength(attempts + 1);
    expect((await t.run(async (ctx) => ctx.db.query("tasteProfiles").first()))?.embedding).toHaveLength(1024);
  });

  test("a Voyage failure still leaves the student ready, matched on exact items", async () => {
    const t = await setup();
    await addApp(t);
    voyage.fail = true;
    const s = await connected(t);
    await drain(t);
    await s.as.mutation(api.taste.confirm, {});
    await drain(t);
    expect(await onboardingOf(t, s.userId)).toBe("ready");
    expect(voyage.calls.length).toBeGreaterThan(1); // retried
    const profile = await t.run(async (ctx) => ctx.db.query("tasteProfiles").first());
    expect(profile?.embedding).toBeUndefined();
    expect(profile?.fingerprint.topArtists.length).toBeGreaterThan(0);
  });

  test("demo fixtures run through the same pipeline without Spotify", async () => {
    const t = await setup();
    const userId = await t.run(async (ctx) => ctx.db.insert("users", { email: "demo1@melos.invalid", isDemo: true, firstName: "Maya" }));
    await t.mutation(internal.onboarding.analysis.analyzeFixture, {
      userId,
      listening: {
        topArtists: ["Big Thief", "Phoebe Bridgers", "Bon Iver", "Clairo", "Fleet Foxes"].map((name, i) => ({ spotifyId: `d${i}`, name, genres: [], rank: i + 1, range: "medium_term" as const })),
        topTracks: [],
        likedSongs: [],
      },
    });
    await drain(t);
    await t.mutation(internal.onboarding.analysis.confirmForUser, { userId });
    await drain(t);
    const { profile, snapshot, user } = await t.run(async (ctx) => ({
      profile: await ctx.db.query("tasteProfiles").first(),
      snapshot: await ctx.db.query("tasteSnapshots").first(),
      user: await ctx.db.get(userId),
    }));
    expect(snapshot?.source).toBe("demo_fixture");
    expect(profile?.embedding).toHaveLength(1024);
    expect(user?.onboarding).toBe("ready");
    expect(spotify.requests).toHaveLength(0);
  });
});

describe("disconnect", () => {
  test("disconnecting while Spotify is still answering stores nothing and never calls Claude", async () => {
    const t = await setup();
    await addApp(t);
    let s: Awaited<ReturnType<typeof student>> | null = null;
    spotify.duringFetch = async () => {
      spotify.duringFetch = null;
      await s!.as.mutation(api.settings.disconnectSpotify, {});
    };
    s = await connected(t);
    await drain(t);
    const left = await t.run(async (ctx) => ({
      snapshots: await ctx.db.query("tasteSnapshots").collect(),
      profiles: await ctx.db.query("tasteProfiles").collect(),
      jobs: await ctx.db.query("analysisJobs").collect(),
      tokens: await ctx.db.query("spotifyTokens").collect(),
    }));
    expect(spotify.requests.some((u) => u.includes("/me/tracks"))).toBe(true); // the fetch really was in flight
    expect(left).toEqual({ snapshots: [], profiles: [], jobs: [], tokens: [] });
    expect(claude.calls).toHaveLength(0);
    expect(voyage.calls).toHaveLength(0);
    expect(await onboardingOf(t, s.userId)).toBe("needs_spotify_connect");
  });

  test("deletes tokens, snapshot, profile, and vector; revokes access; reconnect starts at S07", async () => {
    const t = await setup();
    await addApp(t);
    const s = await connected(t);
    await drain(t);
    await s.as.mutation(api.taste.confirm, {});
    await drain(t);
    await s.as.mutation(api.settings.disconnectSpotify, {});
    const left = await t.run(async (ctx) => ({
      tokens: await ctx.db.query("spotifyTokens").collect(),
      snapshots: await ctx.db.query("tasteSnapshots").collect(),
      profiles: await ctx.db.query("tasteProfiles").collect(),
      jobs: await ctx.db.query("analysisJobs").collect(),
      access: await ctx.db.query("spotifyAccess").first(),
    }));
    expect(left.tokens).toHaveLength(0);
    expect(left.snapshots).toHaveLength(0);
    expect(left.profiles).toHaveLength(0);
    expect(left.jobs).toHaveLength(0);
    expect(left.access?.status).toBe("revoked");
    expect(await onboardingOf(t, s.userId)).toBe("needs_spotify_connect");
    expect(await s.as.query(api.taste.profile, {})).toBeNull();
    // Still on the app's allow-list, so the student can reconnect, and the slot still counts.
    const url = await s.as.action(api.spotify.connectUrl, { redirectUri: "http://127.0.0.1:3000/spotify/callback" });
    expect(url).toContain("client_id=client-melos-alex");
    expect((await t.query(internal.onboarding.admin.queue, {})).apps[0].used).toBe(1);
  });
});
