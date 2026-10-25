"use client";

import { useEffect, useRef } from "react";
import { announcedTimeLeft, countdownDigits, spokenTimeLeft } from "@/app/_lib/drop";
import { useNow } from "@/app/_lib/hooks";
import { animate, PULSE } from "./DropMotion";

// The drop's global countdown: digits only, big, at the top. Pulses once a second (holds still
// under reduced motion). Screen readers get the time in words, announced politely at coarse steps.
export function DropTimer({ endsAt }: { endsAt: number }) {
  const now = useNow(1000);
  const digits = useRef<HTMLSpanElement>(null);
  const left = now === 0 ? null : endsAt - now;
  const running = left !== null && left > 0;

  useEffect(() => {
    if (running) animate(digits.current, PULSE, { duration: 600, easing: "ease-out" });
  }, [now, running]);

  return (
    <div className="flex flex-col items-center">
      <div role="timer" aria-label={left === null ? undefined : spokenTimeLeft(left)} className="flex justify-center">
        <span
          ref={digits}
          aria-hidden
          // Shrinks on narrow phones so "23:59:59" never wraps at 375 wide.
          style={{ fontSize: "min(var(--text-number), 17vw)" }}
          className="inline-block font-display text-number whitespace-nowrap text-ink tabular-nums [text-shadow:0_2px_24px_var(--color-accent)]"
        >
          {left === null ? " " : countdownDigits(left)}
        </span>
      </div>
      <p aria-live="polite" className="sr-only">
        {left === null ? "" : announcedTimeLeft(left)}
      </p>
    </div>
  );
}
