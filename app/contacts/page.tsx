"use client";

import { InfoCard } from "@/components/InfoCard";
import { StateView } from "@/components/StateView";
import { useGate } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";
import { useContacts } from "@/app/_lib/views";
import { formatPhone, instagramDisplay } from "@/app/_lib/validate";
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
    </Screen>
  );
}
