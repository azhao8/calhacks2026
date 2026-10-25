// @ts-expect-error edmonds-blossom ships no types: (edges: [i, j, weight][], maxCardinality) => mate[]
import edmondsBlossom from "edmonds-blossom";
import { PAIR } from "./config";

type Blossom = (edges: [number, number, number][], maxCardinality?: boolean) => number[];
const blossom = edmondsBlossom as Blossom;

// Maximum-weight matching that first pairs as many people as possible (CLAUDE.md §6.4).
// `keys` are sorted first, so the same input always gives the same pairs.
export function maxMatching<Key extends string>(
  keys: Key[],
  edges: { a: Key; b: Key; score: number }[],
): [Key, Key][] {
  const sorted = [...keys].sort();
  const index = new Map(sorted.map((key, i) => [key, i]));
  const numbered = edges
    .map((edge) => {
      const i = index.get(edge.a)!;
      const j = index.get(edge.b)!;
      // Integer weights keep the algorithm's slack checks exact. +1 so a zero score is still an edge.
      return [Math.min(i, j), Math.max(i, j), Math.round(edge.score * PAIR.weightScale) + 1] as [number, number, number];
    })
    .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  if (numbered.length === 0) return [];
  const mate = blossom(numbered, true);
  const pairs: [Key, Key][] = [];
  for (let i = 0; i < mate.length; i++) {
    const j = mate[i];
    if (j !== undefined && j > i) pairs.push([sorted[i], sorted[j]]);
  }
  return pairs;
}
