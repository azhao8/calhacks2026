// Stage 0 stand-in for a screen. Stream D replaces each page with the real screen.
export function Placeholder({ screen, title }: { screen: string; title: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-120 flex-col justify-end gap-2 px-4 pb-12">
      <p className="text-caption text-ink-muted">{screen}</p>
      <h1 className="font-display text-title text-ink">{title}</h1>
      <p className="text-body text-ink-muted">Placeholder. The real screen comes from the design.</p>
    </main>
  );
}
