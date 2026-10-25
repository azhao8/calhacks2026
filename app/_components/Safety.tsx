// Safety information for meetup day (S13) and the menu (S16). Melos is not an emergency service
// and never implies it monitors meetups. Verified UC Berkeley resources are an open item in
// CLAUDE.md §13; add them here once the team has checked them.
export function SafetyNote({ id }: { id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id ?? "safety"}-title`} className="flex flex-col gap-2 rounded-sm bg-surface-raised p-4">
      <h2 id={`${id ?? "safety"}-title`} className="text-body-strong text-ink">
        Need help?
      </h2>
      <p className="text-small text-ink">In an emergency, call 911.</p>
      <p className="text-small text-ink-muted">
        Melos is not an emergency service and doesn&apos;t watch meetups. You can leave at any time, and you never need
        anyone&apos;s permission.
      </p>
    </section>
  );
}
