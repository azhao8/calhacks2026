"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { PlanView, WeekCard } from "@/convex/lib/views";
import { Button, buttonClasses } from "@/components/Button";
import { Card, InlineError } from "@/components/Card";
import { ConcertCard } from "@/components/ConcertCard";
import { getFlag, setFlag } from "@/app/_lib/device";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { isActivePlan, ROUTES } from "@/app/_lib/routes";
import { LAST_ENDED_LINE, markEndedSeen, shouldShowEnded } from "@/app/_lib/lastEnded";
import { useLastEnded, useWeek } from "@/app/_lib/views";
import { Optional } from "@/app/_components/Optional";
import { ShareablePrompt, stayInTouchHref } from "@/app/_components/ShareablePrompt";
import { LoadingScreen, Panel, Screen, ScreenTitle } from "@/app/_components/Screen";

// S10 Your week (mockups week.png, empty.png). Up to 3 asks, stacked, showing only the day, time,
// price and distance. Offers arrive live: when one does, the plan screen takes over.
export default function WeekPage() {
  const gate = useGate(ROUTES.week);
  const ready = gate.status === "ready" && gate.me !== null;
  const cards = useWeek(ready ? undefined : "skip");
  const plan = gate.status === "ready" ? gate.plan : undefined;
  if (!ready || cards === undefined || plan === undefined) return <LoadingScreen object="ticket" title="Loading your week" />;

  // Home goes to the plan first (homeRoute); here the week stays reachable with a way back to it.
  const notices = (
    <>
      {isActivePlan(plan) ? <ActivePlanBanner /> : null}
      <Optional>
        <LastEndedNotice />
      </Optional>
      <PlanNotices plan={plan} />
      {/* Without stream C's shareable query, fall back to the completed plan's own prompt. */}
      <Optional fallback={plan && plan.stage === "after" && plan.canShare ? <AfterSharePrompt plan={plan} /> : null}>
        <ShareablePrompt exclude={isActivePlan(plan) ? plan?.meetupId : undefined} />
      </Optional>
    </>
  );

  if (cards.length === 0) {
    return (
      <Screen object="radio" menu top={<ScreenTitle>Your week</ScreenTitle>}>
        {notices}
        <Panel className="flex flex-col gap-3">
          <h2 className="font-display text-title">Nothing this week yet</h2>
          <p className="text-body text-ink">New events land every day. We will let you know when something sounds like you.</p>
        </Panel>
        <Link href={ROUTES.preferences} className={buttonClasses({ variant: "secondary", block: true })}>
          Change my preferences
        </Link>
      </Screen>
    );
  }

  return (
    <Screen object="ticket" menu top={<ScreenTitle lead="Tap the ones that work. Each one is revealed when you match.">Your week</ScreenTitle>}>
      {notices}
      <ul aria-label="This week" className="m-0 flex list-none flex-col gap-4 p-0">
        {cards.map((card) => (
          <li key={card.askId}>
            <Ask card={card} />
          </li>
        ))}
      </ul>
    </Screen>
  );
}

function Ask({ card }: { card: WeekCard }) {
  const answer = useMutation(api.week.answer);
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const going = card.answer === "yes";

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await answer({ askId: card.askId, answer: going ? "no" : "yes" });
    } catch (e) {
      setError(errorCopy(e, { fallback: "We couldn't save that. Try again." }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ConcertCard
        day={card.dayLabel}
        time={card.timeLabel}
        price={card.priceLabel}
        distance={card.distanceLabel}
        going={going}
        onToggle={toggle}
        loading={busy}
        locked={card.locked || !online}
      />
      {error ? <InlineError>{error}</InlineError> : null}
      {going && !error ? (
        <p role="status" className="px-1 text-small text-ink">
          We&apos;ll look for someone who&apos;s in too.
        </p>
      ) : null}
    </div>
  );
}

// A plan that ended shows here once: the kind notice when nobody was found, or the offer to stay
// in touch after a meetup (CLAUDE.md §5 S12, S14).
function PlanNotices({ plan }: { plan: PlanView | null }) {
  const key = plan ? `seen.${plan.meetupId}.${plan.stage}` : null;
  const [dismissed, setDismissed] = useState(() => (key ? getFlag(key) : false));
  if (plan === null || key === null || dismissed) return null;

  const dismiss = () => {
    setFlag(key);
    setDismissed(true);
  };

  if (plan.stage === "called_off") {
    return (
      <Card>
        <p role="status" className="text-body text-ink">
          {plan.notice === "event_pulled"
            ? "This event isn't on Melos anymore. If you already have a ticket, check the official listing before you go."
            : "We couldn't find anyone else in time. You can still go if you have a ticket."}
        </p>
        <Button variant="secondary" block onClick={dismiss}>
          Got it
        </Button>
      </Card>
    );
  }
  return null;
}

function AfterSharePrompt({ plan }: { plan: PlanView }) {
  const key = `seen.${plan.meetupId}.after`;
  const [dismissed, setDismissed] = useState(() => getFlag(key));
  if (dismissed) return null;
  const dismiss = () => {
    setFlag(key);
    setDismissed(true);
  };
  return (
    <Card>
      <p className="font-display text-title">Want to stay in touch?</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-3">
        <Link href={stayInTouchHref(plan.meetupId)} onClick={dismiss} className={buttonClasses({ block: true })}>
          Share
        </Link>
        <Button variant="secondary" block onClick={dismiss}>
          Not now
        </Button>
      </div>
    </Card>
  );
}

function ActivePlanBanner() {
  return (
    <Panel className="flex flex-col gap-3">
      <p className="text-body text-ink">You have a plan in progress.</p>
      <Link href={ROUTES.plan} className={buttonClasses({ block: true })}>
        Open your plan
      </Link>
    </Panel>
  );
}

// An offer that ran out or got "Next time" in the last day, said once (plans.lastEnded).
function LastEndedNotice() {
  const entry = useLastEnded();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !shouldShowEnded(entry)) return null;
  const dismiss = () => {
    markEndedSeen(entry!.meetupId);
    setDismissed(true);
  };
  return (
    <Card>
      <p role="status" className="text-body text-ink">
        {LAST_ENDED_LINE}
      </p>
      <Button variant="secondary" block onClick={dismiss}>
        Got it
      </Button>
    </Card>
  );
}
