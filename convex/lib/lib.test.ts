import { describe, expect, test } from "vitest";
import { emailDomain, isEduEmail, normalizeEmail } from "./edu";
import { distanceLabel, priceLabel, timeLabel } from "./format";

describe("edu email check", () => {
  test("accepts .edu addresses, subdomains included, after trimming and lowercasing", () => {
    expect(isEduEmail("alex@berkeley.edu")).toBe(true);
    expect(isEduEmail("  Alex@EECS.Berkeley.EDU ")).toBe(true);
    expect(isEduEmail("sam@stanford.edu")).toBe(true);
    expect(normalizeEmail("  Alex@Berkeley.EDU ")).toBe("alex@berkeley.edu");
    expect(emailDomain("alex@eecs.berkeley.edu")).toBe("eecs.berkeley.edu");
  });

  test("refuses everything else", () => {
    expect(isEduEmail("alex@gmail.com")).toBe(false);
    expect(isEduEmail("alex@berkeley.edu.evil.com")).toBe(false);
    expect(isEduEmail("alex@edu")).toBe(false);
    expect(isEduEmail("not an email")).toBe(false);
  });

  test("validates the normalized address, the same one we store and send to", () => {
    // NFKC folds compatibility characters (the Kelvin sign, fullwidth letters) to ASCII before the check,
    // so what passes is exactly the address the code goes to.
    expect(normalizeEmail("alex@Keio.edu")).toBe("alex@keio.edu");
    expect(isEduEmail("alex@Keio.edu")).toBe(true);
    expect(normalizeEmail("alex@berkeley.ｅｄｕ")).toBe("alex@berkeley.edu");
    // Lookalikes that stay non-ASCII after normalization are refused.
    expect(isEduEmail("alex@berkeley.еdu")).toBe(false);
    expect(isEduEmail("аlex@berkeley.edu")).toBe(false);
  });
});

describe("display labels", () => {
  test("prices never invent a value", () => {
    expect(priceLabel(null, null)).toBe("Price not listed");
    expect(priceLabel(0, 0)).toBe("Free");
    expect(priceLabel(22, 22)).toBe("$22");
    expect(priceLabel(18, 25)).toBe("$18 to $25");
    expect(priceLabel(0, 15)).toBe("Free to $15");
  });

  test("a one-sided price never reads as exact", () => {
    expect(priceLabel(15, null)).toBe("From $15");
    expect(priceLabel(null, 25)).toBe("Up to $25");
    expect(priceLabel(null, 0)).toBe("Free");
    expect(priceLabel(0, null)).toBe("Free and up");
  });

  test("times are Pacific and lowercase", () => {
    // 2026-10-31T03:30:00Z is 8:30 pm on Oct 30 in Pacific daylight time.
    expect(timeLabel(Date.UTC(2026, 9, 31, 3, 30))).toBe("8:30 pm");
  });

  test("distance from campus", () => {
    expect(distanceLabel(965)).toBe("0.6 mi from campus");
  });
});
