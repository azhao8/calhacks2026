"use client";

import { useGate } from "@/app/_lib/hooks";
import { ROUTES } from "@/app/_lib/routes";
import { LoadingScreen } from "@/app/_components/Screen";

// S10 Your week is retired: the drop replaced it. Old links and bookmarks land here, and the route
// gate (routes.ts redirectFor) sends them home, which picks the right screen.
export default function WeekPage() {
  useGate(ROUTES.week);
  return <LoadingScreen object="ticket" />;
}
