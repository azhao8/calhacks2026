import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { activeRuns, isBusyRefusal, startRun } from "./apify";

// The Apify module with fetch stubbed: the refusal it raises, and how it asks for runs in progress.
const fetchMock = vi.fn();

beforeEach(() => {
  process.env.APIFY_TOKEN = "test-token";
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

test("a 402 from Apify is a busy refusal; a 500 isn't", async () => {
  fetchMock.mockResolvedValueOnce(new Response("actor-memory-limit-exceeded", { status: 402 }));
  const refused = await startRun("me~scout", {}).catch((error: unknown) => error);
  expect(isBusyRefusal(refused)).toBe(true);
  fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
  const failed = await startRun("me~scout", {}).catch((error: unknown) => error);
  expect(isBusyRefusal(failed)).toBe(false);
});

test("activeRuns asks for this actor's starting and running runs", async () => {
  fetchMock.mockResolvedValueOnce(
    Response.json({ data: { items: [{ id: "Xuv4", startedAt: "2026-10-25T10:09:05.247Z" }] } }),
  );
  expect(await activeRuns("me~scout")).toEqual([{ id: "Xuv4", startedAt: Date.parse("2026-10-25T10:09:05.247Z") }]);
  expect(String(fetchMock.mock.calls[0][0])).toBe(
    "https://api.apify.com/v2/acts/me~scout/runs?status=READY,RUNNING&desc=true&limit=5",
  );
});
