"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useWeek } from "@/app/_lib/views";
import { LoadingScreen, Panel, Screen, ScreenTitle } from "@/app/_components/Screen";

// S10 Your week (mockups week.png, empty.png). Up to 3 asks, stacked, showing only the day, time,
// price and distance. Offers arrive live: when one does, the plan screen takes over.
export default function WeekPage() {
  const router = useRouter();
  const gate = useGate(ROUTES.week);
  const ready = gate.status === "ready" && gate.me !== null;
  const cards = useWeek(ready ? undefined : "skip");
  const plan = gate.status === "ready" ? gate.plan : undefined;
  const active = isActivePlan(plan);

  useEffect(() => {
    if (active) router.replace(ROUTES.plan);
  }, [active, router]);

  if (!ready || cards === undefined || plan === undefined || active) return <LoadingScreen object="ticket" title="Loading your week" />;

  const notices = <PlanNotices plan={plan} />;

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
  if (plan.stage === "after" && plan.canShare) {
    return (
      <Card>
        <p className="font-display text-title">Want to stay in touch?</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-3">
          <Link href={ROUTES.stayInTouch} onClick={dismiss} className={buttonClasses({ block: true })}>
            Share
          </Link>
          <Button variant="secondary" block onClick={dismiss}>
            Not now
          </Button>
        </div>
      </Card>
    );
  }
  return null;
}
