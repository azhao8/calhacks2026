"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Backdrop, type BackdropObject } from "@/components/Backdrop";
import { cx } from "@/components/cx";
import { MenuButton } from "@/components/MenuButton";
import { StateView } from "@/components/StateView";
import { Wordmark } from "@/components/Wordmark";
import { useOnline } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";

// A full screen on the Backdrop (design/docs/backgrounds.md): the top bar with the wordmark and
// either the step count (onboarding) or the menu, then `top` in the sky and `children` in the lower
// part over the vignette. Content is 480 wide at most, centered, with the 16px gutter and safe areas.
// Height and safe areas come from --app-height, --safe-top and --safe-bottom (device-frame.css), so
// the same screen fills a phone or the demo phone frame.
export function Screen({
  object = "none",
  quiet,
  menu,
  step,
  right,
  top,
  children,
}: {
  object?: BackdropObject;
  quiet?: boolean;
  menu?: boolean;
  step?: string;
  right?: ReactNode;
  top?: ReactNode;
  children?: ReactNode;
}) {
  const online = useOnline();
  return (
    <div className="relative isolate min-h-(--app-height)">
      <Backdrop object={object} quiet={quiet} fixed />
      <div className="relative z-1 mx-auto flex min-h-(--app-height) w-full max-w-120 flex-col justify-between gap-8 px-4 pt-[max(1.5rem,var(--safe-top))] pb-[max(2rem,var(--safe-bottom))]">
        <div className="flex flex-col gap-4">
          <header className="flex min-h-12 items-center justify-between gap-3">
            <Link href={ROUTES.welcome} aria-label="Melos home" className="inline-flex min-h-12 items-center">
              <Wordmark />
            </Link>
            {right ??
              (menu ? (
                <MenuButton href={ROUTES.menu} />
              ) : step ? (
                <p className="text-caption font-semibold text-ink">{step}</p>
              ) : null)}
          </header>
          {online ? null : <StateView kind="offline" inline />}
          {top}
        </div>
        <main className="flex flex-col gap-4">{children}</main>
      </div>
    </div>
  );
}

// A dark panel for text that has to sit mid screen (.ml-panel).
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-sm bg-backdrop-vignette px-4 py-3", className)}>{children}</div>;
}

// The loading state for a whole screen.
export function LoadingScreen({ object = "none", title = "Loading" }: { object?: BackdropObject; title?: string }) {
  return (
    <Screen object={object}>
      <StateView kind="loading" title={title} body="This takes a few seconds." />
    </Screen>
  );
}

// Big screen title in the sky. `inkEyebrow` keeps the eyebrow white where the accent would sit on
// the bright sky and blend in (the welcome screen).
export function ScreenTitle({
  eyebrow,
  inkEyebrow,
  children,
  lead,
  display,
}: {
  eyebrow?: string;
  inkEyebrow?: boolean;
  children: ReactNode;
  lead?: ReactNode;
  display?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow ? <p className={cx("text-small font-semibold", inkEyebrow ? "text-ink" : "text-accent")}>{eyebrow}</p> : null}
      <h1 className={display ? "font-display text-display text-balance" : "font-display text-title text-balance"}>{children}</h1>
      {lead ? <div className="text-body text-ink">{lead}</div> : null}
    </div>
  );
}
