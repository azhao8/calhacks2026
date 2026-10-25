"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ROUTES } from "@/app/_lib/routes";

// Spotify redirects here (registered as {site}/spotify/callback on every Spotify app).
// The page hands code and state to Convex, which swaps them for tokens server-side.
function SpotifyCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const completeConnect = useAction(api.spotify.completeConnect);
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      router.replace(ROUTES.connect);
      return;
    }
    const redirectUri = `${window.location.origin}${ROUTES.spotifyCallback}`;
    completeConnect({ code, state, redirectUri })
      .then(() => router.replace(ROUTES.analyzing))
      .catch(() => setFailed(true));
  }, [params, router, completeConnect]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-end gap-3 px-4 pb-12">
      {failed ? (
        <>
          <p role="alert" className="text-ink">
            We couldn&apos;t connect Spotify yet.
          </p>
          <Link href={ROUTES.connect} className="text-accent underline">
            Try again
          </Link>
        </>
      ) : (
        <p role="status" className="text-ink-muted">
          Connecting Spotify
        </p>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SpotifyCallback />
    </Suspense>
  );
}
