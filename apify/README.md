# Event Scout

Event Scout is an AI agent that finds **real, upcoming, public events** near a place and returns them in one strict, structured format: verified venue, explicit start time, a price with the page it came from (or an honest "not found"), the official ticket or RSVP link, performers, age limit, and a safe meeting spot near the venue.

It was built for [Melos](https://melos.azhao.dev), which pairs two students who listen to similar music and sends them to a show together. Melos needs events it can trust without a person checking each one, so the scout never invents a price, time, venue, or availability.

## What it does

- Runs **one agent per source, in parallel**: venue websites crawled with Crawlee, official feeds (like an athletics ICS calendar), ticketing listings, and open-web search. A source that fails is skipped; the others continue.
- Each agent (Claude, through the Anthropic SDK's tool runner) uses four tools:
  - `read_page` fetches public pages, respects robots.txt and crawl delays, and uses Apify Proxy only for public pages that block plain requests.
  - `search_web` uses Apify's Google Search Scraper to discover listings or find a missing price.
  - `find_place` looks places up on OpenStreetMap Nominatim (at most one request per second, cached).
  - `save_event` checks every event against a strict schema before it reaches the dataset.
- **Prices** are taken from the listing, then the official ticket page, then a web search. The source is recorded. If none shows a price, the event is still saved with `price.source = "not_found"`.
- **Meeting spots** (one per venue): busy, public, well lit, within about a 3 minute walk (250 m) of the entrance, never a bar, 21+ space, or residence, described in one sentence, and confirmed on the map. For long trips it may choose a transit station and records the walk time. When no spot can be confirmed, `meetingSpot` is null and the venue's main entrance is the fallback.
- Text from web pages is treated as data, never as instructions.

## Input

| Field | Default | Notes |
| --- | --- | --- |
| `place` | Berkeley, CA | The area to scout |
| `daysAhead` | 14 | 1 to 31 days |
| `startDate` | today | Optional first day |
| `eventTypes` | concert, game, performance | Also `other` |
| `sources` | all | Built-in Berkeley and Oakland presets, plus `web` for any place |
| `customSources` | none | Your own listing pages: `{ "name", "url", "kind"?, "useProxy"? }` |
| `maxEventsPerSource` | 25 | Soonest first |
| `anthropicApiKey` | | Required: your own Anthropic API key (stored as a secret) |

Outside the Bay Area, set `place`, choose `sources: ["web"]`, and add your city's venue calendars under `customSources`.

## Output

Each dataset item is one event:

```json
{
  "title": "Indie folk night",
  "kind": "concert",
  "startsAt": "2026-10-29T20:00:00-07:00",
  "venue": { "name": "The UC Theatre", "address": "2036 University Ave, Berkeley, CA", "osmId": "way/123456", "lat": 37.8716, "lng": -122.2707 },
  "price": { "min": 22, "max": 30, "source": "ticket_page", "sourceUrl": "https://..." },
  "ticketUrl": "https://...",
  "freeEntryNote": null,
  "performers": ["..."],
  "tags": ["indie folk"],
  "ageLimit": null,
  "meetingSpot": {
    "name": "Bench left of the main doors",
    "howToFind": "The bench left of the main doors on University Ave.",
    "lat": 37.8717, "lng": -122.2709, "osmId": null,
    "isTransitStop": false, "travelMinutes": 0
  },
  "sourceUrl": "https://...",
  "sourceName": "uc_theatre",
  "sourceKind": "venue_site",
  "scrapedAt": "2026-10-25T13:00:00.000Z"
}
```

`startsAt` is null when a listing shows no start time; `ageLimit` is null for all ages. The run's `OUTPUT` record in the key-value store summarizes each source: status, events saved, pages read, and any error.

## Cost

Apify usage is small (page fetches, a few Google searches per source, and Apify Proxy only for blocked sites). The model is billed to your Anthropic key; each source makes up to 40 model turns, and older page reads are cleared from context as it goes.

## Responsible use

The scout reads only public pages that need no login, follows robots.txt and crawl delays, identifies itself, and prefers official feeds. Check each site's terms before scheduling it. Map data © OpenStreetMap contributors.
