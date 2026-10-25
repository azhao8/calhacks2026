import { describe, expect, test } from "vitest";
import { afterLeavingText, cantMakeItDetail, couldntGetOneDetail, partnerNoticeText } from "./planCopy";

const plan = (over: Partial<Parameters<typeof partnerNoticeText>[0]> = {}) => ({
  stage: "set" as const,
  notice: null,
  partner: { firstName: "Sam", seat: "in" as const, ticket: "none" as const, left: false },
  previousPartnerFirstName: null,
  beforeCutoff: true,
  hook: "You both have Big Thief on repeat." as string | null,
  ...over,
});

describe("partnerNoticeText", () => {
  test("names the partner who dropped, with the required line", () => {
    expect(partnerNoticeText(plan({ notice: "partner_dropped", partner: null, previousPartnerFirstName: "Sam" }))).toBe(
      "Sam can't make it. We're finding someone else who's going.",
    );
  });

  test("falls back when the name isn't there", () => {
    expect(partnerNoticeText(plan({ notice: "partner_dropped", partner: null }))).toContain("We're finding someone else who's going.");
  });

  test("never promises a replacement after the cutoff", () => {
    const text = partnerNoticeText(plan({ notice: "partner_dropped", partner: null, previousPartnerFirstName: "Sam", beforeCutoff: false }))!;
    expect(text).toContain("too close to the show");
    expect(text).not.toContain("finding someone");
  });

  test("replacement and leaving lines", () => {
    expect(partnerNoticeText(plan({ notice: "partner_replaced", partner: { firstName: "Ari", seat: "offered", ticket: "none", left: false } }))).toBe(
      "Ari is coming instead. You both have Big Thief on repeat.",
    );
    expect(partnerNoticeText(plan({ notice: "partner_replaced", hook: null, partner: { firstName: "Ari", seat: "offered", ticket: "none", left: false } }))).toBe(
      "Ari is coming instead.",
    );
    expect(partnerNoticeText(plan({ notice: "partner_left" }))).toBe("Sam had to head out. Enjoy the show.");
    expect(partnerNoticeText(plan())).toBeNull();
  });
});

test("confirm copy promises a replacement only before the cutoff", () => {
  expect(cantMakeItDetail(plan())).toContain("look for someone else");
  expect(cantMakeItDetail(plan({ beforeCutoff: false }))).not.toMatch(/someone else|look for/);
  expect(couldntGetOneDetail(plan())).toContain("opens for someone else");
  expect(couldntGetOneDetail(plan({ beforeCutoff: false }))).not.toContain("someone else");
  expect(afterLeavingText({ kind: "cant_make_it", beforeCutoff: true, meetupId: "m" }).title).toContain("open for someone else");
  expect(afterLeavingText({ kind: "no_ticket", beforeCutoff: false, meetupId: "m" }).title).not.toContain("someone else");
  expect(afterLeavingText({ kind: "next_time", beforeCutoff: false, meetupId: "m" }).title).toBe("No problem. We will keep looking.");
});

test("no pronouns for the partner and no dashes in any line", () => {
  const lines = [
    cantMakeItDetail(plan({ beforeCutoff: false })),
    cantMakeItDetail(plan()),
    couldntGetOneDetail(plan({ beforeCutoff: false })),
    partnerNoticeText(plan({ notice: "partner_dropped", partner: null, beforeCutoff: false, previousPartnerFirstName: "Sam" }))!,
  ];
  for (const line of lines) {
    expect(line).not.toMatch(/\b(he|she|her|him|his|hers)\b/i);
    expect(line).not.toMatch(/[–—]| - /);
  }
});
