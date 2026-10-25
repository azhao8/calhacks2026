import { expect, test } from "vitest";
import { callbackStep } from "./spotifyCallback";

const base = { error: null, code: "c", state: "s", authLoading: false, authenticated: true };

test("connects only once auth has loaded and the student is signed in", () => {
  expect(callbackStep(base)).toBe("connect");
  expect(callbackStep({ ...base, authLoading: true })).toBe("wait_for_auth");
  expect(callbackStep({ ...base, authLoading: true, authenticated: false })).toBe("wait_for_auth");
});

test("signed out shows only after loading finished", () => {
  expect(callbackStep({ ...base, authenticated: false })).toBe("signed_out");
});

test("declined consent and missing params win before auth", () => {
  expect(callbackStep({ ...base, error: "access_denied", authLoading: true })).toBe("declined");
  expect(callbackStep({ ...base, code: null })).toBe("missing_params");
  expect(callbackStep({ ...base, state: null, authenticated: false })).toBe("missing_params");
});
