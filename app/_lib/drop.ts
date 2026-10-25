import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { DropView } from "../../convex/drops/views";
import { dayLabel, timeLabel } from "../../convex/lib/format";

// The Drop contract lives in convex/drops/views.ts; these are the screen's names for it.
export type { DropView };
export type DropEvent = Extract<DropView, { kind: "deciding" }>["event"];

export const dropsApi = api.drops;

// Which part of the drop the global timer counts down. Optional until the backend's field lands.
export type DropPhase = "choosing" | "confirming";

export function dropPhase(drop: DropView): DropPhase | undefined {
  const phase = (drop as { phase?: unknown }).phase;
  return phase === "choosing" || phase === "confirming" ? phase : undefined;
}

// The small line under the timer's digits.
export const PHASE_SUBTITLE: Record<DropPhase, string> = {
  choosing: "Left to choose",
  confirming: "Until matching",
};

export const useDrop = (skip?: "skip") => useQuery(api.drops.mine, skip === "skip" ? "skip" : {});

// "Thursday, Oct 29 · 8:00 pm", in Pacific time whatever the device's zone.
export function whenLabel(ms: number): string {
  return `${dayLabel(ms)} · ${timeLabel(ms)}`;
}

// Countdown digits, always h:mm:ss so the width never jumps: "1:59:59", "0:04:07", "26:00:00".
// Rounds up, so the timer reads 0:00:00 only once the time has actually passed.
export function countdownDigits(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The timer for screen readers, to the minute: "1 hour 59 minutes left", or with the phase
// "1 hour 59 minutes left to choose", "1 hour 59 minutes until matching".
export function spokenTimeLeft(msLeft: number, phase?: DropPhase): string {
  if (msLeft <= 0) return "Time is up";
  const amount = msLeft < 60_000 ? "Less than a minute" : spokenAmount(Math.floor(msLeft / 60_000));
  if (phase === "confirming") return `${amount} until matching`;
  return phase === "choosing" ? `${amount} left to choose` : `${amount} left`;
}

function spokenAmount(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return plural(m, "minute");
  if (m === 0) return plural(h, "hour");
  return `${plural(h, "hour")} ${plural(m, "minute")}`;
}

// What the polite live region says. It changes only at coarse steps (every 15 minutes above an
// hour, every 5 under, every minute in the last 10) so a screen reader is never told every second.
export function announcedTimeLeft(msLeft: number, phase?: DropPhase): string {
  if (msLeft < 60_000) return spokenTimeLeft(msLeft, phase);
  const step = msLeft >= 3_600_000 ? 15 : msLeft >= 600_000 ? 5 : 1;
  const minutes = Math.floor(msLeft / 60_000);
  return spokenTimeLeft(Math.floor(minutes / step) * step * 60_000, phase);
}
