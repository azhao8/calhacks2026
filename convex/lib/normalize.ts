// Normalized names for exact shared items (§6.3). The one shared copy: every fingerprint, demo or real, and every
// comparison against one (pair scores, performer overlap, hook validation) uses these, so all students compare alike.

// "Beyoncé" → "beyonce", "The Beatles" → "beatles", "AC/DC" → "ac dc".
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");
}

// A track is the same song when its title (minus "remastered" style suffixes) and lead artist match.
export function normalizeTrackKey(title: string, artistNames: string[]): string {
  const base = title.replace(/\s+[-–—]\s+.*$/, "").replace(/\s*[([].*?[)\]]\s*/g, " ");
  return `${normalizeName(base)}|${normalizeName(artistNames[0] ?? "")}`;
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].filter((value) => value.length > 0))].sort();
}
