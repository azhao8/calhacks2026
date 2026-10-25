"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StateView } from "@/components/StateView";
import { errorCopy } from "@/app/_lib/errors";
import { useGate } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";
import { useAnalysis } from "@/app/_lib/views";
import { LoadingScreen, Screen, ScreenTitle } from "@/app/_components/Screen";

// The real stages of the saved analysis job; no percentages.
const STAGE: Record<string, string> = {
  queued: "Reading your top artists",
  fetching: "Reading your top artists",
  summarizing: "Writing your summary",
  // "embedding" runs after "That's me" while the taste vector is saved; it reads as finished.
  embedding: "Almost there",
  done: "Almost there",
};

// S08 Analyzing (StateView loading). The job is saved on the server, so reloading resumes it and
// never re-runs paid calls. When it finishes, onboarding moves to review and the gate moves on.
export default function AnalyzingPage() {
  const gate = useGate(ROUTES.analyzing);
  const ready = gate.status === "ready" && gate.me !== null;
  const job = useAnalysis(ready ? undefined : "skip");
  const start = useMutation(api.taste.startAnalysis);
  const started = useRef(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // No job yet (for example, the callback page was closed early): start it once. Idempotent on the server.
  useEffect(() => {
    if (job !== null || started.current) return;
    started.current = true;
    start({}).catch((e: unknown) => setStartError(errorCopy(e)));
  }, [job, start]);

  if (!ready || job === undefined) return <LoadingScreen object="cassette" title="Getting to know your music" />;

  async function retry() {
    setRetrying(true);
    setStartError(null);
    try {
      await start({});
    } catch (e) {
      setStartError(errorCopy(e));
    } finally {
      setRetrying(false);
    }
  }

  const failed = job?.status === "failed" || startError !== null;
  const tooLittle = job?.status === "failed" && job.failure === "too_little_data" && startError === null;
  // A failed job stays failed until the student retries, so both failure states keep a way forward:
  // "Try again" fetches fresh listening data (the thin snapshot was dropped), and the menu stays reachable.
  return (
    <Screen object="cassette" menu={failed} top={<ScreenTitle>Getting to know your music</ScreenTitle>}>
      {tooLittle ? (
        <StateView
          kind="empty"
          icon="music"
          title="There isn't enough listening on your Spotify yet"
          body="We need at least a few artists you play often. Listen for a few days, then try again."
          action="Try again"
          onAction={retry}
          actionLoading={retrying}
          className="rounded-lg bg-backdrop-vignette"
        />
      ) : failed ? (
        <StateView
          kind="error"
          title="We couldn't read your Spotify yet"
          body={startError ?? "Something went wrong while reading your music. Try again."}
          onAction={retry}
          actionLoading={retrying}
          className="rounded-lg bg-backdrop-vignette"
        />
      ) : (
        <StateView
          kind="loading"
          title={STAGE[job?.status ?? "queued"]}
          body="This takes about a minute. You can leave and come back."
          className="rounded-lg bg-backdrop-vignette"
        />
      )}
    </Screen>
  );
}
