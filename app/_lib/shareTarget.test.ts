import { expect, test } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { shareTarget } from "./shareTarget";

const A = "meetupA" as Id<"meetups">;
const B = "meetupB" as Id<"meetups">;
const current = { meetupId: B, partnerName: "Sam" };
const listA = [{ meetupId: A, partnerFirstName: "Robin", eventTitle: "Cal vs Stanford", startsAt: 0 }];

test("never shares with the current plan when another plan was asked for", () => {
  // The shareable list failed: the requested plan A can't be confirmed, so nothing is shared.
  expect(shareTarget(A, current, "failed")).toEqual({ kind: "unavailable" });
  // A isn't in the list: still never falls back to B.
  expect(shareTarget(A, current, [])).toEqual({ kind: "unavailable" });
});

test("the requested plan is used when it's in the list", () => {
  expect(shareTarget(A, current, listA)).toEqual({ kind: "share", target: { meetupId: A, partnerName: "Robin" } });
});

test("the current plan is used when nothing else was asked for, or it was asked for", () => {
  expect(shareTarget(null, current, "failed")).toEqual({ kind: "share", target: current });
  expect(shareTarget(B, current, undefined)).toEqual({ kind: "share", target: current });
});

test("without a current plan: wait, pick the first, or say there's nothing", () => {
  expect(shareTarget(null, null, undefined)).toEqual({ kind: "loading" });
  expect(shareTarget(null, null, listA)).toEqual({ kind: "share", target: { meetupId: A, partnerName: "Robin" } });
  expect(shareTarget(null, null, [])).toEqual({ kind: "nothing" });
  expect(shareTarget(null, null, "failed")).toEqual({ kind: "nothing" });
});
