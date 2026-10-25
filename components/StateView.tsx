import { cx } from "./cx";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

export type StateKind = "loading" | "empty" | "error" | "offline";

const DEFAULTS: Record<StateKind, { title: string; body: string; action?: string; icon?: IconName }> = {
  loading: { title: "Loading", body: "This takes a few seconds." },
  empty: { title: "Nothing here yet", body: "We will let you know when something arrives." },
  error: { title: "Something went wrong", body: "Check your connection and try again.", action: "Try again", icon: "alert" },
  offline: { title: "You're offline", body: "Your plans are saved here and will update when you are back.", icon: "offline" },
};

// Loading, empty, error and offline states in one voice (design/components/StateView).
// Loading shows equalizer bars that hold still under reduced motion.
export function StateView({
  kind,
  title,
  body,
  action,
  onAction,
  actionLoading,
  inline,
  icon,
  className,
}: {
  kind: StateKind;
  title?: string;
  body?: string;
  action?: string | null;
  onAction?: () => void;
  actionLoading?: boolean;
  inline?: boolean;
  icon?: IconName;
  className?: string;
}) {
  const d = DEFAULTS[kind];
  if (inline && kind === "offline") {
    return (
      <div role="status" className={cx("flex items-center gap-3 rounded-sm bg-surface-raised px-4 py-3 text-small text-ink", className)}>
        <Icon name="offline" />
        {title ?? d.title}
      </div>
    );
  }
  const label = action === undefined ? d.action : action;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-busy={kind === "loading" || undefined}
      className={cx("flex flex-col items-center gap-3 px-4 py-6 text-center", className)}
    >
      {kind === "loading" ? (
        <div aria-hidden="true" className="flex h-8 items-end gap-1.25">
          {["[animation-delay:0s]", "[animation-delay:-.3s]", "[animation-delay:-.6s]", "[animation-delay:-.15s]"].map((delay, i) => (
            <span
              key={delay}
              className={cx(
                "w-1.5 rounded-pill bg-accent motion-safe:animate-eq",
                i % 2 === 0 ? "motion-reduce:h-full" : "motion-reduce:h-[60%]",
                delay,
              )}
            />
          ))}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className={cx(
            "grid size-14 place-items-center rounded-full bg-surface-raised",
            kind === "error" ? "text-danger" : "text-ink-muted",
          )}
        >
          <Icon name={icon ?? d.icon ?? "calendar"} />
        </div>
      )}
      <p className="text-headline text-ink">{title ?? d.title}</p>
      <p className="max-w-88 text-small text-ink-muted">{body ?? d.body}</p>
      {label ? (
        <Button variant="secondary" onClick={onAction} loading={actionLoading}>
          {label}
        </Button>
      ) : null}
    </div>
  );
}
