"use client";

import { useRef, type KeyboardEvent } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

export type School = { id: string; name: string; city?: string; colors?: string[]; status?: "open" | "soon" };

// A single choice list of campuses with their two school colors (design/components/SchoolPicker).
// Schools not open yet stay listed with "Coming soon" and can't be chosen.
export function SchoolPicker({
  schools,
  value,
  onChange,
  label = "Your school",
}: {
  schools: School[];
  value?: string | null;
  onChange?: (id: string) => void;
  label?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const open = schools.map((s, i) => (s.status === "soon" ? -1 : i)).filter((i) => i >= 0);
  const current = schools.findIndex((s) => s.id === value);
  // Roving focus: the checked radio (or the first open one) is the tab stop.
  const tabStop = current >= 0 ? current : (open[0] ?? 0);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !back) return;
    event.preventDefault();
    const pos = open.indexOf(index);
    const next = open[(pos + (forward ? 1 : open.length - 1)) % open.length];
    if (next === undefined) return;
    refs.current[next]?.focus();
    onChange?.(schools[next].id);
  }

  return (
    <ul role="radiogroup" aria-label={label} className="m-0 flex list-none flex-col gap-2 p-0">
      {schools.map((s, i) => {
        const selected = s.id === value;
        const soon = s.status === "soon";
        return (
          <li key={s.id}>
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={soon || undefined}
              tabIndex={i === tabStop ? 0 : -1}
              onKeyDown={(e) => onKeyDown(e, i)}
              onClick={() => {
                if (!soon) onChange?.(s.id);
              }}
              className={cx(
                "flex min-h-14 w-full items-center gap-3 rounded-sm border-[1.5px] px-4 py-3 text-left",
                selected ? "border-accent bg-surface-brand" : "border-line bg-surface",
                soon ? "cursor-default text-ink-muted" : "cursor-pointer text-ink",
              )}
            >
              <span aria-hidden="true" className="grid size-7 flex-none grid-cols-2 overflow-hidden rounded-full border-[1.5px] border-line-strong">
                {/* School colors are data from the universities table, not design tokens. */}
                <span style={{ background: s.colors?.[0] }} />
                <span style={{ background: s.colors?.[1] }} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{s.name}</span>
                <span className="text-small text-ink-muted">{soon ? "Coming soon" : s.city}</span>
              </span>
              {selected ? <Icon name="check" className="text-accent" /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
