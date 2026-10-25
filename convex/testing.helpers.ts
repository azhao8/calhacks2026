/// <reference types="vite/client" />
// Test-only helpers for stream C's convex-test suites. The extra dot in the file name keeps Convex
// from bundling it.
import { convexTest, type TestConvex } from "convex-test";
import { vi } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { normalizeName } from "./matching/taste";

export const modules = import.meta.glob("./**/*.ts");

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// Saturday, Oct 24, 2026, 10:00 am Pacific.
export const T0 = Date.UTC(2026, 9, 24, 17, 0);

export type T = TestConvex<typeof schema>;

export async function setup(): Promise<T> {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  const t = convexTest(schema, modules);
  // Loaded by name so the app's tsc doesn't type-check workpool's TypeScript sources (they need ES2020).
  const workpoolTest = "@convex-dev/workpool/test";
  const workpool = (await import(/* @vite-ignore */ workpoolTest)) as {
    default: { register: (t: T, name: string) => unknown };
  };
  workpool.default.register(t, "aiPool");
  await t.mutation(internal.seed.run, {});
  return t;
}

// Moves the clock forward and runs every scheduled function that comes due on the way.
export async function advance(t: T, ms: number): Promise<void> {
  const step = Math.max(1000, Math.ceil(ms / 20));
  let left = ms;
  while (left > 0) {
    const chunk = Math.min(step, left);
    vi.advanceTimersByTime(chunk);
    left -= chunk;
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 200);
  }
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 200);
}

export function asUser(t: T, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

type StudentInput = {
  firstName: string;
  artists?: string[];
  tracks?: string[];
  labels?: string[];
  gender?: Doc<"users">["gender"];
  year?: Doc<"users">["year"];
  meetWho?: Doc<"preferences">["meetWho"];
  maxTicketPrice?: number | null;
  area?: Doc<"preferences">["area"];
  isDemo?: boolean;
  demoKey?: string;
  email?: string;
  embedding?: number[];
};

export async function makeStudent(t: T, input: StudentInput): Promise<Id<"users">> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: input.email ?? `${input.firstName.toLowerCase()}@berkeley.edu`,
      firstName: input.firstName,
      gender: input.gender,
      year: input.year,
      onboarding: "ready",
      verifiedAt: Date.now(),
      isDemo: input.isDemo,
      demoKey: input.demoKey,
    });
    await ctx.db.insert("preferences", {
      userId,
      maxTicketPrice: input.maxTicketPrice === undefined ? 25 : input.maxTicketPrice,
      meetWho: input.meetWho ?? "anyone",
      area: input.area ?? "berkeley_oakland",
      prefersSimilarYear: false,
      source: "custom",
    });
    const artists = input.artists ?? ["Big Thief"];
    await ctx.db.insert("tasteProfiles", {
      userId,
      summary: "Test taste.",
      labels: input.labels ?? [],
      artists: artists.slice(0, 5),
      revision: 0,
      confirmedAt: Date.now(),
      embedding: input.embedding,
      fingerprint: {
        topArtists: artists.map(normalizeName),
        likedArtists: [],
        tracks: (input.tracks ?? []).map(normalizeName),
        labels: input.labels ?? [],
      },
    });
    return userId;
  });
}

type EventInput = {
  title?: string;
  startsAt?: number;
  priceMin?: number | null;
  priceMax?: number | null;
  area?: Doc<"venues">["area"];
  ageLimit?: number | null;
  performers?: string[];
  featured?: boolean;
  embedding?: number[];
  status?: Doc<"events">["status"];
};

export async function makeEvent(t: T, input: EventInput = {}): Promise<Id<"events">> {
  return await t.run(async (ctx) => {
    const spot = (await ctx.db
      .query("meetingSpots")
      .withIndex("by_name", (q) => q.eq("name", "Sather Gate"))
      .unique())!;
    const venueId = await ctx.db.insert("venues", {
      osmId: `node/${Math.random()}`,
      name: "The UC Theatre",
      aliases: [],
      address: "2036 University Ave, Berkeley",
      lat: 37.8716,
      lng: -122.2697,
      area: input.area ?? "berkeley_oakland",
      distanceFromCampusMeters: 965,
      meetingSpotId: spot._id,
      meetOffsetMinutes: 30,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return await ctx.db.insert("events", {
      title: input.title ?? "Indie folk night",
      kind: "concert",
      venueId,
      // Default: Thursday, Oct 29, 8:00 pm Pacific.
      startsAt: input.startsAt ?? Date.UTC(2026, 9, 30, 3, 0),
      priceMin: input.priceMin === undefined ? 18 : input.priceMin,
      priceMax: input.priceMax === undefined ? 25 : input.priceMax,
      priceSource: "listing",
      ticketUrl: "https://example.com/tickets",
      sourceName: "test",
      sourceUrl: "https://example.com",
      performers: input.performers ?? ["Big Thief"],
      tags: [],
      ageLimit: input.ageLimit ?? null,
      meetingSpotId: spot._id,
      meetOffsetMinutes: 30,
      status: input.status ?? "published",
      featured: input.featured ?? false,
      dedupeKey: `${Math.random()}`,
      scrapedAt: Date.now(),
      lastSeenAt: Date.now(),
      embedding: input.embedding,
    });
  });
}

export async function makeAsk(
  t: T,
  userId: Id<"users">,
  eventId: Id<"events">,
  answer: Doc<"asks">["answer"] = "yes",
): Promise<Id<"asks">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("asks", {
      userId,
      eventId,
      createdAt: Date.now(),
      answer,
      answeredAt: answer === "pending" ? undefined : Date.now(),
    }),
  );
}

export async function seatsFor(t: T, meetupId: Id<"meetups">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("meetupMembers")
      .withIndex("by_meetup", (q) => q.eq("meetupId", meetupId))
      .collect(),
  );
}

export async function plansFor(t: T, eventId: Id<"events">) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("meetups").collect()).filter((plan) => plan.eventId === eventId),
  );
}

