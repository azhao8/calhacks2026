import type { ReactNode } from "react";
import { cx } from "./cx";
import { Button } from "./Button";
import { Chip } from "./Chip";

export type QuestionOption = { id: string; label: string; sub?: string };

// One question per screen with chips and "Surprise me" (design/components/QuestionnaireStep).
// Surprise me is never smaller than a chip. `extra` holds a follow up toggle under the chips.
// The count says "Question", not "Step", so it doesn't compete with onboarding's "Step x of 4".
// Without `total` there is no progress bar (one question edited on its own); without `onSurprise`
// there is no Surprise me button.
export function QuestionnaireStep({
  id = "q",
  step,
  total,
  title,
  hint,
  options,
  multi,
  value,
  onChange,
  onNext,
  onSurprise,
  nextLabel = "Continue",
  nextDisabled,
  busy,
  extra,
  error,
}: {
  id?: string;
  step?: number;
  total?: number;
  title: string;
  hint?: string;
  options: QuestionOption[];
  multi?: boolean;
  value: string | string[] | null;
  onChange: (id: string) => void;
  onNext: () => void;
  onSurprise?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: "next" | "surprise" | null;
  extra?: ReactNode;
  error?: ReactNode;
}) {
  const isOn = (option: string) => (Array.isArray(value) ? value.includes(option) : value === option);
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-5">
      {step !== undefined && total !== undefined ? (
        <div className="flex flex-col gap-2">
          <div aria-hidden="true" className="flex gap-1">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={cx("h-1 flex-1 rounded-pill", i < step ? "bg-accent" : "bg-line")} />
            ))}
          </div>
          <p className="text-caption text-ink-muted">
            Question {step} of {total}
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <h1 id={`${id}-title`} className="font-display text-title text-balance text-ink">
          {title}
        </h1>
        {hint ? <p className="text-small text-ink-muted">{hint}</p> : null}
      </div>
      <div role={multi ? "group" : "radiogroup"} aria-labelledby={`${id}-title`} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.id} role={multi ? undefined : "radio"} selected={isOn(o.id)} sub={o.sub} onClick={() => onChange(o.id)}>
            {o.label}
          </Chip>
        ))}
      </div>
      {extra}
      {error}
      <div className={cx("flex flex-wrap items-center gap-3", onSurprise ? "justify-between" : "justify-end")}>
        {onSurprise ? (
          <Button variant="quiet" icon="spark" onClick={onSurprise} loading={busy === "surprise"} disabled={busy === "next"}>
            Surprise me
          </Button>
        ) : null}
        <Button iconAfter="arrow" onClick={onNext} loading={busy === "next"} disabled={nextDisabled || busy === "surprise"}>
          {nextLabel}
        </Button>
      </div>
    </section>
  );
}
