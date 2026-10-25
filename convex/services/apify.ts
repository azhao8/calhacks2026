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

async function call(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Apify ${path.split("?")[0]} failed with ${response.status}: ${await response.text()}`);
  }
  return response;
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
