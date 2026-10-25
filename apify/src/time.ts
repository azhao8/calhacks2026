// Pacific time offsets, so a listed wall-clock time keeps its meaning across the November clock change.

const laParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// Pacific time's UTC offset in minutes at an instant (-420 in summer, -480 in winter).
export function pacificOffsetMinutes(ms: number): number {
  const parts = Object.fromEntries(laParts.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

const START = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(Z|([+-])(\d{2}):?(\d{2}))$/;

// The same wall-clock time with the right Pacific offset for its date, or null if the string isn't a time with
// an offset. Only Pacific offsets (-07:00, -08:00) are corrected; "Z" and other offsets are true instants.
export function correctPacificOffset(startsAt: string): string | null {
  const m = START.exec(startsAt.trim());
  if (m === null) return null;
  const [, wallText, zone, sign, oh, om] = m;
  if (zone === "Z") return startsAt.trim();
  const given = (sign === "-" ? -1 : 1) * (+oh * 60 + +om);
  if (given !== -420 && given !== -480) return startsAt.trim();
  const wall = Date.parse(`${wallText.length === 16 ? `${wallText}:00` : wallText}Z`);
  if (Number.isNaN(wall)) return null;
  for (const offset of [given, given === -420 ? -480 : -420]) {
    if (pacificOffsetMinutes(wall - offset * 60000) === offset) {
      const wallFull = wallText.length === 16 ? `${wallText}:00` : wallText;
      return `${wallFull}${offset === -420 ? "-07:00" : "-08:00"}`;
    }
  }
  return null;
}
