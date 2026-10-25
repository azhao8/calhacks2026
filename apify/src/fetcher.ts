import { gotScraping } from "got-scraping";
import { RobotsTxtFile } from "crawlee";
import { LIMITS, USER_AGENT } from "./config.js";
import { formatPage, htmlToText, plainToText, type PageText } from "./text.js";

// Polite page fetching for read_page: public pages only, robots rules and crawl delays respected per host,
// and Apify Proxy only when a public page blocks a plain request.

export type FetchResult = { ok: true; page: PageText; viaProxy: boolean } | { ok: false; error: string };

type HostState = { robots: RobotsTxtFile | null; delayMs: number; next: Promise<void> };

const ROBOTS_AGENT = "MelosEventScout";
const BLOCKED = new Set([401, 403, 429, 503]);

export function crawlDelayMs(robotsTxt: string): number | null {
  // The group for our agent wins over "*"; take the first Crawl-delay in the applicable group.
  const lines = robotsTxt.split(/\r?\n/).map((line) => line.replace(/#.*/, "").trim());
  let applies = false;
  let ours: number | null = null;
  let star: number | null = null;
  let inStar = false;
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      applies = value.toLowerCase() === ROBOTS_AGENT.toLowerCase();
      inStar = value === "*";
    } else if (key === "crawl-delay") {
      const seconds = Number(value);
      if (!Number.isFinite(seconds)) continue;
      if (applies && ours === null) ours = seconds * 1000;
      if (inStar && star === null) star = seconds * 1000;
    }
  }
  return ours ?? star;
}

export class PoliteFetcher {
  private hosts = new Map<string, HostState>();

  constructor(
    private readonly getProxyUrl: () => Promise<string | undefined>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async host(url: URL): Promise<HostState> {
    const existing = this.hosts.get(url.origin);
    if (existing) return existing;
    let robots: RobotsTxtFile | null = null;
    let delayMs: number = LIMITS.defaultCrawlDelayMs;
    try {
      const response = await this.fetchImpl(`${url.origin}/robots.txt`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(LIMITS.requestTimeoutMs),
      });
      if (response.ok) {
        const body = await response.text();
        robots = RobotsTxtFile.from(`${url.origin}/robots.txt`, body);
        const delay = crawlDelayMs(body);
        if (delay !== null) delayMs = Math.min(Math.max(delay, LIMITS.defaultCrawlDelayMs), LIMITS.maxCrawlDelayMs);
      }
    } catch {
      // No robots.txt reachable: proceed with the polite default delay.
    }
    const state: HostState = { robots, delayMs, next: Promise.resolve() };
    this.hosts.set(url.origin, state);
    return state;
  }

  // Requests to one host run one at a time, spaced by its crawl delay.
  private async slot(state: HostState): Promise<void> {
    const turn = state.next;
    let release!: () => void;
    state.next = new Promise((resolve) => (release = resolve));
    await turn;
    setTimeout(release, state.delayMs);
  }

  async allowed(url: string): Promise<boolean> {
    const parsed = new URL(url);
    const state = await this.host(parsed);
    return state.robots === null || state.robots.isAllowed(url, ROBOTS_AGENT);
  }

  async read(url: string, preferProxy = false): Promise<FetchResult> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, error: "Not a valid URL" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { ok: false, error: "Only http and https pages" };
    const state = await this.host(parsed);
    if (state.robots !== null && !state.robots.isAllowed(url, ROBOTS_AGENT)) {
      return { ok: false, error: "robots.txt disallows this page; skip it" };
    }
    await this.slot(state);
    if (!preferProxy) {
      try {
        const response = await this.fetchImpl(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/calendar,application/json;q=0.9,*/*;q=0.8" },
          redirect: "follow",
          signal: AbortSignal.timeout(LIMITS.requestTimeoutMs),
        });
        if (response.ok) return { ok: true, page: this.toPage(await response.text(), response.url || url, response.headers.get("content-type")), viaProxy: false };
        if (!BLOCKED.has(response.status)) return { ok: false, error: `The page answered ${response.status}` };
      } catch (error) {
        return { ok: false, error: `Couldn't load the page: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
    const proxyUrl = await this.getProxyUrl();
    if (!proxyUrl) return { ok: false, error: "The page blocks plain requests and no proxy is available" };
    try {
      const response = await gotScraping({ url, proxyUrl, timeout: { request: LIMITS.requestTimeoutMs }, throwHttpErrors: false });
      if (response.statusCode >= 400) return { ok: false, error: `The page answered ${response.statusCode} through the proxy` };
      return { ok: true, page: this.toPage(response.body, response.url, response.headers["content-type"] ?? null), viaProxy: true };
    } catch (error) {
      return { ok: false, error: `Couldn't load the page through the proxy: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private toPage(body: string, url: string, contentType: string | null): PageText {
    const looksHtml = (contentType ?? "").includes("html") || /^\s*<(!doctype|html)/i.test(body);
    return looksHtml ? htmlToText(body, url, LIMITS.linksPerPage) : plainToText(body, url);
  }
}

export function pageForModel(result: FetchResult, maxChars: number): string {
  return result.ok ? formatPage(result.page, maxChars) : `Error: ${result.error}`;
}
