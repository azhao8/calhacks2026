import { expect, test } from "vitest";
import { shouldShowEnded } from "./lastEnded";

const entry = { meetupId: "m1", outReason: "no_answer" as const, outAt: 0 };

test("shows once per plan, and never without an entry", () => {
  expect(shouldShowEnded(entry, () => false)).toBe(true);
  expect(shouldShowEnded(entry, (id) => id === "m1")).toBe(false);
  expect(shouldShowEnded(null, () => false)).toBe(false);
  expect(shouldShowEnded(undefined, () => false)).toBe(false);
});
