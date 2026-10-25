import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { directionsUrl, metersBetween } from "./lib/format";

const SEEDED_SPOT_RADIUS_M = 50;

// Idempotent base data: schools and the team's known meeting spots (CLAUDE.md §8.5).
// Run with: npx convex run seed:run
// Demo students are seeded by stream C (convex/demo), never here.

const SCHOOLS = [
  {
    name: "UC Berkeley",
    emailDomains: ["berkeley.edu"],
    timezone: "America/Los_Angeles",
    city: "Berkeley, CA",
    colors: ["#003262", "#FDB515"],
    status: "open" as const,
    themeId: "berkeley",
  },
  {
    name: "UCLA",
    emailDomains: ["ucla.edu"],
    timezone: "America/Los_Angeles",
    city: "Los Angeles, CA",
    colors: ["#2774AE", "#FFD100"],
    status: "soon" as const,
    themeId: "ucla",
  },
  {
    name: "Stanford",
    emailDomains: ["stanford.edu"],
    timezone: "America/Los_Angeles",
    city: "Stanford, CA",
    colors: ["#8C1515", "#FFFFFF"],
    status: "soon" as const,
    themeId: "stanford",
  },
];

// Busy public places the event agent may reuse; approximate coordinates.
const TEAM_SPOTS = [
  {
    name: "Sather Gate",
    howToFind: "The bronze gate on Sather Road, at the south edge of campus.",
    lat: 37.8703,
    lng: -122.2595,
    area: "campus" as const,
  },
  {
    name: "Downtown Berkeley BART plaza",
    howToFind: "The open plaza at Shattuck Ave and Center St, by the station entrance.",
    lat: 37.8701,
    lng: -122.2681,
    area: "berkeley_oakland" as const,
  },
  {
    name: "Memorial Glade",
    howToFind: "The big lawn in front of Doe Library, by the glade steps.",
    lat: 37.873,
    lng: -122.2593,
    area: "campus" as const,
  },
  {
    name: "19th St Oakland BART plaza",
    howToFind: "The street-level entrance at Broadway and 19th St, across from the Paramount.",
    lat: 37.808,
    lng: -122.269,
    area: "bart" as const,
  },
];

export const run = internalMutation({
  args: {},
  returns: v.object({ schools: v.number(), spots: v.number() }),
  handler: async (ctx) => {
    let schools = 0;
    for (const school of SCHOOLS) {
      const existing = await ctx.db
        .query("universities")
        .withIndex("by_themeId", (q) => q.eq("themeId", school.themeId))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, school);
      } else {
        await ctx.db.insert("universities", school);
        schools += 1;
      }
    }
    let spots = 0;
    for (const spot of TEAM_SPOTS) {
      const doc = { ...spot, directionsUrl: directionsUrl(spot.lat, spot.lng), chosenBy: "team" as const };
      // Names aren't unique: a team override or an agent spot elsewhere can share a seeded spot's name.
      // The seeded row is the oldest team spot of that name near the seeded point; others are left alone.
      const existing =
        (
          await ctx.db
            .query("meetingSpots")
            .withIndex("by_name", (q) => q.eq("name", spot.name))
            .collect()
        ).find((row) => row.chosenBy === "team" && metersBetween(row, spot) <= SEEDED_SPOT_RADIUS_M) ?? null;
      if (existing) {
        await ctx.db.patch(existing._id, doc);
      } else {
        await ctx.db.insert("meetingSpots", doc);
        spots += 1;
      }
    }
    return { schools, spots };
  },
});
