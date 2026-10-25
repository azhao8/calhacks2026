import { cx } from "./cx";

// One opened step of the reveal. The newest is large; earlier ones stay above it, quieter, so the
// student can read back what they share. Rises into place unless motion is reduced.
export function RevealLine({ line, detail, latest }: { line: string; detail?: string | null; latest: boolean }) {
  return (
    <li className={cx("flex flex-col gap-1 rounded-sm bg-backdrop-vignette px-4 py-3 motion-safe:animate-reveal-in", !latest && "opacity-80")}>
      <p className={cx("text-balance wrap-break-word", latest ? "font-display text-title text-ink" : "text-body-strong text-ink-muted")}>
        {line}
      </p>
      {detail ? <p className="text-small text-ink-muted wrap-break-word">{detail}</p> : null}
    </li>
  );
}

// The present: a large real button that opens the next step. `opened` keys a small squeeze each
// time it's tapped; the button itself stays mounted so keyboard focus stays on it.
export function RevealPresent({ opened, total, onOpen }: { opened: number; total: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-describedby="reveal-count"
      className="group flex min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-accent bg-surface-brand p-5 text-ink shadow-glow transition-colors duration-160 hover:bg-surface-raised"
    >
      <span key={opened} className="flex flex-col items-center gap-3 motion-safe:animate-reveal-pop">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="size-10 fill-none stroke-accent [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.75]"
        >
          <path d="M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="font-display text-title">Tap to open</span>
      </span>
      <span id="reveal-count" className="text-small text-ink-muted tabular-nums">
        {opened} of {total} opened
      </span>
    </button>
  );
}
