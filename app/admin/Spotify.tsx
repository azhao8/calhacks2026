"use client";

import { useDeferredValue, useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/Button";
import { TextField, inputClasses } from "@/components/TextField";
import { Icon } from "@/components/Icon";
import {
  Action,
  Badge,
  ConfirmAction,
  CopyButton,
  CopyIcon,
  SAME_AS_SCHOOL_WARNING,
  Warning,
  Filters,
  Loading,
  Muted,
  Panel,
  Result,
  ShowMore,
  ShownError,
  ago,
  useRun,
  when,
} from "./_ui";
import { sameAsSchoolEmail } from "./format";

type Queue = FunctionReturnType<typeof api.admin.queue.list>;
type App = Queue["apps"][number];
type Row = Queue["rows"][number];
export type Status = Row["status"];
export type StudentFocus = { status: Status | "all"; appId: Id<"spotifyApps"> | "none" | "all" };

const PAGE = 25;

export const STATUS: Record<Status, { label: string; tone: "plain" | "accent" | "danger" | "success"; explain: string }> = {
  needs_adding: {
    label: "Needs adding",
    tone: "accent",
    explain: "Add this Spotify email in the app's User Management on Spotify, then tap Mark added.",
  },
  refused: {
    label: "Spotify refused",
    tone: "danger",
    explain: "Spotify refused this account when they tried to connect. Check the email in the app's User Management, or they signed in with a different Spotify account.",
  },
  no_app: {
    label: "No app yet",
    tone: "danger",
    explain: "Every app was full when they asked. They get an app as soon as one has a free slot.",
  },
  added: { label: "Added, not connected", tone: "plain", explain: "Marked added. They can connect Spotify now." },
  connected: { label: "Connected", tone: "success", explain: "Connected through this app. Their Spotify sign-in belongs to it." },
  disconnected: {
    label: "Disconnected",
    tone: "plain",
    explain: "They disconnected in Melos but are still on the app's list in Spotify, so they still use a slot.",
  },
};

const STATUS_ORDER: Status[] = ["needs_adding", "refused", "no_app", "added", "connected", "disconnected"];

export function SpotifyTab({ focus, onFocus }: { focus: StudentFocus; onFocus: (focus: StudentFocus) => void }) {
  // The app list and counts never depend on the student filters, so they read the first page only.
  const overview = useQuery(api.admin.queue.list, { limit: 1 });
  if (overview === undefined) return <Loading />;
  return (
    <div className="flex flex-col gap-4">
      <Apps queue={overview} onShowStudents={(appId) => onFocus({ status: "all", appId })} />
      <Students apps={overview.apps} counts={overview.counts} focus={focus} onFocus={onFocus} />
    </div>
  );
}

// ---- Apps ----

function Apps({ queue, onShowStudents }: { queue: Queue; onShowStudents: (appId: Id<"spotifyApps">) => void }) {
  const [adding, setAdding] = useState(false);
  const free = queue.apps.filter((app) => app.active).reduce((sum, app) => sum + Math.max(0, app.capacity - app.used), 0);
  return (
    <Panel
      title="Spotify apps"
      lead={
        queue.apps.length === 0
          ? "Each app allows 5 Spotify accounts. Add the first one to start the queue."
          : `${queue.apps.length} ${queue.apps.length === 1 ? "app" : "apps"} · ${free} free ${free === 1 ? "slot" : "slots"}. Each app allows 5 Spotify accounts, added by hand in Spotify.`
      }
    >
      {adding ? (
        <AppForm redirectUris={queue.redirectUris} onDone={() => setAdding(false)} />
      ) : (
        <Action
          variant="primary"
          label="Add an app"
          explain="Register a teammate's Spotify app with its client ID and secret."
          onClick={() => setAdding(true)}
        />
      )}
      <ul className="flex flex-col gap-3">
        {queue.apps.map((app) => (
          <AppCard key={app.appId} app={app} redirectUris={queue.redirectUris} onShowStudents={() => onShowStudents(app.appId)} />
        ))}
      </ul>
    </Panel>
  );
}

function SecretBadge({ app }: { app: App }) {
  if (app.secret === "none") return <Badge tone="danger" icon="alert">No secret</Badge>;
  if (app.checkOk === false) return <Badge tone="danger" icon="alert">Spotify rejected it</Badge>;
  if (app.checkOk === true) return <Badge tone="success" icon="check">Checked</Badge>;
  return <Badge>{app.secret === "env" ? "Secret in Convex" : "Secret saved"}</Badge>;
}

function SlotBar({ used, capacity }: { used: number; capacity: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: capacity }, (_, i) => (
          <span key={i} className={i < used ? "h-2 w-5 rounded-pill bg-accent" : "h-2 w-5 rounded-pill bg-surface-raised"} />
        ))}
      </div>
      <span className="text-small text-ink-muted tabular-nums">
        {used} of {capacity} slots used
      </span>
    </div>
  );
}

function AppCard({ app, redirectUris, onShowStudents }: { app: App; redirectUris: string[]; onShowStudents: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const setActive = useMutation(api.admin.queue.setAppActive);
  const remove = useMutation(api.admin.queue.deleteApp);
  const check = useAction(api.admin.queue.checkApp);
  const { busy, error, done, run, setDone } = useRun();
  const toAdd = app.emailsToAdd.length;

  return (
    <li className="flex flex-col gap-3 rounded-md border border-line p-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full flex-col gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex w-full items-start justify-between gap-2">
          <span className="flex min-w-0 flex-col">
            <span className="text-body-strong break-all text-ink">{app.label}</span>
            <span className="text-small text-ink-muted">Owner: {app.ownerName}</span>
          </span>
          <span className="shrink-0 text-small font-semibold text-accent">{open ? "Close" : "Manage"}</span>
        </span>
        <SlotBar used={app.used} capacity={app.capacity} />
        <span className="flex flex-wrap gap-1.5">
          {!app.active ? <Badge tone="danger">Turned off</Badge> : null}
          <SecretBadge app={app} />
          {toAdd > 0 ? <Badge tone="accent">{toAdd} to add</Badge> : null}
          {app.counts.connected > 0 ? <Badge>{app.counts.connected} connected</Badge> : null}
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-4 border-t border-line pt-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
            <dt className="text-ink-muted">Client ID</dt>
            <dd className="break-all text-ink tabular-nums">{app.clientId}</dd>
            <dt className="text-ink-muted">Secret</dt>
            <dd className="text-ink">
              {app.secret === "saved"
                ? `Saved ${app.secretSetAt ? when(app.secretSetAt) : ""}${app.secretSetBy ? ` by ${app.secretSetBy}` : ""}`
                : app.secret === "env"
                  ? "Read from the Convex variable. Save it here to manage it on this page."
                  : "Not saved. Students on this app can't connect until it is."}
            </dd>
            <dt className="text-ink-muted">Last check</dt>
            <dd className="text-ink">
              {app.checkedAt === null ? "Not checked" : `${app.checkOk ? "Spotify accepted it" : "Spotify rejected it"} · ${ago(app.checkedAt)}`}
            </dd>
          </dl>

          {toAdd > 0 ? (
            <div className="flex flex-col gap-2 rounded-sm bg-surface-raised p-3">
              <p className="text-small font-semibold text-ink">Add these in Spotify&apos;s User Management</p>
              <ul className="flex flex-col gap-1">
                {app.emailsToAdd.map((email) => (
                  <li key={email} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-body-strong break-all text-ink">{email}</span>
                    <CopyIcon text={email} what={email} />
                  </li>
                ))}
              </ul>
              <CopyButton
                text={app.emailsToAdd.join("\n")}
                label={`Copy ${toAdd} ${toAdd === 1 ? "email" : "emails"}`}
                explain="One per line. Then mark each student added below."
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Action
              label="Show its students"
              explain="Filters the student list below to this app."
              onClick={() => {
                onShowStudents();
                document.getElementById("students")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
            <Action
              label="Check app"
              explain="Asks Spotify whether it accepts this client ID and secret. Changes nothing."
              busy={busy === "check"}
              disabledReason={app.secret === "none" ? "Save a secret first." : null}
              onClick={() =>
                run("check", async () => {
                  const result = await check({ appId: app.appId });
                  if (result === "rejected") throw new ShownError("Spotify rejected this client ID or secret. Copy both again from the app's settings.");
                  setDone(result === "accepted" ? "Spotify accepted this app." : "Save a secret first.");
                })
              }
            />
            <Action
              label={secretOpen ? "Close" : app.secret === "none" ? "Add secret" : "Replace secret"}
              explain="Saves a new client secret. It can't be read back, only replaced."
              onClick={() => setSecretOpen(!secretOpen)}
            />
            <Action label={editing ? "Close" : "Edit app"} explain="Change the owner's name or the client ID." onClick={() => setEditing(!editing)} />
            {app.active ? (
              <ConfirmAction
                label="Turn off"
                explain="Stops new students from being assigned here."
                question={`Turn off ${app.label}?`}
                consequence={`New students won't be assigned here, and its ${app.used} ${app.used === 1 ? "student" : "students"} can't connect until you turn it back on. Students already connected keep their data.`}
                yes="Turn off"
                busy={busy === "active"}
                onConfirm={() => run("active", () => setActive({ appId: app.appId, active: false }), "Turned off.")}
              />
            ) : (
              <Action
                label="Turn on"
                explain="Students here can connect again, and waiting students can be assigned here."
                busy={busy === "active"}
                onClick={() =>
                  run("active", async () => {
                    const result = await setActive({ appId: app.appId, active: true });
                    setDone(result.assignedWaiting > 0 ? `Turned on. ${result.assignedWaiting} waiting assigned here.` : "Turned on.");
                  })
                }
              />
            )}
            <ConfirmAction
              label="Delete app"
              explain="Removes this app from Melos."
              disabledReason={app.used > 0 ? "Only an empty app can be deleted. Move or remove its students first." : null}
              question={`Delete ${app.label}?`}
              consequence="Removes the app and its saved secret from Melos. The app itself stays in your Spotify dashboard."
              yes="Delete app"
              busy={busy === "delete"}
              onConfirm={() => run("delete", () => remove({ appId: app.appId }))}
            />
          </div>
          {secretOpen ? <SecretForm app={app} onDone={() => setSecretOpen(false)} /> : null}
          {editing ? <AppForm app={app} redirectUris={redirectUris} onDone={() => setEditing(false)} /> : null}
          <Result error={error} done={done} />
        </div>
      ) : null}
    </li>
  );
}

function SecretForm({ app, onDone }: { app: App; onDone: () => void }) {
  const save = useMutation(api.admin.queue.setAppSecret);
  const [secret, setSecret] = useState("");
  const { busy, error, run } = useRun();
  return (
    <form
      className="flex flex-col gap-3 rounded-sm bg-surface-raised p-3"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        if (await run("secret", () => save({ appId: app.appId, secret }))) {
          setSecret("");
          onDone();
        }
      }}
    >
      <TextField
        label="Client secret"
        type="password"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        hint="In the Spotify dashboard: the app, then Settings, then View client secret. Saved on the server and never shown again."
      />
      <Button type="submit" loading={busy === "secret"} disabled={secret.trim().length === 0} className="self-start">
        Save secret
      </Button>
      <Result error={error} />
    </form>
  );
}

function AppForm({ app, redirectUris, onDone }: { app?: App; redirectUris: string[]; onDone: () => void }) {
  const upsert = useMutation(api.admin.queue.upsertSpotifyApp);
  const { busy, error, done, run, setDone } = useRun();
  const [label, setLabel] = useState(app?.label ?? "");
  const [ownerName, setOwnerName] = useState(app?.ownerName ?? "");
  const [clientId, setClientId] = useState(app?.clientId ?? "");
  const [secret, setSecret] = useState("");

  return (
    <form
      className="flex flex-col gap-3 rounded-sm bg-surface-raised p-3"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        const ok = await run("save", async () => {
          const result = await upsert({ label, ownerName, clientId, ...(secret.trim() ? { secret } : {}) });
          setDone(
            result.assignedWaiting > 0
              ? `Saved. ${result.assignedWaiting} waiting ${result.assignedWaiting === 1 ? "student was" : "students were"} assigned to it.`
              : "Saved.",
          );
        });
        if (ok && app) onDone();
        if (ok && !app) {
          setLabel("");
          setOwnerName("");
          setClientId("");
          setSecret("");
        }
      }}
    >
      <p className="text-body-strong text-ink">{app ? `Edit ${app.label}` : "Add a Spotify app"}</p>
      {app ? null : (
        <TextField
          label="Label"
          value={label}
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => setLabel(e.target.value)}
          hint="Lowercase letters, digits, and dashes, like melos-alex. It can't change later."
        />
      )}
      <TextField label="Owner's name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} hint="The teammate whose Spotify account owns the app." />
      <TextField
        label="Client ID"
        value={clientId}
        autoCapitalize="none"
        spellCheck={false}
        onChange={(e) => setClientId(e.target.value)}
        hint="In the Spotify dashboard: the app, then Settings."
      />
      {app ? null : (
        <TextField
          label="Client secret"
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          hint="Settings, then View client secret. Saved on the server and never shown again. You can add it later."
        />
      )}
      {app ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-small font-semibold text-ink">Register both redirect addresses in the app&apos;s settings</p>
          {redirectUris.map((uri) => (
            <div key={uri} className="flex flex-col gap-1">
              <code className="text-small break-all text-ink">{uri}</code>
              <CopyButton text={uri} label="Copy address" explain="Paste it under Redirect URIs in Spotify." />
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy === "save"}>
          {app ? "Save changes" : "Add app"}
        </Button>
        <Button variant="quiet" onClick={onDone} disabled={busy !== null}>
          {app ? "Cancel" : "Close"}
        </Button>
      </div>
      <Result error={error} done={done} />
    </form>
  );
}

// ---- Students ----

function Students({
  apps,
  counts,
  focus,
  onFocus,
}: {
  apps: App[];
  counts: Queue["counts"];
  focus: StudentFocus;
  onFocus: (focus: StudentFocus) => void;
}) {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const deferred = useDeferredValue(search.trim());
  const queue = useQuery(api.admin.queue.list, {
    ...(focus.status === "all" ? {} : { status: focus.status }),
    ...(focus.appId === "all" ? {} : { appId: focus.appId }),
    ...(deferred ? { search: deferred } : {}),
    limit,
  });
  const total = STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0);
  const setFocus = (next: Partial<StudentFocus>) => {
    setLimit(PAGE);
    onFocus({ ...focus, ...next });
  };

  return (
    <div id="students" className="scroll-mt-28">
      <Panel title="Students" lead="Everyone who asked for Spotify access. The next job is always at the top.">
        <Filters
          label="Status"
          value={focus.status}
          onChange={(status) => setFocus({ status })}
          options={[
            { key: "all" as const, label: "All", count: total },
            ...STATUS_ORDER.map((status) => ({ key: status, label: STATUS[status].label, count: counts[status] })),
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="app-filter" className="text-small font-semibold text-ink">
              App
            </label>
            <select
              id="app-filter"
              value={focus.appId}
              onChange={(e) => setFocus({ appId: e.target.value as StudentFocus["appId"] })}
              className={inputClasses}
            >
              <option value="all">Every app</option>
              <option value="none">No app yet</option>
              {apps.map((app) => (
                <option key={app.appId} value={app.appId}>
                  {app.label} ({app.used} of {app.capacity})
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
              setLimit(PAGE);
            }}
            hint="First name, school email, or Spotify email."
          />
        </div>
        {queue === undefined ? (
          <Loading />
        ) : queue.rows.length === 0 ? (
          <Muted>{total === 0 ? "Nobody has asked for access yet." : "Nobody matches these filters."}</Muted>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {queue.rows.map((row) => (
              <StudentRow key={row.accessId} row={row} apps={apps} />
            ))}
          </ul>
        )}
        {queue ? <ShowMore shown={queue.rows.length} total={queue.total} step={PAGE} onMore={() => setLimit(limit + PAGE)} /> : null}
      </Panel>
    </div>
  );
}

function StudentRow({ row, apps }: { row: Row; apps: App[] }) {
  const [open, setOpen] = useState(false);
  const markAdded = useMutation(api.admin.queue.markAdded);
  const { busy, error, done, run, setDone } = useRun();
  const status = STATUS[row.status];
  const canMark = row.status === "needs_adding" || row.status === "refused";

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body text-ink">
          {row.firstName ?? "No name yet"}
          {row.isTeam ? <span className="text-small text-ink-muted"> · team</span> : null}
        </p>
        <Badge tone={status.tone} icon={status.tone === "danger" ? "alert" : status.tone === "success" ? "check" : undefined}>
          {status.label}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-caption font-semibold text-ink-muted">Spotify email</p>
          <p className="text-headline break-all text-ink">{row.spotifyEmail}</p>
        </div>
        <CopyIcon text={row.spotifyEmail} what={row.firstName ? `${row.firstName}'s Spotify email` : "Spotify email"} />
      </div>
      {sameAsSchoolEmail(row.spotifyEmail, row.schoolEmail) ? <Warning>{SAME_AS_SCHOOL_WARNING}</Warning> : null}
      <p className="text-small text-ink">
        {row.appLabel ? (
          <>
            App <span className="font-semibold">{row.appLabel}</span> ({row.appOwner})
          </>
        ) : (
          "No app yet"
        )}
        <span className="text-ink-muted"> · asked {ago(row.requestedAt)}</span>
      </p>
      {row.schoolEmail && !sameAsSchoolEmail(row.spotifyEmail, row.schoolEmail) ? <p className="text-caption break-all text-ink-muted">School email {row.schoolEmail}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {canMark ? (
          <Button
            loading={busy === "mark"}
            onClick={() =>
              run("mark", async () => {
                const result = await markAdded({ accessId: row.accessId });
                setDone(result.emailQueued ? `Marked added. Ready email sent to ${row.firstName ?? "them"}.` : "Marked added. They were emailed before, so no new email.");
              })
            }
          >
            {row.status === "refused" ? "Mark added again" : "Mark added"}
          </Button>
        ) : null}
        <Button variant="quiet" aria-expanded={open} onClick={() => setOpen(!open)} iconAfter={open ? undefined : "arrow"}>
          {open ? "Close" : "More"}
        </Button>
      </div>
      {canMark && !open ? (
        <p className="text-caption text-ink-muted">
          Tap after adding {row.spotifyEmail} in {row.appLabel}&apos;s User Management. {row.emailed ? "They were emailed before, so no new email goes out." : "Sends the ready email once."}
        </p>
      ) : null}
      <Result error={error} done={done} />
      {open ? <StudentActions row={row} apps={apps} explain={status.explain} /> : null}
    </li>
  );
}

function StudentActions({ row, apps, explain }: { row: Row; apps: App[]; explain: string }) {
  const undo = useMutation(api.admin.queue.undoAdded);
  const move = useMutation(api.admin.queue.moveRequest);
  const remove = useMutation(api.admin.queue.removeRequest);
  const { busy, error, done, run } = useRun();
  const targets = apps.filter((app) => app.appId !== row.appId && app.active && app.used < app.capacity);
  const [target, setTarget] = useState<string>("");
  const connected = row.status === "connected" ? "Connected through this app. They need to disconnect in Melos first." : null;

  return (
    <div className="flex flex-col gap-4 rounded-sm bg-surface-raised p-3">
      <p className="flex items-start gap-2 text-small text-ink">
        <Icon name="alert" className="mt-0.5 shrink-0 text-ink-muted" />
        {explain}
      </p>
      {row.allowlistedAt ? (
        <p className="text-caption text-ink-muted">
          Marked added {when(row.allowlistedAt)}
          {row.allowlistedBy ? ` by ${row.allowlistedBy}` : ""}
          {row.emailed ? " · ready email sent" : ""}
        </p>
      ) : null}

      {row.status === "added" ? (
        <Action
          label="Undo added"
          explain="Back to Needs adding, for a student you marked by mistake. No second email goes out later."
          busy={busy === "undo"}
          onClick={() => run("undo", () => undo({ accessId: row.accessId }), "Back to Needs adding.")}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor={`move-${row.accessId}`} className="text-small font-semibold text-ink">
          Move to another app
        </label>
        <select
          id={`move-${row.accessId}`}
          value={target}
          disabled={Boolean(connected) || targets.length === 0}
          onChange={(e) => setTarget(e.target.value)}
          className={inputClasses}
        >
          <option value="">Choose an app</option>
          {targets.map((app) => (
            <option key={app.appId} value={app.appId}>
              {app.label} · {app.capacity - app.used} free
            </option>
          ))}
        </select>
        <Action
          label="Move"
          explain="They take a slot on the new app and wait for its owner to add them. Remove them from the old app in Spotify."
          busy={busy === "move"}
          disabledReason={connected ?? (targets.length === 0 ? "No other app has a free slot." : target === "" ? "Choose an app first." : null)}
          onClick={() => run("move", () => move({ accessId: row.accessId, appId: target as Id<"spotifyApps"> }), "Moved. They show as Needs adding on the new app.")}
        />
      </div>

      <ConfirmAction
        label={row.status === "disconnected" ? "Free the slot" : "Remove request"}
        explain={row.status === "disconnected" ? "Do this after removing them from the app in Spotify." : "Frees their slot on the app."}
        disabledReason={connected}
        question={row.status === "disconnected" ? `Free ${row.firstName ?? "this student"}'s slot?` : `Remove ${row.firstName ?? "this"} request?`}
        consequence={
          row.status === "disconnected"
            ? "Frees the slot for someone waiting. If they come back, they enter their Spotify email again."
            : "Frees the slot. If they're still onboarding, they go back to About you and can ask again. Remove the email from the app in Spotify too."
        }
        yes={row.status === "disconnected" ? "Free the slot" : "Remove request"}
        busy={busy === "remove"}
        onConfirm={() => run("remove", () => remove({ accessId: row.accessId }))}
      />
      <Result error={error} done={done} />
    </div>
  );
}
