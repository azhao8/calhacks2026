import { cx } from "./cx";

// The design's line icon set (design/docs/brand.md): 24px grid, 2px round stroke, currentColor.
const PATHS = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  pin: "M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0113 0C18.5 15.2 12 21 12 21zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  ticket: "M3 9V6.5h18V9a3 3 0 000 6v2.5H3V15a3 3 0 000-6zM14 6.5v11",
  music: "M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
  at: "M16 12a4 4 0 11-8 0 4 4 0 018 0zM16 12v1.5a2.5 2.5 0 005 0V12a9 9 0 10-3.5 7.1",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  alert: "M12 8v5M12 16.5v.5M12 3l10 18H2z",
  offline: "M2 8.5a15 15 0 0120 0M5.5 12a10 10 0 0113 0M9 15.5a5 5 0 016 0M12 19h.01M3 3l18 18",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cx(
        "size-[1.25em] flex-none fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]",
        className,
      )}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
