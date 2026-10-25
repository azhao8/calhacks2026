import { expect, test } from "vitest";
import { revisionState } from "./tasteRevision";

const job = (status: "summarizing" | "failed" | "done" | "embedding", error: string | null = null) => ({ status, error, failure: null });

test("a correction in flight is rewriting, and a newer revision ends it", () => {
  expect(revisionState(job("summarizing"), 0, 0)).toBe("rewriting");
  expect(revisionState(job("done"), 0, 1)).toBe("revised");
  expect(revisionState(job("summarizing"), 0, 1)).toBe("revised");
});

test("a failed correction is its own state; other failures and done are idle", () => {
  expect(revisionState({ status: "failed", error: "correction_failed", failure: "other" }, 0, 0)).toBe("failed");
  expect(revisionState({ status: "failed", error: "failed", failure: "other" }, null, 0)).toBe("idle");
  expect(revisionState(job("done"), null, 2)).toBe("idle");
  expect(revisionState(job("embedding"), null, 2)).toBe("idle");
  expect(revisionState(undefined, null, 0)).toBe("idle");
});

test("after a reload (no sent revision) a running rewrite still shows", () => {
  expect(revisionState(job("summarizing"), null, 3)).toBe("rewriting");
});
