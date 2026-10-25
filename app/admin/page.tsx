"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { dayLabel, priceLabel, timeLabel } from "@/convex/lib/format";

// S17 admin and demo (team only). The server checks ADMIN_EMAILS on every admin function; this gate is only for display.
export default function AdminPage() {
  const who = useQuery(api.admin.whoami);

  if (who === undefined) {
    return (
      <Shell>
        <Loading />
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
      <AllowList />
      <Events />
      <Matching />
      <HelpNotes />
      <Demo />
    </Shell>
  );
}

const when = (ms: number) => `${dayLabel(ms)} · ${timeLabel(ms)}`;

// Runs one server call at a time per control, keeps the button width stable, and shows failures in words.
function useRun() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  async function run(name: string, call: () => Promise<unknown>, doneText?: string) {
    setBusy(name);
    setError(null);
    setDone(null);
    try {
      await call();
      if (doneText) setDone(doneText);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, done, run };
}

function Funnel() {
  const funnel = useQuery(api.admin.funnel);
  return (
    <Section title="Funnel">
      <Muted>Real students only. Demo students and team accounts are left out.</Muted>
      {funnel === undefined ? (
        <Loading />
      ) : (
        <ol className="flex flex-col">
          {funnel.map(({ stage, count }) => (
            <Row key={stage}>
              <span className="text-body text-ink">{stage}</span>
              <span className="text-body-strong text-ink tabular-nums">{count}</span>
            </Row>
          ))}
        </ol>
      )}
    </Section>
  );
}

function AllowList() {
  const queue = useQuery(api.admin.queue.list);
  const markAdded = useMutation(api.admin.queue.markAdded);
  const { busy, error, run } = useRun();
  return (
    <Section title="Allow-list queue">
      {queue === undefined ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-body-strong text-ink">Spotify apps</p>
            {queue.apps.length === 0 ? <Muted>No apps yet. Add one below.</Muted> : null}
            {queue.apps.map((app) => (
              <Row key={app.appId}>
                <span className="text-body text-ink">
                  {app.label} · {app.ownerName}
                  {app.active ? "" : " · inactive"}
                </span>
                <span className="text-body-strong text-ink tabular-nums">
                  {app.used}/{app.capacity}
                </span>
              </Row>
            ))}
            {queue.flags.noCapacity > 0 ? (
              <p className="text-small text-danger">
                {queue.flags.noCapacity} waiting with no free app slot. Add an app or free a slot.
              </p>
            ) : null}
            {queue.flags.refused > 0 ? (
              <p className="text-small text-danger">
                {queue.flags.refused} refused by Spotify at connect. Check the email on the app&apos;s allow-list.
              </p>
            ) : null}
          </div>
          <ul className="flex flex-col gap-3">
            {queue.rows.length === 0 ? <Muted>Nobody has asked for access yet.</Muted> : null}
            {queue.rows.map((row) => (
              <li key={row.accessId} className="flex flex-col gap-2 rounded-md border border-line p-3">
                <p className="text-body-strong text-ink">
                  {row.firstName ?? "No name yet"} · <span className="break-all">{row.spotifyEmail}</span>
                </p>
                <p className="text-small text-ink-muted tabular-nums">
                  {row.appLabel ? `${row.appLabel} (${row.appOwner})` : "No app assigned"} · asked {when(row.requestedAt)} ·{" "}
                  {row.status}
                  {row.refused ? " · Spotify refused" : ""}
                </p>
                {row.status === "requested" && row.appLabel ? (
                  <Button
                    busy={busy === row.accessId}
                    onClick={() => run(row.accessId, () => markAdded({ accessId: row.accessId }))}
                  >
                    Mark added
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <Failure error={error} />
          <AddSpotifyApp />
        </>
      )}
    </Section>
  );
}

function AddSpotifyApp() {
  const upsert = useMutation(api.admin.queue.upsertSpotifyApp);
  const { busy, error, done, run } = useRun();
  const [label, setLabel] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [clientId, setClientId] = useState("");
  return (
    <form
      className="flex flex-col gap-2 border-t border-line pt-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void run("app", () => upsert({ label, ownerName, clientId }), "Saved. Set its client secret in Convex before anyone connects.");
      }}
    >
      <p className="text-body-strong text-ink">Add or update a Spotify app</p>
      <Field label="Label (for example melos-alex)" value={label} onChange={setLabel} />
      <Field label="Owner's name" value={ownerName} onChange={setOwnerName} />
      <Field label="Client ID" value={clientId} onChange={setClientId} />
      <Button type="submit" busy={busy === "app"}>
        Save app
      </Button>
      <Failure error={error} />
      {done ? <p className="text-small text-success">{done}</p> : null}
    </form>
  );
}

function Events() {
  const [filter, setFilter] = useState<"published" | "rejected" | "flagged">("published");
  const imports = useQuery(api.admin.events.imports, { limit: 5 });
  const events = useQuery(
    api.admin.events.list,
    filter === "flagged" ? { flaggedOnly: true, limit: 100 } : { status: filter, limit: 100 },
  );
  const findNow = useAction(api.admin.events.findNow);
  const { busy, error, done, run } = useRun();
  return (
    <Section title="Events">
      <Button busy={busy === "find"} onClick={() => run("find", () => findNow({}), "Started an event scout run. New events arrive when it finishes.")}>
        Find events now
      </Button>
      <Failure error={error} />
      {done ? <p className="text-small text-success">{done}</p> : null}

      <p className="text-body-strong text-ink">Recent imports</p>
      {imports === undefined ? (
        <Loading />
      ) : imports.length === 0 ? (
        <Muted>No imports yet.</Muted>
      ) : (
        <ul className="flex flex-col gap-2">
          {imports.map((row) => (
            <li key={row.importId} className="text-small text-ink tabular-nums">
              {when(row.receivedAt)} · {row.status} · {row.counts.received} received, {row.counts.published} published,{" "}
              {row.counts.updated} updated, {row.counts.rejected} rejected, {row.counts.duplicates} duplicates
              {row.errors.length > 0 ? <span className="block text-danger">{row.errors.slice(0, 3).join(" · ")}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Which events">
        {(["published", "rejected", "flagged"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className="min-h-12 rounded-pill border border-line-strong px-4 text-body text-ink aria-pressed:bg-accent aria-pressed:text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {option === "flagged" ? "Missing from runs" : option === "published" ? "Published" : "Rejected"}
          </button>
        ))}
      </div>
      {events === undefined ? (
        <Loading />
      ) : events.length === 0 ? (
        <Muted>Nothing here.</Muted>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <EventRow key={event.eventId} event={event} />
          ))}
        </ul>
      )}
    </Section>
  );
}

type ListedEvent = FunctionReturnType<typeof api.admin.events.list>[number];

function EventRow({ event }: { event: ListedEvent }) {
  const pull = useMutation(api.admin.events.pull);
  const restore = useMutation(api.admin.events.restore);
  const feature = useMutation(api.admin.events.feature);
  const edit = useMutation(api.admin.events.edit);
  const { busy, error, run } = useRun();
  const [editing, setEditing] = useState(false);
  const [min, setMin] = useState(event.priceMin === null ? "" : String(event.priceMin));
  const [max, setMax] = useState(event.priceMax === null ? "" : String(event.priceMax));
  const id = event.eventId;
  const toPrice = (text: string) => (text.trim() === "" ? null : Number(text));

  return (
    <li className="flex flex-col gap-2 rounded-md border border-line p-3">
      <p className="text-body-strong text-ink">
        {event.title}
        {event.featured ? " · featured" : ""}
      </p>
      <p className="text-small text-ink-muted tabular-nums">
        {when(event.startsAt)} · {event.venueName ?? "No venue"} · {priceLabel(event.priceMin, event.priceMax)}
        {event.priceSource ? ` (${event.priceSource})` : ""} · {event.status}
        {event.rejectReason ? ` · ${event.rejectReason}` : ""}
        {event.flaggedMissing ? " · missing from the last two runs" : ""}
      </p>
      <p className="text-small text-ink-muted">
        {event.meetingSpot ? `Meet: ${event.meetingSpot.name} (${event.meetingSpot.chosenBy})` : "No meeting spot"} ·{" "}
        <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">
          {event.sourceName}
        </a>
      </p>
      <div className="flex flex-wrap gap-2">
        {event.pulled || event.status === "rejected" ? (
          <Button busy={busy === "restore"} onClick={() => run("restore", () => restore({ eventId: id }))}>
            Restore
          </Button>
        ) : (
          <Button busy={busy === "pull"} onClick={() => run("pull", () => pull({ eventId: id }))}>
            Pull
          </Button>
        )}
        <Button busy={busy === "feature"} onClick={() => run("feature", () => feature({ eventId: id, featured: !event.featured }))}>
          {event.featured ? "Unfeature" : "Feature"}
        </Button>
        <Button onClick={() => setEditing(!editing)}>{editing ? "Close" : "Edit price"}</Button>
      </div>
      {editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void run("edit", () => edit({ eventId: id, patch: { priceMin: toPrice(min), priceMax: toPrice(max) } }));
          }}
        >
          <Field label="Lowest price in dollars (empty if not listed)" value={min} onChange={setMin} inputMode="decimal" />
          <Field label="Highest price in dollars (empty if not listed)" value={max} onChange={setMax} inputMode="decimal" />
          <Button type="submit" busy={busy === "edit"}>
            Save price
          </Button>
        </form>
      ) : null}
      <Failure error={error} />
    </li>
  );
}

function Matching() {
  const runs = useQuery(api.admin.matching.runs, { limit: 10 });
  const runNow = useMutation(api.admin.matching.runNow);
  const { busy, error, done, run } = useRun();
  return (
    <Section title="Matching">
      <Button
        busy={busy === "run"}
        onClick={() => run("run", () => runNow({}), "Matching ran for every event with yeses.")}
      >
        Run matching now
      </Button>
      <Failure error={error} />
      {done ? <p className="text-small text-success">{done}</p> : null}
      {runs === undefined ? (
        <Loading />
      ) : runs.length === 0 ? (
        <Muted>No matcher runs yet.</Muted>
      ) : (
        <ul className="flex flex-col gap-3">
          {runs.map((r) => (
            <li key={r._id} className="flex flex-col gap-1 rounded-md border border-line p-3">
              <p className="text-body-strong text-ink">{r.eventTitle}</p>
              <p className="text-small text-ink-muted tabular-nums">
                {when(r.startedAt)} · {r.trigger} · {r.pairsCreated} pairs, {r.seatsRefilled} refills, {r.demoFills} demo fills
              </p>
              {r.decisions.map((d, i) => (
                <div key={i} className="flex flex-col gap-0.5 border-t border-line pt-2 text-small text-ink">
                  <p className="tabular-nums">
                    {d.aName}
                    {d.aIsDemo ? " (demo)" : ""} and {d.bName}
                    {d.bIsDemo ? " (demo)" : ""} · score {d.score.toFixed(3)} · similarity {d.similarity.toFixed(3)}
                  </p>
                  <p className="text-ink-muted">
                    {d.shared.map((item) => `${item.name} (${item.kind}, ${item.weight.toFixed(2)})`).join(" · ") || "Nothing shared"}
                  </p>
                  <p className="text-ink-muted">{d.reason}</p>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function HelpNotes() {
  const notes = useQuery(api.admin.helpNotes);
  const markHandled = useMutation(api.admin.markHelpNoteHandled);
  const { busy, error, run } = useRun();
  return (
    <Section title="Help notes">
      <Muted>Read by the team. Not monitored around the clock, and not an emergency channel.</Muted>
      {notes === undefined ? (
        <Loading />
      ) : notes.length === 0 ? (
        <Muted>No notes yet.</Muted>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note._id} className="flex flex-col gap-2 rounded-md border border-line p-3">
              <p className="text-caption text-ink-muted tabular-nums">
                {when(note.createdAt)} · {note.firstName ?? "No name yet"} · {note.email ?? "No email"}
                {note.isDemo ? " · demo" : ""}
              </p>
              <p className="text-body whitespace-pre-wrap text-ink">{note.text}</p>
              {note.handledAt === null ? (
                <Button busy={busy === note._id} onClick={() => run(note._id, () => markHandled({ noteId: note._id }))}>
                  Mark handled
                </Button>
              ) : (
                <Muted>Handled</Muted>
              )}
            </li>
          ))}
        </ul>
      )}
      <Failure error={error} />
    </Section>
  );
}

const HOUR = 60 * 60 * 1000;

function Demo() {
  const overview = useQuery(api.admin.demo.overview);
  const seed = useMutation(api.admin.demo.seed);
  const reset = useMutation(api.admin.demo.reset);
  const setClock = useMutation(api.admin.demo.setClockOffset);
  const actAs = useMutation(api.admin.demo.actAs);
  const { busy, error, done, run } = useRun();
  const [confirmReset, setConfirmReset] = useState(false);
  const [hours, setHours] = useState("");

  return (
    <Section title="Demo controls">
      <Muted>These touch only demo students and demo plans. Plans with a real student always keep real time.</Muted>
      <div className="flex flex-wrap gap-2">
        <Button busy={busy === "seed"} onClick={() => run("seed", () => seed({}), "Demo students seeded. Their taste summaries take a minute or two.")}>
          Seed demo students
        </Button>
        {confirmReset ? (
          <>
            <Button
              busy={busy === "reset"}
              onClick={() =>
                run("reset", async () => {
                  await reset({});
                  setConfirmReset(false);
                }, "Demo reset. Seats demo students held next to real students reopened.")
              }
            >
              Yes, reset demo
            </Button>
            <Button onClick={() => setConfirmReset(false)}>Keep it</Button>
          </>
        ) : (
          <Button onClick={() => setConfirmReset(true)}>Reset demo</Button>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <p className="text-body-strong text-ink tabular-nums">
          Demo clock: {overview === undefined ? "loading" : overview.clockOffsetMs === 0 ? "real time" : `${(overview.clockOffsetMs / HOUR).toFixed(1)} hours ahead`}
        </p>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 24].map((h) => (
            <Button key={h} busy={busy === `clock-${h}`} onClick={() => run(`clock-${h}`, () => setClock({ offsetMs: h * HOUR }))}>
              {h === 0 ? "Real time" : `${h} ${h === 1 ? "hour" : "hours"} ahead`}
            </Button>
          ))}
        </div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            const value = Number(hours);
            if (Number.isFinite(value)) void run("clock-custom", () => setClock({ offsetMs: value * HOUR }));
          }}
        >
          <Field label="Hours ahead" value={hours} onChange={setHours} inputMode="decimal" />
          <Button type="submit" busy={busy === "clock-custom"}>
            Set demo clock
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <p className="text-body-strong text-ink">Act as a demo student</p>
        {overview === undefined ? (
          <Loading />
        ) : overview.students.length === 0 ? (
          <Muted>No demo students yet. Seed them above.</Muted>
        ) : (
          <ul className="flex flex-col gap-3">
            {overview.students.map((student) => (
              <li key={student.userId} className="flex flex-col gap-2 rounded-md border border-line p-3">
                <p className="text-body-strong text-ink">
                  {student.firstName} · {student.onboarding ?? "no state"}
                </p>
                {student.seats.length === 0 ? <Muted>No seat right now.</Muted> : null}
                {student.seats.map((seat) => (
                  <div key={seat.seatId} className="flex flex-col gap-2">
                    <p className="text-small text-ink-muted">
                      {seat.eventTitle} · seat {seat.seat} · ticket {seat.ticket} · plan {seat.planStatus}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["accept", "Accept"],
                          ["next_time", "Next time"],
                          ["cant_make_it", "Can't make it"],
                          ["got_ticket", "Got ticket"],
                        ] as const
                      ).map(([action, label]) => (
                        <Button
                          key={action}
                          busy={busy === `${seat.seatId}-${action}`}
                          onClick={() =>
                            run(`${seat.seatId}-${action}`, () =>
                              actAs({ userId: student.userId, action, seatId: seat.seatId }),
                            )
                          }
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Failure error={error} />
      {done ? <p className="text-small text-success">{done}</p> : null}
    </Section>
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

function Row({ children }: { children: ReactNode }) {
  return <li className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">{children}</li>;
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-small text-ink-muted">{children}</p>;
}

function Loading() {
  return (
    <p role="status" className="text-body text-ink-muted">
      Loading
    </p>
  );
}

function Failure({ error }: { error: string | null }) {
  if (error === null) return null;
  return (
    <p role="alert" className="text-small text-danger">
      {error}
    </p>
  );
}

function Button({
  children,
  onClick,
  busy = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  busy?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      className="min-h-12 min-w-32 self-start rounded-pill border border-line-strong px-4 text-body-strong text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "text";
}) {
  return (
    <label className="flex flex-col gap-1 text-small text-ink">
      {label}
      <input
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 rounded-md border border-line-strong bg-canvas px-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
    </label>
  );
}
