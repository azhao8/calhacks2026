import { describe, expect, test } from "vitest";
import { revealLine, revealProgress, revealScreen } from "./revealCopy";

describe("revealLine", () => {
  test("each step has its line", () => {
    expect(revealLine({ kind: "going" }).line).toBe("Someone's going with you.");
    expect(revealLine({ kind: "artist", name: "Big Thief" }).line).toBe("You both love Big Thief.");
    expect(revealLine({ kind: "label", name: "indie folk" }).line).toBe("You both love indie folk.");
    expect(revealLine({ kind: "song", title: "Simulation Swarm", artist: "Big Thief" })).toEqual({
      line: "You both have Simulation Swarm on repeat.",
      detail: "Big Thief",
    });
    expect(revealLine({ kind: "name", firstName: "Sam" }).line).toBe("Meet Sam.");
  });

  test("no copy uses a pronoun, an exclamation mark or a dash", () => {
    const steps = [
      { kind: "going" },
      { kind: "artist", name: "X" },
      { kind: "label", name: "X" },
      { kind: "song", title: "X", artist: "Y" },
      { kind: "name", firstName: "X" },
    ] as const;
    for (const step of steps) {
      const { line } = revealLine(step);
      expect(line).not.toMatch(/\b(he|she|her|him|his|hers)\b/i);
      expect(line).not.toMatch(/[!–—]/);
    }
  });

  test("progress reads as a count", () => {
    expect(revealProgress(2, 4)).toBe("2 of 4");
  });
});

describe("revealScreen", () => {
  test("each step fills its own screen", () => {
    expect(revealScreen({ kind: "going" })).toEqual({ lead: null, big: "Someone's going with you.", tail: null, caps: false });
    expect(revealScreen({ kind: "artist", name: "Big Thief" })).toEqual({ lead: "You both love", big: "Big Thief", tail: null, caps: true });
    expect(revealScreen({ kind: "label", name: "indie folk" }).big).toBe("indie folk");
    expect(revealScreen({ kind: "song", title: "Simulation Swarm", artist: "Big Thief" })).toEqual({
      lead: "You both have",
      big: "Simulation Swarm",
      tail: "on repeat",
      caps: true,
    });
    expect(revealScreen({ kind: "name", firstName: "Sam" }).big).toBe("Meet Sam");
  });
});
