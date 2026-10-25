"use client";

import { useDeferredValue, useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { priceLabel } from "@/convex/lib/format";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Icon } from "@/components/Icon";
import { Action, Badge, ConfirmAction, Filters, Loading, Muted, Panel, Result, ShowMore, ago, useRun, when } from "./_ui";
import type { StudentFocus } from "./Spotify";

export type TabKey = "action" | "spotify" | "events" | "matching" | "help" | "demo";

// ---- Needs action ----

type Job = { key: string; count: number; text: string; go: () => void };

export function NeedsActionTab({ go }: { go: (tab: TabKey, focus?: Partial<StudentFocus>) => void }) {
  const queue = useQuery(api.admin.queue.list, { limit: 1 });
  const notes = useQuery(api.admin.helpNotes);
  const missing = useQuery(api.admin.events.list, { flaggedOnly: true, limit: 100 });
  const funnel = useQuery(api.admin.funnel);

  if (queue === undefined || notes === undefined || missing === undefined) return <Loading />;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const noSecret = queue.apps.filter((app) => app.secret === "none" || app.checkOk === false).length;
  const fullApps = queue.apps.length > 0 && queue.apps.every((app) => !app.active || app.used >= app.capacity);
  const jobs: Job[] = [
    {
      key: "add",
      count: queue.counts.needs_adding,
      text: `${plural(queue.counts.needs_adding, "student", "students")} to add in Spotify, across ${plural(
        queue.apps.filter((app) => app.counts.needs_adding > 0).length,
        "app",
        "apps",
      )}`,
      go: () => go("spotify", { status: "needs_adding", appId: "all" }),
    },
    {
      key: "refused",
      count: queue.counts.refused,
      text: `${plural(queue.counts.refused, "student", "students")} refused by Spotify at connect`,
      go: () => go("spotify", { status: "refused", appId: "all" }),
    },
    {
      key: "noapp",
      count: queue.counts.no_app,
      text: `${plural(queue.counts.no_app, "student is", "students are")} waiting with no free app slot. Add an app.`,
      go: () => go("spotify", { status: "no_app", appId: "all" }),
    },
    {
      key: "secret",
      count: noSecret,
      text: `${plural(noSecret, "app has", "apps have")} no working secret, so their students can't connect`,
      go: () => go("spotify"),
    },
    {
      key: "notes",
      count: notes.filter((note) => note.handledAt === null).length,
      text: `${plural(notes.filter((note) => note.handledAt === null).length, "help note", "help notes")} not handled`,
      go: () => go("help"),
    },
    {
      key: "missing",
      count: missing.length,
      text: `${plural(missing.length, "event is", "events are")} missing from the last two scout runs`,
      go: () => go("events"),
    },
  ].filter((job) => job.count > 0);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Needs action" lead="Tap a line to open it. This updates live.">
        {jobs.length === 0 ? (
          <p className="inline-flex items-center gap-2 text-body text-ink">
            <Icon name="check" className="text-success" />
            Nothing needs you right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {jobs.map((job) => (
              <li key={job.key}>
                <button
                  type="button"
                  onClick={job.go}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md border border-line bg-surface-raised px-4 py-3 text-left text-body text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <span className="flex items-start gap-2">
                    <Icon name="alert" className="mt-1 shrink-0 text-accent" />
                    {job.text}
                  </span>
                  <Icon name="arrow" className="shrink-0 text-ink-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {fullApps ? <Muted>Every active app is full. New students wait for a slot until you add an app.</Muted> : null}
      </Panel>
      <Panel title="Funnel" lead="Real students only. Demo students and team accounts are left out. Safe to show on stage.">
        {funnel === undefined ? (
          <Loading />
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
      </Panel>
    </div>
  );
}

// ---- Events ----

type EventFilter = "published" | "rejected" | "flagged";
const EVENT_PAGE = 20;

export function EventsTab() {
  const [filter, setFilter] = useState<EventFilter>("published");
  const [limit, setLimit] = useState(EVENT_PAGE);
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim().toLowerCase());
  const [showImports, setShowImports] = useState(false);
  const imports = useQuery(api.admin.events.imports, { limit: 5 });
  // Searching looks through every upcoming event in the filter, then pages the matches.
  const events = useQuery(
    api.admin.events.list,
    filter === "flagged" ? { flaggedOnly: true, limit: deferred ? 500 : limit + 1 } : { status: filter, limit: deferred ? 500 : limit + 1 },
  );
  const findNow = useAction(api.admin.events.findNow);
  const { busy, error, done, run } = useRun();
  const matches = events?.filter((event) => !deferred || `${event.title} ${event.venueName ?? ""}`.toLowerCase().includes(deferred));
  const shown = matches?.slice(0, limit);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Event scout" lead="Runs daily at about 6:00 am. Events publish on their own when they pass the checks.">
        <Action
          variant="primary"
          label="Find events now"
          explain="Starts a scout run on Apify. New events arrive here when it finishes, usually in a few minutes."
          busy={busy === "find"}
          onClick={() => run("find", () => findNow({}), "Started a scout run. New events arrive when it finishes.")}
        />
        <Result error={error} done={done} />
        <Button variant="quiet" className="self-start" aria-expanded={showImports} onClick={() => setShowImports(!showImports)}>
          {showImports ? "Hide recent runs" : "Show recent runs"}
        </Button>
        {showImports ? (
          imports === undefined ? (
            <Loading />
          ) : imports.length === 0 ? (
            <Muted>No runs have reached Melos yet.</Muted>
          ) : (
            <ul className="flex flex-col gap-2">
              {imports.map((row) => (
                <li key={row.importId} className="text-small text-ink tabular-nums">
                  <span className="font-semibold">{when(row.receivedAt)}</span> · {row.status} · {row.counts.published} published, {row.counts.updated}{" "}
                  updated, {row.counts.rejected} rejected, {row.counts.duplicates} duplicates
                  {row.errors.length > 0 ? <span className="block text-danger">{row.errors.slice(0, 3).join(" · ")}</span> : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Panel>
      <Panel title="Events" lead="Upcoming events only. Tap one to pull it, feature it, or fix its price.">
        <Filters
          label="Which events"
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setLimit(EVENT_PAGE);
          }}
          options={[
            { key: "published", label: "Published" },
            { key: "rejected", label: "Rejected or pulled" },
            { key: "flagged", label: "Missing from runs" },
          ]}
        />
        <TextField label="Search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} hint="Title or venue." />
        {shown === undefined || matches === undefined ? (
          <Loading />
        ) : shown.length === 0 ? (
          <Muted>Nothing here.</Muted>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {shown.map((event) => (
              <EventRow key={event.eventId} event={event} />
            ))}
          </ul>
        )}
        {matches ? (
          deferred ? (
            <ShowMore shown={shown?.length ?? 0} total={matches.length} step={EVENT_PAGE} onMore={() => setLimit(limit + EVENT_PAGE)} />
          ) : matches.length > limit ? (
            <Button variant="secondary" block onClick={() => setLimit(limit + EVENT_PAGE)}>
              Show {EVENT_PAGE} more
            </Button>
          ) : matches.length > 0 ? (
            <p className="text-caption text-ink-muted tabular-nums">Showing all {matches.length}</p>
          ) : null
        ) : null}
      </Panel>
    </div>
  );
}

type ListedEvent = FunctionReturnType<typeof api.admin.events.list>[number];

function EventRow({ event }: { event: ListedEvent }) {
  const [open, setOpen] = useState(false);
  const pull = useMutation(api.admin.events.pull);
  const restore = useMutation(api.admin.events.restore);
  const feature = useMutation(api.admin.events.feature);
  const edit = useMutation(api.admin.events.edit);
  const { busy, error, done, run } = useRun();
  const [min, setMin] = useState(event.priceMin === null ? "" : String(event.priceMin));
  const [max, setMax] = useState(event.priceMax === null ? "" : String(event.priceMax));
  const id = event.eventId;
  const toPrice = (text: string) => (text.trim() === "" ? null : Number(text));
  const restorable = event.pulled || event.status === "rejected";

  return (
    <li className="flex flex-col gap-2 py-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full flex-col gap-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex w-full items-start justify-between gap-2">
          <span className="text-body-strong text-ink">{event.title}</span>
          <span className="shrink-0 text-small font-semibold text-accent">{open ? "Close" : "Open"}</span>
        </span>
        <span className="text-small text-ink-muted tabular-nums">
          {when(event.startsAt)} · {event.venueName ?? "No venue"} · {priceLabel(event.priceMin, event.priceMax)}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {event.featured ? <Badge tone="accent">Featured</Badge> : null}
          {event.pulled ? <Badge tone="danger">Pulled</Badge> : event.rejectReason ? <Badge tone="danger">Rejected</Badge> : null}
          {event.flaggedMissing ? <Badge tone="danger" icon="alert">Missing from runs</Badge> : null}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-4 rounded-sm bg-surface-raised p-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
            {event.rejectReason ? (
              <>
                <dt className="text-ink-muted">Why</dt>
                <dd className="text-ink">{event.rejectReason}</dd>
              </>
            ) : null}
            <dt className="text-ink-muted">Price from</dt>
            <dd className="text-ink">{event.priceSource ?? "Not found"}</dd>
            <dt className="text-ink-muted">Meet at</dt>
            <dd className="text-ink">{event.meetingSpot ? `${event.meetingSpot.name} (chosen by ${event.meetingSpot.chosenBy})` : "No meeting spot"}</dd>
            <dt className="text-ink-muted">Source</dt>
            <dd>
              <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">
                {event.sourceName}
              </a>
            </dd>
          </dl>
          <div className="grid gap-4 sm:grid-cols-2">
            {restorable ? (
              <Action
                label="Restore"
                explain="Publishes it again, so students can be asked about it."
                busy={busy === "restore"}
                onClick={() => run("restore", () => restore({ eventId: id }), "Restored.")}
              />
            ) : (
              <ConfirmAction
                label="Pull"
                explain="Takes it out of Melos. Nobody is asked about it again."
                question={`Pull ${event.title}?`}
                consequence="Students stop seeing it, open asks for it close, and the scout won't publish it again. You can restore it later."
                yes="Pull event"
                busy={busy === "pull"}
                onConfirm={() => run("pull", () => pull({ eventId: id }), "Pulled.")}
              />
            )}
            <Action
              label={event.featured ? "Unfeature" : "Feature"}
              explain={event.featured ? "Removes its boost in what students are asked about." : "Boosts it in what students are asked about."}
              busy={busy === "feature"}
              onClick={() => run("feature", () => feature({ eventId: id, featured: !event.featured }))}
            />
          </div>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void run("edit", () => edit({ eventId: id, patch: { priceMin: toPrice(min), priceMax: toPrice(max) } }), "Price saved.");
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Lowest price ($)" value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" />
              <TextField label="Highest price ($)" value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" />
            </div>
            <p className="text-caption text-ink-muted">Leave both empty when the price isn&apos;t listed. Students see “Price not listed.”</p>
            <Button type="submit" variant="secondary" loading={busy === "edit"} className="self-start">
              Save price
            </Button>
          </form>
          <Result error={error} done={done} />
        </div>
      ) : null}
    </li>
  );
}

// ---- Matching ----

export function MatchingTab() {
  const [limit, setLimit] = useState(10);
  const runs = useQuery(api.admin.matching.runs, { limit: limit + 1 });
  const runNow = useMutation(api.admin.matching.runNow);
  const { busy, error, done, run } = useRun();
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Matching" lead="Runs on its own about 15 seconds after a yes, and every 30 minutes.">
        <Action
          variant="primary"
          label="Run matching now"
          explain="Pairs students who said yes on every upcoming event, right now. Offers appear on their phones live."
          busy={busy === "run"}
          onClick={() => run("run", () => runNow({}), "Matching ran for every event with yeses.")}
        />
        <Result error={error} done={done} />
      </Panel>
      <Panel title="Recent runs" lead="Open a run to see each pair, its score, and what they share.">
        {runs === undefined ? (
          <Loading />
        ) : runs.length === 0 ? (
          <Muted>No matcher runs yet.</Muted>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {runs.slice(0, limit).map((r) => (
              <MatchRun key={r._id} run={r} />
            ))}
          </ul>
        )}
        {runs && runs.length > limit ? (
          <Button variant="secondary" block onClick={() => setLimit(limit + 10)}>
            Show 10 more
          </Button>
        ) : null}
      </Panel>
    </div>
  );
}

type Run = FunctionReturnType<typeof api.admin.matching.runs>[number];

function MatchRun({ run: r }: { run: Run }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-2 py-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full flex-col gap-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex w-full items-start justify-between gap-2">
          <span className="text-body-strong text-ink">{r.eventTitle}</span>
          <span className="shrink-0 text-small font-semibold text-accent">{r.decisions.length > 0 ? (open ? "Close" : "Open") : ""}</span>
        </span>
        <span className="text-small text-ink-muted tabular-nums">
          {ago(r.startedAt)} · {r.trigger} · {r.pairsCreated} pairs, {r.seatsRefilled} refills, {r.demoFills} demo fills
        </span>
      </button>
      {open
        ? r.decisions.map((d, i) => (
            <div key={i} className="flex flex-col gap-0.5 rounded-sm bg-surface-raised p-3 text-small text-ink">
              <p className="font-semibold">
                {d.aName}
                {d.aIsDemo ? " (demo)" : ""} and {d.bName}
                {d.bIsDemo ? " (demo)" : ""}
              </p>
              <p className="text-ink-muted tabular-nums">
                score {d.score.toFixed(3)} · similarity {d.similarity.toFixed(3)}
              </p>
              <p className="text-ink-muted">
                {d.shared.map((item) => `${item.name} (${item.kind}, ${item.weight.toFixed(2)})`).join(" · ") || "Nothing shared"}
              </p>
              <p className="text-ink-muted">{d.reason}</p>
            </div>
          ))
        : null}
    </li>
  );
}

// ---- Help ----

export function HelpTab() {
  const notes = useQuery(api.admin.helpNotes);
  const markHandled = useMutation(api.admin.markHelpNoteHandled);
  const [showHandled, setShowHandled] = useState(false);
  const { busy, error, run } = useRun();
  const open = notes?.filter((note) => note.handledAt === null) ?? [];
  const handled = notes?.filter((note) => note.handledAt !== null) ?? [];
  const list = showHandled ? handled : open;
  return (
    <Panel title="Help notes" lead="From “Tell us about a problem.” Read by the team, not monitored around the clock, and not an emergency channel.">
      <Filters
        label="Which notes"
        value={showHandled ? "handled" : "open"}
        onChange={(key) => setShowHandled(key === "handled")}
        options={[
          { key: "open", label: "Not handled", count: open.length },
          { key: "handled", label: "Handled", count: handled.length },
        ]}
      />
      {notes === undefined ? (
        <Loading />
      ) : list.length === 0 ? (
        <Muted>{showHandled ? "No handled notes yet." : "No notes waiting."}</Muted>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {list.map((note) => (
            <li key={note._id} className="flex flex-col gap-2 py-3">
              <p className="text-caption break-all text-ink-muted tabular-nums">
                {when(note.createdAt)} · {note.firstName ?? "No name yet"} · {note.email ?? "No email"}
                {note.isDemo ? " · demo" : ""}
              </p>
              <p className="text-body whitespace-pre-wrap text-ink">{note.text}</p>
              {note.handledAt === null ? (
                <Action
                  label="Mark handled"
                  explain="Moves it to Handled. The student isn't told."
                  busy={busy === note._id}
                  onClick={() => run(note._id, () => markHandled({ noteId: note._id }))}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Result error={error} />
    </Panel>
  );
}

// ---- Demo ----

const HOUR = 60 * 60 * 1000;

export function DemoTab() {
  const overview = useQuery(api.admin.demo.overview);
  const seed = useMutation(api.admin.demo.seed);
  const reset = useMutation(api.admin.demo.reset);
  const setClock = useMutation(api.admin.demo.setClockOffset);
  const { busy, error, done, run } = useRun();
  const [hours, setHours] = useState("");
  const [openStudent, setOpenStudent] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Demo students" lead="These touch only demo students and demo plans. Plans with a real student always keep real time.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Action
            label="Seed demo students"
            explain="Creates the six demo students if they're missing. Their taste summaries take a minute or two."
            busy={busy === "seed"}
            onClick={() => run("seed", () => seed({}), "Demo students seeded.")}
          />
          <ConfirmAction
            label="Reset demo"
            explain="Starts the demo over from fresh demo students."
            question="Reset the demo?"
            consequence="Deletes and reseeds the demo students and their asks, seats and shares, deletes demo plans, and clears the team accounts' asks. A seat a demo student held next to a real student reopens. Real students' records are never deleted."
            yes="Reset demo"
            busy={busy === "reset"}
            onConfirm={() => run("reset", () => reset({}), "Demo reset.")}
          />
        </div>
        <Result error={error} done={done} />
      </Panel>

      <Panel
        title="Demo clock"
        lead={
          overview === undefined
            ? "Loading"
            : overview.clockOffsetMs === 0
              ? "Real time. Moving it ahead jumps demo plans forward, for example to meetup day."
              : `${(overview.clockOffsetMs / HOUR).toFixed(1)} hours ahead, for demo plans only.`
        }
      >
        <div className="flex flex-wrap gap-2">
          {[0, 1, 24].map((h) => (
            <Button key={h} variant="secondary" loading={busy === `clock-${h}`} onClick={() => run(`clock-${h}`, () => setClock({ offsetMs: h * HOUR }))}>
              {h === 0 ? "Real time" : `${h} ${h === 1 ? "hour" : "hours"} ahead`}
            </Button>
          ))}
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            const value = Number(hours);
            if (Number.isFinite(value)) void run("clock-custom", () => setClock({ offsetMs: value * HOUR }));
          }}
        >
          <TextField label="Hours ahead" value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" hint="Any number, like 30 for tomorrow evening." />
          <Button type="submit" variant="secondary" loading={busy === "clock-custom"} className="self-start">
            Set demo clock
          </Button>
        </form>
      </Panel>

      <Panel title="Act as a demo student" lead="Tap a student to answer for them. They also act on their own after a short delay.">
        {overview === undefined ? (
          <Loading />
        ) : overview.students.length === 0 ? (
          <Muted>No demo students yet. Seed them above.</Muted>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {overview.students.map((student) => (
              <DemoStudent
                key={student.userId}
                student={student}
                open={openStudent === student.userId}
                onToggle={() => setOpenStudent(openStudent === student.userId ? null : student.userId)}
              />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

type DemoStudentView = FunctionReturnType<typeof api.admin.demo.overview>["students"][number];

const ACT_AS = [
  ["accept", "Accept", "Takes the offered seat."],
  ["next_time", "Next time", "Gives up the offered seat. It reopens."],
  ["cant_make_it", "Can't make it", "Leaves the plan. Before the cutoff the seat is refilled."],
  ["got_ticket", "Got ticket", "Marks their ticket as bought."],
] as const;

function DemoStudent({ student, open, onToggle }: { student: DemoStudentView; open: boolean; onToggle: () => void }) {
  const actAs = useMutation(api.admin.demo.actAs);
  const { busy, error, run } = useRun();
  return (
    <li className="flex flex-col gap-2 py-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex flex-col">
          <span className="text-body-strong text-ink">{student.firstName}</span>
          <span className="text-small text-ink-muted">
            {student.seats.length === 0 ? "No seat right now" : `${student.seats.length} ${student.seats.length === 1 ? "seat" : "seats"}`}
          </span>
        </span>
        <span className="text-small font-semibold text-accent">{open ? "Close" : "Open"}</span>
      </button>
      {open
        ? student.seats.map((seat) => (
            <div key={seat.seatId} className="flex flex-col gap-3 rounded-sm bg-surface-raised p-3">
              <p className="text-small text-ink">
                {seat.eventTitle} · seat {seat.seat} · ticket {seat.ticket} · plan {seat.planStatus}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {ACT_AS.map(([action, label, explain]) => (
                  <Action
                    key={action}
                    label={label}
                    explain={explain}
                    busy={busy === `${seat.seatId}-${action}`}
                    onClick={() => run(`${seat.seatId}-${action}`, () => actAs({ userId: student.userId, action, seatId: seat.seatId }))}
                  />
                ))}
              </div>
            </div>
          ))
        : null}
      <Result error={error} />
    </li>
  );
}
