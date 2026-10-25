import type { DemoFixture } from "./fixtures";

// Generated demo students (§6.7), on demand from the admin page. Everything here is pure and seeded by the
// demoKey, so a student's listening data is reproducible (the fallback profile rebuilds it from the key)
// yet different for every new key. Names are fictional first names only; there is never a last name.

export const GENERATED_PREFIX = "gen-";

// Over 100 first names from many backgrounds. Fictional students, never real people.
export const NAME_POOL: readonly string[] = [
  "Ava", "Ben", "Chloe", "Diego", "Elena", "Felix", "Grace", "Hugo", "Isla", "Jonah",
  "Kira", "Leo", "Mila", "Nico", "Olive", "Pablo", "Quinn", "Rosa", "Sami", "Tara",
  "Uma", "Victor", "Wren", "Ximena", "Yara", "Zane", "Aiko", "Bao", "Carmen", "Dev",
  "Esme", "Farid", "Gia", "Hana", "Ines", "Jae", "Kofi", "Lina", "Mateo", "Nadia",
  "Omar", "Priya", "Rafael", "Sana", "Tomas", "Ulla", "Valeria", "Wei", "Yusuf", "Zara",
  "Amara", "Bodhi", "Cyrus", "Dalia", "Emeka", "Freya", "Gabriel", "Hiro", "Imani", "Jasper",
  "Keanu", "Layla", "Malik", "Noor", "Oscar", "Paloma", "Reza", "Selin", "Tavi", "Valentina",
  "Wanjiru", "Yosef", "Zoe", "Arjun", "Beatriz", "Callum", "Daniela", "Eitan", "Fatima", "Gustavo",
  "Hazel", "Ivan", "Juniper", "Kai", "Luca", "Marisol", "Nina", "Orion", "Pia", "Ravi",
  "Soren", "Thandi", "Uriel", "Vera", "Willa", "Xavier", "Yuna", "Zion", "Anika", "Bruno",
  "Celeste", "Dante", "Eliza", "Femi", "Gwen", "Haruto", "Ingrid", "Jamal", "Keiko", "Lorenzo",
  "Mei", "Nalani", "Otis", "Quan", "Rumi", "Sienna", "Teo", "Viktor", "Yasmin", "Zuri",
];

type Cluster = {
  // One clause for the stand-in summary.
  blurb: string;
  // From TASTE_LABELS (convex/ai/labels.ts).
  labels: string[];
  artists: { name: string; tracks: string[] }[];
};

// Real artist names grouped into scenes. Track titles are well known songs by each artist.
export const CLUSTERS: readonly Cluster[] = [
  {
    blurb: "soft spoken indie folk",
    labels: ["indie folk", "singer songwriter", "acoustic", "melancholy"],
    artists: [
      { name: "Big Thief", tracks: ["Not", "Paul"] },
      { name: "Phoebe Bridgers", tracks: ["Motion Sickness", "Kyoto"] },
      { name: "Bon Iver", tracks: ["Holocene", "Skinny Love"] },
      { name: "Fleet Foxes", tracks: ["White Winter Hymnal", "Mykonos"] },
      { name: "Sufjan Stevens", tracks: ["Chicago", "Mystery of Love"] },
      { name: "Adrianne Lenker", tracks: ["anything", "zombie girl"] },
      { name: "Iron & Wine", tracks: ["Naked As We Came", "Flightless Bird, American Mouth"] },
      { name: "boygenius", tracks: ["Not Strong Enough", "Me & My Dog"] },
    ],
  },
  {
    blurb: "bright, hook heavy pop",
    labels: ["pop", "dance pop", "sing along anthems", "upbeat"],
    artists: [
      { name: "Chappell Roan", tracks: ["Good Luck, Babe", "Pink Pony Club"] },
      { name: "Sabrina Carpenter", tracks: ["Espresso", "Please Please Please"] },
      { name: "Olivia Rodrigo", tracks: ["drivers license", "good 4 u"] },
      { name: "Dua Lipa", tracks: ["Levitating", "Don't Start Now"] },
      { name: "Taylor Swift", tracks: ["Cruel Summer", "Anti-Hero"] },
      { name: "Charli xcx", tracks: ["360", "Von dutch"] },
      { name: "Carly Rae Jepsen", tracks: ["Run Away With Me", "Call Me Maybe"] },
      { name: "Troye Sivan", tracks: ["Rush", "My My My!"] },
    ],
  },
  {
    blurb: "west coast rap",
    labels: ["hip hop", "west coast rap", "bay area rap", "bass heavy"],
    artists: [
      { name: "Kendrick Lamar", tracks: ["Not Like Us", "Alright"] },
      { name: "Mac Dre", tracks: ["Feel the Love", "Thizzle Dance"] },
      { name: "E-40", tracks: ["Tell Me When to Go", "Choices (Yup)"] },
      { name: "Larry June", tracks: ["Tell Me Lies", "Smoothies In 1991"] },
      { name: "Tyler, The Creator", tracks: ["See You Again", "EARFQUAKE"] },
      { name: "Kamaiyah", tracks: ["How Does It Feel", "Freaky Freaky"] },
      { name: "Nipsey Hussle", tracks: ["Racks in the Middle", "Double Up"] },
      { name: "Vince Staples", tracks: ["Norf Norf", "Big Fish"] },
    ],
  },
  {
    blurb: "warm alternative R&B",
    labels: ["r&b", "alternative r&b", "neo soul", "late night"],
    artists: [
      { name: "SZA", tracks: ["Saturn", "Good Days"] },
      { name: "Frank Ocean", tracks: ["Pink + White", "Nights"] },
      { name: "Daniel Caesar", tracks: ["Get You", "Best Part"] },
      { name: "Steve Lacy", tracks: ["Bad Habit", "Dark Red"] },
      { name: "H.E.R.", tracks: ["Focus", "Best Part"] },
      { name: "Kali Uchis", tracks: ["Telepatía", "After the Storm"] },
      { name: "Erykah Badu", tracks: ["On & On", "Tyrone"] },
      { name: "Brent Faiyaz", tracks: ["Dead Man Walking", "Clouded"] },
    ],
  },
  {
    blurb: "late night house and electronic",
    labels: ["electronic", "house", "uk garage", "dance floor"],
    artists: [
      { name: "Fred again..", tracks: ["Delilah (pull me out of this)", "Marea (we've lost dancing)"] },
      { name: "Kaytranada", tracks: ["10%", "Glowed Up"] },
      { name: "Four Tet", tracks: ["Baby", "Two Thousand and Seventeen"] },
      { name: "Jamie xx", tracks: ["Gosh", "Loud Places"] },
      { name: "Disclosure", tracks: ["Latch", "You & Me"] },
      { name: "Caribou", tracks: ["Can't Do Without You", "Odessa"] },
      { name: "Bonobo", tracks: ["Kerala", "Cirrus"] },
      { name: "ODESZA", tracks: ["A Moment Apart", "Say My Name"] },
    ],
  },
  {
    blurb: "guitar driven indie rock",
    labels: ["indie rock", "garage rock", "guitar driven", "high energy"],
    artists: [
      { name: "Arctic Monkeys", tracks: ["Do I Wanna Know?", "R U Mine?"] },
      { name: "The Strokes", tracks: ["Reptilia", "Last Nite"] },
      { name: "Vampire Weekend", tracks: ["Harmony Hall", "A-Punk"] },
      { name: "The Killers", tracks: ["Mr. Brightside", "When You Were Young"] },
      { name: "Wet Leg", tracks: ["Chaise Longue", "Wet Dream"] },
      { name: "Alvvays", tracks: ["Archie, Marry Me", "Belinda Says"] },
      { name: "Car Seat Headrest", tracks: ["Drunk Drivers/Killer Whales", "Fill in the Blank"] },
      { name: "Pavement", tracks: ["Harness Your Hopes", "Cut Your Hair"] },
    ],
  },
  {
    blurb: "dreamy psychedelic grooves",
    labels: ["psychedelic rock", "dream pop", "dreamy", "chill"],
    artists: [
      { name: "Tame Impala", tracks: ["The Less I Know the Better", "Let It Happen"] },
      { name: "Khruangbin", tracks: ["Maria También", "People Everywhere (Still Alive)"] },
      { name: "Mac DeMarco", tracks: ["Chamber of Reflection", "My Kind of Woman"] },
      { name: "Beach House", tracks: ["Space Song", "Myth"] },
      { name: "Men I Trust", tracks: ["Show Me How", "Tailwhip"] },
      { name: "Unknown Mortal Orchestra", tracks: ["Multi-Love", "Hunnybee"] },
      { name: "Cocteau Twins", tracks: ["Heaven or Las Vegas", "Cherry-coloured Funk"] },
      { name: "Mild High Club", tracks: ["Homage", "Windowpane"] },
    ],
  },
  {
    blurb: "reggaeton and Latin pop",
    labels: ["reggaeton", "latin pop", "latin trap", "dance floor"],
    artists: [
      { name: "Bad Bunny", tracks: ["Tití Me Preguntó", "Me Porto Bonito"] },
      { name: "Karol G", tracks: ["Provenza", "TQG"] },
      { name: "Rosalía", tracks: ["Despechá", "Malamente"] },
      { name: "Rauw Alejandro", tracks: ["Todo de Ti", "Lokera"] },
      { name: "J Balvin", tracks: ["Mi Gente", "Ginza"] },
      { name: "Feid", tracks: ["Normal", "Classy 101"] },
      { name: "Tainy", tracks: ["Callaita", "Lo Siento BB:/"] },
      { name: "Young Miko", tracks: ["Classy 101", "Lisa"] },
    ],
  },
  {
    blurb: "regional Mexican and corridos",
    labels: ["regional mexican", "corridos", "cumbia", "game day energy"],
    artists: [
      { name: "Peso Pluma", tracks: ["Ella Baila Sola", "LA BEBE"] },
      { name: "Natanael Cano", tracks: ["AMG", "Porte Exuberante"] },
      { name: "Fuerza Regida", tracks: ["TQM", "Bebe Dame"] },
      { name: "Grupo Frontera", tracks: ["un x100to", "No Se Va"] },
      { name: "Junior H", tracks: ["El Azul", "Y Lloro"] },
      { name: "Carin León", tracks: ["Primera Cita", "Que Vuelvas"] },
      { name: "Eslabon Armado", tracks: ["Ella Baila Sola", "Jugaste y Sufrí"] },
      { name: "Los Ángeles Azules", tracks: ["Nunca Es Suficiente", "17 Años"] },
    ],
  },
  {
    blurb: "K pop with big choreography",
    labels: ["k pop", "dance pop", "high energy", "playful"],
    artists: [
      { name: "NewJeans", tracks: ["Super Shy", "Ditto"] },
      { name: "BTS", tracks: ["Dynamite", "Spring Day"] },
      { name: "BLACKPINK", tracks: ["Pink Venom", "How You Like That"] },
      { name: "TWICE", tracks: ["Fancy", "What is Love?"] },
      { name: "SEVENTEEN", tracks: ["Super", "Don't Wanna Cry"] },
      { name: "aespa", tracks: ["Supernova", "Next Level"] },
      { name: "Stray Kids", tracks: ["S-Class", "God's Menu"] },
      { name: "LE SSERAFIM", tracks: ["ANTIFRAGILE", "Perfect Night"] },
    ],
  },
  {
    blurb: "afrobeats and amapiano",
    labels: ["afrobeats", "amapiano", "afropop", "sunny"],
    artists: [
      { name: "Burna Boy", tracks: ["Last Last", "Ye"] },
      { name: "Wizkid", tracks: ["Essence", "Come Closer"] },
      { name: "Tems", tracks: ["Free Mind", "Me & U"] },
      { name: "Rema", tracks: ["Calm Down", "Dumebi"] },
      { name: "Ayra Starr", tracks: ["Rush", "Bloody Samaritan"] },
      { name: "Tyla", tracks: ["Water", "Truth or Dare"] },
      { name: "Asake", tracks: ["Lonely At The Top", "Terminator"] },
      { name: "Davido", tracks: ["Unavailable", "Fall"] },
    ],
  },
  {
    blurb: "jazz from bebop to the modern scene",
    labels: ["jazz", "jazz fusion", "instrumental", "mellow"],
    artists: [
      { name: "Miles Davis", tracks: ["So What", "Blue in Green"] },
      { name: "John Coltrane", tracks: ["Naima", "Giant Steps"] },
      { name: "Kamasi Washington", tracks: ["Truth", "Street Fighter Mas"] },
      { name: "Thelonious Monk", tracks: ["'Round Midnight", "Straight, No Chaser"] },
      { name: "Esperanza Spalding", tracks: ["I Know You Know", "Black Gold"] },
      { name: "Robert Glasper", tracks: ["Afro Blue", "Black Radio"] },
      { name: "Bill Evans", tracks: ["Peace Piece", "Waltz for Debby"] },
      { name: "Snarky Puppy", tracks: ["Lingus", "Shofukan"] },
    ],
  },
  {
    blurb: "punk and emo with loud choruses",
    labels: ["punk", "emo", "pop punk", "intense"],
    artists: [
      { name: "Green Day", tracks: ["Basket Case", "Welcome to Paradise"] },
      { name: "Paramore", tracks: ["Misery Business", "Still into You"] },
      { name: "My Chemical Romance", tracks: ["Welcome to the Black Parade", "Helena"] },
      { name: "Turnstile", tracks: ["MYSTERY", "HOLIDAY"] },
      { name: "American Football", tracks: ["Never Meant", "Honestly?"] },
      { name: "Jawbreaker", tracks: ["Accident Prone", "Boxcar"] },
      { name: "Fall Out Boy", tracks: ["Sugar, We're Goin Down", "Dance, Dance"] },
      { name: "Mannequin Pussy", tracks: ["Romantic", "I Got Heaven"] },
    ],
  },
  {
    blurb: "country and Americana",
    labels: ["country", "americana", "alt country", "nostalgic"],
    artists: [
      { name: "Zach Bryan", tracks: ["Something in the Orange", "I Remember Everything"] },
      { name: "Kacey Musgraves", tracks: ["Slow Burn", "Rainbow"] },
      { name: "Tyler Childers", tracks: ["All Your'n", "Feathered Indians"] },
      { name: "Sturgill Simpson", tracks: ["Turtles All the Way Down", "Breakers Roar"] },
      { name: "Brandi Carlile", tracks: ["The Story", "The Joke"] },
      { name: "Chris Stapleton", tracks: ["Tennessee Whiskey", "Starting Over"] },
      { name: "Waxahatchee", tracks: ["Right Back to It", "Lilac"] },
      { name: "Jason Isbell", tracks: ["Cover Me Up", "If We Were Vampires"] },
    ],
  },
];

export const GENDERS = ["woman", "man", "non_binary", "woman", "man", "prefer_not_to_say"] as const;
export const YEARS = ["first", "second", "third", "fourth_plus", "grad"] as const;

// A small seeded RNG (mulberry32) keyed on a string.
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function isGeneratedKey(key: string): boolean {
  return key.startsWith(GENERATED_PREFIX);
}

// The listening data and stand-in profile for a generated key. The first name is chosen when the student
// is created (so it can avoid names in use) and stored on the user; it isn't part of the listening data.
export function generatedFixture(key: string, firstName = ""): DemoFixture {
  const random = seededRandom(key);
  const clusterCount = 1 + Math.floor(random() * 3); // 1 to 3 scenes
  const clusters = shuffled(CLUSTERS, random).slice(0, clusterCount);

  const artists: { name: string; tracks: string[] }[] = [];
  for (const cluster of clusters) {
    // Most of each scene, so two students who share a scene really share artists.
    const take = Math.max(3, Math.round(cluster.artists.length * (clusterCount === 1 ? 0.9 : 0.6)));
    artists.push(...shuffled(cluster.artists, random).slice(0, take));
  }
  const ordered = shuffled(artists, random).slice(0, 12);
  const topArtists = ordered.map((artist) => artist.name);
  const topTracks = ordered.slice(0, 8).map((artist) => [artist.tracks[0], artist.name] as [string, string]);
  const likedSongs = ordered
    .slice(0, 8)
    .map((artist) => [artist.tracks[1] ?? artist.tracks[0], artist.name] as [string, string]);

  const labels = [...new Set(clusters.flatMap((cluster) => shuffled(cluster.labels, random).slice(0, clusterCount === 1 ? 4 : 2)))].slice(0, 6);
  const blurbs = clusters.map((cluster) => cluster.blurb);
  const summary =
    blurbs.length === 1
      ? `Mostly ${blurbs[0]}.`
      : `A mix of ${blurbs.slice(0, -1).join(", ")} and ${blurbs[blurbs.length - 1]}.`;

  return {
    key,
    firstName,
    gender: GENDERS[Math.floor(random() * GENDERS.length)],
    year: YEARS[Math.floor(random() * YEARS.length)],
    summary,
    labels,
    topArtists,
    topTracks,
    likedSongs,
  };
}

// Picks `count` first names not already in use, in a seeded order. When the pool runs out, a second first
// name is added (never a last name), so every name stays unique.
export function pickNames(count: number, taken: Set<string>, seed: string): string[] {
  const random = seededRandom(`names:${seed}`);
  const used = new Set(taken);
  const names: string[] = [];
  for (const name of shuffled(NAME_POOL, random)) {
    if (names.length >= count) break;
    if (!used.has(name)) {
      names.push(name);
      used.add(name);
    }
  }
  while (names.length < count) {
    const a = NAME_POOL[Math.floor(random() * NAME_POOL.length)];
    const b = NAME_POOL[Math.floor(random() * NAME_POOL.length)];
    const name = `${a} ${b}`;
    if (a !== b && !used.has(name)) {
      names.push(name);
      used.add(name);
    }
  }
  return names;
}
