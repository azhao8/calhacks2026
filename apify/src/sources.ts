import type { SourceKind } from "./schema.js";

// One copy of the agent runs per source (CLAUDE.md §6.1). Presets cover Berkeley and Oakland;
// anyone can add their own listing pages with `customSources`, and `web` searches the open web.

export type Source = {
  id: string;
  name: string;
  kind: SourceKind;
  startUrls: string[];
  // Public pages that block plain requests are fetched through Apify Proxy.
  useProxy: boolean;
  note?: string;
};

export const PRESET_SOURCES: Source[] = [
  {
    id: "cal_performances",
    name: "Cal Performances",
    kind: "venue_site",
    startUrls: ["https://calperformances.org/events/"],
    useProxy: false,
  },
  {
    id: "uc_theatre",
    name: "The UC Theatre",
    kind: "venue_site",
    startUrls: ["https://www.theuctheatre.org/"],
    useProxy: false,
  },
  {
    id: "greek_theatre",
    name: "The Greek Theatre",
    kind: "venue_site",
    startUrls: ["https://thegreekberkeley.com/events/"],
    useProxy: false,
  },
  {
    id: "fox_theater",
    name: "The Fox Theater",
    kind: "venue_site",
    startUrls: ["https://thefoxoakland.com/events/"],
    useProxy: false,
  },
  {
    id: "freight_and_salvage",
    name: "Freight & Salvage",
    kind: "venue_site",
    startUrls: ["https://thefreight.org/shows/"],
    useProxy: true,
  },
  {
    id: "uc_berkeley_events",
    name: "UC Berkeley events calendar",
    kind: "venue_site",
    startUrls: ["https://events.berkeley.edu/"],
    useProxy: false,
    note: "Campus events. Keep public performances, concerts, and games; skip lectures, classes, and internal meetings.",
  },
  {
    id: "cal_athletics",
    name: "Cal Athletics",
    kind: "official_feed",
    startUrls: ["https://calbears.com/calendar.ashx/calendar.ics", "https://calbears.com/calendar"],
    useProxy: false,
    note: "The official Cal Athletics calendar. Keep home games that sell tickets or are free to attend.",
  },
  {
    id: "eventbrite",
    name: "Eventbrite",
    kind: "listing",
    startUrls: [
      "https://www.eventbrite.com/d/ca--berkeley/music--events/",
      "https://www.eventbrite.com/d/ca--oakland/music--events/",
    ],
    useProxy: true,
    note: "A ticketing marketplace. Keep public music and performance events; the Eventbrite page is the official ticket link.",
  },
  {
    id: "web",
    name: "Open web",
    kind: "web",
    startUrls: [],
    useProxy: false,
    note: "No start pages: use search_web to discover events, then confirm each one on an official page.",
  },
];

export type CustomSource = { name: string; url: string; kind?: SourceKind; useProxy?: boolean };

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

export function selectSources(ids: string[] | undefined, custom: CustomSource[] | undefined): Source[] {
  const wanted = ids && ids.length > 0 ? new Set(ids) : new Set(PRESET_SOURCES.map((s) => s.id));
  const chosen = PRESET_SOURCES.filter((source) => wanted.has(source.id));
  for (const entry of custom ?? []) {
    let host = "custom";
    try {
      host = new URL(entry.url).hostname;
    } catch {
      continue;
    }
    chosen.push({
      id: slug(entry.name || host),
      name: entry.name || host,
      kind: entry.kind ?? "venue_site",
      startUrls: [entry.url],
      useProxy: entry.useProxy ?? false,
    });
  }
  return chosen;
}
