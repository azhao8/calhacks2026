"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// S17 admin and demo (stream E). The server checks ADMIN_EMAILS on every admin function; this gate is only for display.
export default function AdminPage() {
  const who = useQuery(api.admin.whoami);

  if (who === undefined) {
    return (
      <main className="px-4 py-12">
        <p role="status" className="text-body text-ink-muted">
          Loading
        </p>
      </main>
    );
  }
  if (!who.isAdmin) {
    return (
      <main className="flex flex-col gap-2 px-4 py-12">
        <h1 className="font-display text-title text-ink">Team only</h1>
        <p className="text-body text-ink-muted">
          {who.signedIn ? "This account isn't on the team list." : "Sign in with a team email."}
        </p>
      </main>
    );
  }
  return (
    <main className="flex flex-col gap-2 px-4 py-12">
      <h1 className="font-display text-title text-ink">Admin</h1>
      <p className="text-body text-ink-muted">
        Allow-list queue, events, matching, funnel, help notes, and demo controls arrive in Stage 1.
      </p>
    </main>
  );
}
