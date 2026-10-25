import Link from "next/link";
import { cx } from "./cx";

const LOOK =
  "grid size-12 flex-none place-items-center rounded-pill border border-ink/25 bg-backdrop-deep/35 text-ink backdrop-blur-[14px] transition-colors duration-160 hover:bg-backdrop-deep/60";

function Lines() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="size-5.5 fill-none stroke-current [stroke-linecap:round] [stroke-width:2]">
      <path d="M4 9h16M4 15h10" />
    </svg>
  );
}

// Two line hamburger in a 48px frosted pill, top right after onboarding. The menu is its own page (S16).
export function MenuButton({ href, label = "Open menu", className }: { href: string; label?: string; className?: string }) {
  return (
    <Link href={href} aria-label={label} className={cx(LOOK, className)}>
      <Lines />
    </Link>
  );
}

// The same pill as a button, for closing the menu.
export function MenuCloseButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" aria-label="Close menu" onClick={onClick} className={cx(LOOK, "cursor-pointer", className)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="size-5.5 fill-none stroke-current [stroke-linecap:round] [stroke-width:2]">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}
