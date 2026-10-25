import type { MeView, PlanView } from "@/convex/lib/views";

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

// Where a signed-in student belongs right now. Home priority: meetup day > set plan > offer > week.
export function homeRoute(me: NonNullable<MeView>, plan: PlanView | null): Route {
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
      return plan !== null && plan.stage !== "called_off" ? ROUTES.plan : ROUTES.week;
  }
}
