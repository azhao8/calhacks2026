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

// The event editor's text fields, as the form shows them.
export type EventFormValues = {
  title: string;
  startsAt: string;
  priceMin: string;
  priceMax: string;
  ticketUrl: string;
  freeEntryNote: string;
  ageLimit: string;
};

type EditableEvent = {
  title: string;
  startsAt: number;
  priceMin: number | null;
  priceMax: number | null;
  ticketUrl: string | null;
  freeEntryNote: string | null;
  ageLimit: number | null;
};

export type EventPatch = {
  title?: string;
  startsAt?: number;
  priceMin?: number | null;
  priceMax?: number | null;
  ticketUrl?: string | null;
  freeEntryNote?: string | null;
  ageLimit?: number | null;
};

export function eventFormValues(event: EditableEvent): EventFormValues {
  return {
    title: event.title,
    startsAt: event.startsAt > 0 ? toPacificInput(event.startsAt) : "",
    priceMin: event.priceMin === null ? "" : String(event.priceMin),
    priceMax: event.priceMax === null ? "" : String(event.priceMax),
    ticketUrl: event.ticketUrl ?? "",
    freeEntryNote: event.freeEntryNote ?? "",
    ageLimit: event.ageLimit === null ? "" : String(event.ageLimit),
  };
}

// Only the fields the admin changed from the values the form opened with, so the server locks
// nothing else against later imports.
export function eventPatch(baseline: EventFormValues, form: EventFormValues): { patch: EventPatch } | { error: string } {
  const patch: EventPatch = {};
  const changed = (key: keyof EventFormValues) => form[key].trim() !== baseline[key].trim();
  if (changed("title")) {
    if (form.title.trim() === "") return { error: "Add a title." };
    patch.title = form.title.trim();
  }
  if (changed("startsAt")) {
    const startsAt = fromPacificInput(form.startsAt);
    if (startsAt === null) return { error: "Pick a start date and time." };
    patch.startsAt = startsAt;
  }
  for (const key of ["priceMin", "priceMax"] as const) {
    if (!changed(key)) continue;
    const price = parsePrice(form[key]);
    if (price === "invalid") return { error: "Prices are dollar amounts like 15, or empty when not listed." };
    patch[key] = price;
  }
  if (changed("ticketUrl")) patch.ticketUrl = form.ticketUrl.trim() || null;
  if (changed("freeEntryNote")) patch.freeEntryNote = form.freeEntryNote.trim() || null;
  if (changed("ageLimit")) {
    const age = form.ageLimit.trim() === "" ? null : Number(form.ageLimit);
    if (age !== null && !(Number.isInteger(age) && age >= 0)) return { error: "The age limit is a whole number, or empty for all ages." };
    patch.ageLimit = age;
  }
  return { patch };
}
