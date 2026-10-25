import type { ReactNode } from "react";
import { cardClasses, Meta, MetaItem } from "./Card";

export type MatchStage = "invite" | "confirmed" | "dayof";

const EYEBROW: Record<MatchStage, string> = { invite: "New invitation", confirmed: "You're both going", dayof: "Today" };

// The invitation that becomes the plan (design/components/MatchCard). The head is the school's
// brand region; the body is whatever the stage needs. Only ever a first name.
export function MatchCard({
  stage,
  eyebrow,
  title,
  when,
  price,
  children,
}: {
  stage: MatchStage;
  eyebrow?: string;
  title: string;
  when: string;
  price?: string;
  children: ReactNode;
}) {
  return (
    <article className={cardClasses(stage === "invite", true)}>
      <div className="flex flex-col gap-2 bg-surface-brand p-5">
        <p className="text-caption text-accent">{eyebrow ?? EYEBROW[stage]}</p>
        <h1 className="font-display text-title text-balance wrap-break-word">{title}</h1>
        <Meta>
          <MetaItem icon="calendar">{when}</MetaItem>
          {price ? <MetaItem icon="ticket">{price}</MetaItem> : null}
        </Meta>
      </div>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </article>
  );
}

// The shared taste line (.ml-match__shared).
export function SharedLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-sm bg-accent-soft px-4 py-3 text-small font-semibold text-accent">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="mt-0.5 size-[1.25em] flex-none fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]">
        <path d="M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

// The Melos number, in accent at the number style so it reads from across a lobby.
export function MelosNumber({ value }: { value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption text-ink-muted">Your Melos number</p>
      <p className="font-display text-number text-accent tabular-nums">{value}</p>
    </div>
  );
}
