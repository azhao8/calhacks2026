"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InlineError } from "@/components/Card";
import { SpotifyConnectButton } from "@/components/SpotifyConnectButton";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";
import { useAccess } from "@/app/_lib/views";
import { LoadingScreen, Panel, Screen, ScreenTitle } from "@/app/_components/Screen";
import { SpotifyAccount } from "@/app/_components/SpotifyAccount";

// S07 Connect Spotify (mockup spotify.png). Says exactly what we read and why, then sends the
// student to Spotify's consent page for their assigned app.
export default function ConnectPage() {
  const gate = useGate(ROUTES.connect);
  const connectUrl = useAction(api.spotify.connectUrl);
  const online = useOnline();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const access = useAccess(gate.status === "ready" && gate.me ? undefined : "skip");

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
    <Screen object="cassette" menu>
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
      {/* Spotify only lets in the account the app owner added, so say which one, with a way to fix it. */}
      {access?.spotifyEmail ? (
        <Panel>
          <SpotifyAccount lead="Sign in to Spotify as" email={access.spotifyEmail} />
        </Panel>
      ) : null}
      <p className="text-center text-caption text-ink-muted">
        <Link href={ROUTES.privacy} className="inline-flex min-h-12 items-center font-semibold text-accent underline underline-offset-3">
          What we read and why
        </Link>
      </p>
    </Screen>
  );
}
