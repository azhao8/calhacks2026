import { describe, expect, test } from "vitest";
import { announcedTimeLeft, countdownDigits, dropPhase, spokenTimeLeft, whenLabel } from "./drop";

const s = (n: number) => n * 1000;
const min = (n: number) => n * 60_000;
const hr = (n: number) => n * 3_600_000;

describe("whenLabel", () => {
  test("explicit day and time in Pacific", () => {
    // Thursday, Oct 29 2026, 8:00 pm Pacific (UTC-7).
    expect(whenLabel(Date.UTC(2026, 9, 30, 3, 0))).toBe("Thursday, Oct 29 · 8:00 pm");
  });

  test("after the switch to standard time", () => {
    // Monday, Nov 2 2026, 5:30 am Pacific (UTC-8).
    expect(whenLabel(Date.UTC(2026, 10, 2, 13, 30))).toBe("Monday, Nov 2 · 5:30 am");
  });
});

describe("countdownDigits", () => {
  test("hours, minutes and seconds", () => {
    expect(countdownDigits(hr(2) - s(1))).toBe("1:59:59");
    expect(countdownDigits(hr(24) - s(1))).toBe("23:59:59");
    expect(countdownDigits(min(4) + s(7))).toBe("0:04:07");
  });

  test("rounds partial seconds up and never goes negative", () => {
    expect(countdownDigits(1)).toBe("0:00:01");
    expect(countdownDigits(0)).toBe("0:00:00");
    expect(countdownDigits(-5000)).toBe("0:00:00");
  });

  test("past a day the hours keep counting", () => {
    expect(countdownDigits(hr(26))).toBe("26:00:00");
  });
});

describe("spokenTimeLeft", () => {
  test("to the minute", () => {
    expect(spokenTimeLeft(hr(2) - s(1))).toBe("1 hour 59 minutes left");
    expect(spokenTimeLeft(hr(2))).toBe("2 hours left");
    expect(spokenTimeLeft(min(1) + s(30))).toBe("1 minute left");
  });

  test("with the phase", () => {
    expect(spokenTimeLeft(hr(2) - s(1), "choosing")).toBe("1 hour 59 minutes left to choose");
    expect(spokenTimeLeft(min(5), "confirming")).toBe("5 minutes until matching");
    expect(spokenTimeLeft(s(30), "confirming")).toBe("Less than a minute until matching");
    expect(spokenTimeLeft(0, "choosing")).toBe("Time is up");
  });

  test("the last minute and after", () => {
    expect(spokenTimeLeft(s(30))).toBe("Less than a minute left");
    expect(spokenTimeLeft(0)).toBe("Time is up");
  });
});

describe("announcedTimeLeft", () => {
  test("steps of 15 minutes above an hour", () => {
    expect(announcedTimeLeft(hr(2) - s(1))).toBe("1 hour 45 minutes left");
    expect(announcedTimeLeft(hr(1) + min(14))).toBe("1 hour left");
  });

  test("steps of 5 minutes under an hour, then every minute", () => {
    expect(announcedTimeLeft(min(59))).toBe("55 minutes left");
    expect(announcedTimeLeft(min(9) + s(59))).toBe("9 minutes left");
    expect(announcedTimeLeft(s(10))).toBe("Less than a minute left");
  });

  test("keeps the phase", () => {
    expect(announcedTimeLeft(hr(2) - s(1), "choosing")).toBe("1 hour 45 minutes left to choose");
    expect(announcedTimeLeft(min(59), "confirming")).toBe("55 minutes until matching");
  });

  test("stays the same within a step", () => {
    expect(announcedTimeLeft(min(44))).toBe(announcedTimeLeft(min(40) + s(1)));
  });
});

describe("dropPhase", () => {
  test("reads the phase when the view has one", () => {
    expect(dropPhase({ kind: "done", endsAt: 0, phase: "confirming" } as never)).toBe("confirming");
    expect(dropPhase({ kind: "done", endsAt: 0 } as never)).toBeUndefined();
    expect(dropPhase({ kind: "none" })).toBeUndefined();
  });
});
