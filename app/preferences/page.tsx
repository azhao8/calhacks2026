"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { MeView } from "@/convex/lib/views";
import { InlineError } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { QuestionnaireStep } from "@/components/QuestionnaireStep";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
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
import { LoadingScreen, Screen } from "@/app/_components/Screen";

// S05 Preferences (component QuestionnaireStep): one question per screen while the allow-list
// request is pending, with "Surprise me" always there. Gender and year are private and used only
// for pairing. Changes apply to future asks and offers.
export default function PreferencesPage() {
  const gate = useGate(ROUTES.preferences);
  const ready = gate.status === "ready" && gate.me !== null;
  // Saved answers, so opening this from the menu starts where the student left off.
  const saved = usePreferences(ready ? undefined : "skip");
  if (gate.status === "loading" || gate.me === null || saved === undefined) return <LoadingScreen object="headphones" />;
  // Next keeps visited pages alive (cacheComponents), so without a key a student coming back after
  // "Surprise me" would see the answers and spinner they left. Keyed on the saved answers, the
  // questions start over from what was saved.
  return <Questions key={JSON.stringify(saved)} me={gate.me} saved={saved} />;
}

const TOTAL = 5;

function Questions({ me, saved }: { me: NonNullable<MeView>; saved: PreferencesView }) {
  const router = useRouter();
  const online = useOnline();
  const savePreferences = useMutation(api.onboarding.savePreferences);
  const surpriseMe = useMutation(api.onboarding.surpriseMe);
  const [step, setStep] = useState(1);
  const [budget, setBudget] = useState<BudgetId | null>(saved ? budgetIdFor(saved.maxTicketPrice) : null);
  const [meetWho, setMeetWho] = useState<MeetWho | null>(saved?.meetWho ?? null);
  const [self, setSelf] = useState<GenderSelf | null>(saved?.gender ?? null);
  const [year, setYear] = useState<Year | null>(saved?.year ?? null);
  const [similarYear, setSimilarYear] = useState(saved?.prefersSimilarYear ?? false);
  const [area, setArea] = useState<Area | null>(saved?.area ?? null);
  const [busy, setBusy] = useState<"next" | "surprise" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // After onboarding, the menu opens this screen; saving goes back there.
  const done = () => router.replace(me.onboarding === "ready" ? ROUTES.menu : ROUTES.welcome);

  async function run(kind: "next" | "surprise", call: () => Promise<null>) {
    setBusy(kind);
    setError(null);
    try {
      await call();
      // Clear the spinner even when the saved answers didn't change (Surprise me twice), because
      // this page stays alive after we leave it.
      setBusy(null);
      done();
    } catch (e) {
      setError(errorCopy(e, { fallback: "We couldn't save your answers. Try again." }));
      setBusy(null);
    }
  }

  const surprise = () => void run("surprise", () => surpriseMe({}));

  function finish() {
    if (budget === null || meetWho === null || area === null) return;
    void run("next", () =>
      savePreferences({
        maxTicketPrice: budgetMax(budget),
        meetWho,
        gender: self ?? undefined,
        year: year ?? undefined,
        prefersSimilarYear: year !== null && similarYear,
        area,
      }),
    );
  }

  const shared = {
    id: `pref-${step}`,
    step,
    total: TOTAL,
    onSurprise: surprise,
    busy,
    error: error ? <InlineError>{error}</InlineError> : null,
  };
  const advance = () => setStep((s) => s + 1);
  const back =
    step > 1 ? (
      <button
        type="button"
        onClick={() => setStep((s) => s - 1)}
        className="min-h-12 self-start text-small font-semibold text-ink-muted underline underline-offset-3 hover:text-ink"
      >
        Back to the last question
      </button>
    ) : null;

  let question;
  if (step === 1) {
    question = (
      <QuestionnaireStep
        {...shared}
        title="What do you usually spend on a ticket?"
        hint="Per ticket. You can change this later."
        options={[...BUDGETS]}
        value={budget}
        onChange={(id) => setBudget(toggleSingle(budget, id as BudgetId))}
        nextDisabled={budget === null}
        onNext={advance}
      />
    );
  } else if (step === 2) {
    question = (
      <QuestionnaireStep
        {...shared}
        title="Who would you like to meet?"
        hint="Pick any that work. We only pair people whose choices fit both ways."
        multi
        options={[...MEET_OPTIONS]}
        value={meetWhoSelection(meetWho)}
        onChange={(id) => setMeetWho(toggleMeetWho(meetWho, id as "anyone" | Gender))}
        nextDisabled={meetWho === null}
        onNext={advance}
      />
    );
  } else if (step === 3) {
    question = (
      <QuestionnaireStep
        {...shared}
        title="I am"
        hint="Optional and private. It's only used for pairing, and nobody sees it. If you'd rather not say, you're paired with people open to anyone."
        options={[...SELF_OPTIONS]}
        value={self}
        onChange={(id) => setSelf(toggleSingle(self, id as GenderSelf))}
        nextLabel={self === null ? "Skip" : "Continue"}
        onNext={advance}
      />
    );
  } else if (step === 4) {
    question = (
      <QuestionnaireStep
        {...shared}
        title="What year are you in?"
        hint="Optional and private. Nobody sees it."
        options={[...YEAR_OPTIONS]}
        value={year}
        onChange={(id) => setYear(toggleSingle(year, id as Year))}
        nextLabel={year === null ? "Skip" : "Continue"}
        onNext={advance}
        extra={
          year !== null ? (
            <div className="flex flex-wrap gap-2">
              <Chip selected={similarYear} onClick={() => setSimilarYear(!similarYear)}>
                Prefer someone in a similar year
              </Chip>
            </div>
          ) : null
        }
      />
    );
  } else {
    question = (
      <QuestionnaireStep
        {...shared}
        title="How far will you go?"
        hint="Measured from campus. Farther includes everything closer."
        options={[...AREA_OPTIONS]}
        value={area}
        onChange={(id) => setArea(toggleSingle(area, id as Area))}
        nextLabel="Save"
        nextDisabled={area === null || !online}
        onNext={finish}
      />
    );
  }

  return (
    <Screen object="headphones" menu={me.onboarding === "ready"}>
      <div className="flex flex-col gap-3 rounded-lg bg-backdrop-vignette p-4">
        {question}
        <p className="text-caption text-ink-muted">Surprise me: Up to $25, anyone, around Berkeley and Oakland. Change it anytime.</p>
        {back}
      </div>
    </Screen>
  );
}
