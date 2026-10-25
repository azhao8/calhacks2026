import { beforeEach, describe, expect, test } from "vitest";
import type { MeView } from "@/convex/lib/views";
import type { Onboarding } from "@/convex/lib/validators";
import type { Id } from "@/convex/_generated/dataModel";
import { rememberNext, takeNext } from "./nav";

const me = (onboarding: Onboarding) =>
  ({
    userId: "u1" as Id<"users">,
    email: "sam@berkeley.edu",
    firstName: "Sam",
    onboarding,
    school: { name: "UC Berkeley", themeId: "berkeley" },
    isAdmin: false,
  }) as NonNullable<MeView>;

// The edge runtime has no sessionStorage; a plain map stands in for this tab's.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
});

describe("deep link after sign in", () => {
  test("returns the remembered route with its query, once", () => {
    rememberNext("/stay-in-touch", "?meetupId=m1");
    expect(takeNext(me("ready"))).toBe("/stay-in-touch?meetupId=m1");
    expect(takeNext(me("ready"))).toBe("/");
  });

  test("ignores anything that isn't one of our routes", () => {
    rememberNext("//evil.example", "");
    expect(takeNext(me("ready"))).toBe("/");
    rememberNext("/no-such-page", "?x=1");
    expect(takeNext(me("ready"))).toBe("/");
  });

  test("goes home when the account may not open the route yet", () => {
    rememberNext("/plan", "");
    expect(takeNext(me("waiting_for_spotify"))).toBe("/");
  });
});
