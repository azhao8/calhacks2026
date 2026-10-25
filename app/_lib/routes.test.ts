import { describe, expect, test } from "vitest";
import type { MeView, PlanView } from "@/convex/lib/views";
import type { Onboarding } from "@/convex/lib/validators";
import type { Id } from "@/convex/_generated/dataModel";
import { homeRoute, isActivePlan, redirectFor, ROUTES } from "./routes";

const me = (onboarding: Onboarding, school: { name: string; themeId: string } | null = { name: "UC Berkeley", themeId: "berkeley" }) =>
  ({
    userId: "u1" as Id<"users">,
    email: "sam@berkeley.edu",
    firstName: "Sam",
    onboarding,
    school,
    isAdmin: false,
  }) satisfies NonNullable<MeView>;

const plan = (stage: PlanView["stage"]) => ({ stage });

describe("homeRoute", () => {
  test("no school goes to the picker first", () => {
    expect(homeRoute(me("ready", null), null)).toBe(ROUTES.school);
  });

  test("each onboarding state has its screen", () => {
    expect(homeRoute(me("needs_verification"), null)).toBe(ROUTES.signIn);
    expect(homeRoute(me("needs_about_you"), null)).toBe(ROUTES.aboutYou);
    expect(homeRoute(me("needs_preferences"), null)).toBe(ROUTES.preferences);
    expect(homeRoute(me("waiting_for_spotify"), null)).toBe(ROUTES.waiting);
    expect(homeRoute(me("needs_spotify_connect"), null)).toBe(ROUTES.connect);
    expect(homeRoute(me("analyzing"), null)).toBe(ROUTES.analyzing);
    expect(homeRoute(me("needs_review"), null)).toBe(ROUTES.taste);
  });

  test("ready students see a live plan before their week", () => {
    expect(homeRoute(me("ready"), null)).toBe(ROUTES.week);
    for (const stage of ["offer", "waiting", "set", "meetup_day"] as const) {
      expect(homeRoute(me("ready"), plan(stage))).toBe(ROUTES.plan);
    }
  });

  test("an ended plan leaves the student on their week", () => {
    expect(homeRoute(me("ready"), plan("after"))).toBe(ROUTES.week);
    expect(homeRoute(me("ready"), plan("called_off"))).toBe(ROUTES.week);
  });
});

describe("isActivePlan", () => {
  test("only live stages take over home", () => {
    expect(isActivePlan(null)).toBe(false);
    expect(isActivePlan(undefined)).toBe(false);
    expect(isActivePlan(plan("offer"))).toBe(true);
    expect(isActivePlan(plan("called_off"))).toBe(false);
  });
});

describe("redirectFor", () => {
  test("visitors reach only public screens", () => {
    expect(redirectFor(ROUTES.welcome, null)).toBeNull();
    expect(redirectFor(ROUTES.school, null)).toBeNull();
    expect(redirectFor(ROUTES.signIn, null)).toBeNull();
    expect(redirectFor(ROUTES.privacy, null)).toBeNull();
    expect(redirectFor(ROUTES.week, null)).toBe(ROUTES.welcome);
    expect(redirectFor(ROUTES.plan, null)).toBe(ROUTES.welcome);
    expect(redirectFor(ROUTES.menu, null)).toBe(ROUTES.welcome);
  });

  test("a deep link past onboarding goes home", () => {
    expect(redirectFor(ROUTES.week, me("needs_about_you"))).toBe(ROUTES.welcome);
    expect(redirectFor(ROUTES.plan, me("analyzing"))).toBe(ROUTES.welcome);
    expect(redirectFor(ROUTES.connect, me("waiting_for_spotify"))).toBe(ROUTES.welcome);
  });

  test("back navigation keeps completed steps reachable", () => {
    expect(redirectFor(ROUTES.aboutYou, me("needs_preferences"))).toBeNull();
    expect(redirectFor(ROUTES.preferences, me("waiting_for_spotify"))).toBeNull();
  });

  test("the menu reaches preferences and taste after onboarding", () => {
    expect(redirectFor(ROUTES.preferences, me("ready"))).toBeNull();
    expect(redirectFor(ROUTES.taste, me("ready"))).toBeNull();
    expect(redirectFor(ROUTES.menu, me("analyzing"))).toBeNull();
  });

  test("contacts and sharing stay reachable after a Spotify disconnect", () => {
    expect(redirectFor(ROUTES.contacts, me("needs_spotify_connect"))).toBeNull();
    expect(redirectFor(ROUTES.stayInTouch, me("analyzing"))).toBeNull();
    expect(redirectFor(ROUTES.contacts, me("waiting_for_spotify"))).toBe(ROUTES.welcome);
  });

  test("About you can't be redone after onboarding", () => {
    expect(redirectFor(ROUTES.aboutYou, me("ready"))).toBe(ROUTES.welcome);
  });

  test("a signed in student without a school is sent to the picker", () => {
    expect(redirectFor(ROUTES.aboutYou, me("needs_about_you", null))).toBe(ROUTES.school);
    expect(redirectFor(ROUTES.school, me("needs_about_you", null))).toBeNull();
  });

  test("waiting moves on live when the account is added", () => {
    expect(redirectFor(ROUTES.waiting, me("waiting_for_spotify"))).toBeNull();
    expect(redirectFor(ROUTES.waiting, me("needs_spotify_connect"))).toBe(ROUTES.welcome);
  });
});
