"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { MeView } from "@/convex/lib/views";
import { Button } from "@/components/Button";
import { InlineError } from "@/components/Card";
import { StateView } from "@/components/StateView";
import { TasteSummary } from "@/components/TasteSummary";
import { TextArea } from "@/components/TextField";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { ONBOARDING_STEP, ROUTES } from "@/app/_lib/routes";
import { useTasteProfile } from "@/app/_lib/views";
import { checkNote } from "@/app/_lib/validate";
import { LoadingScreen, Screen, ScreenTitle } from "@/app/_components/Screen";

// S09 Taste review (component TasteSummary). "That's me" and "Not quite" carry equal weight; a
// correction produces a revised summary to review again, and the student's words win.
export default function TastePage() {
  const gate = useGate(ROUTES.taste);
  if (gate.status === "loading" || gate.me === null) return <LoadingScreen object="cassette" />;
  return <Review me={gate.me} />;
}

function Review({ me }: { me: NonNullable<MeView> }) {
  const router = useRouter();
  const online = useOnline();
  const profile = useTasteProfile();
  const correct = useMutation(api.taste.correct);
  const confirm = useMutation(api.taste.confirm);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"confirm" | "correct" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sentRevision, setSentRevision] = useState<number | null>(null);
  const onboarding = me.onboarding !== "ready";

  if (profile === undefined) return <LoadingScreen object="cassette" />;
  if (profile === null) {
    return (
      <Screen object="cassette" menu={!onboarding}>
        <StateView
          kind="empty"
          icon="music"
          title="No taste summary yet"
          body="It appears here once Spotify is connected and we've listened."
          action={null}
          className="rounded-lg bg-backdrop-vignette"
        />
      </Screen>
    );
  }

  const revised = sentRevision !== null && profile.revision > sentRevision;

  async function onConfirm() {
    setBusy("confirm");
    setError(null);
    try {
      await confirm({});
      router.replace(ROUTES.welcome);
    } catch (e) {
      setError(errorCopy(e, { fallback: "We couldn't save that. Try again." }));
      setBusy(null);
    }
  }

  async function onCorrect(event: FormEvent) {
    event.preventDefault();
    const checked = checkNote(text, 500, "Tell us what to change.");
    if (!checked.ok) {
      setFieldError(checked.error);
      return;
    }
    setFieldError(null);
    setBusy("correct");
    setError(null);
    try {
      await correct({ text: checked.value });
      setSentRevision(profile!.revision);
      setEditing(false);
      setText("");
    } catch (e) {
      // Keep the typed correction so nothing is lost.
      setError(errorCopy(e, { fallback: "We couldn't save your change. Your words are still here. Try again." }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen
      object="cassette"
      menu={!onboarding}
      step={onboarding ? ONBOARDING_STEP[ROUTES.taste] : undefined}
      top={<ScreenTitle>{onboarding ? "Does this sound like you?" : "Your taste"}</ScreenTitle>}
    >
      {revised ? (
        <p role="status" className="text-small text-ink">
          We changed it. Take another look.
        </p>
      ) : null}
      <TasteSummary
        eyebrow={revised ? "Your revised summary" : "Here is how you sound"}
        summary={profile.summary}
        artists={profile.artists}
        labels={profile.labels}
        confirmed={profile.confirmed && !editing && !revised}
        busy={busy === "confirm"}
        onConfirm={editing ? undefined : onConfirm}
        onCorrect={editing ? undefined : () => setEditing(true)}
      >
        {editing ? (
          <form onSubmit={onCorrect} noValidate className="flex flex-col gap-3">
            <TextArea
              label="What should we change?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              error={fieldError}
              hint="Your words win over our read."
              autoFocus
            />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-3">
              <Button type="submit" block loading={busy === "correct"} disabled={!online}>
                Save
              </Button>
              <Button variant="secondary" block onClick={() => setEditing(false)} disabled={busy === "correct"}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </TasteSummary>
      {profile.confirmed && !editing && !revised ? (
        <Button variant="secondary" block onClick={() => setEditing(true)}>
          Not quite
        </Button>
      ) : null}
      {error ? <InlineError>{error}</InlineError> : null}
    </Screen>
  );
}
