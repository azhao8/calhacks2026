"use client";

import { useQuery } from "convex/react";
import type { Infer } from "convex/values";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  PlanView,
  vAccessView,
  vAnalysisView,
  vContactView,
  vMySharesView,
  vPreferencesView,
  vTasteView,
  WeekCard,
} from "@/convex/lib/views";

// Live queries typed by the UI contract in convex/lib/views.ts. While a function is still a stub,
// its generated type is the stub's placeholder (null or []); these hooks keep screens typed by the
// contract instead, so they don't change when the real bodies land.

export type AccessView = Infer<typeof vAccessView>;
export type AnalysisView = Infer<typeof vAnalysisView>;
export type TasteView = Infer<typeof vTasteView>;
export type ContactView = Infer<typeof vContactView>;
export type MySharesView = Infer<typeof vMySharesView>;
export type PreferencesView = Infer<typeof vPreferencesView>;

type Skip = "skip" | undefined;
const args = (skip: Skip) => (skip === "skip" ? ("skip" as const) : {});

export const useAccess = (skip?: Skip) => useQuery(api.onboarding.access, args(skip)) as AccessView | undefined;
export const useAnalysis = (skip?: Skip) => useQuery(api.taste.analysis, args(skip)) as AnalysisView | undefined;
export const useTasteProfile = (skip?: Skip) => useQuery(api.taste.profile, args(skip)) as TasteView | undefined;
export const usePreferences = (skip?: Skip) =>
  useQuery(api.onboarding.preferences, args(skip)) as PreferencesView | undefined;
export const useWeek = (skip?: Skip) => useQuery(api.week.mine, args(skip)) as WeekCard[] | undefined;
export const usePlan = (skip?: Skip) => useQuery(api.plans.current, args(skip)) as PlanView | null | undefined;
export const useContacts = (skip?: Skip) => useQuery(api.contacts.list, args(skip)) as ContactView[] | undefined;
export const useMyShares = (meetupId: Id<"meetups">) =>
  useQuery(api.contacts.myShares, { meetupId }) as MySharesView | undefined;

// The student's own active shares (S15) and recent plans where sharing is still open (S14).
export type MyShare = { meetupId: Id<"meetups">; partnerFirstName: string; kind: "phone" | "instagram"; value: string };
export type Shareable = { meetupId: Id<"meetups">; partnerFirstName: string; eventTitle: string; startsAt: number };

export const useMyActiveShares = (skip?: Skip) => useQuery(api.contacts.mine, args(skip)) as MyShare[] | undefined;
export const useShareable = (skip?: Skip) => useQuery(api.contacts.shareable, args(skip)) as Shareable[] | undefined;
