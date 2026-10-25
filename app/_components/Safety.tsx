import { SAFETY_TOP_LINE, visibleSafetyRows } from "@/app/_lib/safety";

// "Need help?" for meetup day (S13) and the menu (S16). The top line and 911 always show; other
// resources show only once a teammate has checked them (app/_lib/safety.ts). Melos is not an
// emergency service and never implies it watches meetups.
export function SafetyNote({ id, list }: { id?: string; list: "meetup_day" | "menu" }) {
  const titleId = `${id ?? "safety"}-title`;
  const rows = visibleSafetyRows(list);
  return (
    <section id={id} aria-labelledby={titleId} className="flex flex-col gap-3 rounded-sm bg-surface-raised p-4">
      <h2 id={titleId} className="text-body-strong text-ink">
        Need help?
      </h2>
      <p className="text-small text-ink">{SAFETY_TOP_LINE}</p>
      <a href="tel:911" className="inline-flex min-h-12 items-center self-start font-semibold text-accent underline underline-offset-3">
        Call 911
      </a>
      {rows.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((row) => (
            <li key={row.name} className="flex flex-col gap-0.5 border-t border-line pt-3">
              <span className="text-small font-semibold text-ink">{row.name}</span>
              <span className="text-small text-ink-muted">{row.line}</span>
              <span className="text-caption text-ink-muted">{row.when}</span>
              {row.phone && row.tel ? (
                <a href={`tel:${row.tel}`} className="inline-flex min-h-12 items-center self-start font-semibold text-accent tabular-nums underline underline-offset-3">
                  {row.phone}
                </a>
              ) : (
                <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center self-start font-semibold text-accent underline underline-offset-3">
                  Official page
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
