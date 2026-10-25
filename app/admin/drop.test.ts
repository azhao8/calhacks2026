import { expect, test } from "vitest";
import { countdown } from "./format";

test("countdown", () => {
  const now = 1_000_000;
  expect(countdown(now - 5_000, now)).toBe("now");
  expect(countdown(now + 12_400, now)).toBe("12 s");
  expect(countdown(now + (4 * 60 + 9) * 1000, now)).toBe("4 min 09 s");
  expect(countdown(now + (2 * 3600 + 5 * 60 + 30) * 1000, now)).toBe("2 h 05 min");
  expect(countdown(now + 24 * 3600 * 1000, now)).toBe("24 h 00 min");
});
