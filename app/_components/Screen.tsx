"use client";

import type { ReactNode } from "react";
import { Backdrop, type BackdropObject } from "@/components/Backdrop";
import { MenuButton } from "@/components/MenuButton";
import { StateView } from "@/components/StateView";
import { Wordmark } from "@/components/Wordmark";
import { useOnline } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";

// A full screen on the Backdrop (design/docs/backgrounds.md): the top bar with the wordmark and
// either the step count (onboarding) or the menu, then `top` in the sky and `children` in the lower
// part over the vignette. Content is 480 wide at most, centered, with the 16px gutter and safe areas.
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
    <div className="relative isolate min-h-dvh">
      <Backdrop object={object} quiet={quiet} fixed />
      <div className="relative z-1 mx-auto flex min-h-dvh w-full max-w-120 flex-col justify-between gap-8 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-4">
          <header className="flex min-h-12 items-center justify-between gap-3">
            <Wordmark />
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
  return <div className={`rounded-sm bg-backdrop-vignette px-4 py-3 ${className ?? ""}`}>{children}</div>;
}

// The loading state for a whole screen.
export function LoadingScreen({ object = "none", title = "Loading" }: { object?: BackdropObject; title?: string }) {
  return (
    <Screen object={object}>
      <StateView kind="loading" title={title} body="This takes a few seconds." />
    </Screen>
  );
}

// Big screen title in the sky.
export function ScreenTitle({ eyebrow, children, lead, display }: { eyebrow?: string; children: ReactNode; lead?: ReactNode; display?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow ? <p className="text-small font-semibold text-accent">{eyebrow}</p> : null}
      <h1 className={display ? "font-display text-display text-balance" : "font-display text-title text-balance"}>{children}</h1>
      {lead ? <div className="text-body text-ink">{lead}</div> : null}
    </div>
  );
}
