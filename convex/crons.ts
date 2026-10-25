import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { TIMING } from "./lib/config";

// Stream C owns this file.
const crons = cronJobs();

// The matcher sweep (§6.4), which also closes asks past their cutoff and reconciles every active plan.
crons.interval("matcher sweep", { minutes: TIMING.matcherSweepMinutes }, internal.matching.run.sweep, {});

// The rolling 7-day ask window frees room over time; top students back up to 3 asks.
crons.interval("ask top-up", { hours: 6 }, internal.asks.picker.pickAfterImport, {});

// Drops: audience profiles for events that are missing one or changed; also the retry after a failure.
crons.interval("audience profiles", { hours: 1 }, internal.drops.audience.backfill, {});

export default crons;
