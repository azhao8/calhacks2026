"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Backdrop } from "./Backdrop";
import { InlineError } from "./Card";
import { cx } from "./cx";
import { Wordmark } from "./Wordmark";

// The reveal as an unboxing: one full screen per step, nothing else on it but the wordmark.
// Each tap breaks the words apart and the next screen pops in on its own color; the last step
// opens as a circle onto the usual gradient. Styles and motion live in components/reveal.css;
// under reduced motion every change is instant.

export type RevealScreenContent = { lead: string | null; big: string; tail: string | null; caps: boolean };

// White first, then the gradient's two main colors, then the gradient itself.
type Tone = "light" | "sky" | "warm" | "open";

const TONE_CLASSES: Record<Exclude<Tone, "open">, string> = {
  light: "bg-ink text-on-accent",
  sky: "bg-backdrop-sky text-ink",
  warm: "bg-streak-warm text-on-accent",
};

function toneFor(index: number, total: number): Tone {
  if (index === 0) return "light";
  if (index === total - 1 && total > 1) return "open";
  return index % 2 === 1 ? "sky" : "warm";
}

// A fixed scatter per letter, so the same words always break the same way.
function scatter(i: number): CSSProperties {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    "--shard-x": `${Math.round((r(1) - 0.5) * 320)}px`,
    "--shard-y": `${Math.round((r(2) - 0.5) * 280 - 60)}px`,
    "--shard-r": `${Math.round((r(3) - 0.5) * 220)}deg`,
    animationDelay: `${Math.round(r(4) * 70)}ms`,
  } as CSSProperties;
}

// Words stay whole on a line; each letter flies on its own.
function Shards({ text, start = 0 }: { text: string; start?: number }) {
  let i = start;
  return (
    <>
      {text.split(" ").map((word, w) => (
        <span key={w} className="inline-block whitespace-nowrap">
          {Array.from(word).map((ch, c) => (
            <span key={c} className="reveal-shard inline-block" style={scatter(i++)}>
              {ch}
            </span>
          ))}
          {" "}
        </span>
      ))}
    </>
  );
}

function Words({ screen, shattered }: { screen: RevealScreenContent; shattered?: boolean }) {
  const part = (text: string, start: number) => (shattered ? <Shards text={text} start={start} /> : text);
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {screen.lead ? <p className="text-headline font-semibold">{part(screen.lead, 0)}</p> : null}
      <p
        className={cx(
          "font-display font-extrabold leading-[1.02] tracking-[-0.02em] text-balance wrap-break-word",
          screen.caps && "uppercase",
        )}
        style={{ fontSize: screen.caps ? "clamp(2.5rem, 13vw, 4.5rem)" : "clamp(2.25rem, 11vw, 3.5rem)" }}
      >
        {part(screen.big, 100)}
      </p>
      {screen.tail ? <p className="text-headline font-semibold">{part(screen.tail, 200)}</p> : null}
    </div>
  );
}

function Center({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("pointer-events-none absolute inset-0 flex items-center justify-center", className)}>
      <div className="mx-auto w-full max-w-120 px-6">{children}</div>
    </div>
  );
}

const BREAK_MS = 620; // how long the broken letters fly

export function RevealSequence({
  screens,
  announce,
  onFinish,
  busy,
  error,
  disabled,
}: {
  screens: RevealScreenContent[];
  // What a screen reader hears for each screen, in plain sentences.
  announce: string[];
  onFinish: () => void;
  busy?: boolean;
  error?: string | null;
  disabled?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<{ index: number; key: number } | null>(null);
  const last = screens.length - 1;
  // The steps are live: never show more than the server still sends.
  const shown = Math.min(index, last);
  const tone = toneFor(shown, screens.length);
  const leavingTone = leaving ? toneFor(Math.min(leaving.index, last), screens.length) : null;
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), BREAK_MS + 120);
    return () => clearTimeout(t);
  }, [leaving]);

  function tap() {
    if (busy || disabled || screens.length === 0) return;
    if (shown >= last) {
      onFinish();
      return;
    }
    setLeaving({ index: shown, key: Date.now() });
    setIndex(shown + 1);
  }

  const fg = tone === "open" ? "text-ink" : TONE_CLASSES[tone];
  const previousSolid = tone === "open" && shown > 0 ? toneFor(shown - 1, screens.length) : null;

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* The color pops in with each step; the last step opens a circle onto the gradient. */}
      {tone === "open" ? (
        <>
          <div className={cx("absolute inset-0", previousSolid && previousSolid !== "open" ? TONE_CLASSES[previousSolid] : "bg-canvas")} />
          <div className="reveal-iris absolute inset-0">
            <Backdrop />
          </div>
        </>
      ) : (
        <div key={shown} className={cx("absolute inset-0", TONE_CLASSES[tone], shown > 0 && "reveal-pop")} />
      )}

      {/* A ring of light from the middle with each tap. */}
      {leaving ? <div key={`boom-${leaving.key}`} aria-hidden className={cx("reveal-boom pointer-events-none absolute top-1/2 left-1/2", fg)} /> : null}

      <Center className={fg}>
        <div key={shown} className={shown === 0 ? "reveal-arrive" : "reveal-rise"}>
          <Words screen={screens[shown]} />
        </div>
      </Center>

      {leaving && leavingTone ? (
        <Center key={`out-${leaving.key}`} className={leavingTone === "open" ? "text-ink" : TONE_CLASSES[leavingTone].split(" ").filter((c) => c.startsWith("text-")).join(" ")}>
          <div aria-hidden>
            <Words screen={screens[Math.min(leaving.index, last)]} shattered />
          </div>
        </Center>
      ) : null}

      {/* The wordmark in its usual place, on a scrim where the color behind it is light. */}
      <div className="pointer-events-none absolute inset-x-0 top-0">
        <div className="mx-auto flex w-full max-w-120 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <div className={cx("flex min-h-12 items-center", (tone === "light" || tone === "warm") && "rounded-pill bg-scrim px-3")}>
            <Wordmark />
          </div>
        </div>
      </div>

      <div className={cx("pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]", fg)}>
        {error ? (
          <div className="rounded-sm bg-backdrop-vignette px-4 py-3">
            <InlineError>{error}</InlineError>
          </div>
        ) : null}
        <p key={shown} aria-hidden className="reveal-tap text-headline font-semibold">
          {busy ? "Opening" : "Tap"}
        </p>
      </div>

      {/* The whole screen is one real button. */}
      <button
        type="button"
        onClick={tap}
        aria-label={shown >= last ? "See your plan" : "Open the next one"}
        aria-busy={busy || undefined}
        className="absolute inset-0 cursor-pointer focus-visible:outline-offset-[-6px]"
      />

      <p aria-live="polite" className="sr-only">
        {announce[shown] ?? ""}
      </p>
    </div>
  );
}
