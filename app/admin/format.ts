// Pure helpers for the admin forms.

// Event times are Pacific (§4), whatever the phone's timezone. These convert between a UTC timestamp
// and the "YYYY-MM-DDTHH:mm" value of a datetime-local field read as Pacific wall time.
const PACIFIC = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function pacificWall(ms: number): number {
  const part = (type: string) => Number(PACIFIC.formatToParts(ms).find((p) => p.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
}

export function toPacificInput(ms: number): string {
  return new Date(pacificWall(ms)).toISOString().slice(0, 16);
}

export function fromPacificInput(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Guess with the offset at the wall time, then correct once for a daylight saving change.
  let utc = wall - (pacificWall(wall) - wall);
  utc = wall - (pacificWall(utc) - utc);
  return utc;
}

// A typed price: empty means not listed; "$15" and "15" both mean 15. Anything else is refused.
export function parsePrice(text: string): number | null | "invalid" {
  const clean = text.trim().replace(/^\$\s*/, "");
  if (clean === "") return null;
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 ? value : "invalid";
}

// "37.8716, -122.2727" as copied from a map app.
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
