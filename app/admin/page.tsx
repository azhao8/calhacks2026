"use client";

import { useEffect, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Loading } from "./_ui";
import { AdminSignIn } from "./SignIn";
import { Admin, Header } from "./Console";

// S17 admin and demo (team only). The server checks ADMIN_EMAILS on every admin function; this
// page only decides what to show. Signing in here keeps you here, never in student onboarding.
export default function AdminPage() {
  const who = useQuery(api.admin.whoami);
  const { signOut } = useAuthActions();
  // The server says this session's account was deleted (from this page or a wipe): drop the stale session.
  const orphaned = who?.orphaned === true;
  useEffect(() => {
    if (orphaned) void signOut().catch(() => undefined);
  }, [orphaned, signOut]);

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

function Shell({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 bg-canvas px-4 py-12">{children}</main>;
}
