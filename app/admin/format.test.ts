import { expect, test } from "vitest";
import { fromPacificInput, toPacificInput, parsePrice, parseLatLng } from "./format";
test("pacific", () => {
  const ms = Date.UTC(2026, 9, 30, 2, 30); // Oct 29 7:30 pm PDT
  expect(toPacificInput(ms)).toBe("2026-10-29T19:30");
  expect(fromPacificInput("2026-10-29T19:30")).toBe(ms);
  expect(fromPacificInput("2026-11-05T19:30")).toBe(Date.UTC(2026, 10, 6, 3, 30)); // PST
  expect(parsePrice("$15")).toBe(15); expect(parsePrice("")).toBe(null); expect(parsePrice("abc")).toBe("invalid");
  expect(parseLatLng("37.8716, -122.2727")).toEqual({ lat: 37.8716, lng: -122.2727 });
});
