"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/Button";
import { InlineError } from "@/components/Card";
import { SchoolPicker } from "@/components/SchoolPicker";
import { StateView } from "@/components/StateView";
import { setDeviceSchool } from "@/app/_lib/device";
import { errorCopy } from "@/app/_lib/errors";
import { useDeviceSchool, useGate, useOnline } from "@/app/_lib/hooks";
import { onboardingStep, ROUTES } from "@/app/_lib/routes";
import { BackLink, BackTo } from "@/app/_components/BackLink";
import { LoadingScreen, Screen, ScreenTitle } from "@/app/_components/Screen";

// S02 School picker (mockup school.png). Only open schools can be picked; picking one applies its
// theme. Visitors keep the choice on the device until sign-in; signed-in students save it now.
export default function SchoolPage() {
  const router = useRouter();
  const gate = useGate(ROUTES.school);
  const schools = useQuery(api.schools.list);
  const device = useDeviceSchool();
  const chooseSchool = useMutation(api.onboarding.chooseSchool);
  const online = useOnline();
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (gate.status === "loading") return <LoadingScreen object="speaker" />;
  const me = gate.me;
  // UC Berkeley is the only open school, so it starts picked and Continue works at once.
  const onlyOpen = schools?.filter((s) => s.status === "open");
  const value = picked ?? device?.id ?? (onlyOpen?.length === 1 ? onlyOpen[0]._id : null);

  function pick(id: string) {
    const school = schools?.find((s) => s._id === id);
    if (!school || school.status !== "open") return;
    setPicked(id);
    setError(null);
    setDeviceSchool({ id, themeId: school.themeId });
  }

  async function next() {
    if (value === null) return;
    if (me === null) {
      // A preselected school wasn't tapped, so keep it on the device here, as pick() would.
      const school = schools?.find((s) => s._id === value);
      if (school && device?.id !== value) setDeviceSchool({ id: value, themeId: school.themeId });
      router.push(ROUTES.signUp);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await chooseSchool({ universityId: value as Id<"universities"> });
      setDeviceSchool(null);
      router.replace(ROUTES.welcome);
    } catch (e) {
      setError(errorCopy(e));
      setSaving(false);
    }
  }

  return (
    <Screen
      object="speaker"
      step={onboardingStep(ROUTES.school, me) ?? undefined}
      top={
        <div className="flex flex-col gap-2">
          {/* Signed in, School is a setting, so Back always leads home rather than into sign in. */}
          {me === null ? <BackLink fallback={ROUTES.welcome} className="-ml-3 self-start" /> : <BackTo href={ROUTES.welcome} className="-ml-3 self-start" />}
          <ScreenTitle>Where do you go to school?</ScreenTitle>
        </div>
      }
    >
      {schools === undefined ? (
        <StateView kind="loading" title="Finding schools" body="This takes a few seconds." />
      ) : schools.length === 0 ? (
        <StateView kind="error" title="We couldn't load schools" body="Check your connection and try again." onAction={() => window.location.reload()} />
      ) : (
        <>
          <SchoolPicker
            schools={schools.map((s) => ({ id: s._id, name: s.name, city: s.city, colors: s.colors, status: s.status }))}
            value={value}
            onChange={pick}
          />
          {me && me.school ? <p className="text-small text-ink-muted">Your school is {me.school.name}.</p> : null}
          {value === null ? <p className="text-small text-ink">Pick your school to continue.</p> : null}
          {error ? <InlineError>{error}</InlineError> : null}
          <Button block onClick={next} disabled={value === null || (me !== null && !online)} loading={saving}>
            Continue
          </Button>
        </>
      )}
    </Screen>
  );
}
