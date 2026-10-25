"use client";

import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { SIGN_IN } from "@/convex/lib/config";
import { Button } from "@/components/Button";
import { InlineError } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { errorCopy } from "@/app/_lib/errors";
import { useNow } from "@/app/_lib/hooks";
import { secondsLeft } from "@/app/_lib/time";
import { checkSchoolEmail, codeDigits } from "@/app/_lib/validate";
import { CodeInput } from "@/app/sign-in/CodeInput";

// The same .edu email code sign-in as S03 (provider "resend-otp"), shown inline on /admin so a
// teammate signs in here and stays here instead of being sent into student onboarding.
const PROVIDER = "resend-otp";

export function AdminSignIn() {
  const { signIn } = useAuthActions();
  const now = useNow();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const wait = secondsLeft(sentAt + SIGN_IN.resendCooldownMs, now, SIGN_IN.resendCooldownMs / 1000);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const checked = checkSchoolEmail(email);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setEmail(checked.value);
    setBusy("send");
    setError(null);
    try {
      await signIn(PROVIDER, { email: checked.value });
      setSentAt(Date.now());
      setCode("");
      setStep("code");
    } catch (e) {
      setError(errorCopy(e, { fallback: "We couldn't send a code. Try again in a moment." }));
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
      if (!result.signingIn) setError("That code didn't work or has expired. Check it, or send a new one.");
    } catch {
      setError("That code didn't work or has expired. Check it, or send a new one.");
    } finally {
      setBusy(null);
    }
  }

  if (step === "email") {
    return (
      <form onSubmit={send} noValidate className="flex flex-col gap-4">
        <TextField
          label="Team school email"
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
          hint="We send a 6 digit code. Only emails on the team list can use this page."
        />
        <Button type="submit" block loading={busy === "send"}>
          Send code
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void verify(code);
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <p className="text-body text-ink">We sent a 6 digit code to {email}.</p>
      <CodeInput
        value={code}
        onChange={(next) => {
          setCode(next);
          setError(null);
          if (next.length === 6 && busy === null) void verify(next);
        }}
        disabled={busy === "verify"}
        invalid={error !== null}
        describedBy={error ? "admin-code-error" : undefined}
      />
      {error ? (
        <div id="admin-code-error">
          <InlineError>{error}</InlineError>
        </div>
      ) : null}
      <Button type="submit" block loading={busy === "verify"}>
        Sign in
      </Button>
      <div className="flex flex-col gap-1">
        <Button variant="quiet" block onClick={() => void send()} disabled={wait > 0 || busy !== null}>
          {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
        </Button>
        <Button
          variant="quiet"
          block
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
          disabled={busy !== null}
        >
          Use a different email
        </Button>
      </div>
    </form>
  );
}
