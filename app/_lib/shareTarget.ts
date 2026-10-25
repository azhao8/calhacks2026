import type { Id } from "@/convex/_generated/dataModel";
import type { Shareable } from "./views";

// Which plan Stay in touch shares with (S14). The recipient is only ever the plan the student asked
// for: when /stay-in-touch?meetupId= names a plan, nothing else may stand in for it, even if the
// shareable list fails to load. Sharing a number with the wrong person can't be undone.

export type Candidate = { meetupId: Id<"meetups">; partnerName: string | null };

export type ShareTarget =
  | { kind: "loading" }
  | { kind: "share"; target: Candidate }
  | { kind: "nothing" } // no plan to share with
  | { kind: "unavailable" }; // a specific plan was asked for and can't be confirmed right now

export function shareTarget(
  requested: string | null,
  current: Candidate | null,
  shareable: Shareable[] | undefined | "failed",
): ShareTarget {
  if (current && (requested === null || requested === current.meetupId)) return { kind: "share", target: current };
  if (shareable === "failed") return requested === null ? { kind: "nothing" } : { kind: "unavailable" };
  if (shareable === undefined) return { kind: "loading" };
  const pick = requested === null ? shareable[0] : shareable.find((s) => s.meetupId === requested);
  if (pick) return { kind: "share", target: { meetupId: pick.meetupId, partnerName: pick.partnerFirstName } };
  return requested === null ? { kind: "nothing" } : { kind: "unavailable" };
}
