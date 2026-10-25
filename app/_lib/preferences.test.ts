import { describe, expect, test } from "vitest";
import { budgetMax, meetWhoSelection, toggleMeetWho, toggleSingle } from "./preferences";

describe("toggleMeetWho", () => {
  test("Anyone stands alone", () => {
    expect(toggleMeetWho(null, "anyone")).toBe("anyone");
    expect(toggleMeetWho(["woman"], "anyone")).toBe("anyone");
    expect(toggleMeetWho("anyone", "anyone")).toBeNull();
  });

  test("specific groups replace Anyone and toggle", () => {
    expect(toggleMeetWho("anyone", "woman")).toEqual(["woman"]);
    expect(toggleMeetWho(["woman"], "non_binary")).toEqual(["woman", "non_binary"]);
    expect(toggleMeetWho(["woman", "man"], "woman")).toEqual(["man"]);
    expect(toggleMeetWho(["man"], "man")).toBeNull();
  });

  test("selection lists the chips that show a check", () => {
    expect(meetWhoSelection(null)).toEqual([]);
    expect(meetWhoSelection("anyone")).toEqual(["anyone"]);
    expect(meetWhoSelection(["man"])).toEqual(["man"]);
  });
});

test("budgets map to a whole dollar maximum, 0 for free and null for any", () => {
  expect(budgetMax("free")).toBe(0);
  expect(budgetMax("25")).toBe(25);
  expect(budgetMax("any")).toBeNull();
});

test("toggleSingle clears on a second tap", () => {
  expect(toggleSingle(null, "grad")).toBe("grad");
  expect(toggleSingle("grad", "grad")).toBeNull();
  expect(toggleSingle("grad", "first")).toBe("first");
});
