import { describe, expect, test } from "vitest";
import { offerExpiryText, secondsLeft } from "./time";

// Thursday, Oct 29 2026, 6:00 pm Pacific (UTC-7).
const now = Date.UTC(2026, 9, 30, 1, 0);
const minutes = (n: number) => n * 60_000;

describe("offerExpiryText", () => {
  test("same day shows just the time, in Pacific time", () => {
    expect(offerExpiryText(now + minutes(100), now)).toBe("Answer by 7:40 pm to keep this seat.");
  });

  test("another day names the day", () => {
    expect(offerExpiryText(now + minutes(60 * 7), now)).toBe("Answer by Friday, Oct 30 at 1:00 am to keep this seat.");
  });

  test("past expiry says it ran out", () => {
    expect(offerExpiryText(now - 1, now)).toBe("This invitation ran out.");
  });

  test("no expiry, no line", () => {
    expect(offerExpiryText(null, now)).toBeNull();
  });
});

test("secondsLeft rounds up and stops at zero", () => {
  expect(secondsLeft(30_000, 0)).toBe(30);
  expect(secondsLeft(30_000, 29_001)).toBe(1);
  expect(secondsLeft(30_000, 31_000)).toBe(0);
  // The clock ticks on whole seconds, so a fresh wait could read 31 without the cap.
  expect(secondsLeft(30_500, 0, 30)).toBe(30);
});
