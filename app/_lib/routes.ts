import type { MeView, PlanView } from "@/convex/lib/views";
import type { Onboarding } from "@/convex/lib/validators";

// Canonical routes for S01–S17 (CLAUDE.md §5). Chosen once here; screens import from this file.
export const ROUTES = {
  welcome: "/", // S01
  school: "/school", // S02
  signIn: "/sign-in", // S03
  aboutYou: "/about-you", // S04
  preferences: "/preferences", // S05
  waiting: "/waiting", // S06
  connect: "/connect", // S07
  spotifyCallback: "/spotify/callback", // S07, Spotify's redirect
  analyzing: "/analyzing", // S08
  taste: "/taste", // S09
  week: "/week", // S10
  plan: "/plan", // S11 offer, S12 plan set, S13 meetup day
  stayInTouch: "/stay-in-touch", // S14
  contacts: "/contacts", // S15
  menu: "/menu", // S16
  privacy: "/privacy",
  admin: "/admin", // S17
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

type Me = NonNullable<MeView>;
type PlanStage = PlanView["stage"];

// A plan that should take over home. A completed plan ("after") and a called off one show as a
// notice on the week instead, so a student is never stuck on an old plan.
export function isActivePlan(plan: Pick<PlanView, "stage"> | null | undefined): boolean {
  const live: PlanStage[] = ["offer", "waiting", "set", "meetup_day"];
  return plan != null && live.includes(plan.stage);
}

// Where a signed-in student belongs right now. Home priority: meetup day > set plan > offer > week.
export function homeRoute(me: Me, plan: Pick<PlanView, "stage"> | null): Route {
  if (me.school === null) return ROUTES.school;
  switch (me.onboarding) {
    case "needs_verification":
      return ROUTES.signIn;
    case "needs_about_you":
      return ROUTES.aboutYou;
    case "needs_preferences":
      return ROUTES.preferences;
    case "waiting_for_spotify":
      return ROUTES.waiting;
    case "needs_spotify_connect":
      return ROUTES.connect;
    case "analyzing":
      return ROUTES.analyzing;
    case "needs_review":
      return ROUTES.taste;
    case "ready":
      return isActivePlan(plan) ? ROUTES.plan : ROUTES.week;
  }
}

const ORDER: Onboarding[] = [
  "needs_verification",
  "needs_about_you",
  "needs_preferences",
  "waiting_for_spotify",
  "needs_spotify_connect",
  "analyzing",
  "needs_review",
  "ready",
];

const atLeast = (state: Onboarding, min: Onboarding) => ORDER.indexOf(state) >= ORDER.indexOf(min);

// Which onboarding states may open each screen. Back navigation keeps completed work reachable
// (About you while on Preferences); the menu reaches Preferences and Taste after onboarding.
const SIGNED_IN_SCREENS: Partial<Record<Route, (state: Onboarding) => boolean>> = {
  [ROUTES.aboutYou]: (s) => s === "needs_about_you" || s === "needs_preferences",
  [ROUTES.preferences]: (s) => atLeast(s, "needs_preferences"),
  [ROUTES.waiting]: (s) => s === "waiting_for_spotify",
  [ROUTES.connect]: (s) => s === "needs_spotify_connect",
  [ROUTES.analyzing]: (s) => s === "analyzing",
  [ROUTES.taste]: (s) => s === "needs_review" || s === "ready",
  [ROUTES.week]: (s) => s === "ready",
  [ROUTES.plan]: (s) => s === "ready",
  [ROUTES.stayInTouch]: (s) => s === "ready",
  [ROUTES.contacts]: (s) => s === "ready",
};

const PUBLIC_SCREENS: Route[] = [ROUTES.welcome, ROUTES.school, ROUTES.signIn, ROUTES.privacy];

// Deep links get the same checks as normal navigation (CLAUDE.md §5). Returns where to send the
// student instead, or null when they may stay. `me` is null when signed out.
export function redirectFor(route: Route, me: MeView): Route | null {
  if (me === null) return PUBLIC_SCREENS.includes(route) ? null : ROUTES.welcome;
  if (route === ROUTES.school || route === ROUTES.privacy || route === ROUTES.menu) return null;
  if (route === ROUTES.welcome || route === ROUTES.signIn) return null; // they route home themselves
  if (me.school === null) return ROUTES.school;
  const allowed = SIGNED_IN_SCREENS[route];
  if (allowed === undefined || allowed(me.onboarding)) return null;
  return ROUTES.welcome; // home picks the right screen
}

// Onboarding progress shown at the top right before the menu appears (design/docs/backgrounds.md).
export const ONBOARDING_STEP: Partial<Record<Route, string>> = {
  [ROUTES.signIn]: "Step 1 of 4",
  [ROUTES.aboutYou]: "Step 2 of 4",
  [ROUTES.connect]: "Step 3 of 4",
  [ROUTES.taste]: "Step 4 of 4",
};
