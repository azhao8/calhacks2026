/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import schema from "../schema";
import { api, internal } from "../_generated/api";

const sent: { to: string; subject: string; text: string }[] = [];
const resend = { fail: false };
vi.mock("../services/resend", () => ({
  sendEmail: async (message: { to: string; subject: string; text: string }) => {
    if (resend.fail) throw new Error("Resend failed: 503");
    sent.push(message);
  },
}));

const modules = import.meta.glob("/convex/**/*.ts");

beforeAll(async () => {
  const keys = await generateKeyPair("RS256", { extractable: true });
  process.env.JWT_PRIVATE_KEY = (await exportPKCS8(keys.privateKey)).replace(/\n/g, " ");
  process.env.JWKS = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });
  process.env.SITE_URL = "http://127.0.0.1:3000";
  process.env.CONVEX_SITE_URL = "https://test.convex.site";
});

beforeEach(() => {
  sent.length = 0;
  resend.fail = false;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.run, {});
  return t;
}

function codeFrom(index = sent.length - 1): string {
  const match = sent[index].text.match(/\b(\d{6})\b/);
  if (!match) throw new Error("no code in email");
  return match[1];
}

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    const data = (error as { data?: { code?: string } }).data;
    return data?.code ?? String(error);
  }
  return undefined;
}

describe("sign-in with a .edu email code", () => {
  test("a non-.edu address is refused before anything is stored or sent", async () => {
    const t = await setup();
    expect(await errorCode(t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@gmail.com" } }))).toBe(
      "not_edu_email",
    );
    expect(await errorCode(t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu.evil.com" } }))).toBe(
      "not_edu_email",
    );
    expect(sent).toHaveLength(0);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("users").collect()).toHaveLength(0);
      expect(await ctx.db.query("authAccounts").collect()).toHaveLength(0);
      expect(await ctx.db.query("authVerificationCodes").collect()).toHaveLength(0);
    });
  });

  test("a .edu address gets a 6 digit code; verifying sets verifiedAt, school, and onboarding", async () => {
    const t = await setup();
    const started = await t.action(api.auth.signIn, {
      provider: "resend-otp",
      params: { email: "alex@eecs.berkeley.edu" },
    });
    expect(started.started).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("alex@eecs.berkeley.edu");
    const code = codeFrom();
    expect(code).toMatch(/^\d{6}$/);

    await t.run(async (ctx) => {
      const [user] = await ctx.db.query("users").collect();
      expect(user.email).toBe("alex@eecs.berkeley.edu");
      expect(user.onboarding).toBe("needs_verification");
      expect(user.verifiedAt).toBeUndefined();
      // The code is stored hashed, valid for 15 minutes.
      const [stored] = await ctx.db.query("authVerificationCodes").collect();
      expect(stored.code).not.toBe(code);
      expect(Math.abs(stored.expirationTime - Date.now() - 15 * 60 * 1000)).toBeLessThan(1000);
    });

    const result = await t.action(api.auth.signIn, {
      provider: "resend-otp",
      params: { email: "alex@eecs.berkeley.edu", code },
    });
    expect(result.tokens).not.toBeNull();
    await t.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      expect(users).toHaveLength(1);
      const [user] = users;
      expect(user.verifiedAt).toBeTypeOf("number");
      expect(user.emailDomain).toBe("eecs.berkeley.edu");
      expect(user.onboarding).toBe("needs_about_you");
      const school = await ctx.db.get(user.universityId!);
      expect(school?.name).toBe("UC Berkeley");
    });
  });

  test("the address stored and emailed is exactly the normalized one that was validated", async () => {
    const t = await setup();
    // Only the normalized form may request a code (the UI normalizes first). Fullwidth letters, case, and
    // spaces are refused with nothing stored or sent, so one inbox can't collect several accounts and try limits.
    expect(
      await errorCode(t.action(api.auth.signIn, { provider: "resend-otp", params: { email: " Alex@Berkeley.\uFF45\uFF44\uFF55 " } })),
    ).toBe("validation_failed");
    expect(sent).toHaveLength(0);
    await t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu" } });
    expect(sent.map((m) => m.to)).toEqual(["alex@berkeley.edu"]);
    await t.run(async (ctx) => {
      const [user] = await ctx.db.query("users").collect();
      expect(user.email).toBe("alex@berkeley.edu");
      expect(user.emailDomain).toBe("berkeley.edu");
    });
    // A lookalike that stays non-ASCII is refused, with nothing stored or sent.
    expect(await errorCode(t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.\u0435du" } }))).toBe(
      "not_edu_email",
    );
    expect(sent).toHaveLength(1);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("users").collect()).toHaveLength(1);
    });
  });

  test("students from other .edu schools default to the open school", async () => {
    const t = await setup();
    await t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "sam@mit.edu" } });
    await t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "sam@mit.edu", code: codeFrom() } });
    await t.run(async (ctx) => {
      const [user] = await ctx.db.query("users").collect();
      expect((await ctx.db.get(user.universityId!))?.name).toBe("UC Berkeley");
    });
  });

  test("a new code at most every 30 seconds", async () => {
    const t = await setup();
    await t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu" } });
    vi.advanceTimersByTime(10_000);
    expect(await errorCode(t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu" } }))).toBe(
      "code_cooldown",
    );
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(21_000);
    await t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu" } });
    expect(sent).toHaveLength(2);
  });

  test("a wrong or expired code doesn't sign in", async () => {
    const t = await setup();
    await t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu" } });
    const code = codeFrom();
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await errorCode(t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu", code: wrong } }))).toContain(
      "Could not verify code",
    );
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(await errorCode(t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu", code } }))).toContain(
      "Could not verify code",
    );
    await t.run(async (ctx) => {
      const [user] = await ctx.db.query("users").collect();
      expect(user.verifiedAt).toBeUndefined();
    });
  });

  test("a code that never went out doesn't start the 30 second wait", async () => {
    const t = await setup();
    resend.fail = true;
    expect(await errorCode(t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu" } }))).toBe(
      "retryable",
    );
    await t.run(async (ctx) => {
      expect(await ctx.db.query("authVerificationCodes").collect()).toHaveLength(0);
    });
    resend.fail = false;
    vi.advanceTimersByTime(2_000);
    const started = await t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu" } });
    expect(started.started).toBe(true);
    expect(sent).toHaveLength(1);
    // The code that did go out works.
    const result = await t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu", code: codeFrom() } });
    expect(result.tokens).not.toBeNull();
  });

  test("ten failed tries lock the address for a while", async () => {
    const t = await setup();
    await t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu" } });
    const code = codeFrom();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 10; i += 1) {
      await errorCode(t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu", code: wrong } }));
    }
    // Even the right code is refused while rate limited.
    expect(await errorCode(t.action(api.auth.signIn, { provider: "resend-otp", params: { email: "alex@berkeley.edu", code } }))).toContain(
      "Could not verify code",
    );
  });
});
