"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RevealSequence } from "@/components/Reveal";
import type { RevealStep } from "@/app/_lib/drops";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";
import { revealLine, revealScreen } from "@/app/_lib/revealCopy";
import { LoadingScreen } from "@/app/_components/Screen";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nothing to open (the plan ended meanwhile): home picks the screen, so a reload never traps anyone.
  useEffect(() => {
    if (steps.length === 0) router.replace(ROUTES.welcome);
  }, [steps.length, router]);

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

  if (steps.length === 0) return <LoadingScreen object="records" />;
  return (
    <RevealSequence
      screens={steps.map(revealScreen)}
      announce={steps.map((step) => {
        const l = revealLine(step);
        return [l.line, l.detail].filter(Boolean).join(" ");
      })}
      onFinish={finish}
      busy={busy}
      error={error}
      disabled={!online}
    />
  );
}
