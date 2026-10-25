"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buttonClasses } from "@/components/Button";
import { StateView } from "@/components/StateView";
import { useHomeTarget } from "@/app/_lib/home";
import { ROUTES } from "@/app/_lib/routes";
import { Screen, ScreenTitle } from "@/app/_components/Screen";

// S01 Welcome for visitors (mockup welcome.png). Signed-in students go straight to the screen their
// state calls for (CLAUDE.md §5 home priority).
export default function Home() {
  const router = useRouter();
  const me = useQuery(api.me.get);
  const target = useHomeTarget(me);

  useEffect(() => {
    if (target !== null) router.replace(target);
  }, [target, router]);

  if (me === undefined || me !== null) {
    return (
      <Screen object="speaker">
        <StateView kind="loading" title="Opening Melos" body="This takes a few seconds." />
      </Screen>
    );
  }

  return (
    <Screen object="speaker">
      <ScreenTitle eyebrow="For UC Berkeley students" inkEyebrow display lead={<p className="text-ink">Meet students who share your taste and go to shows together.</p>}>
        Your Spotify, turned into plans
      </ScreenTitle>
      <div className="flex flex-col gap-2">
        <Link href={ROUTES.school} className={buttonClasses({ block: true })}>
          Get started
        </Link>
        <Link href={ROUTES.signIn} className={buttonClasses({ variant: "quiet", block: true })}>
          I already have an account
        </Link>
      </div>
    </Screen>
  );
}
