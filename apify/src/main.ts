import Anthropic from "@anthropic-ai/sdk";
import { Actor, log } from "apify";
import { CheerioCrawler, RequestQueue } from "crawlee";
import { runAgent, type AgentRequest } from "./agent.js";
import { GEO, LIMITS, SEARCH_ACTOR } from "./config.js";
import { PoliteFetcher } from "./fetcher.js";
import { Geocoder, type Place, type PlaceCache } from "./geo.js";
import type { ScoutItem } from "./schema.js";
import { selectSources, type CustomSource, type Source } from "./sources.js";
import { formatPage, htmlToText, plainToText } from "./text.js";
import { makeTools, RunState, type SearchResult, type ToolCounters } from "./tools.js";

type Input = {
  place?: string;
  daysAhead?: number;
  startDate?: string;
  eventTypes?: string[];
  sources?: string[];
  customSources?: CustomSource[];
  maxEventsPerSource?: number;
  anthropicApiKey?: string;
};

type SourceSummary = {
  name: string;
  kind: string;
  status: "succeeded" | "failed";
  saved: number;
  refused: number;
  reads: number;
  searches: number;
  iterations: number;
  error?: string;
};

const DAY = 24 * 60 * 60 * 1000;

// The key comes from the run's input. The owner's own runs (the daily schedule and "Find events now") use
// the owner's secret; anyone else running the published actor brings their own key.
function anthropicKey(input: Input): string | undefined {
  if (input.anthropicApiKey) return input.anthropicApiKey;
  const owner = process.env.MELOS_OWNER_USER_ID;
  if (owner && process.env.APIFY_USER_ID === owner) return process.env.MELOS_ANTHROPIC_API_KEY;
  return undefined;
}

async function placeCache(): Promise<PlaceCache> {
  const store = await Actor.openKeyValueStore(GEO.cacheStore);
  const keyFor = (key: string) => `q-${Buffer.from(key).toString("base64url").slice(0, 200)}`;
  return {
    get: async (key) => (await store.getValue<Place[]>(keyFor(key))) ?? null,
    set: async (key, value) => store.setValue(keyFor(key), value),
  };
}

async function searchWeb(query: string): Promise<SearchResult[]> {
  const run = await Actor.call(
    SEARCH_ACTOR,
    { queries: query, maxPagesPerQuery: 1, resultsPerPage: LIMITS.searchResultsPerQuery, countryCode: "us", languageCode: "en" },
    { memory: 512 },
  );
  const { items } = await Actor.apifyClient.dataset(run.defaultDatasetId).listItems();
  const results: SearchResult[] = [];
  for (const item of items as { organicResults?: { title?: string; url?: string; description?: string }[] }[]) {
    for (const r of item.organicResults ?? []) {
      if (r.url) results.push({ title: r.title ?? "", url: r.url, description: (r.description ?? "").slice(0, 300) });
    }
  }
  return results.slice(0, LIMITS.searchResultsPerQuery);
}

// Listing pages for one source, crawled with Crawlee (robots rules respected, one request per host at a time).
async function crawlListings(source: Source, runKey: string): Promise<string[]> {
  if (source.startUrls.length === 0) return [];
  const name = `listings-${runKey}-${source.id}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 63).replace(/-+$/, "");
  const queue = await RequestQueue.open(name);
  const pages: string[] = [];
  const crawler = new CheerioCrawler({
    requestQueue: queue,
    respectRobotsTxtFile: true,
    maxRequestsPerCrawl: LIMITS.listingPagesPerSource,
    maxRequestRetries: 1,
    maxConcurrency: 1,
    sameDomainDelaySecs: LIMITS.defaultCrawlDelayMs / 1000,
    requestHandlerTimeoutSecs: 60,
    additionalMimeTypes: ["text/calendar", "text/plain", "application/json", "application/rss+xml", "application/xml", "text/xml"],
    proxyConfiguration: source.useProxy ? await Actor.createProxyConfiguration() : undefined,
    requestHandler: async ({ request, body, contentType }) => {
      const text = typeof body === "string" ? body : body.toString("utf8");
      const url = request.loadedUrl ?? request.url;
      const page = contentType.type.includes("html") ? htmlToText(text, url, LIMITS.linksPerPage) : plainToText(text, url);
      pages.push(formatPage(page, LIMITS.listingChars));
    },
    failedRequestHandler: ({ request }, error) => {
      log.warning(`${source.id}: couldn't load ${request.url}: ${error.message}`);
    },
  });
  await crawler.run(source.startUrls.slice(0, LIMITS.listingPagesPerSource));
  await queue.drop();
  return pages;
}

async function inPool<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
  });
  await Promise.all(workers);
}

await Actor.main(async () => {
  const input = ((await Actor.getInput<Input>()) ?? {}) as Input;
  const apiKey = anthropicKey(input);
  if (!apiKey) {
    await Actor.fail("Add your Anthropic API key in the input (anthropicApiKey). It is stored as a secret.");
    return;
  }
  const client = new Anthropic({ apiKey });
  const place = input.place?.trim() || "Berkeley, CA";
  const eventTypes = input.eventTypes?.length ? input.eventTypes : ["concert", "game", "performance"];
  const from = input.startDate ? new Date(input.startDate) : new Date();
  const days = Math.min(Math.max(input.daysAhead ?? 14, 1), 31);
  const window = { from: from.getTime(), to: from.getTime() + days * DAY };
  const maxEvents = Math.min(Math.max(input.maxEventsPerSource ?? 25, 1), 100);
  const sources = selectSources(input.sources, input.customSources);
  const runKey = (process.env.ACTOR_RUN_ID ?? `local${Date.now()}`).toLowerCase();

  const proxyConfiguration = sources.some((s) => s.useProxy) ? await Actor.createProxyConfiguration() : undefined;
  const fetcher = new PoliteFetcher(async () => proxyConfiguration?.newUrl());
  const geocoder = new Geocoder(await placeCache());
  const run = new RunState();
  const summaries: SourceSummary[] = [];
  log.info(`Scouting ${sources.length} sources for ${place}, ${days} days ahead`);

  await inPool(sources, LIMITS.sourceConcurrency, async (source) => {
    const counters: ToolCounters = { reads: 0, searches: 0, places: 0, saved: 0, refused: 0 };
    const summary: SourceSummary = { name: source.id, kind: source.kind, status: "succeeded", saved: 0, refused: 0, reads: 0, searches: 0, iterations: 0 };
    try {
      const listings = await crawlListings(source, runKey);
      if (source.startUrls.length > 0 && listings.length === 0) throw new Error("No listing page could be loaded");
      const tools = makeTools(
        {
          source,
          fetcher,
          geocoder,
          search: searchWeb,
          save: async (item: ScoutItem) => Actor.pushData(item),
          run,
          window,
          maxEvents,
        },
        counters,
      );
      const request: AgentRequest = { source, place, eventTypes, window: { from: new Date(window.from), to: new Date(window.to) }, listings, maxEvents };
      const result = await runAgent(client, tools, request);
      summary.iterations = result.iterations;
      if (result.stopReason === "refusal") throw new Error("The model declined this source");
      log.info(`${source.id}: saved ${counters.saved} events in ${result.iterations} turns`);
    } catch (error) {
      // A source that fails is skipped; the others continue.
      summary.status = "failed";
      summary.error = error instanceof Error ? error.message : String(error);
      log.warning(`${source.id} failed: ${summary.error}`);
    }
    Object.assign(summary, { saved: counters.saved, refused: counters.refused, reads: counters.reads, searches: counters.searches });
    summaries.push(summary);
  });

  const saved = summaries.reduce((sum, s) => sum + s.saved, 0);
  await Actor.setValue("OUTPUT", {
    place,
    window: { from: new Date(window.from).toISOString(), to: new Date(window.to).toISOString() },
    saved,
    sources: summaries,
  });
  if (summaries.every((s) => s.status === "failed")) {
    await Actor.fail("Every source failed; see OUTPUT for the reasons.");
    return;
  }
  log.info(`Done: ${saved} events from ${summaries.filter((s) => s.status === "succeeded").length} of ${summaries.length} sources`);
});
