import { PLACES } from "./config";

// Display strings the queries return, so every screen shows the same wording (CLAUDE.md §3, §4).
// Times render in Pacific time no matter where the device is.

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: PLACES.timezone,
  weekday: "long",
  month: "short",
  day: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: PLACES.timezone,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

// "Friday, Oct 30"
export function dayLabel(ms: number): string {
  return dayFormat.format(new Date(ms));
}

// "8:30 pm"
export function timeLabel(ms: number): string {
  return timeFormat.format(new Date(ms)).replace("AM", "am").replace("PM", "pm");
}

function dollars(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

// "Free", "$22", "$18 to $25", "From $15", "Up to $25", or "Price not listed" (never invent a price:
// a listing that only says "from $15" has no known top price, so it never reads as exactly $15).
export function priceLabel(priceMin: number | null, priceMax: number | null): string {
  if (priceMin === null && priceMax === null) return "Price not listed";
  if (priceMax === null) return priceMin === 0 ? "Free and up" : `From ${dollars(priceMin!)}`;
  if (priceMin === null) return priceMax === 0 ? "Free" : `Up to ${dollars(priceMax)}`;
  if (priceMax === 0) return "Free";
  if (priceMin === priceMax) return dollars(priceMin);
  return `${priceMin === 0 ? "Free" : dollars(priceMin)} to ${dollars(priceMax)}`;
}

// "0.6 mi from campus"
export function distanceLabel(meters: number): string {
  const miles = meters / 1609.344;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi from campus`;
}

// Straight-line distance in meters (haversine).
export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
