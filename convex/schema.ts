import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  vAccessStatus,
  vAnalysisStatus,
  vAnswer,
  vArea,
  vAskClosedReason,
  vEventKind,
  vEventStatus,
  vGenderSelf,
  vImportStatus,
  vMatchTrigger,
  vMeetWho,
  vOnboarding,
  vOutReason,
  vPlanStatus,
  vPreferencesSource,
  vSchoolStatus,
  vSeat,
  vShareKind,
  vSnapshotSource,
  vSpotChosenBy,
  vTicket,
  vYear,
} from "./lib/validators";
import { EMBEDDING } from "./lib/config";

// Every table in CLAUDE.md §8.5. Owners: azhao8 (single writer). Streams ask for changes rather than editing.
export default defineSchema({
  ...authTables,

  universities: defineTable({
    name: v.string(),
    emailDomains: v.array(v.string()),
    timezone: v.string(),
    city: v.string(),
    colors: v.array(v.string()),
    status: vSchoolStatus,
    themeId: v.string(),
  }).index("by_themeId", ["themeId"]),

  // Convex Auth's default user fields stay optional so its sign-in flow can write them.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    emailDomain: v.optional(v.string()),
    universityId: v.optional(v.id("universities")),
    verifiedAt: v.optional(v.number()),
    firstName: v.optional(v.string()),
    gender: v.optional(vGenderSelf),
    year: v.optional(vYear),
    onboarding: v.optional(vOnboarding),
    isDemo: v.optional(v.boolean()),
    demoKey: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_demoKey", ["demoKey"]),

  preferences: defineTable({
    userId: v.id("users"),
    maxTicketPrice: v.union(v.number(), v.null()),
    meetWho: vMeetWho,
    area: vArea,
    prefersSimilarYear: v.boolean(),
    source: vPreferencesSource,
  }).index("by_userId", ["userId"]),

  spotifyApps: defineTable({
    label: v.string(),
    ownerName: v.string(),
    clientId: v.string(),
    capacity: v.number(),
    active: v.boolean(),
  }).index("by_label", ["label"]),

  spotifyAccess: defineTable({
    userId: v.id("users"),
    spotifyEmail: v.string(),
    spotifyAppId: v.optional(v.id("spotifyApps")),
    status: vAccessStatus,
    requestedAt: v.number(),
    allowlistedAt: v.optional(v.number()),
    allowlistedBy: v.optional(v.string()),
    notifiedAt: v.optional(v.number()),
    refusedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_app", ["spotifyAppId"])
    .index("by_status", ["status"]),

  // Server-only: never returned by any query.
  spotifyTokens: defineTable({
    userId: v.id("users"),
    appId: v.id("spotifyApps"),
    spotifyUserId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    scopes: v.array(v.string()),
  }).index("by_userId", ["userId"]),

  // Server-only.
  tasteSnapshots: defineTable({
    userId: v.id("users"),
    source: vSnapshotSource,
    topArtists: v.array(
      v.object({
        spotifyId: v.string(),
        name: v.string(),
        normalizedName: v.string(),
        genres: v.array(v.string()),
        rank: v.number(),
        range: v.union(v.literal("short_term"), v.literal("medium_term")),
      }),
    ),
    topTracks: v.array(
      v.object({
        spotifyId: v.string(),
        name: v.string(),
        normalizedKey: v.string(),
        artistNames: v.array(v.string()),
        rank: v.number(),
        range: v.union(v.literal("short_term"), v.literal("medium_term")),
      }),
    ),
    likedSongs: v.array(
      v.object({
        spotifyId: v.string(),
        name: v.string(),
        artistIds: v.array(v.string()),
        artistNames: v.array(v.string()),
      }),
    ),
    fetchedAt: v.number(),
  }).index("by_userId", ["userId"]),

  analysisJobs: defineTable({
    userId: v.id("users"),
    status: vAnalysisStatus,
    error: v.optional(v.string()),
    attempts: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  tasteProfiles: defineTable({
    userId: v.id("users"),
    summary: v.string(),
    labels: v.array(v.string()),
    artists: v.array(v.string()),
    correction: v.optional(v.string()),
    revision: v.number(),
    confirmedAt: v.optional(v.number()),
    embedding: v.optional(v.array(v.float64())),
    // Server-only: normalized sets used for exact shared items and hook validation.
    fingerprint: v.object({
      topArtists: v.array(v.string()),
      likedArtists: v.array(v.string()),
      tracks: v.array(v.string()),
      labels: v.array(v.string()),
    }),
  })
    .index("by_userId", ["userId"])
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: EMBEDDING.dimensions }),

  venues: defineTable({
    osmId: v.string(),
    name: v.string(),
    aliases: v.array(v.string()),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    area: vArea,
    distanceFromCampusMeters: v.number(),
    meetingSpotId: v.optional(v.id("meetingSpots")),
    meetOffsetMinutes: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_osmId", ["osmId"]),

  meetingSpots: defineTable({
    name: v.string(),
    howToFind: v.string(),
    lat: v.number(),
    lng: v.number(),
    osmId: v.optional(v.string()),
    directionsUrl: v.string(),
    area: vArea,
    chosenBy: vSpotChosenBy,
    verifiedAt: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_osmId", ["osmId"]),

  events: defineTable({
    title: v.string(),
    kind: vEventKind,
    venueId: v.optional(v.id("venues")),
    startsAt: v.number(),
    priceMin: v.union(v.number(), v.null()),
    priceMax: v.union(v.number(), v.null()),
    priceSource: v.union(v.string(), v.null()),
    ticketUrl: v.optional(v.string()),
    freeEntryNote: v.optional(v.string()),
    sourceName: v.string(),
    sourceUrl: v.string(),
    performers: v.array(v.string()),
    tags: v.array(v.string()),
    ageLimit: v.union(v.number(), v.null()),
    meetingSpotId: v.optional(v.id("meetingSpots")),
    meetOffsetMinutes: v.number(),
    status: vEventStatus,
    rejectReason: v.optional(v.string()),
    featured: v.boolean(),
    dedupeKey: v.string(),
    apifyRunId: v.optional(v.string()),
    scrapedAt: v.number(),
    lastSeenAt: v.number(),
    missingSince: v.optional(v.number()),
    embedding: v.optional(v.array(v.float64())),
    matcherWakeAt: v.optional(v.number()),
    // Fields the team edited on the admin page; later imports leave them alone (§6.1 team control).
    teamFields: v.optional(v.array(v.string())),
    // Consecutive runs that covered this event's source without seeing it; flagged at 2, reset on sight (§6.1).
    missedRuns: v.optional(v.number()),
  })
    .index("by_status_startsAt", ["status", "startsAt"])
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_venue", ["venueId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: EMBEDDING.dimensions,
      filterFields: ["status"],
    }),

  eventImports: defineTable({
    apifyRunId: v.string(),
    receivedAt: v.number(),
    status: vImportStatus,
    counts: v.object({
      received: v.number(),
      published: v.number(),
      updated: v.number(),
      rejected: v.number(),
      duplicates: v.number(),
    }),
    errors: v.array(v.string()),
    finishedAt: v.optional(v.number()),
  }).index("by_runId", ["apifyRunId"]),

  asks: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
    createdAt: v.number(),
    answer: vAnswer,
    answeredAt: v.optional(v.number()),
    closedReason: v.optional(vAskClosedReason),
    pickReason: v.optional(v.string()), // server-only
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_event", ["userId", "eventId"])
    .index("by_event_answer", ["eventId", "answer"]),

  // A plan: one pair's commitment to one event (§6.5).
  meetups: defineTable({
    eventId: v.id("events"),
    status: vPlanStatus,
    marker: v.number(),
    meetingSpotId: v.optional(v.id("meetingSpots")),
    meetAt: v.number(),
    cutoffAt: v.number(),
    hook: v.string(),
    icebreaker: v.string(),
    hookFromClaude: v.boolean(),
    isDemoPlan: v.boolean(),
    // Set by the reconcile step, so time-based changes reach live queries.
    dayRevealedAt: v.optional(v.number()),
    meetingStartedAt: v.optional(v.number()),
    // Set by reconcile at the cutoff, so live views stop promising a refill (queries don't rerun as time passes).
    cutoffPassedAt: v.optional(v.number()),
    createdAt: v.number(),
    endReason: v.optional(v.string()),
  })
    .index("by_event_status", ["eventId", "status"])
    .index("by_status", ["status"]),

  // A seat in a plan.
  meetupMembers: defineTable({
    meetupId: v.id("meetups"),
    userId: v.id("users"),
    seat: vSeat,
    offeredAt: v.number(),
    offerExpiresAt: v.number(),
    respondedAt: v.optional(v.number()),
    outReason: v.optional(vOutReason),
    outAt: v.optional(v.number()),
    ticket: vTicket,
    leftAt: v.optional(v.number()),
  })
    .index("by_meetup", ["meetupId"])
    .index("by_user_seat", ["userId", "seat"]),

  contactShares: defineTable({
    meetupId: v.id("meetups"),
    userId: v.id("users"),
    kind: vShareKind,
    value: v.string(), // private
    sharedAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_meetup", ["meetupId"])
    .index("by_user_meetup", ["userId", "meetupId"]),

  matchRuns: defineTable({
    eventId: v.id("events"),
    trigger: vMatchTrigger,
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    seatsRefilled: v.number(),
    pairsCreated: v.number(),
    demoFills: v.number(),
    decisions: v.array(
      v.object({
        a: v.id("users"),
        b: v.id("users"),
        score: v.number(),
        similarity: v.number(),
        shared: v.array(v.object({ kind: v.string(), name: v.string(), weight: v.number() })),
        reason: v.string(),
      }),
    ),
    errors: v.array(v.string()),
  }).index("by_event", ["eventId", "startedAt"]),

  helpNotes: defineTable({
    userId: v.id("users"),
    meetupId: v.optional(v.id("meetups")),
    text: v.string(),
    createdAt: v.number(),
    handledAt: v.optional(v.number()),
  }),

  demoSettings: defineTable({
    clockOffsetMs: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }),
});
