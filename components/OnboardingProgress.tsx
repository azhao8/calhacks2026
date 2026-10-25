import { cx } from "./cx";

// Onboarding progress in the header: one segment per step, filled up to the current one, with the
// step in words. Static segments, so nothing moves under reduced motion; the fill eases in otherwise.
// It sits in the header, apart from the questionnaire's own "Question x of y" bar in its card.
export function OnboardingProgress({ step, total, className }: { step: number; total: number; className?: string }) {
  const label = `Step ${step} of ${total}`;
  return (
    <div
      role="progressbar"
      aria-label="Getting set up"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-valuetext={label}
      className={cx("flex flex-col gap-1.5", className)}
    >
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cx("h-1.5 flex-1 rounded-pill motion-safe:transition-colors motion-safe:duration-300", i < step ? "bg-ink" : "bg-ink/25")}
          />
        ))}
      </div>
      <p aria-hidden="true" className="text-caption font-semibold text-ink">
        {label}
      </p>
    </div>
  );
}
