"use client";

import Link from "next/link";
import { cx } from "@/components/cx";
import { Icon } from "@/components/Icon";
import { useBack, useTrackPath } from "@/app/_lib/nav";
import type { Route } from "@/app/_lib/routes";

// "Back" to the previous Melos screen in this tab, or to `fallback` when the student arrived from
// outside (a link, a reload). Never leaves Melos. Pages Next keeps alive keep their typed input.
const LOOK = "inline-flex min-h-12 cursor-pointer items-center gap-1 rounded-pill px-3 text-small font-semibold text-ink hover:text-ink-muted";

export function BackLink({ fallback, label = "Back", className }: { fallback: Route; label?: string; className?: string }) {
  // Pages without a Screen (privacy) still need to count in the in-app history.
  useTrackPath();
  const back = useBack(fallback);
  return (
    <button
      type="button"
      onClick={back}
      className={cx(LOOK, className)}
    >
      <Icon name="arrow" className="rotate-180" />
      {label}
    </button>
  );
}

// "Back" to a fixed earlier screen, for steps whose history entry would only bounce forward again
// (About you comes after sign in, which sends a signed-in student straight back here).
export function BackTo({ href, label = "Back", className }: { href: Route; label?: string; className?: string }) {
  return (
    <Link href={href} className={cx(LOOK, className)}>
      <Icon name="arrow" className="rotate-180" />
      {label}
    </Link>
  );
}
