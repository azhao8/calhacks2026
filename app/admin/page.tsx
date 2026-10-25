"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/Button";
import { cx } from "@/components/cx";
import { Loading } from "./_ui";
import { AdminSignIn } from "./SignIn";
import { SpotifyTab, type StudentFocus } from "./Spotify";
import { DemoTab, EventsTab, HelpTab, MatchingTab, NeedsActionTab, type TabKey } from "./Tabs";

// S17 admin and demo (team only). The server checks ADMIN_EMAILS on every admin function; this
// page only decides what to show. Signing in here keeps you here, never in student onboarding.
const TABS: { key: TabKey; label: string }[] = [
  { key: "action", label: "Needs action" },
  { key: "spotify", label: "Spotify" },
  { key: "events", label: "Events" },
  { key: "matching", label: "Matching" },
  { key: "help", label: "Help" },
  { key: "demo", label: "Demo" },
];
const isTab = (value: string | null): value is TabKey => TABS.some((tab) => tab.key === value);

export default function AdminPage() {
  const who = useQuery(api.admin.whoami);

  if (who === undefined) {
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  }
  if (!who.signedIn) {
    return (
      <Shell>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-title text-ink">Melos admin</h1>
          <p className="text-body text-ink-muted">For the Melos team. Sign in with your school email.</p>
        </div>
        <AdminSignIn />
      </Shell>
    );
  }
  if (!who.isAdmin) {
    return (
      <Shell>
        <Header email={who.email} isAdmin={false} />
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
          <h1 className="text-headline text-ink">This account isn&apos;t on the team list</h1>
          <p className="text-body text-ink-muted">
            Sign out and use a team email, or ask azhao8 to add {who.email ?? "this email"} to ADMIN_EMAILS.
          </p>
        </div>
      </Shell>
    );
  }
  return <Admin email={who.email} />;
}

function Admin({ email }: { email: string | null }) {
  // The open tab lives in the address, so a reload or a shared link keeps it. This component only
  // renders in the browser (after whoami loads), so reading the address here is safe.
  const [tab, setTab] = useState<TabKey>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    return isTab(fromUrl) ? fromUrl : "action";
  });
  const [focus, setFocus] = useState<StudentFocus>({ status: "all", appId: "all" });
  const counts = useCounts();

  function go(next: TabKey, nextFocus?: Partial<StudentFocus>) {
    setTab(next);
    if (nextFocus) setFocus({ status: "all", appId: "all", ...nextFocus });
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="sticky top-0 z-10 border-b border-line bg-canvas pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pt-3">
          <Header email={email} isAdmin />
          <nav aria-label="Admin sections" className="-mx-4 flex gap-1 overflow-x-auto px-4">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-current={tab === key ? "page" : undefined}
                onClick={() => go(key)}
                className={cx(
                  "inline-flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 px-3 text-small font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
                  tab === key ? "border-accent text-ink" : "border-transparent text-ink-muted",
                )}
              >
                {label}
                {counts[key] ? (
                  <span className="rounded-pill bg-accent px-1.5 text-caption text-on-accent tabular-nums">
                    {counts[key]}
                    <span className="sr-only"> need action</span>
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4 pb-[calc(3rem+env(safe-area-inset-bottom))]">
        {tab === "action" ? <NeedsActionTab go={go} /> : null}
        {tab === "spotify" ? <SpotifyTab focus={focus} onFocus={setFocus} /> : null}
        {tab === "events" ? <EventsTab /> : null}
        {tab === "matching" ? <MatchingTab /> : null}
        {tab === "help" ? <HelpTab /> : null}
        {tab === "demo" ? <DemoTab /> : null}
      </main>
    </div>
  );
}

// Badge counts on the tabs: jobs waiting on the team.
function useCounts(): Partial<Record<TabKey, number>> {
  const queue = useQuery(api.admin.queue.list, { limit: 1 });
  const notes = useQuery(api.admin.helpNotes);
  const missing = useQuery(api.admin.events.list, { flaggedOnly: true, limit: 100 });
  const spotify = queue
    ? queue.counts.needs_adding + queue.counts.refused + queue.counts.no_app + queue.apps.filter((app) => app.secret === "none" || app.checkOk === false).length
    : 0;
  const help = notes?.filter((note) => note.handledAt === null).length ?? 0;
  const events = missing?.length ?? 0;
  return { action: spotify + help + events, spotify, help, events };
}

function Header({ email, isAdmin }: { email: string | null; isAdmin: boolean }) {
  const { signOut } = useAuthActions();
  const [busy, setBusy] = useState(false);
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <p className="font-display text-headline text-ink">Melos admin</p>
        <p className="text-caption break-all text-ink-muted">
          Signed in as {email ?? "an account with no email"} · {isAdmin ? "team" : "not on the team list"}
        </p>
      </div>
      <Button
        variant="secondary"
        loading={busy}
        className="shrink-0"
        onClick={async () => {
          setBusy(true);
          try {
            await signOut();
          } finally {
            setBusy(false);
          }
        }}
      >
        Sign out
      </Button>
    </header>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 bg-canvas px-4 py-12">{children}</main>;
}
