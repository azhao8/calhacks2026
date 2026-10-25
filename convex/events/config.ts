// Event catalog constants (CLAUDE.md §6.1). Timing lives in convex/lib/config.ts; these are the catalog's own rules.

export const CATALOG = {
  // A meeting spot must be confirmed on the map within this distance of the venue, unless it is a transit stop.
  spotMaxMeters: 250,
  // A transit stop may replace the nearby spot only for a venue this far from campus, and only this close to it.
  transitVenueMinMeters: 5000,
  transitStopMaxMeters: 1500,
  // An agent spot this close to a team-seeded spot reuses the team spot.
  teamSpotReuseMeters: 60,
  // A venue this close with a matching name is the same venue under another OpenStreetMap ID.
  sameVenueMeters: 150,
  // Upcoming events missing from two runs in a row are flagged, never deleted.
  missingRunsToFlag: 2,
  // Nominatim allows at most 1 request per second.
  geocodeIntervalMs: 1100,
  maxItemsPerImport: 2000,
  embedBatchSize: 64,
} as const;

// Areas (§6.1): `campus` is a short walk from Sather Gate; `berkeley_oakland` is a box around both cities;
// `bart` is anywhere within BART's reach of campus. A venue outside all three is rejected.
export const AREAS = {
  campusMaxMeters: 1300,
  berkeleyOaklandBox: { minLat: 37.735, maxLat: 37.905, minLng: -122.33, maxLng: -122.15 },
  bartMaxMeters: 55000,
} as const;

export const PULLED_REASON = "Pulled by the team";
export const ADULT_REASON = "21+ event";
export const VENUE_NOT_FOUND = "Venue not found on the map";
// Rejections no later import can undo; the team can restore a pulled event.
export const DUPLICATE_REASON = "Duplicate of another event";
export const STICKY_REASONS = new Set<string>([PULLED_REASON, ADULT_REASON, DUPLICATE_REASON]);

// "Most official source wins" when two sources describe the same event. Higher wins.
export const SOURCE_RANK: Record<string, number> = {
  official_feed: 4,
  venue_site: 3,
  listing: 2,
  web: 1,
};
