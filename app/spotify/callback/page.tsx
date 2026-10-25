"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buttonClasses } from "@/components/Button";
import { StateView } from "@/components/StateView";
import { errorCode, errorCopy } from "@/app/_lib/errors";
import { ROUTES } from "@/app/_lib/routes";
import { callbackStep } from "@/app/_lib/spotifyCallback";
import { Screen } from "@/app/_components/Screen";

type Failure = { kind: "refused" } | { kind: "expired" } | { kind: "failed"; message: string };

// Spotify redirects here (registered as {site}/spotify/callback on every Spotify app).
// The page hands code and state to Convex, which swaps them for tokens server-side, but only once
// the session is loaded and signed in (app/_lib/spotifyCallback.ts).
function SpotifyCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const completeConnect = useAction(api.spotify.completeConnect);
  const { isLoading, isAuthenticated } = useConvexAuth();
  const started = useRef(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const code = params.get("code");
  const state = params.get("state");
  const step = callbackStep({ error: params.get("error"), code, state, authLoading: isLoading, authenticated: isAuthenticated });

  useEffect(() => {
    if (step === "missing_params") {
      router.replace(ROUTES.connect);
      return;
    }
    if (step !== "connect" || started.current || !code || !state) return;
    started.current = true;
    const redirectUri = `${window.location.origin}${ROUTES.spotifyCallback}`;
    completeConnect({ code, state, redirectUri })
      .then(() => router.replace(ROUTES.analyzing))
      .catch((e: unknown) => {
        const known = errorCode(e);
        // forbidden: the signed state expired or belongs to another session.
        setFailure(known === "spotify_refused" ? { kind: "refused" } : known === "forbidden" ? { kind: "expired" } : { kind: "failed", message: errorCopy(e) });
      });
  }, [step, code, state, router, completeConnect]);

  if (step === "signed_out") {
    return (
      <>
        <StateView kind="error" title="You're signed out" body="Sign in again, then connect Spotify from there." action={null} />
        <Link href={ROUTES.signIn} className={buttonClasses({ block: true })}>
          Sign in
        </Link>
      </>
    );
  }
  if (step === "declined") {
    return (
      <>
        <StateView
          kind="error"
          title="Spotify wasn't connected"
          body="Melos needs to read your top artists, top tracks and liked songs to pair you. We never post for you."
          action={null}
        />
        <Link href={ROUTES.connect} className={buttonClasses({ block: true })}>
          Try again
        </Link>
      </>
    );
  }
  if (failure === null) {
    return <StateView kind="loading" title="Connecting Spotify" body="This takes a few seconds." />;
  }
  if (failure.kind === "refused") {
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
        title={failure.kind === "expired" ? "That Spotify link expired" : "We couldn't connect Spotify yet"}
        body={failure.kind === "expired" ? "That Spotify link expired. Try connecting again." : failure.message}
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
