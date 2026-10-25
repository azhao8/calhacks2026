"use client";

import { useState } from "react";
import Link from "next/link";
import type { PlanView } from "@/convex/lib/views";
import { Button, buttonClasses } from "@/components/Button";
import { Card } from "@/components/Card";
import { getFlag, setFlag } from "@/app/_lib/device";
import { isActivePlan } from "@/app/_lib/routes";
import { Optional } from "@/app/_components/Optional";
import { ShareablePrompt, stayInTouchHref } from "@/app/_components/ShareablePrompt";

// What the week screen used to say about a plan that ended, now that home is the Drop: the kind
// notice for a called off plan, and the offer to stay in touch after a meetup (CLAUDE.md §5 S12, S14).
export function EndedPlanNotices({ plan }: { plan: PlanView | null }) {
  return (
    <>
      <PlanNotices plan={plan} />
      {/* Without stream C's shareable query, fall back to the completed plan's own prompt. */}
      <Optional fallback={plan && plan.stage === "after" && plan.canShare ? <AfterSharePrompt plan={plan} /> : null}>
        <ShareablePrompt exclude={isActivePlan(plan) ? plan?.meetupId : undefined} />
      </Optional>
    </>
  );
}

function PlanNotices({ plan }: { plan: PlanView | null }) {
  const key = plan ? `seen.${plan.meetupId}.${plan.stage}` : null;
  const [dismissed, setDismissed] = useState(() => (key ? getFlag(key) : false));
  if (plan === null || key === null || dismissed) return null;

  const dismiss = () => {
    setFlag(key);
    setDismissed(true);
  };

  if (plan.stage === "called_off") {
    return (
      <Card>
        <p role="status" className="text-body text-ink">
          {plan.notice === "event_pulled"
            ? "This event isn't on Melos anymore. If you already have a ticket, check the official listing before you go."
            : "We couldn't find anyone else in time. You can still go if you have a ticket."}
        </p>
        <Button variant="secondary" block onClick={dismiss}>
          Got it
        </Button>
      </Card>
    );
  }
  return null;
}

function AfterSharePrompt({ plan }: { plan: PlanView }) {
  const key = `seen.${plan.meetupId}.after`;
  const [dismissed, setDismissed] = useState(() => getFlag(key));
  if (dismissed) return null;
  const dismiss = () => {
    setFlag(key);
    setDismissed(true);
  };
  return (
    <Card>
      <p className="font-display text-title">Want to stay in touch?</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-3">
        <Link href={stayInTouchHref(plan.meetupId)} onClick={dismiss} className={buttonClasses({ block: true })}>
          Share
        </Link>
        <Button variant="secondary" block onClick={dismiss}>
          Not now
        </Button>
      </div>
    </Card>
  );
}
