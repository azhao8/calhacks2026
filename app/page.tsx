"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { homeRoute, ROUTES } from "@/app/_lib/routes";

// S01 for visitors. Signed-in students go straight to the screen their state calls for (CLAUDE.md §5).
// Stream D replaces the welcome markup with the design's Welcome screen.
export default function Home() {
  const router = useRouter();
  const me = useQuery(api.me.get);
  const plan = useQuery(api.plans.current, me ? {} : "skip");
  const target = me && plan !== undefined ? homeRoute(me, plan) : null;

  useEffect(() => {
    if (target !== null) router.replace(target);
  }, [target, router]);

  if (me === undefined || me !== null) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-120 items-end px-4 pb-12">
        <p role="status" className="text-body text-ink-muted">
          Loading
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-120 flex-col justify-end gap-6 bg-canvas px-4 pb-12">
      <p className="font-display text-wordmark text-ink">melos</p>
      <p className="text-small text-accent">For UC Berkeley students</p>
      <h1 className="font-display text-display text-ink">Your Spotify, turned into plans</h1>
      <p className="text-body text-ink-muted">Meet students who share your taste and go to shows together.</p>
      <Link
        href={ROUTES.school}
        className="flex min-h-12 items-center justify-center rounded-pill bg-accent px-6 text-body-strong text-on-accent hover:bg-accent-strong"
      >
        Get started
      </Link>
      <Link href={ROUTES.signIn} className="flex min-h-12 items-center justify-center text-body text-ink-muted">
        I already have an account
      </Link>
    </main>
  );
}
