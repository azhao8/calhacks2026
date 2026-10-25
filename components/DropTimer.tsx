"use client";

import { useEffect, useRef } from "react";
import { announcedTimeLeft, countdownDigits, PHASE_SUBTITLE, spokenTimeLeft, type DropPhase } from "@/app/_lib/drop";
import { useNow } from "@/app/_lib/hooks";
import { cx } from "./cx";
import { animate, KICK, PULSE, PULSE_HOT } from "./DropMotion";

// How hot the timer runs: white until the last 10 minutes, then gold, deeper gold, and red in the
// last minute. Color and words carry the change, so it still reads under reduced motion.
type Heat = "calm" | "warm" | "hot" | "last";

function heatFor(msLeft: number): Heat {
  if (msLeft > 10 * 60_000) return "calm";
  if (msLeft > 5 * 60_000) return "warm";
  if (msLeft > 60_000) return "hot";
  return "last";
}

const HEAT_CLASSES: Record<Heat, string> = {
  calm: "text-ink [text-shadow:0_2px_24px_var(--color-accent)]",
  warm: "text-accent-strong [text-shadow:0_2px_28px_var(--color-accent)]",
  hot: "text-accent [text-shadow:0_2px_32px_var(--color-accent)]",
  last: "text-danger [text-shadow:0_2px_36px_var(--color-danger)]",
};

// The drop's global countdown: digits only, big, at the top, with a small line under it saying what
// it counts down. Pulses once a second, harder as time runs out, with a kick each second of the
// last ten (holds still under reduced motion). Screen readers get the time in words, announced
// politely at coarse steps.
export function DropTimer({ endsAt, phase }: { endsAt: number; phase?: DropPhase }) {
  const now = useNow(1000);
  const digits = useRef<HTMLSpanElement>(null);
  const left = now === 0 ? null : endsAt - now;
  const running = left !== null && left > 0;
  const heat = left === null ? "calm" : heatFor(left);

  useEffect(() => {
    if (!running || left === null) return;
    if (left <= 10_000) animate(digits.current, KICK, { duration: 450, easing: "cubic-bezier(0.3, 1.5, 0.5, 1)" });
    else animate(digits.current, heat === "calm" ? PULSE : PULSE_HOT, { duration: 600, easing: "ease-out" });
    // Once a tick; `left` changes with `now`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, running]);

  return (
    <div className="flex flex-col items-center">
      <div role="timer" aria-label={left === null ? undefined : spokenTimeLeft(left, phase)} className="flex justify-center">
        <span
          ref={digits}
          aria-hidden
          // Shrinks on narrow phones so "23:59:59" never wraps at 375 wide.
          style={{ fontSize: "min(var(--text-number), 17vw)" }}
          className={cx(
            "inline-block font-display text-number whitespace-nowrap tabular-nums transition-[color,text-shadow] duration-1000",
            HEAT_CLASSES[heat],
          )}
        >
          {left === null ? " " : countdownDigits(left)}
        </span>
      </div>
      {phase ? (
        <p aria-hidden className="text-small font-semibold text-ink-muted">
          {PHASE_SUBTITLE[phase]}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {left === null ? "" : announcedTimeLeft(left, phase)}
      </p>
    </div>
  );
}
