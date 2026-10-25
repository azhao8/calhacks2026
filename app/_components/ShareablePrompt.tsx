"use client";

import { useState } from "react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, buttonClasses } from "@/components/Button";
import { Card } from "@/components/Card";
import { getFlag, setFlag } from "@/app/_lib/device";
import { ROUTES } from "@/app/_lib/routes";
import { useShareable } from "@/app/_lib/views";

export function stayInTouchHref(meetupId: string): string {
  return `${ROUTES.stayInTouch}?meetupId=${encodeURIComponent(meetupId)}`;
}

// "Want to stay in touch?" for a recent plan where sharing is still open (S14), offered once on
// home and kept even when a newer offer is live. Render inside <Optional>.
export function ShareablePrompt({ exclude }: { exclude?: Id<"meetups"> }) {
  const shareable = useShareable();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const next = shareable?.find(
    (s) => s.meetupId !== exclude && !dismissed.includes(s.meetupId) && !getFlag(`share-prompt.${s.meetupId}`),
  );
  if (!next) return null;

  const dismiss = () => {
    setFlag(`share-prompt.${next.meetupId}`);
    setDismissed((d) => [...d, next.meetupId]);
  };

  return (
    <Card>
      <p className="font-display text-title">Want to stay in touch?</p>
      <p className="text-small text-ink-muted">
        With {next.partnerFirstName} from {next.eventTitle}.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-3">
        <Link href={stayInTouchHref(next.meetupId)} onClick={dismiss} className={buttonClasses({ block: true })}>
          Share
        </Link>
        <Button variant="secondary" block onClick={dismiss}>
          Not now
        </Button>
      </div>
    </Card>
  );
}
