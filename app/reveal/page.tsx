"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/Button";
import { InlineError } from "@/components/Card";
import { RevealLine, RevealPresent } from "@/components/Reveal";
import type { RevealStep } from "@/app/_lib/drops";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";
import { revealLine } from "@/app/_lib/revealCopy";
import { LoadingScreen, Screen, ScreenTitle } from "@/app/_components/Screen";

// Reveal: a matched plan opened one tap at a time, like a present. What both share comes first and
// the partner's first name last; then the plan. A reload starts the steps again, which is fine.
export default function RevealPage() {
  return (
    <Suspense fallback={<LoadingScreen object="records" />}>
      <RevealGate />
    </Suspense>
  );
}

function RevealGate() {
  const router = useRouter();
  const gate = useGate(ROUTES.reveal);
  const meetupId = useSearchParams().get("meetupId");
  const ready = gate.status === "ready" && gate.me !== null;

  // Without a plan to open, home picks the screen.
  useEffect(() => {
    if (ready && !meetupId) router.replace(ROUTES.welcome);
  }, [ready, meetupId, router]);

  if (!ready || !meetupId) return <LoadingScreen object="records" />;
  return <Reveal meetupId={meetupId as Id<"meetups">} />;
}

function Reveal({ meetupId }: { meetupId: Id<"meetups"> }) {
  const data = useQuery(api.drops.reveal, { meetupId });
  if (data === undefined) return <LoadingScreen object="records" />;
  return <Steps meetupId={meetupId} steps={data.steps} />;
}

function Steps({ meetupId, steps }: { meetupId: Id<"meetups">; steps: RevealStep[] }) {
  const router = useRouter();
  const online = useOnline();
  const markRevealed = useMutation(api.drops.revealed);
  const [opened, setOpened] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The steps are live: never show more than the server still sends.
  const shown = Math.min(opened, steps.length);
  const done = shown >= steps.length;
  const lines = steps.slice(0, shown).map(revealLine);
  const latest = lines.at(-1);

  // The open control disappears after the last step; keyboard focus moves to what comes next.
  useEffect(() => {
    if (done && opened > 0) document.getElementById("see-plan")?.focus();
  }, [done, opened]);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await markRevealed({ meetupId });
      router.replace(ROUTES.plan);
    } catch (e) {
      setError(errorCopy(e));
      setBusy(false);
    }
  }

  return (
    <Screen object="records" menu top={<ScreenTitle eyebrow="Your drop">{done ? "Your plan is ready" : "Something's waiting for you"}</ScreenTitle>}>
      {/* Each opened step is read out once. */}
      <p aria-live="polite" className="sr-only">
        {latest ? [latest.line, latest.detail].filter(Boolean).join(" ") : ""}
      </p>
      {lines.length > 0 ? (
        <ol aria-label="What you share" className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <RevealLine key={i} line={l.line} detail={l.detail} latest={i === lines.length - 1} />
          ))}
        </ol>
      ) : null}
      {done ? (
        <>
          <Button id="see-plan" block loading={busy} disabled={!online} onClick={finish}>
            See your plan
          </Button>
          {error ? <InlineError>{error}</InlineError> : null}
        </>
      ) : (
        <RevealPresent opened={shown} total={steps.length} onOpen={() => setOpened(shown + 1)} />
      )}
    </Screen>
  );
}
