"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, buttonClasses } from "@/components/Button";
import { InlineError } from "@/components/Card";
import { ConnectorButton } from "@/components/ConnectorButton";
import { StateView } from "@/components/StateView";
import { TextField } from "@/components/TextField";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";
import { shareTarget, type Candidate, type ShareTarget } from "@/app/_lib/shareTarget";
import { useMyShares, useShareable } from "@/app/_lib/views";
import { Optional } from "@/app/_components/Optional";
import { checkInstagram, checkPhone, formatPhone, instagramDisplay } from "@/app/_lib/validate";
import { LoadingScreen, Panel, Screen, ScreenTitle } from "@/app/_components/Screen";

type Kind = "phone" | "instagram";

// S14 Stay in touch (component ConnectorButton). Opt in per plan, nothing pre-checked. A value
// shows as shared only after the server saved it. Every choice continues to Contacts.
// /stay-in-touch?meetupId= picks a recent plan from stream C's shareable list, so sharing stays
// possible after a newer offer arrives; without it, the current plan is used.
export default function StayInTouchPage() {
  return (
    <Suspense fallback={<LoadingScreen object="mic" />}>
      <StayInTouch />
    </Suspense>
  );
}

function StayInTouch() {
  const gate = useGate(ROUTES.stayInTouch);
  const requested = useSearchParams().get("meetupId");
  if (gate.status === "loading" || gate.plan === undefined) return <LoadingScreen object="mic" />;
  const plan = gate.plan;
  const current = plan !== null && plan.canShare ? { meetupId: plan.meetupId, partnerName: plan.partner?.firstName ?? null } : null;
  const direct = shareTarget(requested, current, "failed");
  // The current plan needs no list; anything else waits for contacts.shareable, and if that fails
  // the page never swaps in a different recipient (app/_lib/shareTarget.ts).
  if (direct.kind === "share") return <Target target={direct} />;
  return (
    <Optional fallback={<Target target={direct} />}>
      <FromShareable requested={requested} current={current} />
    </Optional>
  );
}

function FromShareable({ requested, current }: { requested: string | null; current: Candidate | null }) {
  const shareable = useShareable();
  return <Target target={shareTarget(requested, current, shareable)} />;
}

function Target({ target }: { target: ShareTarget }) {
  if (target.kind === "loading") return <LoadingScreen object="mic" />;
  if (target.kind === "share") return <Share {...target.target} />;
  if (target.kind === "unavailable") return <Unavailable />;
  return <NothingToShare />;
}

function Unavailable() {
  return (
    <Screen object="mic" menu>
      <StateView
        kind="error"
        title="This plan isn't available to share right now."
        body="Nothing was shared. Try again in a moment."
        action={null}
        className="rounded-lg bg-backdrop-vignette"
      />
      <Link href={ROUTES.contacts} className={buttonClasses({ variant: "secondary", block: true })}>
        Recent connections
      </Link>
    </Screen>
  );
}

function NothingToShare() {
  return (
    <Screen object="mic" menu>
      <StateView
        kind="empty"
        icon="phone"
        title="Nothing to share yet"
        body="Stay in touch opens at the meeting time of a plan."
        action={null}
        className="rounded-lg bg-backdrop-vignette"
      />
      <Link href={ROUTES.contacts} className={buttonClasses({ variant: "secondary", block: true })}>
        Recent connections
      </Link>
    </Screen>
  );
}

function Share({ meetupId, partnerName }: { meetupId: Id<"meetups">; partnerName: string | null }) {
  const shares = useMyShares(meetupId);
  const share = useMutation(api.contacts.share);
  const stopSharing = useMutation(api.contacts.stopSharing);
  const online = useOnline();
  const [open, setOpen] = useState<Kind | null>(null);
  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const name = partnerName;

  if (shares === undefined) return <LoadingScreen object="mic" />;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (open === null) return;
    const checked = open === "phone" ? checkPhone(value) : checkInstagram(value);
    if (!checked.ok) {
      setFieldError(checked.error);
      return;
    }
    setFieldError(null);
    setBusy("save");
    setError(null);
    try {
      await share({ meetupId: meetupId, kind: open, value: checked.value });
      setOpen(null);
      setValue("");
    } catch (e) {
      setError(errorCopy(e, { fallback: "We couldn't share that. Nothing was shared. Try again." }));
    } finally {
      setBusy(null);
    }
  }

  async function stop(kind: Kind) {
    setBusy(`stop-${kind}`);
    setError(null);
    try {
      await stopSharing({ meetupId: meetupId, kind });
    } catch (e) {
      setError(errorCopy(e));
    } finally {
      setBusy(null);
    }
  }

  const shared = { phone: shares.phone, instagram: shares.instagram };
  const anyShared = shared.phone !== null || shared.instagram !== null;

  return (
    <Screen object="mic" menu top={<ScreenTitle lead={name ? `Only ${name} can see it.` : "Only the person from your plan can see it."}>Want to stay in touch?</ScreenTitle>}>
      <Panel className="flex flex-col gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          <ConnectorButton
            kind="phone"
            sent={shared.phone !== null}
            pressed={open === "phone"}
            onClick={() => {
              setOpen(open === "phone" ? null : "phone");
              setValue("");
              setFieldError(null);
            }}
          />
          <ConnectorButton
            kind="instagram"
            sent={shared.instagram !== null}
            pressed={open === "instagram"}
            onClick={() => {
              setOpen(open === "instagram" ? null : "instagram");
              setValue("");
              setFieldError(null);
            }}
          />
          <Link href={ROUTES.contacts} className={buttonClasses({ variant: "secondary", block: true })}>
            {anyShared ? "Continue" : "Not now"}
          </Link>
        </div>
        {open !== null ? (
          <form onSubmit={save} noValidate className="flex flex-col gap-3">
            {open === "phone" ? (
              <TextField
                label="Your phone number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                error={fieldError}
                hint="We check the format only."
              />
            ) : (
              <TextField
                label="Your Instagram handle"
                autoCapitalize="none"
                spellCheck={false}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                error={fieldError}
                hint="With or without the @."
              />
            )}
            <Button type="submit" block loading={busy === "save"} disabled={!online}>
              Share
            </Button>
          </form>
        ) : null}
        {error ? <InlineError>{error}</InlineError> : null}
      </Panel>
      {anyShared ? (
        <Panel className="flex flex-col gap-2">
          <p className="text-caption text-ink-muted">What you shared</p>
          {(["phone", "instagram"] as const).map((kind) =>
            shared[kind] === null ? null : (
              <div key={kind} className="flex flex-wrap items-center justify-between gap-2">
                <span className={kind === "phone" ? "min-w-0 font-semibold tabular-nums" : "min-w-0 flex-1 font-semibold wrap-anywhere"}>
                  {kind === "phone" ? formatPhone(shared[kind]!) : instagramDisplay(shared[kind]!)}
                </span>
                <Button variant="quiet" loading={busy === `stop-${kind}`} disabled={!online} onClick={() => stop(kind)}>
                  Stop sharing
                </Button>
              </div>
            ),
          )}
          <p className="text-caption text-ink-muted">
            Stop sharing hides it in Melos from now on. It can&apos;t remove a copy someone already saved.
          </p>
        </Panel>
      ) : null}
    </Screen>
  );
}
