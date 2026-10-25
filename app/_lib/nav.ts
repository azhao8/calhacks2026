"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MeView } from "@/convex/lib/views";
import { redirectFor, ROUTES, type Route } from "./routes";

// In-app history. Browser history can hold pages from other sites (a link from Gmail, the "ready"
// email), so "Back" only goes back when the entry before this one is a Melos screen from this page
// load; otherwise it goes to a fixed fallback. We count entries ourselves: a push adds one to
// history.length, a replace (the route gate's redirects) doesn't, and popstate moves one either way.

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

let base = -1; // index of the first entry this page load knows; nothing before it is ours
let index = -1;
const paths: string[] = [];
let popped = false;
let visits = 0; // goes up on every screen change, so a page can start fresh each time it's opened

function start(pathname: string) {
  base = index = window.history.length - 1;
  paths.length = 0;
  paths[index] = pathname;
  window.addEventListener("popstate", () => {
    popped = true;
  });
}

// Called by every screen as it shows.
export function useTrackPath(): void {
  const pathname = usePathname();
  useEffect(() => {
    if (base < 0) return start(pathname);
    if (paths[index] === pathname) return;
    if (popped) {
      popped = false;
      if (paths[index - 1] === pathname) index -= 1;
      else if (paths[index + 1] === pathname) index += 1;
      else base = index; // jumped somewhere we can't place: treat it as a fresh start
    } else if (window.history.length === index + 2) {
      index += 1; // pushed; anything that was ahead of us is gone
      paths.length = index;
    }
    paths[index] = pathname;
    visits += 1;
    emit();
  }, [pathname]);
}

// Next keeps visited pages alive (cacheComponents). A page that should open fresh every time keys
// its content on this.
export function useVisit(): number {
  return useSyncExternalStore(subscribe, () => visits, () => 0);
}

export function cameFromApp(): boolean {
  return index > base;
}

// Back to the previous Melos screen, or to `fallback` when there isn't one.
export function useBack(fallback: Route): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (cameFromApp()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}

// A short confirmation that outlives the navigation it triggered ("Preferences saved."), shown by
// the next screen's Screen header. Cleared after a few seconds.
let flash: string | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

export function setFlash(message: string | null, ms = 5000): void {
  flash = message;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = message ? setTimeout(() => setFlash(null), ms) : null;
  emit();
}

export function useFlash(): string | null {
  return useSyncExternalStore(subscribe, () => flash, () => null);
}

// A signed-out deep link (say /plan from a shared link) is remembered for this tab, and after sign
// in the student lands there if their account may open it; otherwise home picks. The path must be
// one of our own routes, so this can't redirect off Melos; its query string comes along, because
// some screens read it (/stay-in-touch?meetupId= picks which plan to share with).
const NEXT_KEY = "melos.next";
const isRoute = (path: string): path is Route => (Object.values(ROUTES) as string[]).includes(path);

export function rememberNext(path: string, search = ""): void {
  if (!isRoute(path)) return;
  try {
    window.sessionStorage.setItem(NEXT_KEY, search.startsWith("?") ? path + search : path);
  } catch {
    // Blocked storage: after sign in, home picks the screen.
  }
}

// Where to go after sign in: the remembered route and query, or home.
export function takeNext(me: MeView): string {
  let next: string | null = null;
  try {
    next = window.sessionStorage.getItem(NEXT_KEY);
    window.sessionStorage.removeItem(NEXT_KEY);
  } catch {
    return ROUTES.welcome;
  }
  if (next === null) return ROUTES.welcome;
  const cut = next.indexOf("?");
  const path = cut < 0 ? next : next.slice(0, cut);
  if (!isRoute(path) || path === ROUTES.signIn || path === ROUTES.signUp || redirectFor(path, me) !== null) return ROUTES.welcome;
  return next;
}
