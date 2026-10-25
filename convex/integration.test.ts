import { describe, expect, test } from "vitest";
import { DEMO_FIXTURES, demoFingerprint, demoSnapshot } from "./demo/fixtures";
import { fingerprint } from "./onboarding/snapshot";
import { normalizeName, normalizeTrackKey } from "./lib/normalize";
import { normalizeName as matchingNormalizeName } from "./matching/taste";
import { TASTE_LABELS } from "./ai/labels";
import { validateHook } from "./ai/hooks";

// Cross-stream contracts that no single stream's tests can see.

describe("demo and real students compare alike", () => {
  test("matching uses the same name normalization as onboarding", () => {
    for (const name of ["The Beatles", "Beyoncé", "AC/DC", "米津玄師", "Simon & Garfunkel"]) {
      expect(matchingNormalizeName(name)).toBe(normalizeName(name));
    }
    expect(normalizeName("米津玄師")).not.toBe("");
  });

  test("a demo fingerprint equals the one onboarding builds from the same listening data", () => {
    for (const fixture of DEMO_FIXTURES) {
      const demo = demoFingerprint(fixture);
      const real = fingerprint(demoSnapshot(fixture), fixture.labels);
      expect(new Set(demo.topArtists)).toEqual(new Set(real.topArtists));
      expect(new Set(demo.likedArtists)).toEqual(new Set(real.likedArtists));
      expect(new Set(demo.tracks)).toEqual(new Set(real.tracks));
    }
  });

  test("track keys from demo data match real ones", () => {
    const [name, artist] = DEMO_FIXTURES[0].topTracks[0];
    expect(demoSnapshot(DEMO_FIXTURES[0]).topTracks[0].normalizedKey).toBe(normalizeTrackKey(name, [artist]));
  });
});

describe("demo fixtures follow onboarding's rules", () => {
  test("every demo label is on the fixed label list", () => {
    for (const fixture of DEMO_FIXTURES) {
      for (const label of fixture.labels) expect(TASTE_LABELS, `${fixture.key}: ${label}`).toContain(label);
    }
  });
});

describe("hooks name only what both students share", () => {
  test("a genre from the fixed list that neither student has is refused", () => {
    // What plans/hooks builds: every label on the fixed list plus the pair's own items.
    const known = new Set([...TASTE_LABELS.map(normalizeName), normalizeName("Big Thief")]);
    const shared = [{ kind: "artist" as const, name: "Big Thief" }];
    const icebreaker = "Which Big Thief song would you play first?";
    expect(validateHook({ hook: "You both have Big Thief on repeat, plus a soft spot for jazz.", icebreaker }, shared, known)).toBeNull();
    expect(validateHook({ hook: "You both have Big Thief on repeat.", icebreaker }, shared, known)).not.toBeNull();
  });
});
