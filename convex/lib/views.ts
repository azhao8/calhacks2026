import { v, type Infer } from "convex/values";
import {
  vAnalysisStatus,
  vAnswer,
  vArea,
  vGenderSelf,
  vMeetWho,
  vOnboarding,
  vPreferencesSource,
  vSchoolStatus,
  vShareKind,
  vTicket,
  vYear,
} from "./validators";

// The UI contract: what each public query returns (CLAUDE.md §8.7). Withholding happens here, by shape:
// a field a student may not see yet is null, never present with a hidden value.

export const vSchoolView = v.object({
  _id: v.id("universities"),
  name: v.string(),
  city: v.string(),
  colors: v.array(v.string()),
  status: vSchoolStatus,
  themeId: v.string(),
});

export const vMeView = v.union(
  v.null(),
  v.object({
    userId: v.id("users"),
    email: v.union(v.string(), v.null()),
    firstName: v.union(v.string(), v.null()),
    onboarding: vOnboarding,
    school: v.union(v.null(), v.object({ name: v.string(), themeId: v.string() })),
    isAdmin: v.boolean(),
  }),
);
export type MeView = Infer<typeof vMeView>;

export const vAccessView = v.object({
  status: v.union(
    v.literal("none"),
    v.literal("no_capacity"),
    v.literal("requested"),
    v.literal("allowlisted"),
    v.literal("connected"),
    v.literal("revoked"),
  ),
  refused: v.boolean(),
  // The student's own Spotify account email, so S06 can say which account to sign in with.
  spotifyEmail: v.union(v.string(), v.null()),
});

// S05 opened again from the menu starts from the saved answers. The student's own record only.
export const vPreferencesView = v.union(
  v.null(),
  v.object({
    maxTicketPrice: v.union(v.number(), v.null()),
    meetWho: vMeetWho,
    gender: v.union(vGenderSelf, v.null()),
    year: v.union(vYear, v.null()),
    prefersSimilarYear: v.boolean(),
    area: vArea,
    source: vPreferencesSource,
  }),
);

export const vAnalysisView = v.union(
  v.null(),
  v.object({
    status: vAnalysisStatus,
    error: v.union(v.string(), v.null()),
    // Why a failed job failed: too little listening data gets its own copy and no retry button (S08).
    failure: v.union(v.null(), v.literal("too_little_data"), v.literal("other")),
  }),
);

export const vTasteView = v.union(
  v.null(),
  v.object({
    summary: v.string(),
    artists: v.array(v.string()),
    labels: v.array(v.string()),
    revision: v.number(),
    confirmed: v.boolean(),
  }),
);

// S10: only day and date, start time, price range, and distance. No event details.
export const vWeekCard = v.object({
  askId: v.id("asks"),
  dayLabel: v.string(),
  timeLabel: v.string(),
  priceLabel: v.string(),
  distanceLabel: v.string(),
  answer: vAnswer,
  locked: v.boolean(),
});
export type WeekCard = Infer<typeof vWeekCard>;

// S11–S14: one view of the student's current plan.
export const vPlanView = v.object({
  meetupId: v.id("meetups"),
  seatId: v.id("meetupMembers"),
  stage: v.union(
    v.literal("offer"), // my seat is offered
    v.literal("waiting"), // I'm in; the other seat is offered or open
    v.literal("set"), // both in
    v.literal("meetup_day"), // from midnight Pacific on the event date
    v.literal("after"), // completed; stay in touch offered once
    v.literal("called_off"),
  ),
  event: v.object({
    title: v.string(),
    venueName: v.string(),
    dayLabel: v.string(),
    timeLabel: v.string(),
    priceLabel: v.string(),
  }),
  // Null while the other seat is open: no pair to describe while the app is only searching.
  hook: v.union(v.string(), v.null()),
  me: v.object({
    seat: v.union(v.literal("offered"), v.literal("in")),
    ticket: vTicket,
    offerExpiresAt: v.union(v.number(), v.null()),
    left: v.boolean(),
  }),
  // Null while the other seat is open and the matcher is refilling it.
  partner: v.union(
    v.null(),
    v.object({
      firstName: v.string(),
      seat: v.union(v.literal("offered"), v.literal("in")),
      ticket: vTicket,
      left: v.boolean(),
    }),
  ),
  notice: v.union(
    v.null(),
    v.literal("partner_dropped"),
    v.literal("partner_replaced"),
    v.literal("partner_left"),
    v.literal("nobody_by_cutoff"),
    v.literal("event_pulled"), // the team took the event off Melos; the plan is called off
  ),
  // The first name of the partner who gave up the seat, for "{Name} can't make it." Set with
  // partner_dropped and partner_replaced; this student already saw the name in the offer.
  previousPartnerFirstName: v.union(v.string(), v.null()),
  // Only once both seats are in.
  meeting: v.union(
    v.null(),
    v.object({
      spotName: v.string(),
      howToFind: v.string(),
      directionsUrl: v.string(),
      meetTimeLabel: v.string(),
    }),
  ),
  ticketUrl: v.union(v.string(), v.null()),
  // Only from meetup day.
  marker: v.union(v.number(), v.null()),
  icebreaker: v.union(v.string(), v.null()),
  // True until the cutoff (§6.5): a seat given up now reopens and is refilled. After it, nobody new is
  // added, so "I can't make it" and "I couldn't get one" must not promise a replacement.
  beforeCutoff: v.boolean(),
  canCantMakeIt: v.boolean(),
  canLeave: v.boolean(),
  canShare: v.boolean(),
});
export type PlanView = Infer<typeof vPlanView>;

export const vMySharesView = v.object({
  phone: v.union(v.string(), v.null()),
  instagram: v.union(v.string(), v.null()),
});

export const vContactView = v.object({
  meetupId: v.id("meetups"),
  firstName: v.string(),
  eventTitle: v.string(),
  dayLabel: v.string(),
  shares: v.array(v.object({ kind: vShareKind, value: v.string() })),
});
