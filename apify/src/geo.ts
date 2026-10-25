import { GEO } from "./config.js";

// find_place: OpenStreetMap Nominatim with its usage policy (at most 1 request per second across the whole
// run, an identifying User-Agent, and cached results).

export type Place = {
  osmId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
};

export type PlaceCache = {
  get(key: string): Promise<Place[] | null>;
  set(key: string, value: Place[]): Promise<void>;
};

type NominatimResult = {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  class?: string;
  type?: string;
};

export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export class Geocoder {
  private queue: Promise<void> = Promise.resolve();
  private memory = new Map<string, Place[]>();

  constructor(
    private readonly cache: PlaceCache | null,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly intervalMs: number = GEO.minIntervalMs,
  ) {}

  // Serializes every request in the run and spaces them by the interval.
  private async turn(): Promise<void> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise((resolve) => (release = resolve));
    await previous;
    setTimeout(release, this.intervalMs);
  }

  async search(query: string, near?: { lat: number; lng: number }, limit = 5): Promise<Place[]> {
    const key = `${query.trim().toLowerCase()}|${near ? `${near.lat.toFixed(3)},${near.lng.toFixed(3)}` : ""}|${limit}`;
    const remembered = this.memory.get(key) ?? (await this.cache?.get(key)) ?? null;
    if (remembered) {
      this.memory.set(key, remembered);
      return remembered;
    }
    await this.turn();
    const params = new URLSearchParams({ q: query, format: "jsonv2", limit: String(limit), addressdetails: "0" });
    if (near) {
      const d = 0.05;
      params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
    }
    const response = await this.fetchImpl(`${GEO.nominatimUrl}?${params}`, { headers: { "User-Agent": GEO.userAgent } });
    if (!response.ok) throw new Error(`The map lookup answered ${response.status}`);
    const results = (await response.json()) as NominatimResult[];
    const places = results.map((r) => ({
      osmId: `${r.osm_type}/${r.osm_id}`,
      name: r.name || r.display_name.split(",")[0],
      address: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
      category: [r.category ?? r.class, r.type].filter(Boolean).join("/"),
    }));
    this.memory.set(key, places);
    await this.cache?.set(key, places);
    return places;
  }
}
