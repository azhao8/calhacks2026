import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { vOnCompleteArgs } from "@convex-dev/workpool";
import { vEventKind } from "../lib/validators";
import { getRecord, getRun, listDatasetItems } from "../services/apify";
import { searchPlaces } from "../services/geocode";
import { embed } from "../services/voyage";
import { ADULT_REASON, CATALOG, STICKY_REASONS, VENUE_NOT_FOUND } from "./config";
import {
  basicRejectReason,
  cleanList,
  cleanNote,
  isHttpUrl,
  placeMatches,
  dedupeKey,
  eventDocument,
  normalizeName,
  normalizeTitle,
  pacificDay,
  parseStart,
  priceFields,
  sourceRank,
  sameShowTitles,
} from "./checks";
import { scoutItem, type ScoutItem } from "./item";
import { IMPORT_RETRY, importPool } from "./pool";

// The import (CLAUDE.md §6.1, §8.2 Events): the webhook records the run, the syncPool runs `run`,
// and mutations write venues, spots, and events after re-checking current state.

const ZERO_COUNTS = { received: 0, published: 0, updated: 0, rejected: 0, duplicates: 0 };

export const receive = internalMutation({
  args: { apifyRunId: v.string(), datasetId: v.optional(v.string()) },
  returns: v.object({ duplicate: v.boolean() }),
  handler: async (ctx, { apifyRunId, datasetId }) => {
    const existing = await ctx.db
      .query("eventImports")
      .withIndex("by_runId", (q) => q.eq("apifyRunId", apifyRunId))
      .first();
    // Apify may deliver a webhook more than once; a run already received is ignored.
    if (existing !== null) return { duplicate: true };
    const importId = await ctx.db.insert("eventImports", {
      apifyRunId,
      receivedAt: Date.now(),
      status: "received",
      counts: ZERO_COUNTS,
      errors: [],
    });
    await importPool.enqueueAction(
      ctx,
      internal.events.imports.run,
      { importId, apifyRunId, datasetId },
      { retry: IMPORT_RETRY, onComplete: internal.events.imports.onComplete, context: importId },
    );
    return { duplicate: false };
  },
});

export const recordFailedRun = internalMutation({
  args: { apifyRunId: v.string(), eventType: v.string() },
  returns: v.null(),
  handler: async (ctx, { apifyRunId, eventType }) => {
    const existing = await ctx.db
      .query("eventImports")
      .withIndex("by_runId", (q) => q.eq("apifyRunId", apifyRunId))
      .first();
    if (existing !== null) return null;
    const now = Date.now();
    // The previous catalog stays live; the admin page shows the failed run (§8.3).
    await ctx.db.insert("eventImports", {
      apifyRunId,
      receivedAt: now,
      status: "failed",
      counts: ZERO_COUNTS,
      errors: [`The scout run ended with ${eventType}`],
      finishedAt: now,
    });
    return null;
  },
});

export const onComplete = internalMutation({
  args: vOnCompleteArgs(v.id("eventImports")),
  returns: v.null(),
  handler: async (ctx, { context: importId, result }) => {
    if (result.kind === "success") return null;
    const row = await ctx.db.get(importId);
    if (row === null || row.status === "done") return null;
    const error = result.kind === "failed" ? result.error : "The import was canceled";
    await ctx.db.patch(importId, {
      status: "failed",
      errors: [...row.errors, error].slice(-50),
      finishedAt: Date.now(),
    });
    return null;
  },
});

export const markImporting = internalMutation({
  args: { importId: v.id("eventImports") },
  returns: v.object({ receivedAt: v.number() }),
  handler: async (ctx, { importId }) => {
    const row = await ctx.db.get(importId);
    if (row === null) throw new Error("import row is missing");
    await ctx.db.patch(importId, { status: "importing" });
    return { receivedAt: row.receivedAt };
  },
});

const vEventInput = v.object({
  title: v.string(),
  kind: vEventKind,
  startsAt: v.number(),
  priceMin: v.union(v.number(), v.null()),
  priceMax: v.union(v.number(), v.null()),
  priceSource: v.string(),
  ticketUrl: v.optional(v.string()),
  freeEntryNote: v.optional(v.string()),
  sourceName: v.string(),
  sourceKind: v.string(),
  sourceUrl: v.string(),
  performers: v.array(v.string()),
  tags: v.array(v.string()),
  ageLimit: v.union(v.number(), v.null()),
});

const vOutcome = v.union(
  v.literal("published"),
  v.literal("updated"),
  v.literal("duplicate"),
  v.literal("rejected"),
);

type EventInput = (typeof vEventInput)["type"];

// The existing event this item describes. First the exact key; then, for a changed title or time, the same
// listing page with the same title, the same venue and title on the same Pacific date, or the same venue and start
// with one title containing the other ("Yo-Yo Ma" and "Cal Performances presents Yo-Yo Ma, cello").
// The fallbacks skip rows this source already wrote in this run, so a two-night stand or an early and a late show
// stay separate events, and they pick the closest start time rather than the first row found.
async function findExisting(
  ctx: { db: import("../_generated/server").MutationCtx["db"] },
  venueId: Id<"venues"> | undefined,
  key: string,
  event: EventInput,
  sourceName: string,
  seenAt: number,
): Promise<Doc<"events"> | null> {
  const byKey = await ctx.db
    .query("events")
    .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", key))
    .first();
  if (byKey !== null || venueId === undefined) return byKey;
  const atVenue = (
    await ctx.db
      .query("events")
      .withIndex("by_venue", (q) => q.eq("venueId", venueId))
      .collect()
  ).filter((e) => !(e.lastSeenAt === seenAt && e.sourceName === sourceName));
  const title = normalizeTitle(event.title);
  const day = pacificDay(event.startsAt);
  const closest = (rows: Doc<"events">[]) =>
    rows.sort((a, b) => Math.abs(a.startsAt - event.startsAt) - Math.abs(b.startsAt - event.startsAt))[0] ?? null;
  return (
    closest(atVenue.filter((e) => e.sourceUrl === event.sourceUrl && normalizeTitle(e.title) === title)) ??
    closest(atVenue.filter((e) => normalizeTitle(e.title) === title && pacificDay(e.startsAt) === day)) ??
    closest(atVenue.filter((e) => e.startsAt === event.startsAt && sameShowTitles(normalizeTitle(e.title), title))) ??
    null
  );
}

function sourceKindOf(event: Doc<"events">): string {
  // The source kind is the prefix of sourceName, e.g. "venue_site:uc_theatre".
  return event.sourceName.split(":")[0];
}

function withoutTeamFields<T extends Record<string, unknown>>(fields: T, teamFields: string[] | undefined): Partial<T> {
  if (!teamFields || teamFields.length === 0) return fields;
  const locked = new Set(teamFields);
  if (locked.has("priceMin") || locked.has("priceMax")) {
    locked.add("priceMin");
    locked.add("priceMax");
    locked.add("priceSource");
  }
  return Object.fromEntries(Object.entries(fields).filter(([name]) => !locked.has(name))) as Partial<T>;
}

export const upsertEvent = internalMutation({
  args: {
    event: vEventInput,
    venueId: v.optional(v.id("venues")),
    venueKey: v.string(),
    rejectReason: v.optional(v.string()),
    // The reason with the 21+ check skipped, for an event the team has cleared (restored after a 21+ rejection).
    rejectReasonIfCleared: v.optional(v.string()),
    apifyRunId: v.string(),
    seenAt: v.number(),
  },
  returns: v.object({ outcome: vOutcome, eventId: v.id("events"), needsEmbedding: v.boolean() }),
  handler: async (ctx, { event, venueId, venueKey, rejectReason: listedReason, rejectReasonIfCleared, apifyRunId, seenAt }) => {
    const key = dedupeKey(venueKey, event.startsAt, event.title);
    const { sourceKind, ...fields } = event;
    const sourceName = fields.sourceName.startsWith(`${sourceKind}:`) ? fields.sourceName : `${sourceKind}:${fields.sourceName}`;
    const existing = await findExisting(ctx, venueId, key, event, sourceName, seenAt);
    const venue = venueId ? await ctx.db.get(venueId) : null;
    // The team locks ageLimit when it restores a 21+ rejection; later listings can't re-reject it as 21+.
    const cleared = listedReason === ADULT_REASON && (existing?.teamFields ?? []).includes("ageLimit");
    const rejectReason = cleared ? rejectReasonIfCleared : listedReason;

    if (existing === null) {
      const eventId = await ctx.db.insert("events", {
        ...fields,
        sourceName,
        venueId,
        meetingSpotId: venue?.meetingSpotId,
        meetOffsetMinutes: venue?.meetOffsetMinutes ?? 30,
        status: rejectReason ? "rejected" : "published",
        rejectReason,
        featured: false,
        dedupeKey: key,
        apifyRunId,
        scrapedAt: seenAt,
        lastSeenAt: seenAt,
      });
      return { outcome: rejectReason ? ("rejected" as const) : ("published" as const), eventId, needsEmbedding: !rejectReason };
    }

    const seen = { lastSeenAt: seenAt, missingSince: undefined, missedRuns: undefined, apifyRunId };
    // A pulled or 21+ event stays out of the catalog, whichever source lists it next.
    if (existing.rejectReason !== undefined && STICKY_REASONS.has(existing.rejectReason)) {
      await ctx.db.patch(existing._id, seen);
      return { outcome: "duplicate" as const, eventId: existing._id, needsEmbedding: false };
    }
    if (rejectReason) {
      if (existing.status === "published" && rejectReason !== ADULT_REASON) {
        // A published event is never downgraded by a listing that fails a softer check.
        await ctx.db.patch(existing._id, seen);
        return { outcome: "duplicate" as const, eventId: existing._id, needsEmbedding: false };
      }
      const wasPublished = existing.status === "published";
      await ctx.db.patch(existing._id, { ...seen, status: "rejected", rejectReason, featured: false });
      if (wasPublished) {
        // It left the catalog (now 21+): close its asks, withdraw offers, and call off its plans.
        await ctx.runMutation(internal.plans.release.forEvent, { eventId: existing._id });
      }
      return { outcome: "rejected" as const, eventId: existing._id, needsEmbedding: false };
    }

    const locked = new Set(existing.teamFields ?? []);
    const teamPrice = locked.has("priceMin") || locked.has("priceMax");
    const wasRejected = existing.status !== "published";
    const owns =
      wasRejected || sourceName === existing.sourceName || sourceRank(sourceKind) > sourceRank(sourceKindOf(existing));
    if (!owns) {
      // The most official source wins (ties go to the source already there); another may only fill in a price nobody found.
      const fillPrice = !teamPrice && existing.priceMin === null && existing.priceMax === null && fields.priceMin !== null;
      await ctx.db.patch(existing._id, {
        ...seen,
        ...(fillPrice ? { priceMin: fields.priceMin, priceMax: fields.priceMax, priceSource: fields.priceSource } : {}),
      });
      return { outcome: fillPrice ? ("updated" as const) : ("duplicate" as const), eventId: existing._id, needsEmbedding: false };
    }

    const incoming = withoutTeamFields(fields, existing.teamFields);
    // A source that found no price never wipes a price another source found.
    if (fields.priceSource.startsWith("not_found") && (existing.priceMin !== null || existing.priceMax !== null)) {
      delete incoming.priceMin;
      delete incoming.priceMax;
      delete incoming.priceSource;
    }
    const next = { ...existing, ...incoming };
    const priceChanged = existing.priceMin !== next.priceMin || existing.priceMax !== next.priceMax;
    const timeChanged = existing.startsAt !== next.startsAt;
    const textChanged =
      existing.title !== next.title ||
      existing.kind !== next.kind ||
      existing.performers.join("|") !== next.performers.join("|") ||
      existing.tags.join("|") !== next.tags.join("|");
    await ctx.db.patch(existing._id, {
      ...seen,
      ...incoming,
      // Optional fields the source dropped are cleared, unless the team set them.
      ...(locked.has("ticketUrl") ? {} : { ticketUrl: fields.ticketUrl }),
      ...(locked.has("freeEntryNote") ? {} : { freeEntryNote: fields.freeEntryNote }),
      sourceName,
      venueId: venueId ?? existing.venueId,
      dedupeKey: key,
      status: "published",
      rejectReason: undefined,
      ...(textChanged ? { embedding: undefined } : {}),
    });
    if (timeChanged && !wasRejected) {
      // Plans on this event move their meeting time and cutoff, and reconcile right away.
      await ctx.runMutation(internal.plans.retime.forEvent, { eventId: existing._id });
    }
    const outcome = wasRejected ? "published" : priceChanged || timeChanged ? "updated" : "duplicate";
    return {
      outcome: outcome as "published" | "updated" | "duplicate",
      eventId: existing._id,
      needsEmbedding: textChanged || wasRejected || existing.embedding === undefined,
    };
  },
});

export const documentsFor = internalQuery({
  args: { eventIds: v.array(v.id("events")) },
  returns: v.array(v.object({ eventId: v.id("events"), text: v.string() })),
  handler: async (ctx, { eventIds }) => {
    const out = [];
    for (const eventId of eventIds) {
      const event = await ctx.db.get(eventId);
      if (event !== null && event.status === "published") out.push({ eventId, text: eventDocument(event) });
    }
    return out;
  },
});

export const setEmbeddings = internalMutation({
  args: { rows: v.array(v.object({ eventId: v.id("events"), embedding: v.array(v.float64()) })) },
  returns: v.null(),
  handler: async (ctx, { rows }) => {
    for (const { eventId, embedding } of rows) {
      if ((await ctx.db.get(eventId)) !== null) await ctx.db.patch(eventId, { embedding });
    }
    return null;
  },
});

// Upcoming published events from the sources that ran, but missing from this run: each such run adds one to
// missedRuns, and seeing the event again resets it. Two misses in a row (runs where its source ran) flag it.
export const flagMissing = internalMutation({
  args: { receivedAt: v.number(), sources: v.array(v.string()), now: v.number() },
  returns: v.object({ missing: v.number(), flagged: v.number() }),
  handler: async (ctx, { receivedAt, sources, now }) => {
    const ran = new Set(sources);
    const upcoming = await ctx.db
      .query("events")
      .withIndex("by_status_startsAt", (q) => q.eq("status", "published").gt("startsAt", now))
      .collect();
    let missing = 0;
    let flagged = 0;
    for (const event of upcoming) {
      if (!ran.has(event.sourceName) || event.lastSeenAt >= receivedAt) continue;
      missing += 1;
      const missedRuns = (event.missedRuns ?? 0) + 1;
      await ctx.db.patch(event._id, { missedRuns, missingSince: event.missingSince ?? receivedAt });
      if (missedRuns >= CATALOG.missingRunsToFlag) flagged += 1;
    }
    return { missing, flagged };
  },
});

export const finish = internalMutation({
  args: {
    importId: v.id("eventImports"),
    counts: v.object({
      received: v.number(),
      published: v.number(),
      updated: v.number(),
      rejected: v.number(),
      duplicates: v.number(),
    }),
    errors: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { importId, counts, errors }) => {
    await ctx.db.patch(importId, { status: "done", counts, errors: errors.slice(0, 50), finishedAt: Date.now() });
    if (counts.published > 0) {
      await ctx.scheduler.runAfter(0, internal.asks.picker.pickAfterImport, {});
    }
    // Drops: audience profiles for new or changed events.
    if (counts.published > 0 || counts.updated > 0) {
      await ctx.scheduler.runAfter(0, internal.drops.audience.backfill, {});
    }
    return null;
  },
});

type RunSummary = { sources?: { name: string; kind: string; status: string }[] };

// Sources that finished in this run (as stored sourceNames), from the scout's OUTPUT record;
// else the sources seen in the items.
export function sourcesThatRan(summary: unknown, items: ScoutItem[]): string[] {
  const named = (summary as RunSummary | null)?.sources;
  const names = Array.isArray(named)
    ? named.filter((s) => s.status === "succeeded").map((s) => `${s.kind}:${s.name}`)
    : items.map((item) => `${item.sourceKind}:${item.sourceName}`);
  return [...new Set(names)];
}

// Venue lookups. `lookup: false` (for an item already rejected) uses only what the scout confirmed or a venue
// we already know, so a rejected listing still lands on the same row as its published twin.
async function resolveVenueFor(
  ctx: import("../_generated/server").ActionCtx,
  item: ScoutItem,
  now: number,
  options: { lookup: boolean; misses: Set<string> },
): Promise<{ venueId: Id<"venues"> } | { reason: string }> {
  let place: { osmId: string; name: string; address: string; lat: number; lng: number; alias?: string } | null = null;
  const scoutPlaced = item.venue.osmId !== null && item.venue.lat !== null && item.venue.lng !== null;
  if (scoutPlaced) {
    place = { osmId: item.venue.osmId!, name: item.venue.name, address: item.venue.address, lat: item.venue.lat!, lng: item.venue.lng! };
  } else {
    const known = await ctx.runQuery(internal.events.venues.findByName, { name: item.venue.name });
    if (known !== null) {
      place = { osmId: known.osmId, name: item.venue.name, address: item.venue.address, lat: known.lat, lng: known.lng };
    } else if (options.lookup) {
      const missKey = normalizeName(`${item.venue.name} ${item.venue.address}`);
      const knownMiss =
        options.misses.has(missKey) ||
        (await ctx.runQuery(internal.events.venues.isKnownMiss, { venueName: item.venue.name }));
      if (!knownMiss) {
        const query = [item.venue.name, item.venue.address].filter((part) => part.length > 0).join(", ");
        const found = (await searchPlaces(query, 3)).find((candidate) => placeMatches(item.venue, candidate));
        // The map's address wins over a scraped one with no street in it ("Oakland, CA").
        const address = /\d/.test(item.venue.address) ? item.venue.address : found?.address ?? "";
        if (found) place = { ...found, name: item.venue.name, address, alias: found.name };
        else options.misses.add(missKey);
      }
    }
  }
  if (place === null) return { reason: VENUE_NOT_FOUND };
  const result = await ctx.runMutation(internal.events.venues.resolve, {
    ...place,
    // The agent's spot was checked against the venue it placed; without that, the main entrance is used.
    spot: scoutPlaced ? item.meetingSpot : null,
    now,
  });
  return result.ok ? { venueId: result.venueId } : { reason: result.reason };
}

function toEventInput(item: ScoutItem, startsAt: number): EventInput {
  const price = priceFields(item);
  return {
    title: item.title.trim().slice(0, 200),
    kind: item.kind,
    startsAt,
    ...price,
    ticketUrl: isHttpUrl(item.ticketUrl) ? item.ticketUrl : undefined,
    freeEntryNote: cleanNote(item.freeEntryNote),
    sourceName: `${item.sourceKind}:${item.sourceName}`,
    sourceKind: item.sourceKind,
    sourceUrl: item.sourceUrl,
    performers: cleanList(item.performers),
    tags: cleanList(item.tags),
    ageLimit: item.ageLimit,
  };
}

export const run = internalAction({
  args: { importId: v.id("eventImports"), apifyRunId: v.string(), datasetId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { importId, apifyRunId, datasetId }) => {
    const { receivedAt } = await ctx.runMutation(internal.events.imports.markImporting, { importId });
    const apifyRun = await getRun(apifyRunId);
    if (apifyRun === null) throw new Error(`Apify run ${apifyRunId} was not found`);
    const raw = await listDatasetItems(datasetId ?? apifyRun.defaultDatasetId, CATALOG.maxItemsPerImport);
    const summary = await getRecord(apifyRun.defaultKeyValueStoreId, "OUTPUT").catch(() => null);

    const counts = { ...ZERO_COUNTS, received: raw.length };
    const errors: string[] = [];
    const items: ScoutItem[] = [];
    raw.forEach((value, index) => {
      const parsed = scoutItem.safeParse(value);
      if (parsed.success) items.push(parsed.data);
      else {
        counts.rejected += 1;
        errors.push(`Item ${index} doesn't match the save_event format: ${parsed.error.issues[0]?.message ?? "invalid"}`);
      }
    });

    const now = Date.now();
    const toEmbed: Id<"events">[] = [];
    const misses = new Set<string>();
    for (const item of items) {
      try {
        let rejectReason = basicRejectReason(item, now) ?? undefined;
        let rejectReasonIfCleared =
          rejectReason === ADULT_REASON ? (basicRejectReason(item, now, { ignoreAdult: true }) ?? undefined) : rejectReason;
        let venueId: Id<"venues"> | undefined;
        const venue = await resolveVenueFor(ctx, item, now, { lookup: rejectReasonIfCleared === undefined, misses });
        if ("venueId" in venue) venueId = venue.venueId;
        else {
          if (rejectReason === undefined) rejectReason = venue.reason;
          if (rejectReasonIfCleared === undefined) rejectReasonIfCleared = venue.reason;
        }
        // A rejected item without a start time still gets a stable row so its reason shows once.
        const dayOnly = Date.parse(item.startsAt?.slice(0, 10) ?? "");
        const startsAt = parseStart(item.startsAt) ?? (Number.isNaN(dayOnly) ? 0 : dayOnly);
        const result = await ctx.runMutation(internal.events.imports.upsertEvent, {
          event: toEventInput(item, startsAt),
          venueId,
          venueKey: venueId ?? `name:${normalizeName(item.venue.name)}`,
          rejectReason,
          rejectReasonIfCleared,
          apifyRunId,
          seenAt: receivedAt,
        });
        if (result.outcome === "published") counts.published += 1;
        else if (result.outcome === "updated") counts.updated += 1;
        else if (result.outcome === "rejected") counts.rejected += 1;
        else counts.duplicates += 1;
        if (result.needsEmbedding) toEmbed.push(result.eventId);
      } catch (error) {
        counts.rejected += 1;
        errors.push(`${item.title}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Voyage vectors; until they succeed, an event is matched on exact items only (§8.3).
    for (let i = 0; i < toEmbed.length; i += CATALOG.embedBatchSize) {
      const docs = await ctx.runQuery(internal.events.imports.documentsFor, {
        eventIds: toEmbed.slice(i, i + CATALOG.embedBatchSize),
      });
      if (docs.length === 0) continue;
      try {
        const vectors = await embed(docs.map((d) => d.text), "document");
        await ctx.runMutation(internal.events.imports.setEmbeddings, {
          rows: docs.map((d, j) => ({ eventId: d.eventId, embedding: vectors[j] })),
        });
      } catch (error) {
        errors.push(`Embedding failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    await ctx.runMutation(internal.events.imports.flagMissing, {
      receivedAt,
      sources: sourcesThatRan(summary, items),
      now,
    });
    await ctx.runMutation(internal.events.imports.finish, { importId, counts, errors });
    return null;
  },
});
