"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { StateView } from "@/components/StateView";
import { useGate } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";
import { useAccess } from "@/app/_lib/views";
import { LoadingScreen, Panel, Screen, ScreenTitle } from "@/app/_components/Screen";

// S06 Waiting for Spotify access (no mockup). Updates live: when the app owner marks the student as
// added, onboarding moves on and the gate sends them to Connect. No fake progress or wait times.
export default function WaitingPage() {
  const gate = useGate(ROUTES.waiting);
  const access = useAccess(gate.status === "ready" && gate.me ? undefined : "skip");
  if (gate.status === "loading" || access === undefined) return <LoadingScreen object="cassette" />;

  let body;
  if (access.status === "no_capacity") {
    body = (
      <ScreenTitle lead="We'll email you when there's room.">We&apos;re at capacity with Spotify right now.</ScreenTitle>
    );
  } else if (access.refused) {
    body = (
      <ScreenTitle
        lead={
          access.spotifyEmail
            ? `Make sure you sign in to Spotify as ${access.spotifyEmail}. If you used a different account, switch accounts in Spotify. We'll email you when you can try again.`
            : "Make sure you sign in to Spotify with the account whose email you gave us. If you used a different account, switch accounts in Spotify. We'll email you when you can try again."
        }
      >
        Spotify hasn&apos;t let us in yet.
      </ScreenTitle>
    );
  } else {
    body = (
      <ScreenTitle lead={access.spotifyEmail ? `The Spotify account we're adding: ${access.spotifyEmail}` : undefined}>
        You&apos;re on the list. We&apos;ll email you when Spotify is ready to connect.
      </ScreenTitle>
    );
  }

  return (
    <Screen object="cassette" menu>
      <Panel className="flex flex-col gap-3">{body}</Panel>
      <StateView
        kind="empty"
        icon="clock"
        title="Melos is in early access with Spotify"
        body="We add each account by hand, so it isn't instant. This page updates on its own."
        action={null}
      />
      <Link href={ROUTES.preferences} className={buttonClasses({ variant: "secondary", block: true })}>
        Change my preferences
      </Link>
    </Screen>
  );
}
