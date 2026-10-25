"use client";

import { useEffect, useRef } from "react";
import { Button } from "./Button";
import { cardClasses, Meta, MetaItem } from "./Card";
import { animate, ENTER } from "./DropMotion";

// One drop choice: only the date, time and price. Never the event, a count, or the other choices.
// Mount it with a new `key` for each card so the next one animates in after Pass forever.
export function ChoiceCard({
  when,
  price,
  onSeeMore,
  onPass,
  pending,
  locked,
}: {
  when: string;
  price: string;
  onSeeMore: () => void;
  onPass: () => void;
  // Which button is waiting on the server; both are blocked meanwhile.
  pending: "seeMore" | "pass" | null;
  locked?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    animate(ref.current, ENTER, { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
  }, []);

  const busy = pending !== null;
  return (
    <article ref={ref} aria-label={`${when}, ${price}`} className={cardClasses(true)}>
      <p className="text-small font-semibold text-accent">Only for you, only this drop</p>
      <h2 className="font-display text-title tabular-nums">
        {/* The day and the time each stay on one line. */}
        {when.split(" · ").map((part, i) => (
          <span key={i} className="whitespace-nowrap">
            {i > 0 ? " · " : null}
            {part}
          </span>
        ))}
      </h2>
      <Meta>
        <MetaItem icon="ticket">{price}</MetaItem>
        <MetaItem icon="spark">Revealed when you see more</MetaItem>
      </Meta>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-3">
        <Button block onClick={onSeeMore} loading={pending === "seeMore"} disabled={busy || locked}>
          See more
        </Button>
        <Button variant="secondary" block onClick={onPass} loading={pending === "pass"} disabled={busy || locked}>
          Pass forever
        </Button>
      </div>
    </article>
  );
}
