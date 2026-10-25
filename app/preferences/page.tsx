"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { MeView } from "@/convex/lib/views";
import { Button } from "@/components/Button";
import { InlineError } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Icon } from "@/components/Icon";
import { QuestionnaireStep } from "@/components/QuestionnaireStep";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { setFlash, useVisit } from "@/app/_lib/nav";
import { usePreferences, type PreferencesView } from "@/app/_lib/views";
import {
  AREA_OPTIONS,
  BUDGETS,
  budgetIdFor,
  budgetMax,
  MEET_OPTIONS,
  meetWhoSelection,
  SELF_OPTIONS,
  toggleMeetWho,
  toggleSingle,
  YEAR_OPTIONS,
  type Area,
  type BudgetId,
  type Gender,
  type GenderSelf,
  type MeetWho,
  type Year,
} from "@/app/_lib/preferences";
import { ROUTES } from "@/app/_lib/routes";
import { BackLink } from "@/app/_components/BackLink";
import { Confirm } from "@/app/_components/Confirm";
import { LoadingScreen, Screen, ScreenTitle } from "@/app/_components/Screen";

// S05 Preferences (component QuestionnaireStep). The first time, one question per screen while the
// allow-list request is pending, with "Surprise me" always there. Opened again (from the menu or
// Waiting), a summary of the saved answers, each with "Change", and one Save. Gender and year are
// private and used only for pairing. Changes apply to future asks and offers.
export default function PreferencesPage() {
  const gate = useGate(ROUTES.preferences);
  const ready = gate.status === "ready" && gate.me !== null;
  const saved = usePreferences(ready ? undefined : "skip");
  // Next keeps visited pages alive (cacheComponents); keyed per visit, the page opens fresh each
  // time instead of on the question or spinner the student left.
  const visit = useVisit();
  if (gate.status === "loading" || gate.me === null || saved === undefined) return <LoadingScreen object="headphones" />;
  if (saved === null) return <FirstTime key={visit} me={gate.me} />;
  return <Summary key={`${visit}:${JSON.stringify(saved)}`} me={gate.me} saved={saved} />;
}

const SAVED = "Preferences saved.";
const SURPRISE = "Up to $25, anyone, around Berkeley and Oakland.";
const QUESTIONS = ["budget", "meetWho", "self", "year", "area"] as const;
type QuestionId = (typeof QUESTIONS)[number];

type Answers = {
  budget: BudgetId | null;
  meetWho: MeetWho | null;
  self: GenderSelf | null;
  year: Year | null;
  similarYear: boolean;
  area: Area | null;
};

const EMPTY: Answers = { budget: null, meetWho: null, self: null, year: null, similarYear: false, area: null };

function fromSaved(saved: NonNullable<PreferencesView>): Answers {
  return {
    budget: budgetIdFor(saved.maxTicketPrice),
    meetWho: saved.meetWho,
    self: saved.gender,
    year: saved.year,
    similarYear: saved.prefersSimilarYear,
    area: saved.area,
  };
}

const complete = (a: Answers) => a.budget !== null && a.meetWho !== null && a.area !== null;

// What the save and surprise mutations need, and what happens on success and failure.
function useSave(onSaved: () => void) {
  const savePreferences = useMutation(api.onboarding.savePreferences);
  const surpriseMe = useMutation(api.onboarding.surpriseMe);
  const [busy, setBusy] = useState<"next" | "surprise" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "next" | "surprise", call: () => Promise<null>) {
    setBusy(kind);
    setError(null);
    try {
      await call();
      setBusy(null);
      setFlash(SAVED);
      onSaved();
    } catch (e) {
      setError(errorCopy(e, { fallback: "We couldn't save your answers. Try again." }));
      setBusy(null);
    }
  }

  const save = (a: Answers) => {
    if (!complete(a)) return;
    void run("next", () =>
      savePreferences({
        maxTicketPrice: budgetMax(a.budget!),
        meetWho: a.meetWho!,
        gender: a.self ?? undefined,
        year: a.year ?? undefined,
        prefersSimilarYear: a.year !== null && a.similarYear,
        area: a.area!,
      }),
    );
  };
  const surprise = () => void run("surprise", () => surpriseMe({}));
  return { busy, error, save, surprise };
}

// The props for one question, shared by the first-time flow and editing one answer.
function question(id: QuestionId, a: Answers, set: (next: Partial<Answers>) => void) {
  switch (id) {
    case "budget":
      return {
        title: "What do you usually spend on a ticket?",
        hint: "Per ticket. You can change this later.",
        options: [...BUDGETS],
        value: a.budget,
        onChange: (v: string) => set({ budget: toggleSingle(a.budget, v as BudgetId) }),
        required: true,
      };
    case "meetWho":
      return {
        title: "Who would you like to meet?",
        hint: "Pick any that work. We only pair people whose choices fit both ways.",
        multi: true,
        options: [...MEET_OPTIONS],
        value: meetWhoSelection(a.meetWho),
        onChange: (v: string) => set({ meetWho: toggleMeetWho(a.meetWho, v as "anyone" | Gender) }),
        required: true,
      };
    case "self":
      return {
        title: "I am",
        hint: "Optional and private. It's only used for pairing, and nobody sees it. If you'd rather not say, you're paired with people open to anyone.",
        options: [...SELF_OPTIONS],
        value: a.self,
        onChange: (v: string) => set({ self: toggleSingle(a.self, v as GenderSelf) }),
        required: false,
      };
    case "year":
      return {
        title: "What year are you in?",
        hint: "Optional and private. Nobody sees it.",
        options: [...YEAR_OPTIONS],
        value: a.year,
        onChange: (v: string) => set({ year: toggleSingle(a.year, v as Year) }),
        required: false,
        extra:
          a.year !== null ? (
            <div className="flex flex-wrap gap-2">
              <Chip selected={a.similarYear} onClick={() => set({ similarYear: !a.similarYear })}>
                Prefer someone in a similar year
              </Chip>
            </div>
          ) : null,
      };
    case "area":
      return {
        title: "How far will you go?",
        hint: "Measured from campus. Farther includes everything closer.",
        options: [...AREA_OPTIONS],
        value: a.area,
        onChange: (v: string) => set({ area: toggleSingle(a.area, v as Area) }),
        required: true,
      };
  }
}

const label = <T extends { id: string; label: string }>(list: readonly T[], id: string | null) => list.find((o) => o.id === id)?.label ?? null;

// The summary rows: what each answer says now, in words.
function answerText(id: QuestionId, a: Answers): string {
  switch (id) {
    case "budget":
      return label(BUDGETS, a.budget) ?? "Not set";
    case "meetWho":
      return meetWhoSelection(a.meetWho)
        .map((v) => label(MEET_OPTIONS, v))
        .join(", ") || "Not set";
    case "self":
      return label(SELF_OPTIONS, a.self) ?? "Not set";
    case "year":
      return a.year === null ? "Not set" : `${label(YEAR_OPTIONS, a.year)}${a.similarYear ? ", prefer someone in a similar year" : ""}`;
    case "area":
      return label(AREA_OPTIONS, a.area) ?? "Not set";
  }
}

const ROW_NAME: Record<QuestionId, string> = {
  budget: "Ticket budget",
  meetWho: "Who you'd like to meet",
  self: "I am",
  year: "Year",
  area: "How far",
};

function Card({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-lg bg-backdrop-vignette p-4">{children}</div>;
}

// First time: one question per screen, then on to the next onboarding step.
function FirstTime({ me }: { me: NonNullable<MeView> }) {
  const router = useRouter();
  const online = useOnline();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const { busy, error, save, surprise } = useSave(() => router.replace(ROUTES.welcome));
  const id = QUESTIONS[step - 1];
  const q = question(id, answers, (next) => setAnswers((a) => ({ ...a, ...next })));
  const last = step === QUESTIONS.length;

  return (
    <Screen object="headphones" menu={me.onboarding !== "needs_preferences"}>
      <Card>
        <QuestionnaireStep
          id={`pref-${step}`}
          step={step}
          total={QUESTIONS.length}
          title={q.title}
          hint={q.hint}
          multi={q.multi}
          options={q.options}
          value={q.value}
          onChange={q.onChange}
          extra={q.extra}
          onSurprise={surprise}
          busy={busy}
          error={error ? <InlineError>{error}</InlineError> : null}
          nextLabel={last ? "Save" : !q.required && q.value === null ? "Skip" : "Continue"}
          nextDisabled={(q.required && (q.value === null || (Array.isArray(q.value) && q.value.length === 0))) || (last && !online)}
          onNext={last ? () => save(answers) : () => setStep((s) => s + 1)}
        />
        <p className="text-caption text-ink-muted">Surprise me: {SURPRISE.replace(/\.$/, "")}. Change it anytime.</p>
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="min-h-12 self-start text-small font-semibold text-ink-muted underline underline-offset-3 hover:text-ink"
          >
            Back to the last question
          </button>
        ) : (
          // Question 1 goes back to About you, which can still change the name and Spotify email.
          <Link href={ROUTES.aboutYou} className="inline-flex min-h-12 items-center self-start text-small font-semibold text-ink-muted underline underline-offset-3 hover:text-ink">
            Back to About you
          </Link>
        )}
      </Card>
    </Screen>
  );
}

// Opened again: every saved answer with "Change", then one Save. Stays on this screen after saving.
function Summary({ me, saved }: { me: NonNullable<MeView>; saved: NonNullable<PreferencesView> }) {
  const online = useOnline();
  const [answers, setAnswers] = useState<Answers>(() => fromSaved(saved));
  const [editing, setEditing] = useState<{ id: QuestionId; before: Answers } | null>(null);
  const [confirmSurprise, setConfirmSurprise] = useState(false);
  const { busy, error, save, surprise } = useSave(() => setConfirmSurprise(false));
  const changed = JSON.stringify(answers) !== JSON.stringify(fromSaved(saved));
  const custom = saved.source === "custom" || changed;
  const home = me.onboarding === "ready" ? ROUTES.menu : ROUTES.welcome;

  if (editing !== null) {
    const q = question(editing.id, answers, (next) => setAnswers((a) => ({ ...a, ...next })));
    const empty = q.value === null || (Array.isArray(q.value) && q.value.length === 0);
    return (
      <Screen object="headphones" menu>
        <Card>
          <QuestionnaireStep
            id={`pref-${editing.id}`}
            title={q.title}
            hint={q.hint}
            multi={q.multi}
            options={q.options}
            value={q.value}
            onChange={q.onChange}
            extra={q.extra}
            nextLabel="Done"
            nextDisabled={q.required && empty}
            onNext={() => setEditing(null)}
          />
          <button
            type="button"
            onClick={() => {
              setAnswers(editing.before);
              setEditing(null);
            }}
            className="min-h-12 min-w-12 self-start px-1 text-small font-semibold text-ink-muted underline underline-offset-3 hover:text-ink"
          >
            Cancel
          </button>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      object="headphones"
      menu
      top={
        <div className="flex flex-col gap-2">
          <BackLink fallback={home} className="-ml-3 self-start" />
          <ScreenTitle lead="Changes apply to your next asks, not to a seat you already hold.">Your preferences</ScreenTitle>
        </div>
      }
    >
      <Card>
        <dl className="m-0 flex flex-col">
          {QUESTIONS.map((id) => (
            <div key={id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line py-2 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <dt className="text-caption text-ink-muted">{ROW_NAME[id]}</dt>
                <dd className="m-0 text-body-strong wrap-break-word">{answerText(id, answers)}</dd>
              </div>
              <Button variant="secondary" aria-label={`Change ${ROW_NAME[id].toLowerCase()}`} onClick={() => setEditing({ id, before: answers })} disabled={busy !== null}>
                Change
              </Button>
            </div>
          ))}
        </dl>
        {changed ? (
          <p role="status" className="inline-flex items-center gap-2 text-small text-ink">
            <Icon name="clock" />
            Not saved yet
          </p>
        ) : null}
        {error ? <InlineError>{error}</InlineError> : null}
        <Button block loading={busy === "next"} disabled={!complete(answers) || !online || busy === "surprise"} onClick={() => save(answers)}>
          Save
        </Button>
        {confirmSurprise ? (
          <Confirm
            question="Use Surprise me?"
            detail={`This replaces your answers with ${SURPRISE}`}
            yes="Replace my answers"
            no="Keep my answers"
            busy={busy === "surprise"}
            disabled={!online}
            onYes={surprise}
            onNo={() => setConfirmSurprise(false)}
          />
        ) : (
          <Button
            variant="secondary"
            block
            icon="spark"
            loading={busy === "surprise"}
            disabled={!online || busy === "next"}
            onClick={() => (custom ? setConfirmSurprise(true) : surprise())}
          >
            Surprise me
          </Button>
        )}
        <p className="text-caption text-ink-muted">Surprise me: {SURPRISE}</p>
      </Card>
    </Screen>
  );
}
