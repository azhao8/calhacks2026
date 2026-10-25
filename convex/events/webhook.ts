import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

// POST /apify/webhook (CLAUDE.md §6.1, §8.2 Events). Registered in convex/http.ts by the coordinator.
// Checks the shared secret, answers at once, and schedules the import. A run ID already received is ignored.

export const SECRET_HEADER = "x-melos-webhook-secret";

type ApifyWebhookBody = {
  eventType?: string;
  eventData?: { actorRunId?: string };
  resource?: { id?: string; defaultDatasetId?: string; status?: string };
};

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const apifyWebhook = httpAction(async (ctx, request) => {
  const expected = process.env.APIFY_WEBHOOK_SECRET;
  if (!expected) return json(503, { error: "webhook secret is not configured" });
  const given = request.headers.get(SECRET_HEADER) ?? "";
  if (!sameSecret(given, expected)) return json(401, { error: "unauthorized" });

  let body: ApifyWebhookBody;
  try {
    body = (await request.json()) as ApifyWebhookBody;
  } catch {
    return json(400, { error: "invalid JSON" });
  }
  const runId = body.resource?.id ?? body.eventData?.actorRunId;
  if (!runId || !/^[A-Za-z0-9]+$/.test(runId)) return json(400, { error: "missing run ID" });

  const eventType = body.eventType ?? "ACTOR.RUN.SUCCEEDED";
  if (eventType === "ACTOR.RUN.SUCCEEDED") {
    const result = await ctx.runMutation(internal.events.imports.receive, {
      apifyRunId: runId,
      datasetId: body.resource?.defaultDatasetId,
    });
    return json(200, { ok: true, duplicate: result.duplicate });
  }
  if (eventType === "ACTOR.RUN.FAILED" || eventType === "ACTOR.RUN.TIMED_OUT" || eventType === "ACTOR.RUN.ABORTED") {
    await ctx.runMutation(internal.events.imports.recordFailedRun, { apifyRunId: runId, eventType });
    return json(200, { ok: true });
  }
  return json(200, { ok: true, ignored: eventType });
});
