"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Loading, Muted, Panel, Result, useRun, when } from "./_ui";
import { countdown } from "./format";

// The Drop tab: one drop for every student at once, moved through its phases from here.
type Drop = NonNullable<FunctionReturnType<typeof api.admin.drops.status>["drop"]>;
type DropStatus = Drop["status"];
type DropCounts = Drop["counts"];

const PHASE: Record<DropStatus | "none", string> = {
  none: "No drop",
  choosing: "Choosing",
  confirming: "Confirming (24 hours)",
  matched: "Matched",
};

const COUNTS: { key: keyof DropCounts; label: string }[] = [
  { key: "eligible", label: "Eligible" },
  { key: "choosing", label: "Choosing" },
  { key: "deciding", label: "Deciding" },
  { key: "accepted", label: "Accepted" },
  { key: "passed", label: "Passed" },
  { key: "declined", label: "Declined" },
  { key: "turnedAway", label: "Turned away" },
  { key: "matched", label: "Matched" },
  { key: "unmatched", label: "Unmatched" },
  { key: "demo", label: "Demo" },
];

export function DropTab() {
  return (
    <DropBoundary>
      <DropControls />
    </DropBoundary>
  );
}

function DropControls() {
  const status = useQuery(api.admin.drops.status);
  const start = useMutation(api.admin.drops.start);
  const end = useMutation(api.admin.drops.endChoosing);
  const match = useMutation(api.admin.drops.matchNow);
  const { busy, error, done, run } = useRun();

  if (status === undefined) return <Loading />;
  const drop = status.drop;
  const phase = drop?.status ?? "none";
  const open = phase === "choosing" || phase === "confirming";
  // One control at a time: while any call is out, every button waits.
  const waiting = busy !== null ? "Waiting for the last step to finish." : null;

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Drop" lead="Every student moves through each phase together. This updates live.">
        <DropState drop={drop} />
      </Panel>

      <Panel title="Run the drop" lead="Each step asks you to confirm. Demo students keep up on their own.">
        <div className="flex flex-col gap-4">
          <BigAction
            label="Start drop"
            explain="Opens a drop for every eligible student: 2 hours of choosing, 1 to 4 cards each."
            question="Start a drop for every eligible student?"
            yes="Start drop"
            busy={busy === "start"}
            disabledReason={waiting ?? (open ? "A drop is already open. Match it first." : null)}
            onConfirm={() => run("start", () => start({}), "Drop started. Cards are going out now.")}
          />
          <BigAction
            label="End choosing"
            explain="Closes choosing now. Students still on cards are turned away; anyone looking at an event gets 24 hours to accept."
            question="End choosing now?"
            yes="End choosing"
            busy={busy === "end"}
            disabledReason={waiting ?? (phase === "choosing" ? null : "Only while students are choosing.")}
            onConfirm={() => run("end", () => end({}), "Choosing closed. The 24 hours to accept have started.")}
          />
          <BigAction
            label="Match now"
            explain="Closes choosing, ends the 24 hours, and matches everyone who accepted. A demo student fills any leftover seat."
            question="Match everyone who accepted, now?"
            yes="Match now"
            busy={busy === "match"}
            disabledReason={waiting ?? (open ? null : "Only while a drop is choosing or confirming.")}
            onConfirm={() => run("match", () => match({}), "Matching started. Plans appear on phones in a few seconds.")}
          />
        </div>
        <Result error={error} done={done} />
      </Panel>

      <Panel title="Demo run">
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-body text-ink">
          <li>Feature an event first on the Events tab, so both team phones get it as card 1.</li>
          <li>Tap Start drop.</li>
          <li>Wait until both phones have accepted that event.</li>
          <li>Tap Match now.</li>
        </ol>
      </Panel>
    </div>
  );
}

function DropState({ drop }: { drop: Drop | null }) {
  const now = useNow();
  if (drop === null) {
    return (
      <div className="flex flex-col gap-1">
        <p className="font-display text-title text-ink">{PHASE.none}</p>
        <Muted>Start a drop below when you&apos;re ready.</Muted>
      </div>
    );
  }
  const next =
    drop.status === "choosing"
      ? { label: "Choosing ends in", at: drop.choosingEndsAt }
      : drop.status === "confirming"
        ? { label: "Matching in", at: drop.matchAt }
        : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-display text-title text-ink">{PHASE[drop.status]}</p>
        {next ? (
          <p className="inline-flex items-center gap-2 text-body-strong text-ink tabular-nums" aria-live="off">
            <Icon name="clock" className="text-accent" />
            {next.label} {countdown(next.at, now)}
          </p>
        ) : null}
      </div>
      <dl className="grid gap-x-4 gap-y-1 text-small sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-muted">Started</dt>
        <dd className="text-ink tabular-nums">{when(drop.startedAt)}</dd>
        <dt className="text-ink-muted">Choosing ends</dt>
        <dd className="text-ink tabular-nums">{when(drop.choosingEndsAt)}</dd>
        <dt className="text-ink-muted">Match at</dt>
        <dd className="text-ink tabular-nums">{when(drop.matchAt)}</dd>
      </dl>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {COUNTS.map(({ key, label }) => (
          <li key={key} className="flex flex-col rounded-md border border-line bg-surface-raised px-3 py-2">
            <span className="text-caption text-ink-muted">{label}</span>
            <span className="text-headline text-ink tabular-nums">{drop.counts[key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A full-width button; the first tap asks, the second does it. Like ConfirmAction, but sized for a phone on stage.
function BigAction({
  label,
  explain,
  question,
  yes,
  onConfirm,
  busy,
  disabledReason,
}: {
  label: string;
  explain: string;
  question: string;
  yes: string;
  onConfirm: () => Promise<unknown>;
  busy: boolean;
  disabledReason: string | null;
}) {
  const [asking, setAsking] = useState(false);
  // A phase change from elsewhere (another phone, the timer) makes an open question stale, so it hides.
  const open = asking && (busy || !disabledReason);

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="primary" block onClick={() => setAsking(true)} disabled={Boolean(disabledReason)} loading={busy}>
          {label}
        </Button>
        <p className="text-caption text-ink-muted">{disabledReason ?? explain}</p>
      </div>
    );
  }
  return (
    <div role="group" aria-label={question} className="flex flex-col gap-3 rounded-sm border border-accent bg-surface-raised p-3">
      <p className="flex items-start gap-2 text-body-strong text-ink">
        <Icon name="alert" className="mt-1 text-accent" />
        {question}
      </p>
      <p className="text-small text-ink-muted">{explain}</p>
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          block
          loading={busy}
          onClick={async () => {
            await onConfirm();
            setAsking(false);
          }}
        >
          {yes}
        </Button>
        <Button variant="quiet" block onClick={() => setAsking(false)} disabled={busy}>
          Not yet
        </Button>
      </div>
    </div>
  );
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

// Until Drop 1's functions are deployed, the status query throws; keep the rest of the page working.
class DropBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Panel title="Drop" lead="The drop controls couldn't load.">
        <Muted>The server may not have the drop functions yet. Reload once the backend is deployed.</Muted>
        <Button variant="secondary" className="self-start" onClick={() => this.setState({ failed: false })}>
          Try again
        </Button>
      </Panel>
    );
  }
}
