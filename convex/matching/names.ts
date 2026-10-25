import type { Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";
import type { HookItem } from "../ai/hooks";
import { normalizeName, type SharedItem } from "./taste";
import { normalizeTrackKey } from "../lib/normalize";

// Fingerprints hold normalized names; hooks show the names as Spotify spells them.
export async function hookItems(
  db: DatabaseReader,
  shared: SharedItem[],
  userIds: Id<"users">[],
): Promise<HookItem[]> {
  const artists = new Map<string, string>();
  const tracks = new Map<string, string>();
  for (const userId of userIds) {
    const profile = await db
      .query("tasteProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    for (const name of profile?.artists ?? []) artists.set(normalizeName(name), name);
    const snapshot = await db
      .query("tasteSnapshots")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (snapshot === null) continue;
    for (const artist of snapshot.topArtists) artists.set(artist.normalizedName, artist.name);
    for (const track of snapshot.topTracks) tracks.set(track.normalizedKey, track.name);
    for (const song of snapshot.likedSongs) {
      for (const name of song.artistNames) if (!artists.has(normalizeName(name))) artists.set(normalizeName(name), name);
      // Liked songs are in the fingerprint's tracks too, under the same key onboarding builds.
      const key = normalizeTrackKey(song.name, song.artistNames);
      if (!tracks.has(key)) tracks.set(key, song.name);
    }
  }
  return shared.map((item) => {
    if (item.kind === "artist") return { kind: item.kind, name: artists.get(item.name) ?? item.name };
    // A key is "title|artist"; without a spelling on file, show the title, never the raw key.
    if (item.kind === "track") return { kind: item.kind, name: tracks.get(item.name) ?? item.name.split("|")[0] };
    return { kind: item.kind, name: item.name };
  });
}
