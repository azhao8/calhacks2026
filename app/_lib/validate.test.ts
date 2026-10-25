import { describe, expect, test } from "vitest";
import {
  checkEmail,
  checkFirstName,
  checkInstagram,
  checkNote,
  checkPhone,
  checkSchoolEmail,
  codeDigits,
  EDU_REFUSED,
  formatPhone,
  instagramDisplay,
} from "./validate";

describe("checkSchoolEmail", () => {
  test("accepts any .edu address, subdomains included, trimmed and lowercased", () => {
    expect(checkSchoolEmail("  Sam@Berkeley.EDU ")).toEqual({ ok: true, value: "sam@berkeley.edu" });
    expect(checkSchoolEmail("sam@eecs.berkeley.edu")).toEqual({ ok: true, value: "sam@eecs.berkeley.edu" });
    expect(checkSchoolEmail("sam@ucla.edu").ok).toBe(true);
  });

  test("refuses everything else with the required copy", () => {
    expect(checkSchoolEmail("sam@gmail.com")).toEqual({ ok: false, error: EDU_REFUSED });
    expect(checkSchoolEmail("sam@berkeley.edu.evil.com")).toEqual({ ok: false, error: EDU_REFUSED });
    expect(checkSchoolEmail("").ok).toBe(false);
    expect(checkSchoolEmail("not an email").ok).toBe(false);
  });
});

test("checkEmail accepts any email for Spotify", () => {
  expect(checkEmail(" Sam@Gmail.com")).toEqual({ ok: true, value: "sam@gmail.com" });
  expect(checkEmail("nope").ok).toBe(false);
});

test("checkFirstName trims and keeps it short", () => {
  expect(checkFirstName("  Maya  ")).toEqual({ ok: true, value: "Maya" });
  expect(checkFirstName("Mary  Ann")).toEqual({ ok: true, value: "Mary Ann" });
  expect(checkFirstName("Łucja")).toEqual({ ok: true, value: "Łucja" });
  expect(checkFirstName(" ").ok).toBe(false);
  expect(checkFirstName("a".repeat(41)).ok).toBe(false);
  expect(checkFirstName("sam@x.edu").ok).toBe(false);
});

test("codeDigits keeps six digits from anything pasted", () => {
  expect(codeDigits("12 34-56")).toBe("123456");
  expect(codeDigits("1234567")).toBe("123456");
  expect(codeDigits("abc")).toBe("");
});

describe("checkPhone", () => {
  test("US numbers become E.164", () => {
    expect(checkPhone("(510) 555-0123")).toEqual({ ok: true, value: "+15105550123" });
    expect(checkPhone("1 510 555 0123")).toEqual({ ok: true, value: "+15105550123" });
    expect(checkPhone("510.555.0123")).toEqual({ ok: true, value: "+15105550123" });
  });

  test("international numbers need a +", () => {
    expect(checkPhone("+44 20 7946 0958")).toEqual({ ok: true, value: "+442079460958" });
    expect(checkPhone("+1234").ok).toBe(false);
  });

  test("refuses letters and wrong lengths", () => {
    expect(checkPhone("555-CALL-NOW").ok).toBe(false);
    expect(checkPhone("12345").ok).toBe(false);
    expect(checkPhone("").ok).toBe(false);
  });

  test("formats US numbers for display", () => {
    expect(formatPhone("+15105550123")).toBe("(510) 555\u20110123");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
  });
});

describe("checkInstagram", () => {
  test("strips the @ and lowercases", () => {
    expect(checkInstagram(" @Maya.Listens_ ")).toEqual({ ok: true, value: "maya.listens_" });
  });

  test("refuses invalid handles", () => {
    expect(checkInstagram("").ok).toBe(false);
    expect(checkInstagram("has space").ok).toBe(false);
    expect(checkInstagram(".dot").ok).toBe(false);
    expect(checkInstagram("dot.").ok).toBe(false);
    expect(checkInstagram("two..dots").ok).toBe(false);
    expect(checkInstagram("a".repeat(31)).ok).toBe(false);
  });

  test("displays with one @", () => {
    expect(instagramDisplay("maya")).toBe("@maya");
    expect(instagramDisplay("@maya")).toBe("@maya");
  });
});

test("checkNote trims and limits length", () => {
  expect(checkNote("  hi ", 10, "empty")).toEqual({ ok: true, value: "hi" });
  expect(checkNote("   ", 10, "empty")).toEqual({ ok: false, error: "empty" });
  expect(checkNote("x".repeat(11), 10, "empty").ok).toBe(false);
});
