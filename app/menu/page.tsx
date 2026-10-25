"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { MeView } from "@/convex/lib/views";
import { Button } from "@/components/Button";
import { InlineError, Ok } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { MenuCloseButton } from "@/components/MenuButton";
import { TextArea } from "@/components/TextField";
import { errorCopy } from "@/app/_lib/errors";
import { useGate, useOnline } from "@/app/_lib/hooks";
import { atLeast, ROUTES } from "@/app/_lib/routes";
import { useAccess } from "@/app/_lib/views";
import { checkNote } from "@/app/_lib/validate";
import { Confirm } from "@/app/_components/Confirm";
import { LoadingScreen, Screen, ScreenTitle } from "@/app/_components/Screen";

// S16 Menu, settings and help (component MenuButton opens it).
export default function MenuPage() {
  const gate = useGate(ROUTES.menu);
  if (gate.status === "loading" || gate.me === null) return <LoadingScreen object="none" />;
  return <Menu me={gate.me} />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-2 shadow-card">
      <h2 className="px-3 pt-2 text-caption text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

function Row({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-12 items-center justify-between gap-3 rounded-sm px-3 py-2 text-body text-ink hover:bg-surface-raised">
      <span>{children}</span>
      <Icon name="arrow" className="text-ink-muted" />
    </Link>
  );
}

function Menu({ me }: { me: NonNullable<MeView> }) {
  const router = useRouter();
  const ready = me.onboarding === "ready";
  const close = () => (window.history.length > 1 ? router.back() : router.push(ROUTES.welcome));

  return (
    <Screen object="none" quiet right={<MenuCloseButton onClick={close} />} top={<ScreenTitle>Menu</ScreenTitle>}>
      <Section title="Your account">
        <div className="flex flex-col gap-1 px-3 py-2">
          <p className="text-body break-all">{me.email ?? "No email on file"}</p>
          {me.email ? (
            <p className="inline-flex items-center gap-2 text-small text-success">
              <Icon name="check" />
              School email verified
            </p>
          ) : null}
          {me.school ? <p className="text-small text-ink-muted">{me.school.name}</p> : null}
        </div>
      </Section>

      <Section title="Melos">
        {ready ? <Row href={ROUTES.welcome}>Home</Row> : null}
        {ready ? <Row href={ROUTES.week}>Your week</Row> : null}
        {me.onboarding === "needs_review" || ready ? <Row href={ROUTES.taste}>Your taste summary</Row> : null}
        {me.onboarding !== "needs_verification" && me.onboarding !== "needs_about_you" ? (
          <Row href={ROUTES.preferences}>Preferences</Row>
        ) : null}
        {atLeast(me.onboarding, "needs_spotify_connect") ? <Row href={ROUTES.contacts}>Recent connections</Row> : null}
        <Row href={ROUTES.privacy}>Privacy</Row>
      </Section>

      <SpotifySection />
      <HelpSection />

      <SignOut />
    </Screen>
  );
}

function SpotifySection() {
  const access = useAccess();
  const disconnect = useMutation(api.settings.disconnectSpotify);
  const online = useOnline();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await disconnect({});
      setDone(true);
      setConfirming(false);
    } catch (e) {
      setError(errorCopy(e));
    } finally {
      setBusy(false);
    }
  }

  const status =
    access === undefined
      ? "Checking"
      : access.status === "connected"
        ? "Connected"
        : access.status === "allowlisted"
          ? "Ready to connect"
          : access.status === "requested"
            ? "Waiting for Spotify access"
            : access.status === "revoked"
              ? "Disconnected"
              : "Not connected";

  return (
    <Section title="Spotify">
      <div className="flex flex-col gap-3 px-3 py-2">
        <p className="text-body">{status}</p>
        {done ? <Ok>Disconnected. We deleted your Spotify data and taste summary.</Ok> : null}
        {access?.status === "connected" && !done ? (
          confirming ? (
            <Confirm
              question="Disconnect Spotify?"
              detail="We delete your Spotify data, taste summary and taste profile, give up any seat you hold, and stop new asks. You can connect again later."
              yes="Disconnect"
              no="Keep it"
              busy={busy}
              disabled={!online}
              onYes={run}
              onNo={() => setConfirming(false)}
            />
          ) : (
            <Button variant="secondary" block onClick={() => setConfirming(true)}>
              Disconnect Spotify
            </Button>
          )
        ) : null}
        {error ? <InlineError>{error}</InlineError> : null}
      </div>
    </Section>
  );
}

function HelpSection() {
  const submit = useMutation(api.help.submit);
  const online = useOnline();
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send(event: FormEvent) {
    event.preventDefault();
    const checked = checkNote(text, 2000, "Tell us what happened.");
    if (!checked.ok) {
      setFieldError(checked.error);
      return;
    }
    setFieldError(null);
    setBusy(true);
    setError(null);
    try {
      await submit({ text: checked.value });
      setSent(true);
      setText("");
    } catch (e) {
      setError(errorCopy(e, { fallback: "We couldn't send that. Your note is still here. Try again." }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Tell us about a problem">
      <form onSubmit={send} noValidate className="flex flex-col gap-3 px-3 py-2">
        <TextArea
          label="What happened?"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSent(false);
          }}
          error={fieldError}
          hint="The Melos team reads these. It isn't watched around the clock and isn't for emergencies."
        />
        {sent ? <Ok>Sent. Thanks for telling us.</Ok> : null}
        {error ? <InlineError>{error}</InlineError> : null}
        <Button type="submit" variant="secondary" block loading={busy} disabled={!online}>
          Send
        </Button>
      </form>
    </Section>
  );
}

function SignOut() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="quiet"
      block
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
        } finally {
          router.replace(ROUTES.welcome);
        }
      }}
    >
      Sign out
    </Button>
  );
}
