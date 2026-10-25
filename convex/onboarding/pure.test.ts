import { describe, expect, test } from "vitest";
import { TASTE_LABELS, canonicalLabel } from "../ai/labels";
import { TasteValidationError, validateTaste } from "../ai/taste";
import { normalizeName, normalizeTrackKey } from "./normalize";
import { signState, verifyState } from "./oauthState";
import { distinctArtistCount, toSnapshotFields } from "./snapshot";

describe("fixed label list", () => {
  test("about 150 unique, lowercase labels with no dashes", () => {
    expect(TASTE_LABELS.length).toBeGreaterThanOrEqual(140);
    expect(TASTE_LABELS.length).toBeLessThanOrEqual(180);
    expect(new Set(TASTE_LABELS).size).toBe(TASTE_LABELS.length);
    for (const label of TASTE_LABELS) {
      expect(label).toBe(label.toLowerCase());
      expect(label).not.toMatch(/[-–—]/);
    }
    expect(canonicalLabel(" Indie-Folk ")).toBe("indie folk");
    expect(canonicalLabel("vibes")).toBeNull();
  });
});

describe("normalized names", () => {
  test("accents, case, punctuation, and a leading 'the' don't matter", () => {
    expect(normalizeName("Beyoncé")).toBe("beyonce");
    expect(normalizeName("The Beatles")).toBe("beatles");
    expect(normalizeName("Simon & Garfunkel")).toBe("simon and garfunkel");
    expect(normalizeTrackKey("Not - 2019 Remaster", ["Big Thief"])).toBe(normalizeTrackKey("Not", ["big thief"]));
    expect(normalizeTrackKey("Motion Sickness (Live)", ["Phoebe Bridgers"])).toBe("motion sickness|phoebe bridgers");
  });

  test("distinct artists count every source once", () => {
    const snapshot = toSnapshotFields({
      topArtists: [{ spotifyId: "1", name: "Big Thief", genres: [], rank: 1, range: "short_term" }],
      topTracks: [{ spotifyId: "t", name: "Song", artistNames: ["big thief", "Clairo"], rank: 1, range: "short_term" }],
      likedSongs: [{ spotifyId: "l", name: "Song", artistIds: ["x"], artistNames: ["Bon Iver"] }],
    });
    expect(distinctArtistCount(snapshot)).toBe(3);
  });
});

describe("taste validator", () => {
  const input = { topArtists: ["Big Thief", "Clairo"], topTracks: [], likedArtists: [{ name: "Bon Iver", count: 3 }], genres: [] };
  const ok = { summary: "Soft indie and folk for late nights.", labels: ["indie folk", "late night", "mellow"], artists: ["clairo"] };

  test("keeps only listed labels and the student's own artists", () => {
    expect(validateTaste({ ...ok, artists: ["clairo", "Nobody Real", "BON IVER"] }, input)).toEqual({
      summary: "Soft indie and folk for late nights.",
      labels: ["indie folk", "late night", "mellow"],
      artists: ["Clairo", "Bon Iver"],
    });
  });

  test("rejects long summaries, dashes, exclamation marks, too few labels, and invented artists", () => {
    expect(() => validateTaste({ ...ok, summary: "x".repeat(241) }, input)).toThrow(TasteValidationError);
    expect(() => validateTaste({ ...ok, summary: "Indie — folk." }, input)).toThrow(TasteValidationError);
    expect(() => validateTaste({ ...ok, summary: "Indie folk!" }, input)).toThrow(TasteValidationError);
    // Word-joining hyphens become spaces, so "lo-fi" never reaches the screen.
    expect(validateTaste({ ...ok, summary: "Lo-fi beats and hip-hop for late nights." }, input).summary).toBe(
      "Lo fi beats and hip hop for late nights.",
    );
    expect(() => validateTaste({ ...ok, summary: "Indie - folk." }, input)).toThrow(TasteValidationError);
    expect(() => validateTaste({ ...ok, labels: ["indie folk", "vibes"] }, input)).toThrow(TasteValidationError);
    expect(() => validateTaste({ ...ok, artists: ["Made Up"] }, input)).toThrow(TasteValidationError);
  });
});

describe("signed OAuth state", () => {
  test("round trips, and refuses tampering and expiry", async () => {
    process.env.SPOTIFY_STATE_SECRET = "secret";
    const now = 1_000_000;
    const state = await signState("user1", "app1", "http://127.0.0.1:3000/spotify/callback", now);
    expect(await verifyState(state, now + 1000)).toMatchObject({ userId: "user1", appId: "app1", redirectUri: "http://127.0.0.1:3000/spotify/callback" });
    expect(await verifyState(state, now + 16 * 60 * 1000)).toBeNull();
    const [body, sig] = state.split(".");
    const forged = btoa(JSON.stringify({ userId: "user2", appId: "app1", expiresAt: now + 60000, nonce: "n" })).replace(/=+$/, "");
    expect(await verifyState(`${forged}.${sig}`, now)).toBeNull();
    expect(await verifyState(`${body}.`, now)).toBeNull();
    expect(await verifyState("garbage", now)).toBeNull();
    process.env.SPOTIFY_STATE_SECRET = "other";
    expect(await verifyState(state, now)).toBeNull();
  });
});
