import { expect, test } from "vitest";
import { eventFormValues, eventPatch, sameAsSchoolEmail, fromPacificInput, toPacificInput, parsePrice, parseLatLng } from "./format";
test("pacific", () => {
  const ms = Date.UTC(2026, 9, 30, 2, 30); // Oct 29 7:30 pm PDT
  expect(toPacificInput(ms)).toBe("2026-10-29T19:30");
  expect(fromPacificInput("2026-10-29T19:30")).toBe(ms);
  expect(fromPacificInput("2026-11-05T19:30")).toBe(Date.UTC(2026, 10, 6, 3, 30)); // PST
  expect(parsePrice("$15")).toBe(15); expect(parsePrice("")).toBe(null); expect(parsePrice("abc")).toBe("invalid");
  expect(parseLatLng("37.8716, -122.2727")).toEqual({ lat: 37.8716, lng: -122.2727 });
});

const EVENT = {
  title: "Indie folk night",
  startsAt: Date.UTC(2026, 9, 30, 2, 30),
  priceMin: 18,
  priceMax: 25,
  ticketUrl: "https://example.com/t",
  freeEntryNote: null,
  ageLimit: null,
};

test("the event editor sends only fields changed from the values it opened with", () => {
  const baseline = eventFormValues(EVENT);
  expect(eventPatch(baseline, baseline)).toEqual({ patch: {} });
  expect(eventPatch(baseline, { ...baseline, priceMin: "$15" })).toEqual({ patch: { priceMin: 15 } });
  expect(eventPatch(baseline, { ...baseline, priceMax: "" })).toEqual({ patch: { priceMax: null } });
  expect(eventPatch(baseline, { ...baseline, startsAt: "2026-11-05T19:30" })).toEqual({ patch: { startsAt: Date.UTC(2026, 10, 6, 3, 30) } });
  expect(eventPatch(baseline, { ...baseline, priceMin: "fifteen" })).toEqual({ error: expect.stringContaining("Prices") });

  // A scout run updates the event while the form is open: untouched fields stay out of the patch.
  const form = { ...baseline, title: "Indie folk night, late show" };
  const newer = eventFormValues({ ...EVENT, priceMin: 20, ticketUrl: "https://example.com/new" });
  expect(newer.priceMin).not.toBe(baseline.priceMin);
  expect(eventPatch(baseline, form)).toEqual({ patch: { title: "Indie folk night, late show" } });
});

test("a Spotify email equal to the school email is flagged, ignoring case and spaces", () => {
  expect(sameAsSchoolEmail("Maya@Berkeley.edu ", "maya@berkeley.edu")).toBe(true);
  expect(sameAsSchoolEmail("maya.listens@gmail.com", "maya@berkeley.edu")).toBe(false);
  expect(sameAsSchoolEmail(null, "maya@berkeley.edu")).toBe(false);
  expect(sameAsSchoolEmail("maya@berkeley.edu", null)).toBe(false);
});
