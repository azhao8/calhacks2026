import { getFlag, setFlag } from "./device";

// The student's latest seat that went out as "Next time" or unanswered in the last 24 hours
// (plans.lastEnded). Your week says "No problem. We will keep looking." once for it, per device.

export type LastEnded = { meetupId: string; outReason: "no_answer" | "next_time"; outAt: number } | null;

export const LAST_ENDED_LINE = "No problem. We will keep looking.";

const key = (meetupId: string) => `ended.${meetupId}`;

export function markEndedSeen(meetupId: string): void {
  setFlag(key(meetupId));
}

export function shouldShowEnded(entry: LastEnded | undefined, seen: (meetupId: string) => boolean = (id) => getFlag(key(id))): boolean {
  return entry != null && !seen(entry.meetupId);
}
