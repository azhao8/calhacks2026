"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

// The design's .ml-input with a persistent label (never placeholder only), a hint and an error.
export const inputClasses =
  "w-full min-h-12 rounded-sm border-[1.5px] border-line-strong bg-surface-raised px-4 py-2.5 text-body text-ink placeholder:text-ink-faint aria-invalid:border-danger";

type Common = { label: string; hint?: ReactNode; error?: string | null; className?: string };

function Frame({
  id,
  label,
  hint,
  error,
  className,
  children,
}: Common & { id: string; children: ReactNode }) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-small font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-small text-danger">
          <Icon name="alert" className="mt-0.5" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

export function TextField({
  label,
  hint,
  error,
  className,
  id: givenId,
  ...input
}: Common & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  const fallbackId = useId();
  const id = givenId ?? fallbackId;
  return (
    <Frame id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClasses}
      />
    </Frame>
  );
}

export function TextArea({
  label,
  hint,
  error,
  className,
  id: givenId,
  ...input
}: Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  const fallbackId = useId();
  const id = givenId ?? fallbackId;
  return (
    <Frame id={id} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        rows={3}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(inputClasses, "resize-y")}
      />
    </Frame>
  );
}
