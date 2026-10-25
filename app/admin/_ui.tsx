"use client";

import { useState, type ReactNode } from "react";
import { ConvexError } from "convex/values";
import { Button, type ButtonVariant } from "@/components/Button";
import { InlineError, Ok } from "@/components/Card";
import { Icon, type IconName } from "@/components/Icon";
import { cx } from "@/components/cx";
import { dayLabel, timeLabel } from "@/convex/lib/format";

// Shared pieces for the S17 admin page. Plain, calm, and built from the app's own components.

export const when = (ms: number) => `${dayLabel(ms)} · ${timeLabel(ms)}`;

const MINUTE = 60_000;
export function ago(ms: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - ms) / MINUTE));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return dayLabel(ms);
}

// Our own functions explain refusals in words; show those, otherwise a plain retry line.
// A failure the page itself words, shown as is.
export class ShownError extends Error {}

export function failureText(error: unknown): string {
  if (error instanceof ShownError) return error.message;
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === "object" && data !== null && "message" in data) {
      const message = (data as { message: unknown }).message;
      if (typeof message === "string" && message !== "forbidden" && !/^[a-z_]+$/.test(message)) return message;
      if (message === "forbidden") return "This account isn't on the team list.";
    }
  }
  return "That didn't work. Try again.";
}

// One server call at a time per control, with the result in words.
export function useRun() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  async function run(name: string, call: () => Promise<unknown>, doneText?: string): Promise<boolean> {
    setBusy(name);
    setError(null);
    setDone(null);
    try {
      await call();
      if (doneText) setDone(doneText);
      return true;
    } catch (e) {
      setError(failureText(e));
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, done, run, setDone, setError };
}

export function Result({ error, done }: { error: string | null; done?: string | null }) {
  if (error) return <InlineError>{error}</InlineError>;
  if (done) return <Ok>{done}</Ok>;
  return null;
}

export function Panel({ title, lead, action, children }: { title: string; lead?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-headline text-ink">{title}</h2>
          {lead ? <p className="text-small text-ink-muted">{lead}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// A button with a short line under it that says what it does, or why it can't be used right now.
export function Action({
  label,
  explain,
  onClick,
  busy,
  disabledReason,
  variant = "secondary",
  icon,
}: {
  label: string;
  explain: string;
  onClick: () => void;
  busy?: boolean;
  disabledReason?: string | null;
  variant?: ButtonVariant;
  icon?: IconName;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Button variant={variant} onClick={onClick} loading={busy} disabled={Boolean(disabledReason)} icon={icon} className="self-start">
        {label}
      </Button>
      <p className="text-caption text-ink-muted">{disabledReason ?? explain}</p>
    </div>
  );
}

// A destructive action: first tap shows exactly what will happen, second tap does it.
export function ConfirmAction({
  label,
  explain,
  question,
  consequence,
  yes,
  onConfirm,
  busy,
  disabledReason,
}: {
  label: string;
  explain: string;
  question: string;
  consequence: string;
  yes: string;
  onConfirm: () => Promise<unknown> | void;
  busy?: boolean;
  disabledReason?: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <Action label={label} explain={explain} onClick={() => setOpen(true)} disabledReason={disabledReason} />;
  }
  return (
    <div role="group" aria-label={question} className="flex flex-col gap-3 rounded-sm border border-danger bg-surface-raised p-3">
      <p className="flex items-start gap-2 text-body-strong text-ink">
        <Icon name="alert" className="mt-1 text-danger" />
        {question}
      </p>
      <p className="text-small text-ink-muted">{consequence}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          loading={busy}
          onClick={async () => {
            await onConfirm();
            setOpen(false);
          }}
        >
          {yes}
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
          Keep it
        </Button>
      </div>
    </div>
  );
}

export function Badge({ tone = "plain", icon, children }: { tone?: "plain" | "accent" | "danger" | "success"; icon?: IconName; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-caption font-semibold whitespace-nowrap",
        tone === "plain" && "bg-surface-raised text-ink-muted",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "danger" && "border border-danger text-danger",
        tone === "success" && "border border-success text-success",
      )}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-small text-ink-muted">{children}</p>;
}

export function Loading() {
  return (
    <p role="status" className="text-body text-ink-muted">
      Loading
    </p>
  );
}

// "Show more" paging: the server returns one page; this asks for the next one.
export function ShowMore({ shown, total, onMore, step }: { shown: number; total: number; onMore: () => void; step: number }) {
  if (shown >= total) return total > 0 ? <p className="text-caption text-ink-muted tabular-nums">Showing all {total}</p> : null;
  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" block onClick={onMore}>
        Show {Math.min(step, total - shown)} more
      </Button>
      <p className="text-center text-caption text-ink-muted tabular-nums">
        Showing {shown} of {total}
      </p>
    </div>
  );
}

// A row of filter chips that scrolls sideways on its own, so the page never does.
export function Filters<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={cx(
            "inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-pill border-[1.5px] px-4 text-small font-semibold whitespace-nowrap",
            value === option.key ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-ink",
          )}
        >
          {value === option.key ? <Icon name="check" /> : null}
          {option.label}
          {option.count !== undefined ? <span className="tabular-nums opacity-80">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ text, label, explain }: { text: string; label: string; explain: string }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Button
        variant="secondary"
        icon={copied === "yes" ? "check" : "copy"}
        className="self-start"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied("yes");
          } catch {
            setCopied("failed");
          }
          window.setTimeout(() => setCopied(null), 2500);
        }}
      >
        {copied === "yes" ? "Copied" : label}
      </Button>
      <p role="status" className="text-caption text-ink-muted">
        {copied === "failed" ? "Your browser blocked copying. Select the text instead." : explain}
      </p>
    </div>
  );
}


// A 48px icon button that copies one value, for emails the admin pastes into Spotify.
export function CopyIcon({ text, what }: { text: string; what: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? `Copied ${what}` : `Copy ${what}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex size-12 shrink-0 items-center justify-center rounded-pill border-[1.5px] border-line-strong text-ink hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <Icon name={copied ? "check" : "copy"} className={copied ? "text-success" : undefined} />
    </button>
  );
}
