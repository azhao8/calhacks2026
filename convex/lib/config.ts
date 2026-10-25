// One shared configuration (CLAUDE.md §6.6). Change values here, never inline in code.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const TIMING = {
  availabilityHorizonMs: 7 * DAY,
  agentLookaheadMs: 14 * DAY,
  asksPerWindow: 3,
  asksWindowMs: 7 * DAY,
  matcherWakeDelayMs: 15 * SECOND,
  matcherSweepMinutes: 30,
  demoFillWaitMs: 1 * MINUTE,
  offerWindowMs: 2 * HOUR,
  nextTimeCooldownMs: 0,
  demoReplyDelayMs: { min: 5 * SECOND, max: 20 * SECOND },
  demoTicketDelayMs: 1 * MINUTE,
  meetOffsetMinutes: 30,
  cutoffBeforeMeetMs: 2 * HOUR,
  completionAfterStartMs: 4 * HOUR,
  repeatPairBlockMs: 7 * DAY,
} as const;

export const SIGN_IN = {
  codeLength: 6,
  codeTtlSeconds: 15 * 60,
  resendCooldownMs: 30 * SECOND,
  maxFailedAttemptsPerHour: 10,
} as const;

export const SPOTIFY = {
  appCapacity: 5,
  scopes: ["user-top-read", "user-library-read"],
  topLimit: 50,
  likedSongsLimit: 200,
  timeRanges: ["short_term", "medium_term"],
  callbackPath: "/spotify/callback",
  // Each app's client secret lives in the env var SPOTIFY_CLIENT_SECRET_<LABEL> (uppercase, dashes as underscores).
  secretEnvName: (label: string) => `SPOTIFY_CLIENT_SECRET_${label.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
} as const;

export const ANALYSIS = {
  minDistinctArtists: 5,
  summaryMaxChars: 240,
  labelsMin: 3,
  labelsMax: 6,
  displayArtistsMax: 5,
  documentArtistsMax: 10,
} as const;

export const EMBEDDING = {
  model: "voyage-4",
  dimensions: 1024,
} as const;

// Model IDs and effort per job live here (§7).
export const MODELS = {
  default: "claude-opus-5-5",
  faster: "claude-sonnet-5-5",
  effort: {
    scout: "high",
    taste: "medium",
    picks: "low",
    hook: "low",
  },
} as const;

export const MATCHING = {
  weights: {
    similarity: 1.0,
    sharedItems: 0.6,
    similarYear: 0.1,
    waitingPerRun: 0.02,
  },
  minSharedItems: 1,
  markerMin: 10,
  markerMax: 99,
  hookMaxChars: 120,
  icebreakerMaxChars: 140,
  askCandidates: 50,
  askShortlist: 10,
} as const;

export const PLACES = {
  timezone: "America/Los_Angeles",
  // Distance "from campus" is measured from Sather Gate.
  campus: { name: "Sather Gate", lat: 37.8703, lng: -122.2595 },
} as const;

export const SURPRISE_ME = {
  maxTicketPrice: 25,
  meetWho: "anyone",
  area: "berkeley_oakland",
  prefersSimilarYear: false,
} as const;

// S05 budget choices; null means any price.
export const BUDGET_CHOICES = [0, 15, 25, 50, null] as const;

export const EMAIL = {
  from: "Melos <hello@melos.azhao.dev>",
} as const;

export const SITE = {
  prodUrl: "https://melos.azhao.dev",
  devUrl: "http://127.0.0.1:3000",
} as const;
