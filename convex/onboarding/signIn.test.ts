/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import schema from "../schema";
import { api, internal } from "../_generated/api";

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("../services/resend", () => ({
  sendEmail: async (message: { to: string; subject: string; text: string }) => {
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
      params: { email: "Alex@EECS.Berkeley.edu" },
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
      params: { email: "Alex@EECS.Berkeley.edu", code },
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
