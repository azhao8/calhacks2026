"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buttonClasses } from "@/components/Button";
import { StateView } from "@/components/StateView";
import { errorCode, errorCopy } from "@/app/_lib/errors";
import { ROUTES } from "@/app/_lib/routes";
import { Screen } from "@/app/_components/Screen";

type Outcome = { kind: "working" } | { kind: "declined" } | { kind: "refused" } | { kind: "failed"; message: string };

// Spotify redirects here (registered as {site}/spotify/callback on every Spotify app).
// The page hands code and state to Convex, which swaps them for tokens server-side.
function SpotifyCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const completeConnect = useAction(api.spotify.completeConnect);
  const started = useRef(false);
  // Declining consent on Spotify's page comes back as ?error=access_denied.
  const declined = params.get("error") !== null;
  const [result, setOutcome] = useState<Outcome>({ kind: "working" });
  const outcome: Outcome = declined ? { kind: "declined" } : result;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get("code");
    const state = params.get("state");
    if (declined) return;
    if (!code || !state) {
      router.replace(ROUTES.connect);
      return;
    }
    const redirectUri = `${window.location.origin}${ROUTES.spotifyCallback}`;
    completeConnect({ code, state, redirectUri })
      .then(() => router.replace(ROUTES.analyzing))
      .catch((e: unknown) =>
        setOutcome(errorCode(e) === "spotify_refused" ? { kind: "refused" } : { kind: "failed", message: errorCopy(e) }),
      );
  }, [params, router, completeConnect, declined]);

  if (outcome.kind === "working") {
    return <StateView kind="loading" title="Connecting Spotify" body="This takes a few seconds." />;
  }
  if (outcome.kind === "refused") {
    return (
      <>
        <StateView
          kind="error"
          title="Spotify hasn't let us in yet."
          body="Make sure you sign in to Spotify with the account whose email you gave us. We've let the team know."
          action={null}
        />
        <Link href={ROUTES.welcome} className={buttonClasses({ block: true })}>
          Continue
        </Link>
      </>
    );
  }
  return (
    <>
      <StateView
        kind="error"
        title={outcome.kind === "declined" ? "Spotify wasn't connected" : "We couldn't connect Spotify yet"}
        body={
          outcome.kind === "declined"
            ? "Melos needs to read your top artists, top tracks and liked songs to pair you. We never post for you."
            : outcome.message
        }
        action={null}
      />
      <Link href={ROUTES.connect} className={buttonClasses({ block: true })}>
        Try again
      </Link>
    </>
  );
}

export default function Page() {
  return (
    <Screen object="cassette">
      <Suspense fallback={<StateView kind="loading" title="Connecting Spotify" />}>
        <SpotifyCallback />
      </Suspense>
    </Screen>
  );
}
