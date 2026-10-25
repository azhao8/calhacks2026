"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InlineError } from "@/components/Card";
import { SpotifyConnectButton } from "@/components/SpotifyConnectButton";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { ONBOARDING_STEP, ROUTES } from "@/app/_lib/routes";
import { LoadingScreen, Screen, ScreenTitle } from "@/app/_components/Screen";

// S07 Connect Spotify (mockup spotify.png). Says exactly what we read and why, then sends the
// student to Spotify's consent page for their assigned app.
export default function ConnectPage() {
  const gate = useGate(ROUTES.connect);
  const connectUrl = useAction(api.spotify.connectUrl);
  const online = useOnline();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (gate.status === "loading") return <LoadingScreen object="cassette" />;

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const url = await connectUrl({ redirectUri: `${window.location.origin}${ROUTES.spotifyCallback}` });
      window.location.assign(url);
    } catch (e) {
      setError(errorCopy(e, { fallback: "We couldn't reach Spotify. Try again." }));
      setConnecting(false);
    }
  }

  return (
    <Screen object="cassette" step={ONBOARDING_STEP[ROUTES.connect]}>
      <ScreenTitle lead="We use your top artists, top tracks and liked songs to write a short read on your taste. You get to correct it.">
        Let us hear what you play
      </ScreenTitle>
      <SpotifyConnectButton
        state={connecting ? "connecting" : "idle"}
        onClick={connect}
        disabled={!online}
        note="We never post for you. Disconnect anytime."
      />
      {error ? <InlineError>{error}</InlineError> : null}
      <p className="text-center text-caption text-ink-muted">
        <Link href={ROUTES.privacy} className="inline-flex min-h-12 items-center font-semibold text-accent underline underline-offset-3">
          What we read and why
        </Link>
      </p>
    </Screen>
  );
}
