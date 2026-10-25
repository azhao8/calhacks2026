// The one module that talks to Apify (CLAUDE.md §8.1). Call it only from actions.
// Plain REST calls keep it in Convex's default runtime; no student data is ever sent (§8.4).

const API = "https://api.apify.com/v2";

export type ApifyRun = {
  id: string;
  status: string;
  defaultDatasetId: string;
  defaultKeyValueStoreId: string;
};

function token(): string {
  const value = process.env.APIFY_TOKEN;
  if (!value) throw new Error("APIFY_TOKEN is not set on this Convex deployment");
  return value;
}

// An Apify refusal, with its HTTP status (402 or 429 when the plan's concurrent-run or memory limit is full).
export class ApifyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok && response.status !== 404) {
    throw new ApifyError(`Apify ${path.split("?")[0]} failed with ${response.status}: ${await response.text()}`, response.status);
  }
  return response;
}

// The plan's limits are full (a run plus its search runs can fill all concurrent slots): try again later.
export function isBusyRefusal(error: unknown): boolean {
  return error instanceof ApifyError && (error.status === 402 || error.status === 429);
}

// This actor's runs that are starting or running, newest first.
export async function activeRuns(actorId: string): Promise<{ id: string; startedAt: number }[]> {
  const response = await call(`/acts/${encodeURIComponent(actorId)}/runs?status=READY,RUNNING&desc=true&limit=5`);
  if (response.status === 404) return [];
  const body = (await response.json()) as { data: { items: { id: string; startedAt: string }[] } };
  return body.data.items.map((item) => ({ id: item.id, startedAt: Date.parse(item.startedAt) }));
}

export async function getRun(runId: string): Promise<ApifyRun | null> {
  const response = await call(`/actor-runs/${encodeURIComponent(runId)}`);
  if (response.status === 404) return null;
  const body = (await response.json()) as { data: ApifyRun };
  return body.data;
}

// Every item of a dataset, a page at a time.
export async function listDatasetItems(datasetId: string, maxItems: number): Promise<unknown[]> {
  const items: unknown[] = [];
  const pageSize = 500;
  while (items.length < maxItems) {
    const limit = Math.min(pageSize, maxItems - items.length);
    const response = await call(
      `/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&offset=${items.length}&limit=${limit}`,
    );
    if (response.status === 404) break;
    const page = (await response.json()) as unknown[];
    items.push(...page);
    if (page.length < limit) break;
  }
  return items;
}

// A JSON record from a key-value store, or null when it doesn't exist.
export async function getRecord(storeId: string, key: string): Promise<unknown> {
  const response = await call(`/key-value-stores/${encodeURIComponent(storeId)}/records/${encodeURIComponent(key)}`);
  if (response.status === 404) return null;
  return await response.json();
}

// The scout actor, as "username~actor-name" (or its ID), from APIFY_SCOUT_ACTOR.
export function scoutActorId(): string {
  return process.env.APIFY_SCOUT_ACTOR ?? "prolific_moccasin_3df~melos-event-scout";
}

// Starts a run and returns at once; the run's webhook brings the results back (§8.2 Events).
export async function startRun(actorId: string, input: Record<string, unknown>): Promise<ApifyRun> {
  const response = await call(`/acts/${encodeURIComponent(actorId)}/runs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (response.status === 404) throw new Error(`Apify actor ${actorId} was not found`);
  const body = (await response.json()) as { data: ApifyRun };
  return body.data;
}
