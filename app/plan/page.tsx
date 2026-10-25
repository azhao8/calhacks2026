"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { PlanView } from "@/convex/lib/views";
import { Button, ButtonLink, buttonClasses } from "@/components/Button";
import { InlineError, Ok } from "@/components/Card";
import { MatchCard, MelosNumber, SharedLine } from "@/components/MatchCard";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useNow, useOnline } from "@/app/_lib/hooks";
import { isActivePlan, ROUTES } from "@/app/_lib/routes";
import { markEndedSeen } from "@/app/_lib/lastEnded";
import { afterLeavingText, cantMakeItDetail, couldntGetOneDetail, partnerNoticeText, type Ended } from "@/app/_lib/planCopy";
import { offerExpiryText } from "@/app/_lib/time";
import { Confirm } from "@/app/_components/Confirm";
import { Optional } from "@/app/_components/Optional";
import { ShareablePrompt } from "@/app/_components/ShareablePrompt";
import { LoadingScreen, Panel, Screen, ScreenTitle } from "@/app/_components/Screen";

type Plan = PlanView;

// S11 Offer, S12 Plan set, S13 Meetup day: one screen driven by the plan's stage. Everything shown
// comes from the server's current view; fields the student may not see yet are null there.
export default function PlanPage() {
  const router = useRouter();
  const gate = useGate(ROUTES.plan);
  const plan = gate.status === "ready" ? gate.plan : undefined;
  // After giving up a seat the plan disappears; keep the kind message on screen until they move on.
  const [ended, setEnded] = useState<Ended | null>(null);
  const gone = plan !== undefined && !isActivePlan(plan);

  useEffect(() => {
    if (gone && ended === null) router.replace(ROUTES.week);
  }, [gone, ended, router]);

  if (ended !== null) return <AfterLeaving ended={ended} />;
  if (gate.status === "loading" || plan === undefined || plan === null || gone) return <LoadingScreen object="records" />;

  if (plan.stage === "offer") return <Offer plan={plan} onEnded={setEnded} />;
  if (plan.stage === "meetup_day") return <MeetupDay plan={plan} onEnded={setEnded} />;
  return <PlanSet plan={plan} onEnded={setEnded} />;
}

function useSeatAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(name: string, call: () => Promise<unknown>, after?: () => void) {
    setBusy(name);
    setError(null);
    try {
      await call();
      after?.();
    } catch (e) {
      // Never show success after a failed call.
      setError(errorCopy(e));
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, run };
}

const when = (plan: Plan) => `${plan.event.dayLabel} · ${plan.event.timeLabel}`;
const eventLine = (plan: Plan) => `${plan.event.title} at ${plan.event.venueName}`;

// Notices about the other seat, worded neutrally (CLAUDE.md §3).
function PartnerNotice({ plan }: { plan: Plan }) {
  const text = partnerNoticeText(plan);
  if (text === null) return null;
  return (
    <Panel>
      <p role="status" className="text-body text-ink">
        {text}
      </p>
    </Panel>
  );
}

function Offer({ plan, onEnded }: { plan: Plan; onEnded: (e: Ended) => void }) {
  const accept = useMutation(api.plans.accept);
  const nextTime = useMutation(api.plans.nextTime);
  const online = useOnline();
  const now = useNow(15000);
  const { busy, error, run } = useSeatAction();
  const name = plan.partner?.firstName ?? null;
  const expiry = offerExpiryText(plan.me.offerExpiresAt, now);
  const expired = plan.me.offerExpiresAt !== null && plan.me.offerExpiresAt <= now;

  return (
    <Screen object="records" menu>
      <PartnerNotice plan={plan} />
      <Optional>
        <ShareablePrompt exclude={plan.meetupId} />
      </Optional>
      <MatchCard stage="invite" title={name ? `${name} can make it too.` : "A seat is open for you."} when={when(plan)} price={plan.event.priceLabel}>
        <p className="text-headline">{eventLine(plan)}</p>
        {plan.hook ? <SharedLine>{plan.hook}</SharedLine> : null}
        {expiry ? <p className="text-small text-ink-muted">{expiry}</p> : null}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-3">
          <Button block loading={busy === "accept"} disabled={busy === "next" || expired || !online} onClick={() => run("accept", () => accept({ seatId: plan.seatId }))}>
            Accept
          </Button>
          <Button
            variant="secondary"
            block
            loading={busy === "next"}
            disabled={busy === "accept" || !online}
            onClick={() => run("next", () => nextTime({ seatId: plan.seatId }), () => onEnded({ kind: "next_time", meetupId: plan.meetupId, beforeCutoff: plan.beforeCutoff }))}
          >
            Next time
          </Button>
        </div>
        <p className="text-caption text-ink-muted">
          {name ? `Saying next time is always fine. ${name} won't be told why.` : "Saying next time is always fine."}
        </p>
        {error ? <InlineError>{error}</InlineError> : null}
      </MatchCard>
    </Screen>
  );
}

function TicketBlock({ plan, onEnded }: { plan: Plan; onEnded: (e: Ended) => void }) {
  const setTicket = useMutation(api.plans.setTicket);
  const online = useOnline();
  const { busy, error, run } = useSeatAction();
  const [confirming, setConfirming] = useState(false);
  const mine = plan.me.ticket === "got";
  const both = mine && plan.partner?.ticket === "got";

  if (both) return <Ok>You&apos;re both set.</Ok>;
  if (mine) return <Ok>You have your ticket.</Ok>;
  return (
    <div className="flex flex-col gap-3">
      {plan.ticketUrl ? (
        <ButtonLink href={plan.ticketUrl} variant="secondary" icon="ticket" block>
          Buy your ticket
        </ButtonLink>
      ) : null}
      <p className="text-caption text-ink-muted">
        You buy your own ticket from the official seller. Melos never takes payment and can&apos;t refund tickets.
      </p>
      {confirming ? (
        <Confirm
          question="Couldn't get a ticket?"
          detail={couldntGetOneDetail(plan)}
          yes="Give up my seat"
          no="Keep my seat"
          busy={busy === "couldnt"}
          disabled={!online}
          onYes={() => {
            const beforeCutoff = plan.beforeCutoff;
            void run("couldnt", () => setTicket({ seatId: plan.seatId, ticket: "couldnt" }), () => onEnded({ kind: "no_ticket", meetupId: plan.meetupId, beforeCutoff }));
          }}
          onNo={() => setConfirming(false)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Button block icon="check" loading={busy === "got"} disabled={!online} onClick={() => run("got", () => setTicket({ seatId: plan.seatId, ticket: "got" }))}>
            Got my ticket
          </Button>
          {/* From the meeting time on, giving up the seat goes through "I need to leave" instead. */}
          {plan.canCantMakeIt ? (
            <Button variant="secondary" block onClick={() => setConfirming(true)}>
              I couldn&apos;t get one
            </Button>
          ) : null}
        </div>
      )}
      {error ? <InlineError>{error}</InlineError> : null}
    </div>
  );
}

function CantMakeIt({ plan, onEnded, label }: { plan: Plan; onEnded: (e: Ended) => void; label: string }) {
  const cantMakeIt = useMutation(api.plans.cantMakeIt);
  const online = useOnline();
  const { busy, error, run } = useSeatAction();
  const [confirming, setConfirming] = useState(false);
  if (!plan.canCantMakeIt) return null;
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <Confirm
          question={label}
          detail={cantMakeItDetail(plan)}
          yes="Yes, I can't"
          no="Keep my seat"
          busy={busy === "cant"}
          disabled={!online}
          onYes={() => {
            const beforeCutoff = plan.beforeCutoff;
            void run("cant", () => cantMakeIt({ seatId: plan.seatId }), () => onEnded({ kind: "cant_make_it", meetupId: plan.meetupId, beforeCutoff }));
          }}
          onNo={() => setConfirming(false)}
        />
      ) : (
        <Button variant="quiet" block onClick={() => setConfirming(true)}>
          {label}
        </Button>
      )}
      {error ? <InlineError>{error}</InlineError> : null}
    </div>
  );
}

function MeetingSpot({ plan }: { plan: Plan }) {
  if (plan.meeting === null) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption text-ink-muted">Meeting spot</p>
      <p className="text-headline tabular-nums">
        Meet at {plan.meeting.spotName} at {plan.meeting.meetTimeLabel}.
      </p>
      <p className="text-small text-ink-muted">{plan.meeting.howToFind}</p>
      <ButtonLink href={plan.meeting.directionsUrl} variant="secondary" icon="pin" className="mt-2 self-start">
        Open directions
      </ButtonLink>
    </div>
  );
}

function PlanSet({ plan, onEnded }: { plan: Plan; onEnded: (e: Ended) => void }) {
  const name = plan.partner?.firstName ?? null;
  const waiting = plan.stage === "waiting";
  const title = waiting
    ? name && plan.partner?.seat === "offered"
      ? `You're in. Waiting on ${name}.`
      : "You're in."
    : name
      ? `You and ${name} are set.`
      : "You're set.";

  return (
    <Screen object="records" menu>
      <PartnerNotice plan={plan} />
      <Optional>
        <ShareablePrompt exclude={plan.meetupId} />
      </Optional>
      <MatchCard stage={waiting ? "invite" : "confirmed"} eyebrow={waiting ? "Your plan" : undefined} title={title} when={when(plan)} price={plan.event.priceLabel}>
        <p className="text-headline">{eventLine(plan)}</p>
        {plan.hook ? <SharedLine>{plan.hook}</SharedLine> : null}
        {waiting && plan.meeting === null ? <p className="text-small text-ink-muted">The meeting spot shows here once you&apos;re both in.</p> : null}
        <MeetingSpot plan={plan} />
        {plan.meeting ? <TicketBlock plan={plan} onEnded={onEnded} /> : null}
      </MatchCard>
      <CantMakeIt plan={plan} onEnded={onEnded} label="I can't make it anymore" />
    </Screen>
  );
}

function MeetupDay({ plan, onEnded }: { plan: Plan; onEnded: (e: Ended) => void }) {
  const leave = useMutation(api.plans.leave);
  const online = useOnline();
  const { busy, error, run } = useSeatAction();
  const name = plan.partner?.firstName ?? null;

  return (
    <Screen
      object="mic"
      menu
      top={<ScreenTitle eyebrow={`Today, ${plan.event.timeLabel}`} display>{name ? `Look for ${name}.` : "Today's the day."}</ScreenTitle>}
    >
      <PartnerNotice plan={plan} />
      <Optional>
        <ShareablePrompt exclude={plan.meetupId} />
      </Optional>
      <MatchCard stage="dayof" eyebrow="Your plan" title={eventLine(plan)} when={when(plan)} price={plan.event.priceLabel}>
        {plan.marker !== null ? <MelosNumber value={plan.marker} /> : null}
        {plan.meeting ? (
          <p className="flex flex-col text-body">
            <span className="text-caption text-ink-muted">Meet at</span>
            <span className="font-semibold">
              {plan.meeting.spotName}, {plan.meeting.meetTimeLabel}
            </span>
            <span className="text-small text-ink-muted">{plan.meeting.howToFind}</span>
          </p>
        ) : null}
        {plan.meeting ? (
          <ButtonLink href={plan.meeting.directionsUrl} variant="secondary" icon="pin" className="self-start">
            Open directions
          </ButtonLink>
        ) : null}
        {plan.icebreaker ? (
          <div className="flex flex-col gap-1 border-t border-line pt-4">
            <p className="text-caption text-ink-muted">Something to start with</p>
            <p>{plan.icebreaker}</p>
          </div>
        ) : null}
        {plan.meeting ? <TicketBlock plan={plan} onEnded={onEnded} /> : null}
      </MatchCard>
      {plan.me.left ? (
        <Panel>
          <p role="status" className="text-body text-ink">
            You headed out. Thanks for going.
          </p>
        </Panel>
      ) : null}
      {plan.canShare ? (
        <Link href={ROUTES.stayInTouch} className={buttonClasses({ block: true })}>
          Stay in touch
        </Link>
      ) : null}
      <CantMakeIt plan={plan} onEnded={onEnded} label="I can't make it" />
      {plan.canLeave && !plan.me.left ? (
        <Button variant="quiet" block loading={busy === "leave"} disabled={!online} onClick={() => run("leave", () => leave({ seatId: plan.seatId }))}>
          I need to leave
        </Button>
      ) : null}
      {error ? <InlineError>{error}</InlineError> : null}
    </Screen>
  );
}

function AfterLeaving({ ended }: { ended: Ended }) {
  const { title, body } = afterLeavingText(ended);
  // This screen already says "No problem. We will keep looking." for Next time, so the week's
  // lastEnded notice shouldn't repeat it for the same plan.
  useEffect(() => {
    if (ended.kind === "next_time") markEndedSeen(ended.meetupId);
  }, [ended]);
  return (
    <Screen object="radio" menu>
      <Panel className="flex flex-col gap-2">
        <ScreenTitle>{title}</ScreenTitle>
        <p className="text-body text-ink">{body}</p>
      </Panel>
      <Link href={ROUTES.week} className={buttonClasses({ block: true })}>
        Back to your week
      </Link>
    </Screen>
  );
}
