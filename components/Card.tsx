import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

// The design's .ml-card. `selected` marks the one thing that just changed (shadow-glow).
// `flush` drops the padding and gap for cards with their own regions (MatchCard).
export const cardClasses = (selected?: boolean, flush?: boolean) =>
  cx(
    "flex flex-col rounded-lg border bg-surface text-ink",
    flush ? "overflow-hidden" : "gap-4 p-5",
    selected ? "border-accent shadow-glow" : "border-line shadow-card",
  );

export function Card({ selected, className, children }: { selected?: boolean; className?: string; children: ReactNode }) {
  return <article className={cx(cardClasses(selected), className)}>{children}</article>;
}

// The design's .ml-tag.
export function Tag({ accent, icon, children }: { accent?: boolean; icon?: IconName; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-caption font-semibold",
        accent ? "bg-accent-soft text-accent" : "bg-surface-raised text-ink-muted",
      )}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

// Icon + text metadata row (.ml-card__meta).
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-wrap gap-x-4 gap-y-2 text-small text-ink-muted tabular-nums", className)}>{children}</div>;
}

export function MetaItem({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon name={icon} />
      {children}
    </span>
  );
}

// Success line with a check (.ml-ok). Words and an icon, never color alone.
export function Ok({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="inline-flex items-center gap-2 font-semibold text-success">
      <Icon name="check" />
      {children}
    </p>
  );
}

// An inline error with an icon (role alert), for failed actions.
export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 text-small text-danger">
      <Icon name="alert" className="mt-0.5" />
      <span>{children}</span>
    </p>
  );
}
