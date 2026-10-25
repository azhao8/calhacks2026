import { expect, test } from "vitest";
import { SAFETY_ROWS, SAFETY_TOP_LINE, visibleSafetyRows, type SafetyRow } from "./safety";

test("nothing unverified shows: every row starts unchecked", () => {
  expect(SAFETY_ROWS.every((row) => !row.checked)).toBe(true);
  expect(visibleSafetyRows("menu")).toEqual([]);
  expect(visibleSafetyRows("meetup_day")).toEqual([]);
});

test("checked rows show; meetup day gets only the short list", () => {
  const rows: SafetyRow[] = SAFETY_ROWS.map((row) => ({ ...row, checked: true }));
  expect(visibleSafetyRows("menu", rows)).toHaveLength(rows.length);
  expect(visibleSafetyRows("meetup_day", rows).every((row) => row.meetupDay)).toBe(true);
  expect(visibleSafetyRows("meetup_day", rows).length).toBeLessThan(rows.length);
});

test("numbers use spaces, never dashes, and tel links match the shown digits", () => {
  for (const row of SAFETY_ROWS) {
    if (row.phone === null) continue;
    expect(row.phone).not.toMatch(/[-–—]/);
    expect(row.tel?.replace(/^\+1/, "")).toBe(row.phone.replace(/\s/g, ""));
  }
  expect(SAFETY_TOP_LINE).toContain("call 911");
});
