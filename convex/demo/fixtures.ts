import type { Doc } from "../_generated/dataModel";
import { normalizeName, normalizeTrackKey } from "../lib/normalize";

// Six demo students with fictional first names and generated, Spotify-like listening data (§6.7).
// Their emails use the reserved .invalid domain, so nobody is ever emailed. They share only phone
// numbers from the reserved 555-0100 to 555-0199 range, never an Instagram handle.

type Track = [name: string, artist: string];

export type DemoFixture = {
  key: string;
  firstName: string;
  gender: NonNullable<Doc<"users">["gender"]>;
  year: NonNullable<Doc<"users">["year"]>;
  // Stand-ins for the taste summary until stream A's pipeline writes real ones.
  summary: string;
  labels: string[];
  topArtists: string[];
  topTracks: Track[];
  likedSongs: Track[];
};

export const DEMO_FIXTURES: DemoFixture[] = [
  {
    key: "demo-1",
    firstName: "Maya",
    gender: "woman",
    year: "third",
    summary: "Quiet, lyric heavy indie with a soft spot for live folk.",
    labels: ["indie folk", "singer songwriter", "bedroom pop"],
    topArtists: ["Big Thief", "Phoebe Bridgers", "Adrianne Lenker", "Mitski", "boygenius", "Japanese Breakfast", "Bon Iver", "Fleet Foxes", "Clairo", "Soccer Mommy"],
    topTracks: [["Not", "Big Thief"], ["Motion Sickness", "Phoebe Bridgers"], ["Nobody", "Mitski"], ["Be Sweet", "Japanese Breakfast"], ["Holocene", "Bon Iver"], ["Sofia", "Clairo"]],
    likedSongs: [["Simulation Swarm", "Big Thief"], ["Kyoto", "Phoebe Bridgers"], ["Not Strong Enough", "boygenius"], ["White Winter Hymnal", "Fleet Foxes"], ["anything", "Adrianne Lenker"]],
  },
  {
    key: "demo-2",
    firstName: "Theo",
    gender: "man",
    year: "second",
    summary: "West coast rap and warm R&B, with plenty of Bay Area pride.",
    labels: ["hip hop", "alternative r&b", "bay area rap"],
    topArtists: ["Kendrick Lamar", "SZA", "Tyler, The Creator", "Frank Ocean", "Steve Lacy", "Mac Dre", "E-40", "Larry June", "Daniel Caesar", "Kali Uchis"],
    topTracks: [["Not Like Us", "Kendrick Lamar"], ["Saturn", "SZA"], ["See You Again", "Tyler, The Creator"], ["Pink + White", "Frank Ocean"], ["Bad Habit", "Steve Lacy"], ["Tell Me Lies", "Larry June"]],
    likedSongs: [["Feel the Love", "Mac Dre"], ["Tell Me When to Go", "E-40"], ["Get You", "Daniel Caesar"], ["Telepatía", "Kali Uchis"], ["Nights", "Frank Ocean"]],
  },
  {
    key: "demo-3",
    firstName: "Priya",
    gender: "woman",
    year: "first",
    summary: "Big choruses and bright pop, from stadium anthems to club ready hits.",
    labels: ["pop", "dance pop", "synth pop"],
    topArtists: ["Chappell Roan", "Charli xcx", "Sabrina Carpenter", "Olivia Rodrigo", "Taylor Swift", "Dua Lipa", "Carly Rae Jepsen", "Troye Sivan", "Lorde", "SZA"],
    topTracks: [["Good Luck, Babe", "Chappell Roan"], ["360", "Charli xcx"], ["Espresso", "Sabrina Carpenter"], ["drivers license", "Olivia Rodrigo"], ["Cruel Summer", "Taylor Swift"], ["Green Light", "Lorde"]],
    likedSongs: [["Levitating", "Dua Lipa"], ["Run Away With Me", "Carly Rae Jepsen"], ["Rush", "Troye Sivan"], ["Kill Bill", "SZA"], ["Pink Pony Club", "Chappell Roan"]],
  },
  {
    key: "demo-4",
    firstName: "Jonah",
    gender: "man",
    year: "fourth_plus",
    summary: "Guitar bands old and new, from garage rock to psychedelic grooves.",
    labels: ["indie rock", "psychedelic rock", "garage rock"],
    topArtists: ["Arctic Monkeys", "The Strokes", "Tame Impala", "Radiohead", "Mac DeMarco", "Khruangbin", "Phoebe Bridgers", "Vampire Weekend", "The Smiths", "Big Thief"],
    topTracks: [["Do I Wanna Know?", "Arctic Monkeys"], ["Reptilia", "The Strokes"], ["The Less I Know the Better", "Tame Impala"], ["Weird Fishes", "Radiohead"], ["Chamber of Reflection", "Mac DeMarco"], ["Harmony Hall", "Vampire Weekend"]],
    likedSongs: [["Maria También", "Khruangbin"], ["There Is a Light That Never Goes Out", "The Smiths"], ["Not", "Big Thief"], ["Let It Happen", "Tame Impala"], ["Motion Sickness", "Phoebe Bridgers"]],
  },
  {
    key: "demo-5",
    firstName: "Rowan",
    gender: "non_binary",
    year: "grad",
    summary: "Late night electronic music, from melodic house to bass heavy sets.",
    labels: ["house", "electronic", "uk garage"],
    topArtists: ["Fred again..", "Kaytranada", "Four Tet", "Jamie xx", "Disclosure", "ODESZA", "Bonobo", "Floating Points", "Caribou", "Charli xcx"],
    topTracks: [["Delilah (pull me out of this)", "Fred again.."], ["10%", "Kaytranada"], ["Baby", "Four Tet"], ["Gosh", "Jamie xx"], ["Latch", "Disclosure"], ["Can't Do Without You", "Caribou"]],
    likedSongs: [["A Moment Apart", "ODESZA"], ["Kerala", "Bonobo"], ["Last Bloom", "Floating Points"], ["Marea (we've lost dancing)", "Fred again.."], ["Von dutch", "Charli xcx"]],
  },
  {
    key: "demo-6",
    firstName: "Lucía",
    gender: "prefer_not_to_say",
    year: "second",
    summary: "Reggaeton and Latin pop with a love for anything you can dance to.",
    labels: ["reggaeton", "latin pop", "latin trap"],
    topArtists: ["Bad Bunny", "Karol G", "Rosalía", "Peso Pluma", "Rauw Alejandro", "J Balvin", "Kali Uchis", "Feid", "Tainy", "Dua Lipa"],
    topTracks: [["Tití Me Preguntó", "Bad Bunny"], ["Provenza", "Karol G"], ["Despechá", "Rosalía"], ["Ella Baila Sola", "Peso Pluma"], ["Todo de Ti", "Rauw Alejandro"], ["Normal", "Feid"]],
    likedSongs: [["Mi Gente", "J Balvin"], ["Telepatía", "Kali Uchis"], ["Me Porto Bonito", "Bad Bunny"], ["Levitating", "Dua Lipa"], ["Safaera", "Bad Bunny"]],
  },
];

export function demoEmail(key: string): string {
  return `${key}@melos.invalid`;
}

// (510) 555-0101 to (510) 555-0106: all inside the reserved 555-0100 to 555-0199 range.
export function demoPhone(key: string): string | null {
  const index = DEMO_FIXTURES.findIndex((fixture) => fixture.key === key);
  if (index < 0) return null;
  return `(510) 555-01${String(index + 1).padStart(2, "0")}`;
}

function slug(text: string): string {
  return normalizeName(text).replace(/ /g, "-");
}

// The same key real students get from their Spotify data (lib/normalize), so demo and real tracks can match.
export function trackKey(name: string, artist: string): string {
  return normalizeTrackKey(name, [artist]);
}

// The same stand-in in the shape of a Spotify fetch, for onboarding's analyzeFixture (no normalized fields:
// onboarding derives them itself, exactly as it does for real students).
export function demoListening(fixture: DemoFixture) {
  const snapshot = demoSnapshot(fixture);
  return {
    topArtists: snapshot.topArtists.map(({ spotifyId, name, genres, rank, range }) => ({ spotifyId, name, genres, rank, range })),
    topTracks: snapshot.topTracks.map(({ spotifyId, name, artistNames, rank, range }) => ({ spotifyId, name, artistNames, rank, range })),
    likedSongs: snapshot.likedSongs,
  };
}

// The generated stand-in for a Spotify fetch, in the tasteSnapshots shape.
export function demoSnapshot(fixture: DemoFixture) {
  const artistId = (name: string) => `demo-artist-${slug(name)}`;
  const topArtists = fixture.topArtists.flatMap((name, i) => {
    const base = { spotifyId: artistId(name), name, normalizedName: normalizeName(name), genres: [] as string[], rank: i + 1 };
    return i < 6
      ? [
          { ...base, range: "short_term" as const },
          { ...base, range: "medium_term" as const },
        ]
      : [{ ...base, range: "medium_term" as const }];
  });
  const topTracks = fixture.topTracks.map(([name, artist], i) => ({
    spotifyId: `demo-track-${slug(name)}-${slug(artist)}`,
    name,
    normalizedKey: trackKey(name, artist),
    artistNames: [artist],
    rank: i + 1,
    range: "short_term" as const,
  }));
  const likedSongs = fixture.likedSongs.map(([name, artist]) => ({
    spotifyId: `demo-track-${slug(name)}-${slug(artist)}`,
    name,
    artistIds: [artistId(artist)],
    artistNames: [artist],
  }));
  return { topArtists, topTracks, likedSongs };
}

export function demoFingerprint(fixture: DemoFixture) {
  return {
    topArtists: [...new Set(fixture.topArtists.map(normalizeName))],
    likedArtists: [...new Set(fixture.likedSongs.map(([, artist]) => normalizeName(artist)))],
    tracks: [...new Set([...fixture.topTracks, ...fixture.likedSongs].map(([name, artist]) => trackKey(name, artist)))],
    labels: fixture.labels,
  };
}
