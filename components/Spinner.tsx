import { cx } from "./cx";

// The design's .ml-spin: a ring that turns. Under reduced motion it holds still as a full faint ring.
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block size-[1.1em] flex-none rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin motion-reduce:border-r-current motion-reduce:opacity-60",
        className,
      )}
    />
  );
}
