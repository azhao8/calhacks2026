"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { dayLabel, timeLabel } from "@/convex/lib/format";

// S17 admin and demo (stream E). The server checks ADMIN_EMAILS on every admin function; this gate is only for display.
export default function AdminPage() {
  const who = useQuery(api.admin.whoami);

  if (who === undefined) {
    return (
      <Shell>
        <p role="status" className="text-body text-ink-muted">
          Loading
        </p>
      </Shell>
    );
  }
  if (!who.isAdmin) {
    return (
      <Shell>
        <h1 className="font-display text-title text-ink">Team only</h1>
        <p className="text-body text-ink-muted">
          {who.signedIn ? "This account isn't on the team list." : "Sign in with a team email."}
        </p>
      </Shell>
    );
  }
  return (
    <Shell>
      <h1 className="font-display text-title text-ink">Admin</h1>
      <Funnel />
      <HelpNotes />
      <Section title="Allow-list queue">
        <Pending>Arrives with the onboarding backend.</Pending>
      </Section>
      <Section title="Events">
        <Pending>Arrives with the event agent.</Pending>
      </Section>
      <Section title="Matching">
        <Pending>Arrives with the matcher.</Pending>
      </Section>
      <Section title="Demo controls">
        <Pending>Arrives with the matcher.</Pending>
      </Section>
    </Shell>
  );
}

function Funnel() {
  const funnel = useQuery(api.admin.funnel);
  return (
    <Section title="Funnel">
      <p className="text-small text-ink-muted">Real students only. Demo students and team accounts are left out.</p>
      {funnel === undefined ? (
        <p role="status" className="text-body text-ink-muted">
          Loading
        </p>
      ) : (
        <ol className="flex flex-col">
          {funnel.map(({ stage, count }) => (
            <li key={stage} className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
              <span className="text-body text-ink">{stage}</span>
              <span className="text-body-strong text-ink tabular-nums">{count}</span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function HelpNotes() {
  const notes = useQuery(api.admin.helpNotes);
  return (
    <Section title="Help notes">
      {notes === undefined ? (
        <p role="status" className="text-body text-ink-muted">
          Loading
        </p>
      ) : notes.length === 0 ? (
        <p className="text-body text-ink-muted">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note._id} className="flex flex-col gap-2 rounded-md border border-line p-3">
              <p className="text-caption text-ink-muted tabular-nums">
                {dayLabel(note.createdAt)} · {timeLabel(note.createdAt)} · {note.firstName ?? "No name yet"} ·{" "}
                {note.email ?? "No email"}
                {note.isDemo ? " · demo" : ""}
              </p>
              <p className="text-body whitespace-pre-wrap text-ink">{note.text}</p>
              {note.handledAt === null ? (
                <MarkHandled noteId={note._id} />
              ) : (
                <p className="text-small text-ink-muted">Handled</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function MarkHandled({ noteId }: { noteId: Id<"helpNotes"> }) {
  const markHandled = useMutation(api.admin.markHelpNoteHandled);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={async () => {
          setPending(true);
          setFailed(false);
          try {
            await markHandled({ noteId });
          } catch {
            setFailed(true);
          } finally {
            setPending(false);
          }
        }}
        className="min-h-12 min-w-40 rounded-pill border border-line-strong px-4 text-body-strong text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
      >
        Mark handled
      </button>
      {failed ? (
        <p role="alert" className="text-small text-danger">
          Couldn&apos;t save that. Try again.
        </p>
      ) : null}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12">{children}</main>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
      <h2 className="text-headline text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Pending({ children }: { children: ReactNode }) {
  return <p className="text-body text-ink-muted">{children}</p>;
}
