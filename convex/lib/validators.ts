import { v, type Infer } from "convex/values";

// Shared string-literal vocabularies (CLAUDE.md §8.5–§8.6). Schema and function contracts both use these.

export const vOnboarding = v.union(
  v.literal("needs_verification"),
  v.literal("needs_about_you"),
  v.literal("needs_preferences"),
  v.literal("waiting_for_spotify"),
  v.literal("needs_spotify_connect"),
  v.literal("analyzing"),
  v.literal("needs_review"),
  v.literal("ready"),
);
export type Onboarding = Infer<typeof vOnboarding>;

export const vGender = v.union(v.literal("woman"), v.literal("man"), v.literal("non_binary"));
export type Gender = Infer<typeof vGender>;

export const vGenderSelf = v.union(
  v.literal("woman"),
  v.literal("man"),
  v.literal("non_binary"),
  v.literal("prefer_not_to_say"),
);

export const vYear = v.union(
  v.literal("first"),
  v.literal("second"),
  v.literal("third"),
  v.literal("fourth_plus"),
  v.literal("grad"),
);

export const vArea = v.union(v.literal("campus"), v.literal("berkeley_oakland"), v.literal("bart"));
export type Area = Infer<typeof vArea>;

export const vMeetWho = v.union(v.literal("anyone"), v.array(vGender));

export const vPreferencesSource = v.union(v.literal("surprise_me"), v.literal("custom"));

export const vSchoolStatus = v.union(v.literal("open"), v.literal("soon"));

export const vAccessStatus = v.union(
  v.literal("requested"),
  v.literal("allowlisted"),
  v.literal("connected"),
  v.literal("revoked"),
);

export const vSnapshotSource = v.union(v.literal("spotify"), v.literal("demo_fixture"));

export const vAnalysisStatus = v.union(
  v.literal("queued"),
  v.literal("fetching"),
  v.literal("summarizing"),
  v.literal("embedding"),
  v.literal("done"),
  v.literal("failed"),
);

export const vSpotChosenBy = v.union(v.literal("agent"), v.literal("team"));

export const vEventKind = v.union(
  v.literal("concert"),
  v.literal("game"),
  v.literal("performance"),
  v.literal("other"),
);

export const vEventStatus = v.union(v.literal("scraped"), v.literal("published"), v.literal("rejected"));

export const vImportStatus = v.union(
  v.literal("received"),
  v.literal("importing"),
  v.literal("done"),
  v.literal("failed"),
);

export const vAnswer = v.union(v.literal("pending"), v.literal("yes"), v.literal("no"));

export const vAskClosedReason = v.union(
  v.literal("seated"),
  v.literal("dropped"),
  v.literal("cutoff"),
  v.literal("event_pulled"),
);

export const vPlanStatus = v.union(
  v.literal("forming"),
  v.literal("set"),
  v.literal("done"),
  v.literal("called_off"),
);

export const vSeat = v.union(v.literal("offered"), v.literal("in"), v.literal("out"));

export const vOutReason = v.union(
  v.literal("next_time"),
  v.literal("no_answer"),
  v.literal("cant_make_it"),
  v.literal("no_ticket"),
);

export const vTicket = v.union(v.literal("none"), v.literal("got"));

export const vShareKind = v.union(v.literal("phone"), v.literal("instagram"));

export const vMatchTrigger = v.union(
  v.literal("yes"),
  v.literal("seat_open"),
  v.literal("demo_wait"),
  v.literal("sweep"),
  v.literal("admin"),
);

// Drops (DECISIONS.md, Oct 25).
export const vDropStatus = v.union(v.literal("choosing"), v.literal("confirming"), v.literal("matched"));
export type DropStatus = Infer<typeof vDropStatus>;

export const vDropEntryState = v.union(
  v.literal("choosing"),
  v.literal("deciding"),
  v.literal("accepted"),
  v.literal("passed"),
  v.literal("declined"),
  v.literal("turned_away"),
  v.literal("matched"),
  v.literal("unmatched"),
);
export type DropEntryState = Infer<typeof vDropEntryState>;
