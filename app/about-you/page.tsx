"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { MeView } from "@/convex/lib/views";
import { Button } from "@/components/Button";
import { InlineError } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { onboardingStep, ROUTES } from "@/app/_lib/routes";
import { checkEmail, checkFirstName } from "@/app/_lib/validate";
import { normalizeEmail } from "@/convex/lib/edu";
import { Confirm } from "@/app/_components/Confirm";
import { setFlash } from "@/app/_lib/nav";
import { useAccess } from "@/app/_lib/views";
import { BackTo } from "@/app/_components/BackLink";
import { LoadingScreen, Screen, ScreenTitle } from "@/app/_components/Screen";

// S04 About you (no mockup; built from the design's parts). First name, then the email of the
// Spotify account, which an app owner adds to the allow-list by hand. Also opened from Waiting and
// Connect to fix that email; saving there goes back home, which shows the new address.
export default function AboutYouPage() {
  const gate = useGate(ROUTES.aboutYou);
  const signedIn = gate.status === "ready" && gate.me !== null;
  // The form starts from what was saved, so coming back doesn't change the allow-list request.
  const access = useAccess(signedIn ? undefined : "skip");
  if (gate.status === "loading" || gate.me === null || access === undefined) return <LoadingScreen object="headphones" />;
  return <AboutYouForm me={gate.me} savedSpotifyEmail={access.spotifyEmail} />;
}

function AboutYouForm({ me, savedSpotifyEmail }: { me: NonNullable<MeView>; savedSpotifyEmail: string | null }) {
  const router = useRouter();
  const save = useMutation(api.onboarding.saveAboutYou);
  const online = useOnline();
  const [firstName, setFirstName] = useState(me.firstName ?? "");
  // Never the school email: most students would keep it, and it's rarely their Spotify login, so
  // the app owner would add the wrong account and Spotify would refuse the connection later.
  const [spotifyEmail, setSpotifyEmail] = useState(savedSpotifyEmail ?? "");
  // First time through, Continue leads to Preferences. Opened later to fix the email, it saves and
  // goes home (Waiting or Connect) with a short confirmation.
  const firstTime = me.onboarding === "needs_about_you" || me.onboarding === "needs_preferences";
  const [errors, setErrors] = useState<{ firstName?: string; spotifyEmail?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  // The school email is rarely a Spotify login, so typing it again asks once before saving.
  const [confirmSame, setConfirmSame] = useState(false);
  const spotifyField = useRef<HTMLDivElement>(null);

  async function submit(event?: FormEvent, confirmed = false) {
    event?.preventDefault();
    const name = checkFirstName(firstName);
    const mail = checkEmail(spotifyEmail);
    if (!name.ok || !mail.ok) {
      setErrors({ firstName: name.ok ? undefined : name.error, spotifyEmail: mail.ok ? undefined : mail.error });
      return;
    }
    setErrors({});
    if (!confirmed && me.email !== null && mail.value === normalizeEmail(me.email)) {
      setConfirmSame(true);
      return;
    }
    setConfirmSame(false);
    setSaving(true);
    try {
      await save({ firstName: name.value, spotifyEmail: mail.value });
      // Next keeps this page alive, and Change on Waiting opens it again: clear the spinner so Save
      // works on the next visit.
      setSaving(false);
      if (firstTime) {
        router.replace(ROUTES.preferences);
      } else {
        setFlash("Saved.");
        router.replace(ROUTES.welcome);
      }
    } catch (e) {
      setErrors({ form: errorCopy(e) });
      setSaving(false);
    }
  }

  return (
    <Screen
      object="headphones"
      step={onboardingStep(ROUTES.aboutYou, me) ?? undefined}
      menu={!firstTime}
      top={
        <div className="flex flex-col gap-2">
          {/* Sign in is behind us (it would send a signed-in student straight back), so back is the
              school; opened later from Waiting or Connect, back is home. */}
          <BackTo href={firstTime ? ROUTES.school : ROUTES.welcome} className="-ml-3 self-start" />
          <ScreenTitle>A little about you</ScreenTitle>
        </div>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-lg bg-backdrop-vignette p-4">
        <TextField
          label="What should we call you?"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          error={errors.firstName}
          hint="First name only. The person you go with sees it, and nobody else does."
        />
        <div ref={spotifyField}>
          <TextField
            label="The email you log in to Spotify with"
            required
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={spotifyEmail}
            onChange={(e) => {
              setSpotifyEmail(e.target.value);
              setConfirmSame(false);
            }}
            error={errors.spotifyEmail}
            hint={
              <>
                Not sure? Spotify → Profile → Account. If you signed up with Google or Apple, it&apos;s that email.
                <br />
                Melos is in early access with Spotify, so we add each account by hand. We only use this email for that.
              </>
            }
          />
        </div>
        {confirmSame ? (
          <Confirm
            question="Is this the email you log in to Spotify with?"
            detail="Most Spotify accounts use a personal email, not a school one. If you signed up with Google or Apple, use that email."
            yes="Yes, that's my Spotify email"
            no="Change it"
            busy={saving}
            disabled={!online}
            onYes={() => void submit(undefined, true)}
            onNo={() => {
              setConfirmSame(false);
              spotifyField.current?.querySelector("input")?.focus();
            }}
          />
        ) : null}
        {errors.form ? <InlineError>{errors.form}</InlineError> : null}
        <Button type="submit" block loading={saving && !confirmSame} disabled={!online || confirmSame}>
          {firstTime ? "Continue" : "Save"}
        </Button>
      </form>
    </Screen>
  );
}
