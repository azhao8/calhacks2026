"use client";

import { useState } from "react";
import { cx } from "./cx";
import { buttonClasses } from "./Button";
import { Icon } from "./Icon";

const KIND = { instagram: { icon: "at", label: "Instagram" }, phone: { icon: "phone", label: "number" } } as const;

// A contact someone volunteered (design/components/InfoCard). The value shows in full and stays
// selectable; tapping it calls or opens; Copy confirms in words.
export function InfoCard({ kind, from, value }: { kind: keyof typeof KIND; from: string; value: string }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const k = KIND[kind];
  const href = kind === "phone" ? `tel:${value.replace(/[^\d+]/g, "")}` : `https://www.instagram.com/${value.replace(/^@/, "")}`;
  const openLabel = kind === "phone" ? `Call ${from}` : `Open ${from}'s Instagram`;

  async function copy() {
    try {
      // Copy a plain hyphen, not the non-breaking one used for display.
      await navigator.clipboard.writeText(value.replace(/\u2011/g, "-"));
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-sm bg-surface-raised p-4">
      <span aria-hidden="true" className="grid size-10 flex-none place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name={k.icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption text-ink-muted">
          {from}&apos;s {k.label}
        </span>
        <a
          href={href}
          target={kind === "instagram" ? "_blank" : undefined}
          rel={kind === "instagram" ? "noopener noreferrer" : undefined}
          aria-label={`${openLabel}, ${value}`}
          className="flex min-h-12 min-w-0 items-center font-semibold text-ink tabular-nums underline decoration-line-strong underline-offset-4"
        >
          {/* A handle wraps anywhere rather than widening the screen. A number may break only at its
              space, never at the hyphen, so "(510) 555-0123" never splits mid-number. */}
          <span className={cx("min-w-0", kind === "phone" ? "" : "wrap-anywhere")}>{kind === "phone" ? value.replace(/-/g, "\u2011") : value}</span>
        </a>
      </span>
      <button type="button" onClick={copy} aria-label={`Copy ${from}'s ${k.label}`} className={cx(buttonClasses({ variant: "quiet" }))}>
        <Icon name={copied === "yes" ? "check" : "copy"} />
        {copied === "yes" ? "Copied" : "Copy"}
      </button>
      {copied === "failed" ? (
        <p role="status" className="w-full text-caption text-ink-muted">
          Copy didn&apos;t work here. Press and hold the {k.label} to copy it.
        </p>
      ) : copied === "yes" ? (
        <span role="status" className="sr-only">
          Copied
        </span>
      ) : null}
    </div>
  );
}
