import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

// The design's .ml-chip. A selected chip gets a check, so color never carries the meaning alone.
export function Chip({
  selected,
  role,
  onClick,
  sub,
  disabled,
  children,
}: {
  selected: boolean;
  role?: "radio" | "checkbox";
  onClick: () => void;
  sub?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? selected : undefined}
      aria-pressed={role ? undefined : selected}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-12 cursor-pointer items-center gap-1 rounded-pill border-[1.5px] px-4.5 py-2 text-left text-small font-semibold",
        "disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-transparent text-ink",
      )}
    >
      {selected ? <Icon name="check" /> : null}
      {children}
      {sub ? <span className="font-normal text-ink-muted"> {sub}</span> : null}
    </button>
  );
}
