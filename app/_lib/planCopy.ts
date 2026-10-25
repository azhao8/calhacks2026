import type { PlanView } from "@/convex/lib/views";

// Plan copy that depends on the cutoff (CLAUDE.md §3, §6.5). Before the cutoff a seat given up is
// refilled; after it nobody new is added, so the copy never promises a replacement then.

// hook is null when there's no active partner seat (for example between a drop and the refill).
type Plan = Pick<PlanView, "stage" | "notice" | "partner" | "previousPartnerFirstName" | "beforeCutoff"> & { hook: string | null };

export type Ended = { kind: "next_time" | "cant_make_it" | "no_ticket"; beforeCutoff: boolean; meetupId: string };

const TOO_CLOSE = "It's too close to the show to find someone new.";

// The neutral line about the other seat, or null when there's nothing to say.
export function partnerNoticeText(plan: Plan): string | null {
  if (plan.notice === "partner_dropped" || (plan.partner === null && plan.stage !== "offer")) {
    const lead = plan.previousPartnerFirstName ? `${plan.previousPartnerFirstName} can't make it. ` : "";
    if (!plan.beforeCutoff) return `${lead}${TOO_CLOSE} You can still go if you have a ticket.`;
    return lead
      ? `${lead}We're finding someone else who's going.`
      : "Your plan is still on. We're finding someone else who's going. You don't need to do anything.";
  }
  if (plan.notice === "partner_replaced" && plan.partner)
    return plan.hook ? `${plan.partner.firstName} is coming instead. ${plan.hook}` : `${plan.partner.firstName} is coming instead.`;
  if (plan.notice === "partner_left" && plan.partner) return `${plan.partner.firstName} had to head out. Enjoy the show.`;
  return null;
}

export function cantMakeItDetail(plan: Plan): string {
  const name = plan.partner?.firstName ?? null;
  if (plan.beforeCutoff) {
    return name
      ? `That's okay. ${name} keeps the plan, and we'll look for someone else who's going.`
      : "That's okay. We'll let the plan go for you.";
  }
  return name ? `That's okay. ${TOO_CLOSE} We'll let ${name} know kindly.` : `That's okay. ${TOO_CLOSE}`;
}

export function couldntGetOneDetail(plan: Plan): string {
  return plan.beforeCutoff
    ? "That's okay. Your seat opens for someone else who's going, and the plan carries on for them."
    : `That's okay. ${TOO_CLOSE}`;
}

export function afterLeavingText(ended: Ended): { title: string; body: string } {
  if (ended.kind === "next_time") return { title: "No problem. We will keep looking.", body: "Your other yeses still count." };
  return ended.beforeCutoff
    ? { title: "Done. Your seat is open for someone else.", body: "We will keep looking for your other yeses." }
    : { title: "Done. Thanks for letting us know.", body: "We will keep looking for your other yeses." };
}
