import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { TIMING } from "../lib/config";
import { directionsUrl, metersBetween } from "../lib/format";
import { CATALOG, VENUE_NOT_FOUND } from "./config";
import { areaFor, distanceFromCampus, looksLikeAddress, normalizeName, sameShowTitles } from "./checks";

// Venues and meeting spots (CLAUDE.md §6.1). One venue per OpenStreetMap ID; one meeting spot per venue.

const vSpotInput = v.object({
  name: v.string(),
  howToFind: v.string(),
  lat: v.number(),
  lng: v.number(),
  osmId: v.union(v.string(), v.null()),
  isTransitStop: v.boolean(),
  travelMinutes: v.number(),
});

// The venues table is the geocoding cache: look a venue up by its name or any alias before asking the map.
export const findByName = internalQuery({
  args: { name: v.string() },
  returns: v.union(
    v.null(),
    v.object({ venueId: v.id("venues"), osmId: v.string(), lat: v.number(), lng: v.number() }),
  ),
  handler: async (ctx, { name }) => {
    const key = normalizeName(name);
    if (key.length === 0) return null;
    // The table is small (a few dozen venues), so a scan is fine.
    for (const venue of await ctx.db.query("venues").collect()) {
      if (normalizeName(venue.name) === key || venue.aliases.some((alias) => normalizeName(alias) === key)) {
        return { venueId: venue._id, osmId: venue.osmId, lat: venue.lat, lng: venue.lng };
      }
    }
    return null;
  },
});

// Map misses are cached as the rejected rows themselves: an event already rejected because its venue (keyed by
// name) wasn't on the map means the same lookup isn't repeated on the next run.
export const isKnownMiss = internalQuery({
  args: { venueName: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { venueName }) => {
    const prefix = `name:${normalizeName(venueName)}|`;
    const rows = await ctx.db
      .query("events")
      .withIndex("by_dedupeKey", (q) => q.gte("dedupeKey", prefix).lt("dedupeKey", `${prefix}\uffff`))
      .take(20);
    return rows.some((row) => row.rejectReason === VENUE_NOT_FOUND);
  },
});

// "Fox Theater, 1807, Telegraph Avenue, Uptown, Oakland, ..." gives "1807 Telegraph Avenue".
export function streetOf(address: string, venueName: string): string {
  const name = normalizeName(venueName);
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && normalizeName(part) !== name);
  if (parts.length === 0 || !/\d/.test(parts[0])) return "";
  if (/^\d+[a-z]?$/i.test(parts[0]) && parts[1]) return `${parts[0]} ${parts[1]}`;
  return parts[0];
}

async function nearbyTeamSpot(
  ctx: MutationCtx,
  point: { lat: number; lng: number },
): Promise<Doc<"meetingSpots"> | null> {
  const spots = await ctx.db.query("meetingSpots").collect();
  let best: Doc<"meetingSpots"> | null = null;
  let bestMeters = Infinity;
  for (const spot of spots) {
    if (spot.chosenBy !== "team") continue;
    const meters = metersBetween(spot, point);
    if (meters <= CATALOG.teamSpotReuseMeters && meters < bestMeters) {
      best = spot;
      bestMeters = meters;
    }
  }
  return best;
}

// The agent's spot if it follows the rules, or null.
async function agentSpot(
  ctx: MutationCtx,
  venue: Doc<"venues">,
  proposed: (typeof vSpotInput)["type"] | null,
  now: number,
): Promise<{ spotId: Id<"meetingSpots">; meetOffsetMinutes: number } | null> {
  const area = venue.area;
  if (proposed !== null) {
    const meters = metersBetween(proposed, venue);
    const transitOk =
      proposed.isTransitStop &&
      venue.distanceFromCampusMeters >= CATALOG.transitVenueMinMeters &&
      meters <= CATALOG.transitStopMaxMeters;
    const ok = meters <= CATALOG.spotMaxMeters || transitOk;
    if (ok) {
      const meetOffsetMinutes = TIMING.meetOffsetMinutes + (transitOk ? proposed.travelMinutes : 0);
      const team = await nearbyTeamSpot(ctx, proposed);
      if (team !== null) return { spotId: team._id, meetOffsetMinutes };
      const spotId = await ctx.db.insert("meetingSpots", {
        name: proposed.name.slice(0, 120),
        howToFind: proposed.howToFind.slice(0, 300),
        lat: proposed.lat,
        lng: proposed.lng,
        osmId: proposed.osmId ?? undefined,
        directionsUrl: directionsUrl(proposed.lat, proposed.lng),
        area,
        chosenBy: "agent",
        verifiedAt: now,
      });
      return { spotId, meetOffsetMinutes };
    }
  }
  return null;
}

function isEntranceFallback(spot: Doc<"meetingSpots"> | null, venue: Doc<"venues">): boolean {
  return spot !== null && spot.chosenBy === "agent" && spot.osmId === venue.osmId && spot.lat === venue.lat && spot.lng === venue.lng;
}

// The agent's spot if it follows the rules; otherwise the venue's main entrance.
async function chooseSpot(
  ctx: MutationCtx,
  venue: Doc<"venues">,
  proposed: (typeof vSpotInput)["type"] | null,
  now: number,
): Promise<{ spotId: Id<"meetingSpots">; meetOffsetMinutes: number }> {
  const chosen = await agentSpot(ctx, venue, proposed, now);
  if (chosen !== null) return chosen;
  const area = venue.area;
  const spotId = await ctx.db.insert("meetingSpots", {
    name: `Main entrance of ${venue.name}`,
    howToFind: `Out front of the main entrance of ${venue.name}${streetOf(venue.address, venue.name) ? ` on ${streetOf(venue.address, venue.name)}` : ""}.`,
    lat: venue.lat,
    lng: venue.lng,
    osmId: venue.osmId,
    directionsUrl: directionsUrl(venue.lat, venue.lng),
    area,
    chosenBy: "agent",
    verifiedAt: now,
  });
  return { spotId, meetOffsetMinutes: TIMING.meetOffsetMinutes };
}

// Moves a venue (and those of its events that used `fromSpotId`, or all of them) to a new meeting spot, carrying
// the change to every forming or set plan for those events. A spot a plan points to is never deleted, so a plan
// always keeps its meeting place; when the meeting offset changes, the plans are retimed.
export async function moveVenueSpot(
  ctx: MutationCtx,
  venue: Doc<"venues">,
  toSpotId: Id<"meetingSpots">,
  meetOffsetMinutes: number,
  options: { onlyFrom?: Id<"meetingSpots">; now: number },
): Promise<void> {
  await ctx.db.patch(venue._id, { meetingSpotId: toSpotId, meetOffsetMinutes, updatedAt: options.now });
  const events = await ctx.db
    .query("events")
    .withIndex("by_venue", (q) => q.eq("venueId", venue._id))
    .collect();
  for (const event of events) {
    if (options.onlyFrom !== undefined && event.meetingSpotId !== options.onlyFrom) continue;
    const retime = event.meetOffsetMinutes !== meetOffsetMinutes;
    await ctx.db.patch(event._id, { meetingSpotId: toSpotId, meetOffsetMinutes });
    for (const status of ["forming", "set"] as const) {
      const plans = await ctx.db
        .query("meetups")
        .withIndex("by_event_status", (q) => q.eq("eventId", event._id).eq("status", status))
        .collect();
      for (const plan of plans) await ctx.db.patch(plan._id, { meetingSpotId: toSpotId });
    }
    if (retime) await ctx.runMutation(internal.plans.retime.forEvent, { eventId: event._id });
  }
}

// Checks for the OSM ID before inserting, inside one transaction, so two imports at once can't create a duplicate.
export const resolve = internalMutation({
  args: {
    osmId: v.string(),
    name: v.string(),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    // The map's own name for the venue, kept as an alias.
    alias: v.optional(v.string()),
    spot: v.union(vSpotInput, v.null()),
    now: v.number(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), venueId: v.id("venues"), created: v.boolean() }),
    v.object({ ok: v.literal(false), reason: v.string() }),
  ),
  handler: async (ctx, args) => {
    // One venue can sit under two OSM IDs (a building way and an amenity node a few meters apart): a venue within
    // about 150 m whose name or aliases match is the same venue. The table is small, so a scan is fine.
    const existing =
      (await ctx.db
        .query("venues")
        .withIndex("by_osmId", (q) => q.eq("osmId", args.osmId))
        .unique()) ??
      (await ctx.db.query("venues").collect()).find(
        (venue) =>
          metersBetween(venue, args) <= CATALOG.sameVenueMeters &&
          [venue.name, ...venue.aliases].some((known) =>
            [args.name, args.alias ?? ""].some(
              (name) => name.length > 0 && sameShowTitles(normalizeName(known), normalizeName(name)),
            ),
          ),
      ) ??
      null;
    let venue: Doc<"venues">;
    let created = false;
    // Students see "{title} at {venue}", so the display name is a real name whenever we have one; a street
    // address ("2121 Allston Way") is kept as an alias instead.
    const candidates = [args.name, args.alias ?? ""].map((name) => name.trim()).filter((name) => name.length > 0);
    const realName = candidates.find((name) => !looksLikeAddress(name));
    if (existing !== null) {
      venue = existing;
      const rename = looksLikeAddress(existing.name) && realName !== undefined;
      const name = rename ? realName! : existing.name;
      const known = new Set([name].map(normalizeName));
      const aliases: string[] = [];
      for (const alias of [...existing.aliases, existing.name, ...candidates]) {
        if (!known.has(normalizeName(alias))) {
          known.add(normalizeName(alias));
          aliases.push(alias);
        }
      }
      if (rename || aliases.length !== existing.aliases.length) {
        await ctx.db.patch(existing._id, { name, aliases, updatedAt: args.now });
        venue = { ...existing, name, aliases };
      }
    } else {
      const area = areaFor(args);
      if (area === null) return { ok: false as const, reason: "Venue is outside our areas" };
      const venueId = await ctx.db.insert("venues", {
        osmId: args.osmId,
        name: realName ?? args.name,
        aliases: candidates.filter(
          (name, i) =>
            normalizeName(name) !== normalizeName(realName ?? args.name) &&
            candidates.findIndex((other) => normalizeName(other) === normalizeName(name)) === i,
        ),
        address: args.address,
        lat: args.lat,
        lng: args.lng,
        area,
        distanceFromCampusMeters: distanceFromCampus(args),
        meetOffsetMinutes: TIMING.meetOffsetMinutes,
        createdAt: args.now,
        updatedAt: args.now,
      });
      venue = (await ctx.db.get(venueId))!;
      created = true;
    }
    if (venue.meetingSpotId === undefined) {
      const { spotId, meetOffsetMinutes } = await chooseSpot(ctx, venue, args.spot, args.now);
      await ctx.db.patch(venue._id, { meetingSpotId: spotId, meetOffsetMinutes, updatedAt: args.now });
    } else if (args.spot !== null) {
      // The agent may attach its spot to any of a venue's events: a valid spot replaces the main-entrance
      // fallback, never a spot the agent or the team already chose.
      const current = await ctx.db.get(venue.meetingSpotId);
      if (isEntranceFallback(current, venue)) {
        const chosen = await agentSpot(ctx, venue, args.spot, args.now);
        if (chosen !== null) {
          // The old fallback row stays: past plans may still point to it.
          await moveVenueSpot(ctx, venue, chosen.spotId, chosen.meetOffsetMinutes, {
            onlyFrom: venue.meetingSpotId,
            now: args.now,
          });
        }
      }
    }
    return { ok: true as const, venueId: venue._id, created };
  },
});
