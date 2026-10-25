"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

// Client-side Convex Auth: the browser keeps the session (CLAUDE.md §8.1).
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// shouldHandleCode={false}: Melos signs in only with typed email codes, never with a ?code= in the
// URL. Without this, Convex Auth takes Spotify's ?code= on /spotify/callback as its own sign-in
// code, the server rejects it, and the student is signed out before the connection completes.
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} shouldHandleCode={false}>
      {children}
    </ConvexAuthProvider>
  );
}
