"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { MeView, PlanView } from "@/convex/lib/views";
import { getDeviceSchool, parseDeviceSchool, subscribeDeviceSchool, type DeviceSchool } from "./device";
import { rememberNext } from "./nav";
import { redirectFor, type Route } from "./routes";
import { usePlan } from "./views";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// The browser's own online signal. Offline screens keep the last known state and disable actions
// that change shared state (CLAUDE.md §5, shared state treatments).
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

let cachedRaw: string | null | undefined;
let cachedSchool: DeviceSchool | null = null;

export function useDeviceSchool(): DeviceSchool | null {
  return useSyncExternalStore(
    subscribeDeviceSchool,
    () => {
      // Keep the snapshot stable between renders when nothing changed.
      const next = getDeviceSchool();
      const raw = next === null ? null : JSON.stringify(next);
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedSchool = parseDeviceSchool(raw);
      }
      return cachedSchool;
    },
    () => null,
  );
}

// A clock that ticks, for countdowns and expiry text. Quantized to the interval so the snapshot is
// stable between ticks; 0 on the server, where nothing time based is rendered.
export function useNow(intervalMs = 1000): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = window.setInterval(onChange, intervalMs);
      return () => window.clearInterval(id);
    },
    [intervalMs],
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  );
}

export type Gate =
  | { status: "loading" }
  | { status: "ready"; me: MeView; plan: PlanView | null | undefined };

// Loads the signed-in student and enforces the screen's access rule (routes.ts redirectFor).
// While a redirect is on its way the screen keeps showing its loading state.
export function useGate(route: Route): Gate {
  const router = useRouter();
  const pathname = usePathname();
  const me = useQuery(api.me.get);
  const plan = usePlan(me && me.onboarding === "ready" ? undefined : "skip");
  const target = me === undefined ? null : redirectFor(route, me);

  useEffect(() => {
    // Signed out on a deep link: remember where they were going for after sign in.
    if (me === null && target !== null) rememberNext(pathname);
    if (target !== null && target !== pathname) router.replace(target);
  }, [me, target, pathname, router]);

  if (me === undefined || target !== null) return { status: "loading" };
  return { status: "ready", me, plan: me?.onboarding === "ready" ? plan : null };
}
