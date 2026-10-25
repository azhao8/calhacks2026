"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { MeView } from "@/convex/lib/views";
import { homeRoute } from "./routes";
import { usePlan } from "./views";

// Where home sends this student, or null while what it depends on is still loading. A ready
// student's home depends on their plan and their drop (routes.ts homeRoute).
export function useHomeTarget(me: MeView | undefined): string | null {
  const ready = me != null && me.onboarding === "ready";
  const plan = usePlan(ready ? undefined : "skip");
  const drop = useQuery(api.drops.mine, ready ? {} : "skip");
  if (me == null) return null;
  if (ready && (plan === undefined || drop === undefined)) return null;
  return homeRoute(me, plan ?? null, drop ?? null);
}
