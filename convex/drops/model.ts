import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseReader, MutationCtx } from "../_generated/server";
import { fail } from "../lib/errors";
import { eventPriceLabel } from "../asks/rules";
import { hookItems } from "../matching/names";
import { documentFrequency, sharedItems } from "../matching/taste";
import { normalizeTrackKey } from "../lib/normalize";
import { isActivePlan, isActiveSeat, seatsOf } from "../plans/model";
import { entryFor, latestDrop, openDrop, type Drop, type Entry } from "./cycle";
import type { DropView, Reveal } from "./views";

// One student's view of the drop and their own actions (DECISIONS.md, Oct 25).

function endsAt(drop: Drop): number {
  return drop.status === "choosing" ? drop.choosingEndsAt : drop.matchAt;
}

function phase(drop: Drop): "choosing" | "confirming" {
  return drop.status === "choosing" ? "choosing" : "confirming";
}

async function eventDetails(db: DatabaseReader, eventId: Id<"events">) {
  const event = await db.get(eventId);
  if (event === null) return null;
  const venue = event.venueId ? await db.get(event.venueId) : null;
  return {
    title: event.title,
    venue: venue?.name ?? "Venue to be announced",
    startsAt: event.startsAt,
    price: eventPriceLabel(event),
    kind: event.kind,
  };
}

// A match not yet revealed, in a plan that's still on.
async function unrevealedMatch(db: DatabaseReader, userId: Id<"users">): Promise<Entry | null> {
  const entries = await db
    .query("dropEntries")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const entry of entries.sort((a, b) => b._creationTime - a._creationTime)) {
    if (entry.state !== "matched" || entry.revealedAt !== undefined || entry.meetupId === undefined) continue;
    const plan = await db.get(entry.meetupId);
    if (plan === null || !isActivePlan(plan)) continue;
    const seat = (await seatsOf(db, plan._id)).find((s) => s.userId === userId);
    if (seat !== undefined && isActiveSeat(seat)) return entry;
  }
  return null;
}

export async function dropView(db: DatabaseReader, userId: Id<"users">): Promise<DropView> {
  const match = await unrevealedMatch(db, userId);
  if (match !== null) return { kind: "reveal", meetupId: match.meetupId! };
  const drop = (await openDrop(db)) ?? (await latestDrop(db));
  if (drop === null || drop.status === "matched") return { kind: "none" };
  const entry = await entryFor(db, drop._id, userId);
  if (entry === null) return { kind: "none" };
  switch (entry.state) {
    case "choosing": {
      const event = await db.get(entry.choices[entry.index]);
      if (event === null) return { kind: "done", phase: phase(drop), endsAt: endsAt(drop) };
      return { kind: "choosing", phase: phase(drop), endsAt: endsAt(drop), card: { startsAt: event.startsAt, price: eventPriceLabel(event) } };
    }
    case "deciding": {
      const event = await eventDetails(db, entry.eventId!);
      if (event === null) return { kind: "done", phase: phase(drop), endsAt: endsAt(drop) };
      return { kind: "deciding", phase: phase(drop), endsAt: endsAt(drop), acceptBy: drop.matchAt, event };
    }
    case "accepted": {
      const event = await eventDetails(db, entry.eventId!);
      if (event === null) return { kind: "done", phase: phase(drop), endsAt: endsAt(drop) };
      return { kind: "accepted", phase: phase(drop), endsAt: endsAt(drop), matchAt: drop.matchAt, event };
    }
    case "passed":
    case "declined":
      return { kind: "done", phase: phase(drop), endsAt: endsAt(drop) };
    default:
      return { kind: "none" };
  }
}

// The caller's entry in the open drop, or an error the UI maps to recovery copy.
async function ownEntry(ctx: MutationCtx, userId: Id<"users">): Promise<{ drop: Drop; entry: Entry }> {
  const drop = await openDrop(ctx.db);
  if (drop === null) fail("offer_expired", "This drop has ended.");
  const entry = await entryFor(ctx.db, drop._id, userId);
  if (entry === null) fail("forbidden", "You're not in this drop.");
  return { drop, entry };
}

export async function seeMoreEntry(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const { drop, entry } = await ownEntry(ctx, userId);
  if (entry.state === "deciding") return;
  if (entry.state !== "choosing") fail("validation_failed", "There's no card to open.");
  if (drop.status !== "choosing") fail("offer_expired", "Choosing has ended.");
  await ctx.db.patch(entry._id, { state: "deciding", eventId: entry.choices[entry.index], decidedAt: Date.now() });
}

// Moves to the next card; past the last one, the drop is done for this student. The screen blocks
// duplicate taps while a pass is pending (no args, so the server can't tell a double tap from two).
export async function passEntry(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const { drop, entry } = await ownEntry(ctx, userId);
  if (entry.state === "passed") return;
  if (entry.state !== "choosing") fail("validation_failed", "There's no card to pass.");
  if (drop.status !== "choosing") fail("offer_expired", "Choosing has ended.");
  const next = entry.index + 1;
  if (next >= entry.choices.length) await ctx.db.patch(entry._id, { state: "passed", endedAt: Date.now() });
  else await ctx.db.patch(entry._id, { index: next });
}

export async function acceptEntry(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const { drop, entry } = await ownEntry(ctx, userId);
  if (entry.state === "accepted") return;
  if (entry.state !== "deciding") fail("validation_failed", "There's nothing to accept.");
  if (Date.now() >= drop.matchAt) fail("offer_expired", "The time to accept has run out.");
  await ctx.db.patch(entry._id, { state: "accepted", acceptedAt: Date.now() });
}

export async function nextTimeEntry(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const { entry } = await ownEntry(ctx, userId);
  if (entry.state === "declined") return;
  if (entry.state !== "deciding") fail("validation_failed", "There's nothing to decline.");
  await ctx.db.patch(entry._id, { state: "declined", endedAt: Date.now() });
}

// The caller's own seat and their partner's in a plan, or forbidden.
async function ownPlanPair(db: DatabaseReader, userId: Id<"users">, meetupId: Id<"meetups">) {
  const plan = await db.get(meetupId);
  if (plan === null) fail("forbidden");
  const active = (await seatsOf(db, meetupId)).filter(isActiveSeat);
  const mine = active.find((seat) => seat.userId === userId);
  if (mine === undefined) fail("forbidden");
  const partnerSeat = active.find((seat) => seat.userId !== userId);
  const partner = partnerSeat ? await db.get(partnerSeat.userId) : null;
  return { plan, partner };
}

// The artist who sings a shared track, as Spotify spells it (keys are "title|artist").
async function trackArtist(db: DatabaseReader, key: string, userIds: Id<"users">[]): Promise<string> {
  for (const userId of userIds) {
    const snapshot = await db
      .query("tasteSnapshots")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    const track = snapshot?.topTracks.find((t) => t.normalizedKey === key);
    if (track?.artistNames[0]) return track.artistNames[0];
    // A song shared only through liked songs.
    const liked = snapshot?.likedSongs.find((s) => normalizeTrackKey(s.name, s.artistNames) === key);
    if (liked?.artistNames[0]) return liked.artistNames[0];
  }
  return key.split("|")[1] ?? "";
}

export async function revealFor(db: DatabaseReader, userId: Id<"users">, meetupId: Id<"meetups">): Promise<Reveal> {
  const { partner } = await ownPlanPair(db, userId, meetupId);
  const steps: Reveal["steps"] = [{ kind: "going" }];
  if (partner !== null) {
    const profiles = (await db.query("tasteProfiles").collect()).filter((p) => p.confirmedAt !== undefined);
    const mine = profiles.find((p) => p.userId === userId);
    const theirs = profiles.find((p) => p.userId === partner._id);
    if (mine && theirs) {
      const shared = sharedItems(mine.fingerprint, theirs.fingerprint, documentFrequency(profiles.map((p) => p.fingerprint)), profiles.length);
      const userIds = [userId, partner._id];
      // Rarest first (sharedItems sorts by weight).
      const artist = shared.find((item) => item.kind === "artist");
      const label = shared.find((item) => item.kind === "label");
      const track = shared.find((item) => item.kind === "track");
      if (artist) steps.push({ kind: "artist", name: (await hookItems(db, [artist], userIds))[0].name });
      else if (label) steps.push({ kind: "label", name: label.name });
      if (track) {
        const title = (await hookItems(db, [track], userIds))[0].name;
        steps.push({ kind: "song", title, artist: await trackArtist(db, track.name, userIds) });
      }
    }
    steps.push({ kind: "name", firstName: partner.firstName ?? "Your partner" });
  }
  return { steps };
}

export async function markRevealed(ctx: MutationCtx, userId: Id<"users">, meetupId: Id<"meetups">): Promise<void> {
  await ownPlanPair(ctx.db, userId, meetupId);
  const entries = await ctx.db
    .query("dropEntries")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const entry of entries as Doc<"dropEntries">[]) {
    if (entry.meetupId === meetupId && entry.revealedAt === undefined) {
      await ctx.db.patch(entry._id, { revealedAt: Date.now() });
    }
  }
}
