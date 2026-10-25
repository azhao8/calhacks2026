import type { Doc } from "../_generated/dataModel";
import { MATCHING } from "../lib/config";
import { PAIR } from "./config";

// Pure pair-scoring helpers (CLAUDE.md §6.3). No database access here, so they're easy to test.

export type ItemKind = "artist" | "track" | "label";
export type SharedItem = { kind: ItemKind; name: string; weight: number };
export type Fingerprint = Doc<"tasteProfiles">["fingerprint"];

// Shared with onboarding, so demo and real fingerprints compare alike.
export { normalizeName } from "../lib/normalize";

// Built once per fingerprint object, so scoring every pair in a pool doesn't rebuild them.
const setCache = new WeakMap<Fingerprint, Record<ItemKind, Set<string>>>();

export function itemSets(fingerprint: Fingerprint): Record<ItemKind, Set<string>> {
  const cached = setCache.get(fingerprint);
  if (cached) return cached;
  const sets = {
    artist: new Set([...fingerprint.topArtists, ...fingerprint.likedArtists]),
    track: new Set(fingerprint.tracks),
    label: new Set(fingerprint.labels),
  };
  setCache.set(fingerprint, sets);
  return sets;
}

export const ITEM_KINDS: ItemKind[] = ["artist", "track", "label"];

export function itemKey(kind: ItemKind, name: string): string {
  return `${kind}:${name}`;
}

// How many of our own students have each item (Spotify no longer reports popularity).
export function documentFrequency(fingerprints: Fingerprint[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const fingerprint of fingerprints) {
    const sets = itemSets(fingerprint);
    for (const kind of ITEM_KINDS) {
      for (const name of sets[kind]) {
        const key = itemKey(kind, name);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return counts;
}

// 1 for an item only these two share; close to 0 for one everybody has.
export function rarityWeight(sharedBy: number, students: number): number {
  const n = Math.max(students, 2);
  const df = Math.min(Math.max(sharedBy, 2), n);
  return Math.log(n / df + 1) / Math.log(n / 2 + 1);
}

export function sharedItems(
  a: Fingerprint,
  b: Fingerprint,
  frequency: Map<string, number>,
  students: number,
): SharedItem[] {
  const setsA = itemSets(a);
  const setsB = itemSets(b);
  const shared: SharedItem[] = [];
  for (const kind of ITEM_KINDS) {
    for (const name of setsA[kind]) {
      if (!setsB[kind].has(name)) continue;
      const weight = rarityWeight(frequency.get(itemKey(kind, name)) ?? 2, students);
      shared.push({ kind, name, weight });
    }
  }
  // Rarest first, then by name, so hooks and logs are deterministic.
  return shared.sort((x, y) => y.weight - x.weight || x.kind.localeCompare(y.kind) || x.name.localeCompare(y.name));
}

export function cosine(a: number[] | undefined, b: number[] | undefined): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

const YEAR_ORDER: Record<NonNullable<Doc<"users">["year"]>, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth_plus: 4,
  grad: 5,
};

export function similarYear(
  a: { year?: Doc<"users">["year"]; prefersSimilarYear: boolean },
  b: { year?: Doc<"users">["year"]; prefersSimilarYear: boolean },
): boolean {
  if (!a.year || !b.year) return false;
  if (!a.prefersSimilarYear && !b.prefersSimilarYear) return false;
  return Math.abs(YEAR_ORDER[a.year] - YEAR_ORDER[b.year]) <= 1;
}

// "Who you'd like to meet" must accept the other person. Someone who prefers not to say (or didn't
// answer) is only accepted by people open to anyone.
export function accepts(meetWho: Doc<"preferences">["meetWho"], other: Doc<"users">["gender"]): boolean {
  if (meetWho === "anyone") return true;
  if (other === undefined || other === "prefer_not_to_say") return false;
  return meetWho.includes(other);
}

export type PairScore = {
  score: number;
  similarity: number;
  shared: SharedItem[];
  sharedScore: number;
  yearBoost: number;
  waitingBoost: number;
};

export function pairScore(input: {
  similarity: number;
  shared: SharedItem[];
  similarYear: boolean;
  waitingRuns: number;
}): PairScore {
  const w = MATCHING.weights;
  const rawShared = input.shared.reduce((sum, item) => sum + item.weight, 0);
  // Squash so a long list of common items can't swamp everything else.
  const sharedScore = 1 - Math.exp(-rawShared);
  const yearBoost = input.similarYear ? w.similarYear : 0;
  const waitingBoost = Math.min(input.waitingRuns, PAIR.waitingRunsCap) * w.waitingPerRun;
  const score = w.similarity * input.similarity + w.sharedItems * sharedScore + yearBoost + waitingBoost;
  return { score, similarity: input.similarity, shared: input.shared, sharedScore, yearBoost, waitingBoost };
}
