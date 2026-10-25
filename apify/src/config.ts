// The scout's one configuration: model, effort, and limits. Change values here, never inline.

export const MODEL = {
  id: "claude-opus-5-5",
  // Higher effort for the scout: it reads messy pages and must never invent details.
  effort: "high",
  maxTokens: 16000,
  maxIterations: 40,
  // A safety refusal retries on another model instead of failing the source.
  fallbackBeta: "server-side-fallback-2026-07-01",
  contextBeta: "context-management-2025-06-27",
} as const;

export const LIMITS = {
  // Characters of page text handed to the model per page.
  listingChars: 24000,
  pageChars: 12000,
  linksPerPage: 120,
  listingPagesPerSource: 3,
  readsPerSource: 30,
  searchesPerSource: 4,
  searchResultsPerQuery: 10,
  sourceConcurrency: 4,
  requestTimeoutMs: 30000,
  // Polite defaults when robots.txt sets no crawl delay.
  defaultCrawlDelayMs: 1500,
  maxCrawlDelayMs: 10000,
} as const;

export const GEO = {
  nominatimUrl: "https://nominatim.openstreetmap.org/search",
  userAgent: "Melos/1.0 (hello@melos.azhao.dev)",
  // Nominatim allows at most 1 request per second.
  minIntervalMs: 1100,
  spotMaxMeters: 250,
  cacheStore: "melos-geocode-cache",
} as const;

export const SEARCH_ACTOR = "apify/google-search-scraper";

export const USER_AGENT = "MelosEventScout/1.0 (+https://melos.azhao.dev; hello@melos.azhao.dev)";
