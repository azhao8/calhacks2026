"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Button } from "@/components/Button";
import { Card, InlineError, Meta, MetaItem } from "@/components/Card";
import { ChoiceCard } from "@/components/ChoiceCard";
import { DropTimer } from "@/components/DropTimer";
import { countdownDigits, dropPhase, dropsApi, useDrop, whenLabel, type DropEvent, type DropView } from "@/app/_lib/drop";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useNow, useOnline } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";
import { LoadingScreen, Panel, Screen, ScreenTitle } from "@/app/_components/Screen";
import { EndedPlanNotices } from "./PlanNotices";

type Action = "seeMore" | "passForever" | "accept" | "nextTime";

// The Drop. Every state comes from the server (drops.mine), so a reload lands in the same place.
// The global timer shows in every state but `none`.
export default function DropPage() {
  const gate = useGate(ROUTES.drop);
  const ready = gate.status === "ready" && gate.me !== null;
  const drop = useDrop(ready ? undefined : "skip");
  const router = useRouter();
  const revealTo = drop?.kind === "reveal" ? `/reveal?meetupId=${encodeURIComponent(drop.meetupId)}` : null;

  useEffect(() => {
    if (revealTo) router.replace(revealTo);
  }, [revealTo, router]);

  const plan = gate.status === "ready" ? gate.plan : undefined;
  if (!ready || drop === undefined || drop.kind === "reveal" || plan === undefined) {
    return <LoadingScreen object="ticket" title="Loading the drop" />;
  }
  // Home is the Drop, so the notices for a plan that ended live here (they were on the week).
  const notices = <EndedPlanNotices plan={plan} />;
  if (drop.kind === "none") {
    return (
      <Screen object="radio" menu top={<ScreenTitle lead="Come back later. We'll email you when the next one opens.">No drop right now</ScreenTitle>}>
        {notices}
      </Screen>
    );
  }
  return (
    <Screen object="ticket" menu top={<DropTimer endsAt={drop.endsAt} phase={dropPhase(drop)} />}>
      {notices}
      <DropState key={drop.kind} drop={drop} />
    </Screen>
  );
}

function DropState({ drop }: { drop: Exclude<DropView, { kind: "none" } | { kind: "reveal" }> }) {
  const { run, pending, error, locked } = useDropActions();

  switch (drop.kind) {
    case "choosing":
      return (
        <>
          <Choosing drop={drop} run={run} pending={pending} locked={locked} />
          {error ? <InlineError>{error}</InlineError> : null}
        </>
      );
    case "deciding":
      return (
        <>
          <Deciding drop={drop} run={run} pending={pending} locked={locked} />
          {error ? <InlineError>{error}</InlineError> : null}
        </>
      );
    case "accepted":
      return (
        <>
          <Panel className="flex flex-col gap-2">
            <h1 className="font-display text-title">You&apos;re in.</h1>
            <p className="text-body text-ink tabular-nums">Receive your match at {whenLabel(drop.matchAt)}</p>
          </Panel>
          <EventRecap event={drop.event} small />
        </>
      );
    case "done":
      return (
        <Panel className="flex flex-col gap-2">
          <h1 className="font-display text-title">That&apos;s it for this drop.</h1>
          <p className="text-body text-ink">We&apos;ll email you when the next one opens.</p>
        </Panel>
      );
  }
}

type Run = (action: Action) => Promise<boolean>;

function Choosing({
  drop,
  run,
  pending,
  locked,
}: {
  drop: Extract<DropView, { kind: "choosing" }>;
  run: Run;
  pending: Action | null;
  locked: boolean;
}) {
  // Each pass mounts a new card, so the next one animates in even if its time and price repeat.
  const [passes, setPasses] = useState(0);
  const key = `${drop.card.startsAt}-${drop.card.price}-${passes}`;
  return (
    <ChoiceCard
      key={key}
      when={whenLabel(drop.card.startsAt)}
      price={drop.card.price}
      pending={pending === "seeMore" ? "seeMore" : pending === "passForever" ? "pass" : null}
      locked={locked}
      onSeeMore={() => void run("seeMore")}
      onPass={() => {
        void run("passForever").then((ok) => {
          if (ok) setPasses((n) => n + 1);
        });
      }}
    />
  );
}

function Deciding({
  drop,
  run,
  pending,
  locked,
}: {
  drop: Extract<DropView, { kind: "deciding" }>;
  run: Run;
  pending: Action | null;
  locked: boolean;
}) {
  const now = useNow(1000);
  const busy = pending !== null;
  return (
    <>
      <EventRecap event={drop.event} />
      {/* Locked: these two buttons are the only way on. Stacked so the countdown never wraps. */}
      <div className="flex flex-col gap-3">
        <Button block onClick={() => void run("accept")} loading={pending === "accept"} disabled={busy || locked}>
          <span className="tabular-nums">Accept · {now === 0 ? "" : countdownDigits(drop.acceptBy - now)}</span>
        </Button>
        <Button variant="secondary" block onClick={() => void run("nextTime")} loading={pending === "nextTime"} disabled={busy || locked}>
          Next time
        </Button>
      </div>
    </>
  );
}

function EventRecap({ event, small }: { event: DropEvent; small?: boolean }) {
  return (
    <Card selected={!small}>
      <h2 className={small ? "font-display text-headline" : "font-display text-title text-balance"}>{event.title}</h2>
      <Meta>
        <MetaItem icon="pin">{event.venue}</MetaItem>
        <MetaItem icon="calendar">{whenLabel(event.startsAt)}</MetaItem>
        <MetaItem icon="ticket">{event.price}</MetaItem>
      </Meta>
    </Card>
  );
}

// One mutation at a time. A pending call blocks every button (the Button keeps its width); a failure
// shows inline and the screen stays where the server says it is.
function useDropActions() {
  const online = useOnline();
  const mutations = {
    seeMore: useMutation(dropsApi.seeMore),
    passForever: useMutation(dropsApi.passForever),
    accept: useMutation(dropsApi.accept),
    nextTime: useMutation(dropsApi.nextTime),
  };
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action): Promise<boolean> {
    if (pending !== null || !online) return false;
    setPending(action);
    setError(null);
    try {
      await mutations[action]({});
      return true;
    } catch (e) {
      setError(errorCopy(e, { fallback: "We couldn't save that. Try again." }));
      return false;
    } finally {
      setPending(null);
    }
  }

  return { run, pending, error, locked: !online };
}
