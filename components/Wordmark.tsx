import { cx } from "./cx";

const SIZES = { s: "text-[1.125rem]", m: "text-wordmark", l: "text-[3rem]" } as const;

// The melos text logo: always ink, never on an accent fill. Screen readers hear "Melos".
export function Wordmark({ size = "m", className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Melos"
      className={cx(
        "font-display font-extrabold leading-none tracking-[-0.03em] whitespace-nowrap text-ink [text-shadow:0_1px_12px_var(--scrim)]",
        SIZES[size],
        className,
      )}
    >
      melos
    </span>
  );
}
