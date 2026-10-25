"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SIGN_IN } from "@/convex/lib/config";
import { Button } from "@/components/Button";
import { InlineError } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { errorCode, errorCopy } from "@/app/_lib/errors";
import { useNow, useOnline } from "@/app/_lib/hooks";
import { onboardingStep, ROUTES } from "@/app/_lib/routes";
import { secondsLeft } from "@/app/_lib/time";
import { checkSchoolEmail, codeDigits } from "@/app/_lib/validate";
import { takeNext } from "@/app/_lib/nav";
import { BackLink } from "@/app/_components/BackLink";
import { LoadingScreen, Screen, ScreenTitle } from "@/app/_components/Screen";
import { CodeInput } from "./CodeInput";

// The Convex Auth email code provider (built by the onboarding stream with this id).
const PROVIDER = "resend-otp";

export type SignInMode = "register" | "sign_in";

// A code we sent, kept for this tab so a reload on the code step comes back to it (the code stays
// valid for SIGN_IN.codeTtlSeconds). Per mode, so registering and signing in never mix.
type Pending = { email: string; sentAt: number };
const pendingKey = (mode: SignInMode) => `melos.code.${mode}`;

function readPending(mode: SignInMode): Pending | null {
  try {
    const raw = window.sessionStorage.getItem(pendingKey(mode));
    const value = raw ? (JSON.parse(raw) as Pending) : null;
    if (value && typeof value.email === "string" && typeof value.sentAt === "number" && Date.now() - value.sentAt < SIGN_IN.codeTtlSeconds * 1000) return value;
  } catch {
    // Blocked storage or something we didn't write: start at the email step.
  }
  return null;
}

function writePending(mode: SignInMode, value: Pending | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(pendingKey(mode));
    else window.sessionStorage.setItem(pendingKey(mode), JSON.stringify(value));
  } catch {
    // The code step just won't survive a reload.
  }
}

// S03 Verify email (mockup verify.png): any .edu address, then a 6 digit code. The server refuses
// other addresses before anything is stored or sent; this screen checks first to save a round trip.
// Two routes share it: /sign-up is step 2 of onboarding (after School), /sign-in is a returning
// student and shows no steps. The mode lives in the route, so a reload keeps it.
export function SignInFlow({ mode }: { mode: SignInMode }) {
  const register = mode === "register";
  const router = useRouter();
  const { signIn } = useAuthActions();
  const me = useQuery(api.me.get);
  const online = useOnline();
  const now = useNow();
  // Rendered on the client only (it waits for `me`), so reading the tab's storage here is safe.
  const [pending] = useState(() => (typeof window === "undefined" ? null : readPending(mode)));
  const [step, setStep] = useState<"email" | "code">(pending ? "code" : "email");
  const [email, setEmail] = useState(pending?.email ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(pending?.sentAt ?? 0);
  const [resent, setResent] = useState(false);
  const [verified, setVerified] = useState(false);

  // Signed in (now, or already): home picks the next screen.
  useEffect(() => {
    if (!me) return;
    writePending(mode, null);
    const next = takeNext(me);
    // A remembered deep link loads fresh: Next keeps the signed-out visit to that page alive, and
    // re-showing it would bounce the student home before the signed-in data arrives.
    if (next === ROUTES.welcome) router.replace(next);
    else window.location.replace(next);
  }, [me, router, mode]);

  if (me === undefined || me !== null || verified) return <LoadingScreen object="headphones" title={verified ? "Signing you in" : "Loading"} />;

  const wait = secondsLeft(sentAt + SIGN_IN.resendCooldownMs, now, SIGN_IN.resendCooldownMs / 1000);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const checked = checkSchoolEmail(email);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setEmail(checked.value);
    setBusy(step === "code" ? "resend" : "send");
    setError(null);
    try {
      await signIn(PROVIDER, { email: checked.value });
      const now = Date.now();
      setSentAt(now);
      writePending(mode, { email: checked.value, sentAt: now });
      setResent(step === "code");
      setCode("");
      setStep("code");
    } catch (e) {
      if (errorCode(e) === "code_cooldown" && step === "email") {
        // A valid code went out moments ago, so go to the code step anyway.
        const now = Date.now();
        setSentAt(now);
        writePending(mode, { email: checked.value, sentAt: now });
        setCode("");
        setStep("code");
      } else {
        setError(errorCopy(e, { fallback: "We couldn't send a code. Try again in a moment." }));
      }
    } finally {
      setBusy(null);
    }
  }

  async function verify(value: string) {
    if (codeDigits(value).length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }
    setBusy("verify");
    setError(null);
    try {
      const result = await signIn(PROVIDER, { email, code: value });
      if (result.signingIn) setVerified(true);
      else setError("That code didn't work or has expired. Check it, or send a new one.");
    } catch (e) {
      const known = errorCode(e);
      setError(
        known && known !== "retryable"
          ? errorCopy(e)
          : online
            ? "That code didn't work or has expired. Check it, or send a new one."
            : errorCopy(e),
      );
    } finally {
      setBusy(null);
    }
  }

  function onCode(next: string) {
    setCode(next);
    setError(null);
    if (next.length === 6 && busy === null) void verify(next);
  }

  if (step === "email") {
    return (
      <Screen
        object="headphones"
        step={onboardingStep(register ? ROUTES.signUp : ROUTES.signIn, null) ?? undefined}
        top={
          <div className="flex flex-col gap-2">
            {/* Back to whichever screen opened this (School when registering, Welcome when signing
                in); the typed email stays. */}
            <BackLink fallback={register ? ROUTES.school : ROUTES.welcome} className="-ml-3 self-start" />
            {register ? (
              <ScreenTitle lead="Melos is for students. We'll send a 6 digit code to your school email.">What&apos;s your school email?</ScreenTitle>
            ) : (
              <ScreenTitle lead="We'll send a 6 digit code to your school email.">Welcome back</ScreenTitle>
            )}
          </div>
        }
      >
        <form onSubmit={send} noValidate className="flex flex-col gap-4">
          <TextField
            label="School email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            error={error}
            hint={
              <>
                Any .edu address works. See our{" "}
                <Link href={ROUTES.privacy} className="inline-flex min-h-12 items-center font-semibold text-accent underline underline-offset-3">
                  privacy page
                </Link>
                .
              </>
            }
          />
          <Button type="submit" block loading={busy === "send"} disabled={!online}>
            Continue
          </Button>
        </form>
      </Screen>
    );
  }

  return (
    <Screen
      object="headphones"
      step={onboardingStep(register ? ROUTES.signUp : ROUTES.signIn, null) ?? undefined}
      top={<ScreenTitle lead={`We sent a 6 digit code to ${email}.`}>Check your school email</ScreenTitle>}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        <CodeInput value={code} onChange={onCode} disabled={busy === "verify"} invalid={error !== null} describedBy={error ? "code-error" : undefined} />
        {error ? (
          <div id="code-error">
            <InlineError>{error}</InlineError>
          </div>
        ) : resent ? (
          <p role="status" className="text-small text-ink">
            We sent a new code.
          </p>
        ) : null}
        <Button type="submit" block loading={busy === "verify"} disabled={!online}>
          Continue
        </Button>
        <div className="flex flex-col gap-1">
          <Button variant="quiet" block onClick={() => void send()} loading={busy === "resend"} disabled={wait > 0 || !online || busy === "verify"}>
            {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
          </Button>
          <Button
            variant="quiet"
            block
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
              writePending(mode, null);
            }}
            disabled={busy !== null}
          >
            Use a different email
          </Button>
        </div>
      </form>
    </Screen>
  );
}
