import type { Doc } from "../_generated/dataModel";
import type { SpotifyListening } from "../services/spotify";
import type { TasteInput } from "../ai/taste";
import { ANALYSIS } from "../lib/config";
import { normalizeName, normalizeTrackKey, uniqueSorted } from "./normalize";

// Pure helpers that turn listening data into what Claude, Voyage, and the matcher see (§6.3, §7).

export type SnapshotFields = Pick<Doc<"tasteSnapshots">, "topArtists" | "topTracks" | "likedSongs">;

const INPUT_ARTISTS = 30;
const INPUT_TRACKS = 30;
const INPUT_LIKED_ARTISTS = 30;
const INPUT_GENRES = 20;

// Listening data plus normalized names next to the Spotify IDs. Demo fixtures come through here too.
export function toSnapshotFields(listening: SpotifyListening): SnapshotFields {
  return {
    topArtists: listening.topArtists.map((artist) => ({ ...artist, normalizedName: normalizeName(artist.name) })),
    topTracks: listening.topTracks.map((track) => ({
      ...track,
      normalizedKey: normalizeTrackKey(track.name, track.artistNames),
    })),
    likedSongs: listening.likedSongs,
  };
}

// Distinct artists across every source; fewer than ANALYSIS.minDistinctArtists means too little data.
export function distinctArtistCount(snapshot: SnapshotFields): number {
  const names = new Set<string>();
  for (const artist of snapshot.topArtists) names.add(artist.normalizedName);
  for (const track of snapshot.topTracks) for (const name of track.artistNames) names.add(normalizeName(name));
  for (const song of snapshot.likedSongs) for (const name of song.artistNames) names.add(normalizeName(name));
  names.delete("");
  return names.size;
}

// Top artists merged across ranges: a high rank in either range counts, and showing up in both counts more.
export function rankedTopArtists(snapshot: SnapshotFields): string[] {
  const scores = new Map<string, { name: string; score: number }>();
  for (const artist of snapshot.topArtists) {
    const entry = scores.get(artist.normalizedName) ?? { name: artist.name, score: 0 };
    entry.score += 51 - Math.min(artist.rank, 50);
    scores.set(artist.normalizedName, entry);
  }
  return [...scores.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).map((e) => e.name);
}

function likedArtistCounts(snapshot: SnapshotFields): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const song of snapshot.likedSongs) {
    for (const name of song.artistNames) {
      const key = normalizeName(name);
      if (!key) continue;
      const entry = counts.get(key) ?? { name, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function tasteInput(snapshot: SnapshotFields): TasteInput {
  const seenTracks = new Set<string>();
  const topTracks: string[] = [];
  for (const track of [...snapshot.topTracks].sort((a, b) => a.rank - b.rank)) {
    if (seenTracks.has(track.normalizedKey)) continue;
    seenTracks.add(track.normalizedKey);
    topTracks.push(`${track.name} by ${track.artistNames.join(", ")}`);
  }
  const genres = uniqueSorted(snapshot.topArtists.flatMap((artist) => artist.genres));
  return {
    topArtists: rankedTopArtists(snapshot).slice(0, INPUT_ARTISTS),
    topTracks: topTracks.slice(0, INPUT_TRACKS),
    likedArtists: likedArtistCounts(snapshot).slice(0, INPUT_LIKED_ARTISTS),
    genres: genres.slice(0, INPUT_GENRES),
  };
}

// Normalized sets for exact shared items and hook validation. Server-only.
export function fingerprint(snapshot: SnapshotFields, labels: string[]): Doc<"tasteProfiles">["fingerprint"] {
  return {
    topArtists: uniqueSorted(snapshot.topArtists.map((artist) => artist.normalizedName)),
    likedArtists: uniqueSorted(snapshot.likedSongs.flatMap((song) => song.artistNames.map(normalizeName))),
    tracks: uniqueSorted([
      ...snapshot.topTracks.map((track) => track.normalizedKey),
      ...snapshot.likedSongs.map((song) => normalizeTrackKey(song.name, song.artistNames)),
    ]),
    labels: uniqueSorted(labels),
  };
}

// What Voyage embeds for a student (§6.3): the summary, labels, up to 10 artists, and any correction.
export function tasteDocument(
  profile: Pick<Doc<"tasteProfiles">, "summary" | "labels" | "artists" | "correction">,
  snapshot: SnapshotFields | null,
): string {
  const artists = [...profile.artists];
  if (snapshot) {
    for (const name of [...rankedTopArtists(snapshot), ...likedArtistCounts(snapshot).map((a) => a.name)]) {
      if (artists.length >= ANALYSIS.documentArtistsMax) break;
      if (!artists.some((existing) => normalizeName(existing) === normalizeName(name))) artists.push(name);
    }
  }
  const lines = [
    `Music taste: ${profile.summary}`,
    `Labels: ${profile.labels.join(", ")}`,
    `Artists: ${artists.slice(0, ANALYSIS.documentArtistsMax).join(", ")}`,
  ];
  if (profile.correction) lines.push(`In their own words: ${profile.correction}`);
  return lines.join("\n");
}
