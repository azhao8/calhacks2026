"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/Button";
import { InlineError } from "@/components/Card";
import { errorCopy } from "@/app/_lib/errors";
import { InfoCard } from "@/components/InfoCard";
import { StateView } from "@/components/StateView";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";
import { useContacts, useMyActiveShares, type MyShare } from "@/app/_lib/views";
import { formatPhone, instagramDisplay } from "@/app/_lib/validate";
import { Optional } from "@/app/_components/Optional";
import { LoadingScreen, Panel, Screen, ScreenTitle } from "@/app/_components/Screen";

// S15 Contacts (component InfoCard): only values people from your plans chose to share with you.
// Updates live if someone shares later. Melos never sends messages for you.
export default function ContactsPage() {
  const gate = useGate(ROUTES.contacts);
  const ready = gate.status === "ready" && gate.me !== null;
  const contacts = useContacts(ready ? undefined : "skip");
  if (!ready || contacts === undefined) return <LoadingScreen object="none" />;

  return (
    <Screen object="none" quiet menu top={<ScreenTitle>Recent connections</ScreenTitle>}>
      {contacts.length === 0 ? (
        <StateView
          kind="empty"
          icon="phone"
          title="Nothing shared yet"
          body="When someone from one of your plans shares a number or Instagram, it shows up here."
          action={null}
          className="rounded-lg bg-backdrop-vignette"
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {contacts.map((c) => (
            <li key={c.meetupId}>
              <Panel className="flex flex-col gap-3">
                <div>
                  <h2 className="text-headline">{c.firstName}</h2>
                  <p className="text-small text-ink-muted">
                    {c.eventTitle} · {c.dayLabel}
                  </p>
                </div>
                {c.shares.length === 0 ? (
                  <p className="text-small text-ink-muted">Nothing shared yet.</p>
                ) : (
                  c.shares.map((s) => (
                    <InfoCard
                      key={s.kind}
                      kind={s.kind}
                      from={c.firstName}
                      value={s.kind === "phone" ? formatPhone(s.value) : instagramDisplay(s.value)}
                    />
                  ))
                )}
              </Panel>
            </li>
          ))}
        </ul>
      )}
      <Optional>
        <MyShares />
      </Optional>
    </Screen>
  );
}

// What this student shared, from any plan, with a way to stop (S15). Stopping hides the value in
// Melos from now on; it can't remove a copy someone already saved.
function MyShares() {
  const mine = useMyActiveShares();
  const stopSharing = useMutation(api.contacts.stopSharing);
  const online = useOnline();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (mine === undefined || mine.length === 0) return null;

  async function stop(share: MyShare) {
    const key = `${share.meetupId}.${share.kind}`;
    setBusy(key);
    setError(null);
    try {
      await stopSharing({ meetupId: share.meetupId, kind: share.kind });
    } catch (e) {
      setError(errorCopy(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel className="flex flex-col gap-2">
      <h2 className="text-headline">What you shared</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {mine.map((share) => (
          <li key={`${share.meetupId}.${share.kind}`} className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-col">
              <span className="font-semibold wrap-break-word tabular-nums">
                {share.kind === "phone" ? formatPhone(share.value) : instagramDisplay(share.value)}
              </span>
              <span className="text-caption text-ink-muted">With {share.partnerFirstName}</span>
            </span>
            <Button variant="quiet" loading={busy === `${share.meetupId}.${share.kind}`} disabled={!online} onClick={() => stop(share)}>
              Stop sharing
            </Button>
          </li>
        ))}
      </ul>
      {error ? <InlineError>{error}</InlineError> : null}
      <p className="text-caption text-ink-muted">Stop sharing hides it in Melos from now on. It can&apos;t remove a copy someone already saved.</p>
    </Panel>
  );
}
