"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { MeView } from "@/convex/lib/views";
import { Button } from "@/components/Button";
import { InlineError } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { ONBOARDING_STEP, ROUTES } from "@/app/_lib/routes";
import { checkEmail, checkFirstName } from "@/app/_lib/validate";
import { LoadingScreen, Screen, ScreenTitle } from "@/app/_components/Screen";

// S04 About you (no mockup; built from the design's parts). First name, then the email of the
// Spotify account, which an app owner adds to the allow-list by hand.
export default function AboutYouPage() {
  const gate = useGate(ROUTES.aboutYou);
  if (gate.status === "loading" || gate.me === null) return <LoadingScreen object="headphones" />;
  return <AboutYouForm me={gate.me} />;
}

function AboutYouForm({ me }: { me: NonNullable<MeView> }) {
  const router = useRouter();
  const save = useMutation(api.onboarding.saveAboutYou);
  const online = useOnline();
  const [firstName, setFirstName] = useState(me.firstName ?? "");
  const [spotifyEmail, setSpotifyEmail] = useState(me.email ?? "");
  const [errors, setErrors] = useState<{ firstName?: string; spotifyEmail?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = checkFirstName(firstName);
    const mail = checkEmail(spotifyEmail);
    if (!name.ok || !mail.ok) {
      setErrors({ firstName: name.ok ? undefined : name.error, spotifyEmail: mail.ok ? undefined : mail.error });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await save({ firstName: name.value, spotifyEmail: mail.value });
      router.replace(ROUTES.preferences);
    } catch (e) {
      setErrors({ form: errorCopy(e) });
      setSaving(false);
    }
  }

  return (
    <Screen object="headphones" step={ONBOARDING_STEP[ROUTES.aboutYou]} top={<ScreenTitle>A little about you</ScreenTitle>}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-lg bg-backdrop-vignette p-4">
        <TextField
          label="What should we call you?"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          error={errors.firstName}
          hint="First name only. The person you go with sees it, and nobody else does."
        />
        <TextField
          label="What email is your Spotify account under?"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={spotifyEmail}
          onChange={(e) => setSpotifyEmail(e.target.value)}
          error={errors.spotifyEmail}
          hint="Melos is in early access with Spotify, so we add each account by hand. We only use this email for that."
        />
        {errors.form ? <InlineError>{errors.form}</InlineError> : null}
        <Button type="submit" block loading={saving} disabled={!online}>
          Continue
        </Button>
      </form>
    </Screen>
  );
}
