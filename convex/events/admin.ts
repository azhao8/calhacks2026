import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { TIMING } from "../lib/config";
import { vEventKind, vEventStatus, vImportStatus } from "../lib/validators";
import { directionsUrl, metersBetween } from "../lib/format";
import { fail } from "../lib/errors";
import { scoutActorId, startRun } from "../services/apify";
import { embed } from "../services/voyage";
import { ADULT_REASON, CATALOG, DUPLICATE_REASON, PULLED_REASON, STICKY_REASONS } from "./config";
import { cleanNote, isHttpUrl, normalizeTitle, sameShowTitles, sourceRank } from "./checks";
import type { Id } from "../_generated/dataModel";
import { moveVenueSpot } from "./venues";

// Internal functions behind S17's Events panel. The coordinator's admin wrappers check ADMIN_EMAILS first.

const vCounts = v.object({
  received: v.number(),
  published: v.number(),
  updated: v.number(),
  rejected: v.number(),
  duplicates: v.number(),
});

export const imports = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      importId: v.id("eventImports"),
      apifyRunId: v.string(),
      receivedAt: v.number(),
      finishedAt: v.union(v.number(), v.null()),
      status: vImportStatus,
      counts: vCounts,
      errors: v.array(v.string()),
    }),
  ),
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("eventImports").order("desc").take(Math.min(limit ?? 20, 100));
    return rows.map((row) => ({
      importId: row._id,
      apifyRunId: row.apifyRunId,
      receivedAt: row.receivedAt,
      finishedAt: row.finishedAt ?? null,
      status: row.status,
      counts: row.counts,
      errors: row.errors,
    }));
  },
});

const vListedEvent = v.object({
  eventId: v.id("events"),
  title: v.string(),
  kind: vEventKind,
  status: vEventStatus,
  rejectReason: v.union(v.string(), v.null()),
  startsAt: v.number(),
  venueName: v.union(v.string(), v.null()),
  area: v.union(v.string(), v.null()),
  distanceFromCampusMeters: v.union(v.number(), v.null()),
  priceMin: v.union(v.number(), v.null()),
  priceMax: v.union(v.number(), v.null()),
  priceSource: v.union(v.string(), v.null()),
  ticketUrl: v.union(v.string(), v.null()),
  freeEntryNote: v.union(v.string(), v.null()),
  performers: v.array(v.string()),
  tags: v.array(v.string()),
  ageLimit: v.union(v.number(), v.null()),
  sourceName: v.string(),
  sourceUrl: v.string(),
  featured: v.boolean(),
  meetingSpot: v.union(v.null(), v.object({ name: v.string(), howToFind: v.string(), chosenBy: v.string() })),
  meetOffsetMinutes: v.number(),
  hasEmbedding: v.boolean(),
  missingSince: v.union(v.number(), v.null()),
  flaggedMissing: v.boolean(),
  pulled: v.boolean(),
  teamFields: v.array(v.string()),
  venueId: v.union(v.id("venues"), v.null()),
  // True when the team can undo the rejection with `restore` (pulled, 21+, or a merged duplicate).
  restorable: v.boolean(),
  lastSeenAt: v.number(),
});

// Published, rejected (with reasons), and flagged-missing events, soonest first.
export const list = internalQuery({
  args: {
    status: v.optional(vEventStatus),
    flaggedOnly: v.optional(v.boolean()),
    includePast: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.array(vListedEvent),
  handler: async (ctx, { status, flaggedOnly, includePast, limit }) => {
    const now = Date.now();
    const statuses = status ? [status] : (["published", "rejected", "scraped"] as const);
    const out = [];
    for (const s of statuses) {
      // Rejected rows are listed by when a run last saw them, including ones with no start time (startsAt 0).
      const rows =
        s === "rejected"
          ? (
              await ctx.db
                .query("events")
                .withIndex("by_status_startsAt", (q) => q.eq("status", s))
                .collect()
            )
              .filter((e) => includePast || e.startsAt > now || e.startsAt === 0)
              .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
              .slice(0, 500)
          : await ctx.db
              .query("events")
              .withIndex("by_status_startsAt", (q) => (includePast ? q.eq("status", s) : q.eq("status", s).gt("startsAt", now)))
              .take(500);
      for (const event of rows) {
        // Missing from two runs in a row where its source ran.
        const flagged = event.status === "published" && (event.missedRuns ?? 0) >= CATALOG.missingRunsToFlag;
        if (flaggedOnly && !flagged) continue;
        const venue = event.venueId ? await ctx.db.get(event.venueId) : null;
        const spotId = event.meetingSpotId ?? venue?.meetingSpotId;
        const spot = spotId ? await ctx.db.get(spotId) : null;
        out.push({
          eventId: event._id,
          title: event.title,
          kind: event.kind,
          status: event.status,
          rejectReason: event.rejectReason ?? null,
          startsAt: event.startsAt,
          venueName: venue?.name ?? null,
          area: venue?.area ?? null,
          distanceFromCampusMeters: venue?.distanceFromCampusMeters ?? null,
          priceMin: event.priceMin,
          priceMax: event.priceMax,
          priceSource: event.priceSource,
          ticketUrl: event.ticketUrl ?? null,
          freeEntryNote: event.freeEntryNote ?? null,
          performers: event.performers,
          tags: event.tags,
          ageLimit: event.ageLimit,
          sourceName: event.sourceName,
          sourceUrl: event.sourceUrl,
          featured: event.featured,
          meetingSpot: spot ? { name: spot.name, howToFind: spot.howToFind, chosenBy: spot.chosenBy } : null,
          meetOffsetMinutes: event.meetOffsetMinutes,
          hasEmbedding: event.embedding !== undefined,
          missingSince: event.missingSince ?? null,
          flaggedMissing: flagged,
          pulled: event.rejectReason === PULLED_REASON,
          teamFields: event.teamFields ?? [],
          venueId: event.venueId ?? null,
          restorable: event.rejectReason !== undefined && STICKY_REASONS.has(event.rejectReason),
          lastSeenAt: event.lastSeenAt,
        });
      }
    }
    // Rejected alone: most recently seen first. Otherwise: soonest first.
    if (status === "rejected") out.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    else out.sort((a, b) => a.startsAt - b.startsAt);
    return out.slice(0, Math.min(limit ?? 200, 500));
  },
});

// Pulls an event from the catalog. Later imports never republish it.
export const pull = internalMutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (event === null) fail("validation_failed", "No such event");
    await ctx.db.patch(eventId, { status: "rejected", rejectReason: PULLED_REASON, featured: false });
    // Closes its open asks, withdraws offers, and calls off its plans, in the same transaction.
    await ctx.runMutation(internal.plans.release.forEvent, { eventId });
    return null;
  },
});

// Folds a duplicate into the event it repeats: the duplicate leaves the catalog for good (its asks and plans are
// released), and the kept event takes a price the duplicate found when it had none.
export const mergeDuplicate = internalMutation({
  args: { keepId: v.id("events"), dropId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, { keepId, dropId }) => {
    if (keepId === dropId) fail("validation_failed", "An event can't duplicate itself");
    const keep = await ctx.db.get(keepId);
    const drop = await ctx.db.get(dropId);
    if (keep === null || drop === null) fail("validation_failed", "No such event");
    if (keep.priceMin === null && keep.priceMax === null && (drop.priceMin !== null || drop.priceMax !== null)) {
      await ctx.db.patch(keepId, { priceMin: drop.priceMin, priceMax: drop.priceMax, priceSource: drop.priceSource });
    }
    await ctx.db.patch(dropId, { status: "rejected", rejectReason: DUPLICATE_REASON, featured: false });
    await ctx.runMutation(internal.plans.release.forEvent, { eventId: dropId });
    return null;
  },
});

// Finds published upcoming events already stored twice (same venue, same start, the same show by title) and folds
// each extra copy into the one people hold. Never strands a student:
// - keep: the copy with a forming or set plan; else the one with more open asks; else the more official source;
// - a group where two copies both hold plans is left alone and reported, for the team;
// - a dropped copy's open asks close through plans.release.forEvent (it holds no plans).
// Dry run by default: it reports what it would do and changes nothing.
export const mergeDuplicates = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.array(
    v.object({
      keep: v.object({ eventId: v.id("events"), title: v.string() }),
      drop: v.array(v.object({ eventId: v.id("events"), title: v.string(), openAsks: v.number() })),
      skipped: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { dryRun }) => {
    const now = Date.now();
    const upcoming = await ctx.db
      .query("events")
      .withIndex("by_status_startsAt", (q) => q.eq("status", "published").gt("startsAt", now))
      .collect();
    const holders = async (eventId: Id<"events">) => {
      let plans = 0;
      for (const status of ["forming", "set"] as const) {
        plans += (
          await ctx.db
            .query("meetups")
            .withIndex("by_event_status", (q) => q.eq("eventId", eventId).eq("status", status))
            .collect()
        ).length;
      }
      let openAsks = 0;
      for (const answer of ["pending", "yes"] as const) {
        openAsks += (
          await ctx.db
            .query("asks")
            .withIndex("by_event_answer", (q) => q.eq("eventId", eventId).eq("answer", answer))
            .collect()
        ).filter((ask) => ask.closedReason === undefined).length;
      }
      return { plans, openAsks };
    };
    const seen = new Set<string>();
    const report = [];
    for (const event of upcoming) {
      if (seen.has(event._id) || event.venueId === undefined) continue;
      const group = upcoming.filter(
        (other) =>
          other.venueId === event.venueId &&
          other.startsAt === event.startsAt &&
          (other._id === event._id || sameShowTitles(normalizeTitle(other.title), normalizeTitle(event.title))),
      );
      for (const member of group) seen.add(member._id);
      if (group.length < 2) continue;
      const scored = [];
      for (const member of group) scored.push({ member, ...(await holders(member._id)) });
      scored.sort(
        (a, b) =>
          b.plans - a.plans ||
          b.openAsks - a.openAsks ||
          sourceRank(b.member.sourceName.split(":")[0]) - sourceRank(a.member.sourceName.split(":")[0]) ||
          a.member.scrapedAt - b.member.scrapedAt,
      );
      const [keep, ...drops] = scored;
      const skipped = drops.some((d) => d.plans > 0) ? "Two copies both hold plans; merge by hand" : null;
      if (dryRun === false && skipped === null) {
        for (const drop of drops) {
          await ctx.runMutation(internal.events.admin.mergeDuplicate, { keepId: keep.member._id, dropId: drop.member._id });
        }
      }
      report.push({
        keep: { eventId: keep.member._id, title: keep.member.title },
        drop: drops.map((d) => ({ eventId: d.member._id, title: d.member.title, openAsks: d.openAsks })),
        skipped,
      });
    }
    return report;
  },
});

// Gives a venue its real name (students see "{title} at {venue}"); the old name stays as an alias.
export const renameVenue = internalMutation({
  args: { venueId: v.id("venues"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, { venueId, name }) => {
    const venue = await ctx.db.get(venueId);
    if (venue === null) fail("validation_failed", "No such venue");
    const next = name.trim();
    if (next.length === 0) fail("validation_failed", "The name is empty");
    const aliases = [...new Set([...venue.aliases, venue.name])].filter((alias) => alias !== next);
    await ctx.db.patch(venueId, { name: next, aliases, updatedAt: Date.now() });
    return null;
  },
});

// Undo a pull (or a 21+ rejection the team checked by hand): the event is published again.
export const restore = internalMutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (event === null) fail("validation_failed", "No such event");
    if (event.rejectReason === undefined || !STICKY_REASONS.has(event.rejectReason)) {
      fail("validation_failed", "Only a pulled or 21+ event can be restored");
    }
    // Clearing a 21+ rejection locks ageLimit, so the next import can't re-reject it.
    const clearsAdult = event.rejectReason === ADULT_REASON;
    await ctx.db.patch(eventId, {
      status: "published",
      rejectReason: undefined,
      ...(clearsAdult ? { ageLimit: null, teamFields: [...new Set([...(event.teamFields ?? []), "ageLimit"])] } : {}),
    });
    if (event.embedding === undefined) await ctx.scheduler.runAfter(0, internal.events.admin.reembed, { eventId });
    await ctx.scheduler.runAfter(0, internal.asks.picker.pickAfterImport, {});
    return null;
  },
});

export const feature = internalMutation({
  args: { eventId: v.id("events"), featured: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { eventId, featured }) => {
    const event = await ctx.db.get(eventId);
    if (event === null) fail("validation_failed", "No such event");
    await ctx.db.patch(eventId, { featured });
    return null;
  },
});

// Edits any field, such as a price the scout couldn't find. A team price is never overwritten by imports.
export const edit = internalMutation({
  args: {
    eventId: v.id("events"),
    patch: v.object({
      title: v.optional(v.string()),
      kind: v.optional(vEventKind),
      startsAt: v.optional(v.number()),
      priceMin: v.optional(v.union(v.number(), v.null())),
      priceMax: v.optional(v.union(v.number(), v.null())),
      ticketUrl: v.optional(v.union(v.string(), v.null())),
      freeEntryNote: v.optional(v.union(v.string(), v.null())),
      performers: v.optional(v.array(v.string())),
      tags: v.optional(v.array(v.string())),
      ageLimit: v.optional(v.union(v.number(), v.null())),
      meetOffsetMinutes: v.optional(v.number()),
    }),
    editedBy: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { eventId, patch, editedBy }) => {
    const event = await ctx.db.get(eventId);
    if (event === null) fail("validation_failed", "No such event");
    for (const price of [patch.priceMin, patch.priceMax]) {
      // A typed "$15" arrives as NaN; only null or a finite amount of at least 0 is a price.
      if (price !== undefined && price !== null && !(Number.isFinite(price) && price >= 0)) {
        fail("validation_failed", "A price must be a number of dollars, 0 or more, or empty");
      }
    }
    const { ticketUrl, freeEntryNote, ...rest } = patch;
    if (ticketUrl && !isHttpUrl(ticketUrl)) fail("validation_failed", "The ticket link must be an http or https URL");
    const next = { ...rest } as Record<string, unknown>;
    if (ticketUrl !== undefined) next.ticketUrl = ticketUrl ?? undefined;
    if (freeEntryNote !== undefined) next.freeEntryNote = cleanNote(freeEntryNote);
    if (patch.priceMin !== undefined || patch.priceMax !== undefined) {
      const min = patch.priceMin !== undefined ? patch.priceMin : event.priceMin;
      const max = patch.priceMax !== undefined ? patch.priceMax : event.priceMax;
      if (min !== null && max !== null && min > max) fail("validation_failed", "Minimum price is above maximum");
      next.priceSource = `team${editedBy ? ` ${editedBy}` : ""}`;
    }
    // Every field the team edits is locked: later imports leave it alone.
    const edited = Object.keys(patch).filter((field) => field !== "meetOffsetMinutes");
    next.teamFields = [...new Set([...(event.teamFields ?? []), ...edited])];
    const textChanged = ["title", "kind", "performers", "tags"].some((field) => field in rest);
    if (textChanged) next.embedding = undefined;
    await ctx.db.patch(eventId, next);
    if (textChanged && event.status === "published") {
      await ctx.scheduler.runAfter(0, internal.events.admin.reembed, { eventId });
    }
    if (patch.startsAt !== undefined || patch.meetOffsetMinutes !== undefined) {
      // Plans on this event move their meeting time and cutoff, and reconcile right away.
      await ctx.runMutation(internal.plans.retime.forEvent, { eventId });
    }
    return null;
  },
});

export const reembed = internalAction({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const docs = await ctx.runQuery(internal.events.imports.documentsFor, { eventIds: [eventId] });
    if (docs.length === 0) return null;
    const [embedding] = await embed([docs[0].text], "document");
    await ctx.runMutation(internal.events.imports.setEmbeddings, { rows: [{ eventId, embedding }] });
    return null;
  },
});

// The team overrides a venue's meeting spot; every show there uses it.
export const overrideSpot = internalMutation({
  args: {
    venueId: v.id("venues"),
    name: v.string(),
    howToFind: v.string(),
    lat: v.number(),
    lng: v.number(),
    meetOffsetMinutes: v.optional(v.number()),
  },
  returns: v.id("meetingSpots"),
  handler: async (ctx, args) => {
    const venue = await ctx.db.get(args.venueId);
    if (venue === null) fail("validation_failed", "No such venue");
    if (metersBetween(venue, args) > CATALOG.spotMaxMeters * 4) {
      fail("validation_failed", "That spot is far from the venue");
    }
    const spotId = await ctx.db.insert("meetingSpots", {
      name: args.name,
      howToFind: args.howToFind,
      lat: args.lat,
      lng: args.lng,
      directionsUrl: directionsUrl(args.lat, args.lng),
      area: venue.area,
      chosenBy: "team",
      verifiedAt: Date.now(),
    });
    const meetOffsetMinutes = args.meetOffsetMinutes ?? venue.meetOffsetMinutes ?? TIMING.meetOffsetMinutes;
    // Every show at the venue, and every forming or set plan for them, moves to the team's spot.
    await moveVenueSpot(ctx, venue, spotId, meetOffsetMinutes, { moveSetPlans: true, now: Date.now() });
    return spotId;
  },
});

// "Find events now": starts a scout run; its webhook brings the results back.
export const findNow = internalAction({
  args: { sources: v.optional(v.array(v.string())) },
  returns: v.object({ apifyRunId: v.string() }),
  handler: async (_ctx, { sources }) => {
    const run = await startRun(scoutActorId(), sources ? { sources } : {});
    return { apifyRunId: run.id };
  },
});
