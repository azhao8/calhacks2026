import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "quiet";

type Look = { variant?: ButtonVariant; block?: boolean; className?: string };

// Shared with links styled as buttons (Buy your ticket, Open directions).
export function buttonClasses({ variant = "primary", block, className }: Look): string {
  return cx(
    "inline-flex min-h-12 min-w-12 max-w-full cursor-pointer items-center justify-center gap-2 rounded-pill border-[1.5px] py-2.5 text-center text-body-strong leading-[1.3]",
    "transition-[background-color,border-color,color,transform] duration-160 ease-out motion-safe:active:scale-[0.98]",
    // A loading button is natively disabled too (so a form can't submit twice) but keeps its look.
    "not-aria-busy:disabled:cursor-not-allowed not-aria-busy:disabled:border-transparent not-aria-busy:disabled:bg-surface-raised not-aria-busy:disabled:text-ink-faint",
    "aria-busy:cursor-progress motion-safe:disabled:active:scale-100",
    "aria-disabled:cursor-not-allowed aria-disabled:border-transparent aria-disabled:bg-surface-raised aria-disabled:text-ink-faint",
    variant === "primary" && "border-transparent bg-accent px-5.5 text-on-accent hover:bg-accent-strong",
    variant === "secondary" &&
      "border-line-strong bg-transparent px-5.5 text-ink hover:bg-surface-raised aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent",
    variant === "quiet" && "border-transparent bg-transparent px-3 text-ink-muted hover:text-ink",
    block && "flex w-full",
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  Look & {
    icon?: IconName;
    iconAfter?: IconName;
    // Shows a spinner in place of the icon and blocks repeat taps. The label stays, so the width holds.
    loading?: boolean;
    // For toggles such as "I can make it"; the label should say the current state.
    pressed?: boolean;
  };

export function Button({
  variant,
  block,
  className,
  icon,
  iconAfter,
  loading,
  pressed,
  children,
  onClick,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-pressed={pressed === undefined ? undefined : pressed}
      onClick={loading ? undefined : onClick}
      className={buttonClasses({ variant, block, className })}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} /> : null}
    </button>
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & Look & { icon?: IconName; children: ReactNode };

// An outside link that looks like a button. Opens in a new tab.
export function ButtonLink({ variant, block, className, icon, children, ...rest }: ButtonLinkProps) {
  return (
    <a target="_blank" rel="noopener noreferrer" {...rest} className={buttonClasses({ variant, block, className })}>
      {icon ? <Icon name={icon} className="flex-none" /> : null}
      {/* At large text sizes a long word wraps inside the button rather than running past the card. */}
      <span className="min-w-0 wrap-break-word">{children}</span>
    </a>
  );
}
