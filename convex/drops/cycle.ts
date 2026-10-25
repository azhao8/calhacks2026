import { internalAction, internalMutation, type DatabaseReader, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { v, type Infer } from "convex/values";
import { isTeamEmail } from "../lib/access";
import { DROP, dropsEnabled } from "../lib/config";
import { fail } from "../lib/errors";
import { emailPool } from "../lib/pools";
import { sendEmail } from "../services/resend";
import { heldSeats } from "../plans/model";
import { matchDrop } from "./match";
import { pickChoices, type PickEvent } from "./pick";
import type { vAdminDropStatus } from "./views";

// The drop cycle (DECISIONS.md, Oct 25): start → choosing (2 hours) → confirming (24 hours) → matched.
// Every transition is an idempotent internal mutation. The scheduler runs them at choosingEndsAt and
// matchAt; the admin buttons run the same ones early, and the later scheduled run then does nothing.

export type Drop = Doc<"drops">;
export type Entry = Doc<"dropEntries">;

export async function openDrop(db: DatabaseReader): Promise<Drop | null> {
  for (const status of ["choosing", "confirming"] as const) {
    const drop = await db
      .query("drops")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order("desc")
      .first();
    if (drop !== null) return drop;
  }
  return null;
}

export async function latestDrop(db: DatabaseReader): Promise<Drop | null> {
  return await db.query("drops").order("desc").first();
}

export async function entryFor(db: DatabaseReader, dropId: Id<"drops">, userId: Id<"users">): Promise<Entry | null> {
  return await db
    .query("dropEntries")
    .withIndex("by_drop_user", (q) => q.eq("dropId", dropId).eq("userId", userId))
    .first();
}

export async function entriesIn(db: DatabaseReader, dropId: Id<"drops">, state: Entry["state"]): Promise<Entry[]> {
  return await db
    .query("dropEntries")
    .withIndex("by_drop_state", (q) => q.eq("dropId", dropId).eq("state", state))
    .collect();
}

// Onboarding ready and holding no active plan. Demo students hold one seat per event, so they always
// take part.
async function isEligible(db: DatabaseReader, user: Doc<"users">): Promise<boolean> {
  if (user.onboarding !== "ready") return false;
  if (user.isDemo) return true;
  return (await heldSeats(db, user._id)).length === 0;
}

// Published events near the drop window, with their venue's area.
async function pickableEvents(db: DatabaseReader, matchAt: number): Promise<PickEvent[]> {
  const events = await db
    .query("events")
    .withIndex("by_status_startsAt", (q) =>
      q
        .eq("status", "published")
        .gte("startsAt", matchAt + DROP.minLeadMs)
        .lte("startsAt", matchAt + DROP.horizonMs),
    )
    .collect();
  const areas = new Map<Id<"venues">, Doc<"venues">["area"] | null>();
  const result: PickEvent[] = [];
  for (const event of events) {
    let area: Doc<"venues">["area"] | null = null;
    if (event.venueId !== undefined) {
      if (!areas.has(event.venueId)) areas.set(event.venueId, (await db.get(event.venueId))?.area ?? null);
      area = areas.get(event.venueId)!;
    }
    result.push({ ...event, area });
  }
  return result;
}

function randomDelay(): number {
  const { min, max } = DROP.demoStepDelayMs;
  return min + Math.floor(Math.random() * (max - min + 1));
}

// One student's entry, with their own choices. Returns null when no event fits them (they see no drop).
export async function createEntry(
  ctx: MutationCtx,
  drop: Drop,
  user: Doc<"users">,
  events?: PickEvent[],
): Promise<Id<"dropEntries"> | null> {
  if (await entryFor(ctx.db, drop._id, user._id)) return null;
  const profile = await ctx.db
    .query("tasteProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  const prefs = await ctx.db
    .query("preferences")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  const choices = pickChoices({
    events: events ?? (await pickableEvents(ctx.db, drop.matchAt)),
    embedding: profile?.embedding,
    maxTicketPrice: prefs?.maxTicketPrice ?? null,
    area: prefs?.area ?? "berkeley_oakland",
    isTeam: !user.isDemo && isTeamEmail(user.email),
    matchAt: drop.matchAt,
  });
  if (choices.length === 0) return null;
  const entryId = await ctx.db.insert("dropEntries", {
    dropId: drop._id,
    userId: user._id,
    choices,
    index: 0,
    state: "choosing",
    isDemo: user.isDemo === true,
    createdAt: Date.now(),
  });
  // Demo students tap See more on card 1, then Accept, each after a short random wait.
  if (user.isDemo) await ctx.scheduler.runAfter(randomDelay(), internal.drops.cycle.demoStep, { entryId });
  return entryId;
}

export const demoStep = internalMutation({
  args: { entryId: v.id("dropEntries") },
  returns: v.null(),
  handler: async (ctx, { entryId }) => {
    const entry = await ctx.db.get(entryId);
    if (entry === null || !entry.isDemo) return null;
    const drop = await ctx.db.get(entry.dropId);
    if (drop === null || drop.status === "matched") return null;
    const now = Date.now();
    if (entry.state === "choosing" && drop.status === "choosing") {
      await ctx.db.patch(entryId, { state: "deciding", eventId: entry.choices[entry.index], decidedAt: now });
      await ctx.scheduler.runAfter(randomDelay(), internal.drops.cycle.demoStep, { entryId });
    } else if (entry.state === "deciding") {
      await ctx.db.patch(entryId, { state: "accepted", acceptedAt: now });
    }
    return null;
  },
});

// Demo students always finish: anything they haven't accepted yet is accepted now, on card 1.
async function fastForwardDemos(ctx: MutationCtx, drop: Drop): Promise<void> {
  const now = Date.now();
  for (const state of ["choosing", "deciding"] as const) {
    for (const entry of await entriesIn(ctx.db, drop._id, state)) {
      if (!entry.isDemo) continue;
      await ctx.db.patch(entry._id, {
        state: "accepted",
        eventId: entry.eventId ?? entry.choices[entry.index],
        decidedAt: entry.decidedAt ?? now,
        acceptedAt: now,
      });
    }
  }
}

async function sendToReal(ctx: MutationCtx, userIds: Id<"users">[], subject: string, text: string): Promise<void> {
  for (const userId of userIds) {
    const user = await ctx.db.get(userId);
    if (user === null || user.isDemo || user.email === undefined || user.email.endsWith(".invalid")) continue;
    await emailPool.enqueueAction(ctx, internal.drops.cycle.sendDropEmail, { to: user.email, subject, text });
  }
}

export const sendDropEmail = internalAction({
  args: { to: v.string(), subject: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (_ctx, message) => {
    await sendEmail(message);
    return null;
  },
});

export const EMAILS = {
  open: {
    subject: "Your Melos drop is open",
    text: `You have 2 hours to see what's waiting for you.\n\n${DROP.siteUrl}`,
  },
  matched: {
    subject: "You've been matched",
    text: `Someone's going with you. Open Melos to find out who.\n\n${DROP.siteUrl}`,
  },
} as const;

// Gives every eligible student their entry at once, then emails the real ones.
export const open = internalMutation({
  args: { dropId: v.id("drops") },
  returns: v.number(),
  handler: async (ctx, { dropId }) => {
    const drop = await ctx.db.get(dropId);
    if (drop === null || drop.status !== "choosing") return 0;
    const events = await pickableEvents(ctx.db, drop.matchAt);
    const users = await ctx.db.query("users").collect();
    const notify: Id<"users">[] = [];
    let created = 0;
    for (const user of users) {
      if (!(await isEligible(ctx.db, user))) continue;
      const entryId = await createEntry(ctx, drop, user, events);
      if (entryId === null) continue;
      created += 1;
      if (!user.isDemo) notify.push(user._id);
    }
    await sendToReal(ctx, notify, EMAILS.open.subject, EMAILS.open.text);
    return created;
  },
});

// A student who becomes ready while choosing is open gets their own choices too.
export async function joinLate(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const drop = await openDrop(ctx.db);
  if (drop === null || drop.status !== "choosing") return;
  const user = await ctx.db.get(userId);
  if (user === null || !(await isEligible(ctx.db, user))) return;
  await createEntry(ctx, drop, user);
}

// Choosing ends: demo students finish, students still on cards are turned away, and students on an
// event screen keep until matchAt to accept.
export async function endChoosingFor(ctx: MutationCtx, drop: Drop): Promise<void> {
  if (drop.status !== "choosing") return;
  const now = Date.now();
  await fastForwardDemos(ctx, drop);
  for (const entry of await entriesIn(ctx.db, drop._id, "choosing")) {
    await ctx.db.patch(entry._id, { state: "turned_away", endedAt: now });
  }
  await ctx.db.patch(drop._id, {
    status: "confirming",
    endedChoosingAt: now,
    choosingEndsAt: Math.min(drop.choosingEndsAt, now),
  });
}

export const endChoosing = internalMutation({
  args: { dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { dropId }) => {
    const drop = await ctx.db.get(dropId);
    if (drop !== null) await endChoosingFor(ctx, drop);
    return null;
  },
});

// Matching: anyone who hasn't accepted is turned away, then each event's accepted students are paired.
export async function matchFor(ctx: MutationCtx, dropId: Id<"drops">): Promise<void> {
  let drop = await ctx.db.get(dropId);
  if (drop === null || drop.status === "matched") return;
  await endChoosingFor(ctx, drop);
  drop = (await ctx.db.get(dropId))!;
  await fastForwardDemos(ctx, drop);
  const now = Date.now();
  for (const entry of await entriesIn(ctx.db, drop._id, "deciding")) {
    await ctx.db.patch(entry._id, { state: "turned_away", endedAt: now });
  }
  const matched = await matchDrop(ctx, drop._id);
  await ctx.db.patch(drop._id, { status: "matched", matchedAt: now, matchAt: Math.min(drop.matchAt, now) });
  await sendToReal(ctx, matched, EMAILS.matched.subject, EMAILS.matched.text);
}

export const match = internalMutation({
  args: { dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { dropId }) => {
    await matchFor(ctx, dropId);
    return null;
  },
});

// Admin: Start drop. Inserts the drop and schedules every phase; entries are created right after.
export async function startDrop(ctx: MutationCtx, by: string): Promise<Id<"drops">> {
  if (!dropsEnabled()) fail("validation_failed", "Drops are turned off (DROP_ENABLED=false).");
  if ((await openDrop(ctx.db)) !== null) fail("validation_failed", "A drop is already open.");
  const now = Date.now();
  const choosingEndsAt = now + DROP.choosingMs;
  const matchAt = choosingEndsAt + DROP.confirmMs;
  const dropId = await ctx.db.insert("drops", {
    status: "choosing",
    startedAt: now,
    choosingEndsAt,
    matchAt,
    startedBy: by,
  });
  await ctx.scheduler.runAfter(0, internal.drops.cycle.open, { dropId });
  await ctx.scheduler.runAt(choosingEndsAt, internal.drops.cycle.endChoosing, { dropId });
  await ctx.scheduler.runAt(matchAt, internal.drops.cycle.match, { dropId });
  return dropId;
}

// Admin: End choosing, now. The 24 hours to accept keep their original end (matchAt).
export async function requestEndChoosing(ctx: MutationCtx): Promise<void> {
  const drop = await openDrop(ctx.db);
  if (drop === null || drop.status !== "choosing") fail("validation_failed", "No drop is choosing right now.");
  await ctx.scheduler.runAfter(0, internal.drops.cycle.endChoosing, { dropId: drop._id });
}

// Admin: Match now. Closes choosing, ends the 24 hours, and matches at once.
export async function requestMatchNow(ctx: MutationCtx): Promise<void> {
  const drop = await openDrop(ctx.db);
  if (drop === null) fail("validation_failed", "No drop is open right now.");
  await ctx.scheduler.runAfter(0, internal.drops.cycle.match, { dropId: drop._id });
}

export async function adminStatus(db: DatabaseReader): Promise<Infer<typeof vAdminDropStatus>> {
  const drop = await latestDrop(db);
  if (drop === null) return { drop: null };
  const entries = await db
    .query("dropEntries")
    .withIndex("by_drop_user", (q) => q.eq("dropId", drop._id))
    .collect();
  const count = (state: Entry["state"]) => entries.filter((entry) => entry.state === state).length;
  return {
    drop: {
      status: drop.status,
      startedAt: drop.startedAt,
      choosingEndsAt: drop.choosingEndsAt,
      matchAt: drop.matchAt,
      counts: {
        eligible: entries.length,
        choosing: count("choosing"),
        deciding: count("deciding"),
        accepted: count("accepted"),
        passed: count("passed"),
        declined: count("declined"),
        turnedAway: count("turned_away"),
        matched: count("matched"),
        unmatched: count("unmatched"),
        demo: entries.filter((entry) => entry.isDemo).length,
      },
    },
  };
}
