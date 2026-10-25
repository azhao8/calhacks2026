import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";
import { Wordmark } from "./Wordmark";

// The dark grain gradient, recolored by the school theme (design/components/Canvas). The wordmark
// always sits on top; an image gets a scrim behind the top bar.
export function Canvas({
  school,
  pattern,
  patternSize,
  image,
  logo = true,
  actions,
  children,
  className,
}: {
  school?: string;
  pattern?: string;
  patternSize?: string;
  image?: string;
  logo?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const slot: CSSProperties | null = image
    ? { backgroundImage: `url(${image})` }
    : pattern
      ? { backgroundImage: pattern, backgroundSize: patternSize ?? "auto" }
      : null;
  return (
    <div
      data-theme={school}
      className={cx("relative isolate flex min-h-88 flex-col overflow-hidden rounded-lg bg-canvas text-ink", className)}
    >
      <div aria-hidden="true" className="canvas__glow absolute -inset-[10%] -z-3" />
      {slot ? (
        <div
          aria-hidden="true"
          style={slot}
          className={cx("canvas__slot absolute inset-0 -z-2 bg-cover bg-center", image ? "opacity-50" : "opacity-pattern")}
        />
      ) : null}
      <div aria-hidden="true" className="canvas__grain pointer-events-none absolute inset-0 -z-1 opacity-grain" />
      {logo ? (
        <div className="relative z-2 flex items-center justify-between gap-3 px-4 pt-4">
          {image ? (
            <div aria-hidden="true" className="absolute inset-x-0 top-0 -bottom-6 -z-1 bg-linear-to-b from-scrim to-transparent" />
          ) : null}
          <Wordmark />
          {actions}
        </div>
      ) : null}
      <div className="relative z-1 flex flex-1 flex-col justify-end gap-4 p-4">{children}</div>
    </div>
  );
}
