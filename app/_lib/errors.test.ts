import { describe, expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { errorCode, errorCopy } from "./errors";

const appError = (code: string, message = code) => new ConvexError({ code, message });

describe("errorCopy", () => {
  test("maps known codes to recovery copy", () => {
    expect(errorCopy(appError("not_edu_email"), { online: true })).toBe(
      "Melos is only open to students with a .edu email right now.",
    );
    expect(errorCopy(appError("spotify_refused"), { online: true })).toBe("Spotify hasn't let us in yet.");
    expect(errorCopy(appError("offer_expired"), { online: true })).toContain("ran out");
  });

  test("stubs and unknown errors get the generic line or the screen's fallback", () => {
    const stub = appError("retryable", "plans.accept is not built yet");
    expect(errorCopy(stub, { online: true })).toBe("Something went wrong on our side. Try again.");
    expect(errorCopy(new Error("boom"), { online: true, fallback: "We couldn't save that." })).toBe("We couldn't save that.");
  });

  test("shows our own validation messages", () => {
    expect(errorCopy(appError("validation_failed", "Write between 1 and 2000 characters."), { online: true })).toBe(
      "Write between 1 and 2000 characters.",
    );
    expect(errorCopy(appError("validation_failed"), { online: true })).toBe("Check what you entered and try again.");
  });

  test("offline beats everything", () => {
    expect(errorCopy(appError("offer_expired"), { online: false })).toContain("offline");
  });
});

describe("errorCode", () => {
  test("reads only known codes from ConvexError data", () => {
    expect(errorCode(appError("seat_unavailable"))).toBe("seat_unavailable");
    expect(errorCode(appError("made_up"))).toBeNull();
    expect(errorCode(new Error("x"))).toBeNull();
    expect(errorCode(new ConvexError("plain string"))).toBeNull();
  });
});
