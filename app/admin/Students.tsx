"use client";

import { useDeferredValue, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@/components/Button";
import { TextField, inputClasses } from "@/components/TextField";
import { Icon } from "@/components/Icon";
import { Action, Badge, ConfirmAction, Filters, Loading, Muted, Panel, Result, ShowMore, ago, useRun } from "./_ui";

type List = FunctionReturnType<typeof api.admin.students.list>;
type Row = List["rows"][number];
type Kind = Row["kind"];
type Stage = NonNullable<Row["stage"]>;

const PAGE = 25;

const STAGE: Record<Stage, string> = {
  needs_verification: "Hasn't verified email",
  needs_about_you: "On About you",
  needs_preferences: "On preferences",
  waiting_for_spotify: "Waiting for Spotify",
  needs_spotify_connect: "Can connect Spotify",
  analyzing: "Reading their music",
  needs_review: "Reviewing taste",
  ready: "Ready",
};
const STAGES = Object.keys(STAGE) as Stage[];

const SPOTIFY: Record<string, string> = {
  needs_adding: "needs adding",
  refused: "refused by Spotify",
  no_app: "no app yet",
  added: "added, not connected",
  connected: "connected",
  disconnected: "disconnected",
};

export function StudentsTab() {
  const [kind, setKind] = useState<Kind | "all">("real");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const deferred = useDeferredValue(search.trim());
  const list = useQuery(api.admin.students.list, {
    ...(kind === "all" ? {} : { kind }),
    ...(stage === "all" ? {} : { stage }),
    ...(deferred ? { search: deferred } : {}),
    limit,
  });
  const reset = () => setLimit(PAGE);

  return (
    <Panel title="Students" lead="Every account, newest first. Deleting a student is permanent and removes all their data.">
      <Filters
        label="Kind"
        value={kind}
        onChange={(next) => {
          setKind(next);
          reset();
        }}
        options={[
          { key: "real" as const, label: "Real", count: list?.kinds.real },
          { key: "demo" as const, label: "Demo", count: list?.kinds.demo },
          { key: "team" as const, label: "Team", count: list?.kinds.team },
          { key: "all" as const, label: "All" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="stage-filter" className="text-small font-semibold text-ink">
            Where they are
          </label>
          <select
            id="stage-filter"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value as Stage | "all");
              reset();
            }}
            className={inputClasses}
          >
            <option value="all">Any step</option>
            {STAGES.map((key) => (
              <option key={key} value={key}>
                {STAGE[key]}
              </option>
            ))}
          </select>
        </div>
        <TextField
          label="Search"
          type="search"
          autoCapitalize="none"
          spellCheck={false}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            reset();
          }}
          hint="First name or school email."
        />
      </div>
      {list === undefined ? (
        <Loading />
      ) : list.rows.length === 0 ? (
        <Muted>Nobody matches these filters.</Muted>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {list.rows.map((row) => (
            <StudentRow key={row.userId} row={row} />
          ))}
        </ul>
      )}
      {list ? <ShowMore shown={list.rows.length} total={list.total} step={PAGE} onMore={() => setLimit(limit + PAGE)} /> : null}
    </Panel>
  );
}

function StudentRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const remove = useMutation(api.admin.students.deleteStudent);
  const { busy, error, run } = useRun();
  const name = row.firstName ?? row.email ?? "this student";
  return (
    <li className="flex flex-col gap-2 py-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-start justify-between gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body-strong text-ink">
            {row.firstName ?? "No name yet"}
            {row.isYou ? <span className="text-small font-normal text-ink-muted"> · you</span> : null}
          </span>
          <span className="text-small break-all text-ink-muted">{row.email ?? "No email"}</span>
          <span className="text-caption text-ink-muted">
            {row.stage ? STAGE[row.stage] : "No step"} · signed up {ago(row.signedUpAt)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {row.kind !== "real" ? <Badge>{row.kind === "demo" ? "Demo" : "Team"}</Badge> : null}
          {row.seat ? <Badge tone="accent">{row.seat.seat === "in" ? "In a plan" : "Has an offer"}</Badge> : null}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-4 rounded-sm bg-surface-raised p-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
            <dt className="text-ink-muted">Email</dt>
            <dd className="text-ink">{row.verified ? "Verified" : "Not verified"}</dd>
            <dt className="text-ink-muted">Spotify</dt>
            <dd className="text-ink">{row.spotify ? SPOTIFY[row.spotify] : "Hasn't asked yet"}</dd>
            <dt className="text-ink-muted">Seat</dt>
            <dd className="text-ink">{row.seat ? `${row.seat.eventTitle} · ${row.seat.seat === "in" ? "in" : "offered"} · plan ${row.seat.planStatus}` : "None"}</dd>
          </dl>
          <ConfirmAction
            label="Delete student"
            explain="Permanently removes this account and all its data."
            disabledReason={row.isYou ? "This is the account you're signed in with." : null}
            question={`Delete ${name} and all their data?`}
            consequence={`Removes their account, sign-in, preferences, Spotify connection and taste, asks, seats, shares and help notes. A seat they hold reopens for their partner. This can't be undone.${
              row.spotify ? " Remove their email from the Spotify app's User Management too." : ""
            }`}
            yes="Delete student"
            busy={busy === "delete"}
            onConfirm={() => run("delete", () => remove({ userId: row.userId }))}
          />
          <Result error={error} />
        </div>
      ) : null}
    </li>
  );
}

// ---- Danger zone ----

type Scope = "students" | "events" | "everything";

const NUKES: { scope: Scope; label: string; phrase: string; explain: string; removes: string }[] = [
  {
    scope: "students",
    label: "Delete all students",
    phrase: "delete all students",
    explain: "Every real and demo student and all their data.",
    removes:
      "Every account that isn't on the team list, with their sign-ins, preferences, Spotify connections, taste, asks, seats, shares and help notes, plus all matcher logs. Team accounts, events, Spotify apps and schools stay. Remove the students from each Spotify app's User Management too.",
  },
  {
    scope: "events",
    label: "Delete all events",
    phrase: "delete all events",
    explain: "Every event, and the asks and plans built on them.",
    removes:
      "Every event and scout import, with every ask, plan, seat, shared contact and matcher log. Students, venues, meeting spots and Spotify apps stay. Run Find events now to fill the catalog again.",
  },
  {
    scope: "everything",
    label: "Delete everything",
    phrase: "delete everything",
    explain: "Starts Melos over, keeping only the setup.",
    removes:
      "All events and imports, asks, plans, seats, shares, matcher logs, help notes and every student. The demo clock goes back to real time. Kept: team accounts, Spotify apps and their secrets, schools, venues and meeting spots.",
  },
];

export function DangerTab() {
  const counts = useQuery(api.admin.students.dangerCounts);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border border-danger p-4 text-small text-ink">
        <Icon name="alert" className="mt-0.5 shrink-0 text-danger" />
        <p>
          These permanently delete data for everyone using Melos, including real students. Nothing here can be undone. Each one asks you to type a
          phrase first.
        </p>
      </div>
      <Panel title="What's here now">
        {counts === undefined ? (
          <Loading />
        ) : (
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-body">
            <dt className="text-ink-muted">Students (real and demo)</dt>
            <dd className="text-ink tabular-nums">{counts.students}</dd>
            <dt className="text-ink-muted">Events</dt>
            <dd className="text-ink tabular-nums">{counts.events}</dd>
            <dt className="text-ink-muted">Plans</dt>
            <dd className="text-ink tabular-nums">{counts.plans}</dd>
            <dt className="text-ink-muted">Asks</dt>
            <dd className="text-ink tabular-nums">{counts.asks}</dd>
            <dt className="text-ink-muted">Help notes</dt>
            <dd className="text-ink tabular-nums">{counts.helpNotes}</dd>
          </dl>
        )}
      </Panel>
      {NUKES.map((nuke) => (
        <Nuke key={nuke.scope} {...nuke} />
      ))}
    </div>
  );
}

function Nuke({ scope, label, phrase, explain, removes }: (typeof NUKES)[number]) {
  const nuke = useMutation(api.admin.students.nuke);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { busy, error, done, run } = useRun();
  const matches = typed.trim().toLowerCase() === phrase;
  return (
    <Panel title={label} lead={explain}>
      {open ? (
        <div className="flex flex-col gap-3 rounded-sm border border-danger bg-surface-raised p-3">
          <p className="text-small text-ink">{removes}</p>
          <TextField
            label={`Type "${phrase}" to confirm`}
            value={typed}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy === scope}
              disabled={!matches}
              onClick={async () => {
                if (await run(scope, () => nuke({ scope, confirm: typed }), "Started. It finishes in a few seconds; the counts above update live.")) {
                  setTyped("");
                  setOpen(false);
                }
              }}
            >
              {label}
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
              disabled={busy !== null}
            >
              Keep it
            </Button>
          </div>
          {!matches ? <p className="text-caption text-ink-muted">The button works once the phrase matches.</p> : null}
        </div>
      ) : (
        <Action label={label} explain="Shows exactly what gets deleted before anything happens." onClick={() => setOpen(true)} />
      )}
      <Result error={error} done={done} />
    </Panel>
  );
}
