"use client";

import { useEffect, useRef } from "react";
import { Button } from "./Button";
import { cardClasses, Meta, MetaItem } from "./Card";
import { animate, ENTER, FLIP_OUT } from "./DropMotion";
import { WaveRing } from "./WaveRing";

// One drop choice: only the date, time and price. Never the event, a count, or the other choices.
// Mount it with a new `key` for each card so the next one animates in after Pass forever.
// See more turns the card over; the event turns in on the other side (FLIP_IN on the Drop page).
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
  // Resolves false when the server refused, so the card turns back.
  onSeeMore: () => Promise<boolean>;
  onPass: () => void;
  // Which button is waiting on the server; both are blocked meanwhile.
  pending: "seeMore" | "pass" | null;
  locked?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    animate(ref.current, ENTER, { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
  }, []);

  function seeMore() {
    const flip = animate(ref.current, FLIP_OUT, { duration: 260, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" });
    void onSeeMore().then((ok) => {
      if (!ok) flip?.cancel();
    });
  }

  const busy = pending !== null;
  return (
    <div className="flex flex-col gap-5">
      <div ref={ref}>
        <WaveRing>
          <article aria-label={`${when}, ${price}`} className={cardClasses(true)}>
            <p className="text-small font-semibold text-accent">Only for you, only this drop</p>
            <h2 className="font-display text-title tabular-nums">
              {/* Keeps "Oct 29 ·" and "8:00 pm" whole while the line can still wrap between words. */}
              {when.replace(/(?<!·) (?=\d|am|pm|·)/g, " ")}
            </h2>
            <Meta>
              <MetaItem icon="ticket">{price}</MetaItem>
              <MetaItem icon="spark">Revealed when you see more</MetaItem>
            </Meta>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-3">
              <Button block onClick={seeMore} loading={pending === "seeMore"} disabled={busy || locked}>
                See more
              </Button>
              <Button variant="secondary" block onClick={onPass} loading={pending === "pass"} disabled={busy || locked}>
                Pass forever
              </Button>
            </div>
          </article>
        </WaveRing>
      </div>
      <p className="text-center text-small text-ink-muted">Choose carefully. You may not undo.</p>
    </div>
  );
}
