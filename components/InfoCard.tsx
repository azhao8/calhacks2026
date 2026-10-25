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
      await navigator.clipboard.writeText(value);
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
          className="inline-flex min-h-12 items-center font-semibold wrap-break-word text-ink tabular-nums underline decoration-line-strong underline-offset-4"
        >
          {value}
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
