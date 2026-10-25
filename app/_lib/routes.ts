import type { MeView, PlanView } from "@/convex/lib/views";
import type { Onboarding } from "@/convex/lib/validators";
import type { DropView } from "./drops";

// Canonical routes for S01–S17 (CLAUDE.md §5). Chosen once here; screens import from this file.
export const ROUTES = {
  welcome: "/", // S01
  school: "/school", // S02
  signIn: "/sign-in", // S03, returning students: no onboarding steps
  signUp: "/sign-up", // S03, the register flow: step 2 of onboarding
  aboutYou: "/about-you", // S04
  preferences: "/preferences", // S05
  waiting: "/waiting", // S06
  connect: "/connect", // S07
  spotifyCallback: "/spotify/callback", // S07, Spotify's redirect
  analyzing: "/analyzing", // S08
  taste: "/taste", // S09
  week: "/week", // S10, retired: the page only redirects home
  drop: "/drop", // the weekly drop
  reveal: "/reveal", // opening a matched plan, one step at a time (?meetupId=)
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

// The reveal screen for one plan.
export const revealHref = (meetupId: string) => `${ROUTES.reveal}?meetupId=${encodeURIComponent(meetupId)}`;

// Where a signed-in student belongs right now. Home priority for a ready student: meetup day > a
// matched plan not yet revealed (the drop says "reveal") > a live, revealed plan > the drop, which
// shows every drop state including "No drop right now".
export function homeRoute(
  me: Me,
  plan: Pick<PlanView, "stage"> | null,
  drop: { kind: DropView["kind"]; meetupId?: string } | null = null,
): string {
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
      if (plan?.stage === "meetup_day") return ROUTES.plan;
      if (drop?.kind === "reveal" && drop.meetupId) return revealHref(drop.meetupId);
      return isActivePlan(plan) ? ROUTES.plan : ROUTES.drop;
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

export const atLeast = (state: Onboarding, min: Onboarding) => ORDER.indexOf(state) >= ORDER.indexOf(min);

// Which onboarding states may open each screen. Back navigation keeps completed work reachable
// (About you while on Preferences); the menu reaches Preferences and Taste after onboarding.
const SIGNED_IN_SCREENS: Partial<Record<Route, (state: Onboarding) => boolean>> = {
  // Later, Waiting and Connect open it to fix the Spotify email.
  [ROUTES.aboutYou]: (s) => s === "needs_about_you" || s === "needs_preferences" || s === "waiting_for_spotify" || s === "needs_spotify_connect",
  [ROUTES.preferences]: (s) => atLeast(s, "needs_preferences"),
  [ROUTES.waiting]: (s) => s === "waiting_for_spotify",
  [ROUTES.connect]: (s) => s === "needs_spotify_connect",
  [ROUTES.analyzing]: (s) => s === "analyzing",
  [ROUTES.taste]: (s) => s === "needs_review" || s === "ready",
  [ROUTES.week]: () => false, // retired from the core flow; the gate sends it home
  [ROUTES.drop]: (s) => s === "ready",
  [ROUTES.reveal]: (s) => s === "ready",
  [ROUTES.plan]: (s) => s === "ready",
  // Sharing and contacts outlive a Spotify disconnect, which sends onboarding back to Connect.
  [ROUTES.stayInTouch]: (s) => atLeast(s, "needs_spotify_connect"),
  [ROUTES.contacts]: (s) => atLeast(s, "needs_spotify_connect"),
};

const PUBLIC_SCREENS: Route[] = [ROUTES.welcome, ROUTES.school, ROUTES.signIn, ROUTES.signUp, ROUTES.privacy];

// Deep links get the same checks as normal navigation (CLAUDE.md §5). Returns where to send the
// student instead, or null when they may stay. `me` is null when signed out.
export function redirectFor(route: Route, me: MeView): Route | null {
  if (me === null) return PUBLIC_SCREENS.includes(route) ? null : ROUTES.welcome;
  if (route === ROUTES.school || route === ROUTES.privacy || route === ROUTES.menu) return null;
  if (route === ROUTES.welcome || route === ROUTES.signIn || route === ROUTES.signUp) return null; // they route home themselves
  if (me.school === null) return ROUTES.school;
  const allowed = SIGNED_IN_SCREENS[route];
  if (allowed === undefined || allowed(me.onboarding)) return null;
  return ROUTES.welcome; // home picks the right screen
}

// Onboarding progress (the header's progress bar). Six steps, the whole register flow; signing in
// is not onboarding and shows none. Signed in, the step comes from the server's onboarding state,
// never from how the browser got here, so a reload or a returning student lands on the real step.
export const ONBOARDING_STEPS = 6;

export function onboardingStep(route: Route, me: MeView): number | null {
  if (me === null) {
    // Signed out, only the register pages count: School, then /sign-up (email and code).
    if (route === ROUTES.school) return 1;
    if (route === ROUTES.signUp) return 2;
    return null;
  }
  // School is step 1 while onboarding, also when Back returns to it; afterwards it's a setting.
  if (route === ROUTES.school) return me.school === null || me.onboarding !== "ready" ? 1 : null;
  const s = me.onboarding;
  if (route === ROUTES.aboutYou) return s === "needs_about_you" || s === "needs_preferences" ? 3 : null;
  if (route === ROUTES.preferences) return s === "needs_preferences" ? 4 : null;
  if (route === ROUTES.waiting || route === ROUTES.connect || route === ROUTES.analyzing) {
    return s === "waiting_for_spotify" || s === "needs_spotify_connect" || s === "analyzing" ? 5 : null;
  }
  if (route === ROUTES.taste) return s === "needs_review" ? 6 : null;
  return null;
}
