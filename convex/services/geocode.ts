import { CATALOG } from "../events/config";

// The one module that talks to OpenStreetMap Nominatim (CLAUDE.md §6.1). Call it only from actions.
// Nominatim's policy: at most 1 request per second, an identifying User-Agent, and cached results.
// The venues table is the cache; callers look there first and call this only for venues we don't know.

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Melos/1.0 (hello@melos.azhao.dev)";

export type Place = {
  osmId: string; // "way/123456"
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type NominatimResult = {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
};

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = lastRequestAt + CATALOG.geocodeIntervalMs - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

// Up to `limit` places for a free-text query, biased to the Bay Area.
export async function searchPlaces(query: string, limit = 3): Promise<Place[]> {
  await throttle();
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: String(limit),
    countrycodes: "us",
    viewbox: "-122.75,38.2,-121.75,37.3",
  });
  const response = await fetch(`${ENDPOINT}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Nominatim search failed with ${response.status}`);
  const results = (await response.json()) as NominatimResult[];
  return results.map((result) => ({
    osmId: `${result.osm_type}/${result.osm_id}`,
    name: result.name || result.display_name.split(",")[0],
    address: result.display_name,
    lat: Number(result.lat),
    lng: Number(result.lon),
  }));
}
