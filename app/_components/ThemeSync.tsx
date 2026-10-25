"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useDeviceSchool } from "@/app/_lib/hooks";
import { setDeviceSchool } from "@/app/_lib/device";
import { ROUTES } from "@/app/_lib/routes";

// Keeps <html data-theme> on the student's school (CLAUDE.md §4): the saved school once signed in,
// else the one picked on this device, else `base` on the picker and `berkeley` elsewhere.
// Also saves the device's pick to the account right after sign-in (S02).
export function ThemeSync() {
  const pathname = usePathname();
  const me = useQuery(api.me.get);
  const device = useDeviceSchool();
  const chooseSchool = useMutation(api.onboarding.chooseSchool);
  const saving = useRef(false);

  const theme = me?.school?.themeId ?? device?.themeId ?? (pathname === ROUTES.school ? "base" : "berkeley");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!me || me.school !== null || device === null || saving.current) return;
    saving.current = true;
    chooseSchool({ universityId: device.id as Id<"universities"> })
      .then(() => setDeviceSchool(null))
      // If it fails, the school picker asks again and shows the error there.
      .catch(() => undefined);
  }, [me, device, chooseSchool]);

  return null;
}
