import { internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { isTeamEmail } from "../lib/access";
import { demoClockOffsetMs } from "../lib/clock";
import { MATCHING, SURPRISE_ME, TIMING } from "../lib/config";
import { vMatchTrigger } from "../lib/validators";
import {
  canHoldSeat,
  createPlan,
  eventCutoff,
  isActiveSeat,
  isDemoOrTeam,
  refillSeat,
  seatsOf,
} from "../plans/model";
import { maxMatching } from "./blossom";
import { hookItems } from "./names";
import {
  accepts,
  cosine,
  documentFrequency,
  pairScore,
  sharedItems,
  similarYear,
  type PairScore,
} from "./taste";

// The matcher (CLAUDE.md §6.3, §6.4). One run is one mutation per event: loading the pool, exact
// in-memory scoring, and every commit happen in a single transaction, so a run always sees current
// state, two runs for the same event serialize, and a retried run can't double-book anyone.

type Member = {
  user: Doc<"users">;
  profile: Doc<"tasteProfiles">;
  prefs: Pick<Doc<"preferences">, "meetWho" | "prefersSimilarYear">;
  waitStart: number; // when they started waiting alone (real time)
  waitingRuns: number;
};

type Decision = Doc<"matchRuns">["decisions"][number];

const DEFAULT_PREFS = { meetWho: SURPRISE_ME.meetWho, prefersSimilarYear: SURPRISE_ME.prefersSimilarYear } as const;

async function loadMember(
  ctx: MutationCtx,
  user: Doc<"users">,
  profiles: Map<Id<"users">, Doc<"tasteProfiles">>,
  waitStart: number,
): Promise<Member | null> {
  const profile = profiles.get(user._id);
  if (profile === undefined || user.onboarding !== "ready") return null;
  const prefs = await ctx.db
    .query("preferences")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  return { user, profile, prefs: prefs ?? DEFAULT_PREFS, waitStart, waitingRuns: 0 };
}

export async function runMatcher(
  ctx: MutationCtx,
  eventId: Id<"events">,
  trigger: Doc<"matchRuns">["trigger"],
): Promise<Id<"matchRuns"> | null> {
  const real = Date.now();
  const event = await ctx.db.get(eventId);
  if (event === null) return null;
  if (event.matcherWakeAt !== undefined && event.matcherWakeAt <= real) {
    await ctx.db.patch(eventId, { matcherWakeAt: undefined });
  }
  if (event.status !== "published" || real >= eventCutoff(event)) return null;

  // Rarity comes from our own students.
  const allProfiles = (await ctx.db.query("tasteProfiles").collect()).filter((p) => p.confirmedAt !== undefined);
  const profiles = new Map(allProfiles.map((p) => [p.userId, p]));
  const frequency = documentFrequency(allProfiles.map((p) => p.fingerprint));
  const students = allProfiles.length;
  const offset = await demoClockOffsetMs(ctx.db);

  // The pool: real students and team accounts who said yes, are ready, and hold no seat.
  const yesAsks = (
    await ctx.db
      .query("asks")
      .withIndex("by_event_answer", (q) => q.eq("eventId", eventId).eq("answer", "yes"))
      .collect()
  ).filter((ask) => ask.closedReason === undefined);
  const pool = new Map<Id<"users">, Member>();
  for (const ask of yesAsks) {
    const user = await ctx.db.get(ask.userId);
    if (user === null || user.isDemo || pool.has(user._id)) continue;
    if (!(await canHoldSeat(ctx.db, user, eventId))) continue;
    const member = await loadMember(ctx, user, profiles, ask.answeredAt ?? ask.createdAt);
    if (member !== null) pool.set(user._id, member);
  }

  // Waiting boost: matcher runs for this event since each person said yes.
  const earliest = Math.min(real, ...[...pool.values()].map((m) => m.waitStart));
  const pastRuns = await ctx.db
    .query("matchRuns")
    .withIndex("by_event", (q) => q.eq("eventId", eventId).gte("startedAt", earliest))
    .collect();
  for (const member of pool.values()) {
    member.waitingRuns = pastRuns.filter((run) => run.startedAt >= member.waitStart).length;
  }

  // People paired together in the last 7 days aren't paired again.
  const recentCache = new Map<Id<"users">, Set<Id<"users">>>();
  async function recentPartners(userId: Id<"users">): Promise<Set<Id<"users">>> {
    const cached = recentCache.get(userId);
    if (cached) return cached;
    const partners = new Set<Id<"users">>();
    const seats = await ctx.db
      .query("meetupMembers")
      .withIndex("by_user_seat", (q) => q.eq("userId", userId))
      .collect();
    for (const seat of seats) {
      if (seat._creationTime < real - TIMING.repeatPairBlockMs) continue;
      for (const other of await seatsOf(ctx.db, seat.meetupId)) {
        if (other.userId !== userId && other._creationTime >= real - TIMING.repeatPairBlockMs) partners.add(other.userId);
      }
    }
    recentCache.set(userId, partners);
    return partners;
  }

  // Hard rules, then the exact score. Null when the pair isn't allowed.
  async function evaluate(a: Member, b: Member): Promise<PairScore | null> {
    if (!accepts(a.prefs.meetWho, b.user.gender) || !accepts(b.prefs.meetWho, a.user.gender)) return null;
    // Two team accounts may pair again, so rehearsals never block the stage demo (DECISIONS.md).
    const bothTeam = isTeamEmail(a.user.email) && isTeamEmail(b.user.email) && !a.user.isDemo && !b.user.isDemo;
    if (!bothTeam && (await recentPartners(a.user._id)).has(b.user._id)) return null;
    const shared = sharedItems(a.profile.fingerprint, b.profile.fingerprint, frequency, students);
    if (shared.length < MATCHING.minSharedItems) return null;
    return pairScore({
      similarity: cosine(a.profile.embedding, b.profile.embedding),
      shared,
      similarYear: similarYear(
        { year: a.user.year, prefersSimilarYear: a.prefs.prefersSimilarYear },
        { year: b.user.year, prefersSimilarYear: b.prefs.prefersSimilarYear },
      ),
      waitingRuns: a.waitingRuns + b.waitingRuns,
    });
  }

  const decisions: Decision[] = [];
  const errors: string[] = [];
  function log(a: Member, b: Member, score: PairScore, reason: string) {
    decisions.push({
      a: a.user._id,
      b: b.user._id,
      score: round(score.score),
      similarity: round(score.similarity),
      shared: score.shared.slice(0, 10).map((item) => ({ kind: item.kind, name: item.name, weight: round(item.weight) })),
      reason: `${reason}; shared ${round(score.sharedScore)}, year ${round(score.yearBoost)}, waiting ${round(score.waitingBoost)}`,
    });
  }

  // A plan for a pair whose clock is already past the cutoff (a demo plan after a clock jump) is skipped.
  async function pastCutoffFor(users: Doc<"users">[]): Promise<boolean> {
    const demoPlan = users.every((user) => isDemoOrTeam(user));
    return real + (demoPlan ? offset : 0) >= eventCutoff(event!);
  }

  // Plans of this event with one open seat.
  const formingPlans = await ctx.db
    .query("meetups")
    .withIndex("by_event_status", (q) => q.eq("eventId", eventId).eq("status", "forming"))
    .collect();
  const openPlans: {
    plan: Doc<"meetups">;
    stayer: Member | null;
    stayerUser: Doc<"users">;
    previous: Set<Id<"users">>;
    openSince: number;
    filled: boolean;
  }[] = [];
  for (const plan of formingPlans.sort((x, y) => x._creationTime - y._creationTime)) {
    const seats = await seatsOf(ctx.db, plan._id);
    const active = seats.filter(isActiveSeat);
    if (active.length !== 1) continue;
    const planNow = real + (plan.isDemoPlan ? offset : 0);
    if (planNow >= plan.cutoffAt) {
      errors.push(`skipped plan ${plan._id}: demo clock is past the cutoff`);
      continue;
    }
    const stayerUser = await ctx.db.get(active[0].userId);
    if (stayerUser === null) continue;
    const stayer = await loadMember(ctx, stayerUser, profiles, real);
    const out = seats.filter((seat) => seat.seat === "out");
    const lastOut = Math.max(...out.map((seat) => seat.outAt ?? seat.offeredAt));
    openPlans.push({
      plan,
      stayer,
      stayerUser,
      previous: new Set(seats.map((seat) => seat.userId)),
      // Real time the seat opened, so the demo-fill wait is measured on the real clock.
      openSince: lastOut - (plan.isDemoPlan ? offset : 0),
      filled: false,
    });
  }

  let seatsRefilled = 0;
  let pairsCreated = 0;
  let demoFills = 0;

  // 1. Refill open seats from the pool.
  for (const open of openPlans) {
    const stayer = open.stayer;
    if (stayer === null) continue;
    let best: { member: Member; score: PairScore } | null = null;
    for (const member of [...pool.values()].sort((x, y) => x.user._id.localeCompare(y.user._id))) {
      if (open.previous.has(member.user._id)) continue;
      const score = await evaluate(stayer, member);
      if (score !== null && (best === null || score.score > best.score.score)) best = { member, score };
    }
    if (best === null) continue;
    const items = await hookItems(ctx.db, best.score.shared, [open.stayerUser._id, best.member.user._id]);
    await refillSeat(ctx, open.plan, best.member.user, items);
    pool.delete(best.member.user._id);
    open.filled = true;
    seatsRefilled += 1;
    log(stayer, best.member, best.score, "refill");
  }

  // 2. Pair the rest with blossom matching (most pairs first, then the best total fit).
  const members = [...pool.values()];
  const edges: { a: Id<"users">; b: Id<"users">; score: PairScore }[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const score = await evaluate(members[i], members[j]);
      if (score !== null) edges.push({ a: members[i].user._id, b: members[j].user._id, score });
    }
  }
  const matched = maxMatching(
    members.map((m) => m.user._id),
    edges.map((edge) => ({ a: edge.a, b: edge.b, score: edge.score.score })),
  );
  for (const [aId, bId] of matched) {
    const a = pool.get(aId)!;
    const b = pool.get(bId)!;
    const edge = edges.find((e) => (e.a === aId && e.b === bId) || (e.a === bId && e.b === aId))!;
    if (await pastCutoffFor([a.user, b.user])) {
      errors.push(`skipped ${a.user._id} + ${b.user._id}: demo clock is past the cutoff`);
      continue;
    }
    const items = await hookItems(ctx.db, edge.score.shared, [aId, bId]);
    await createPlan(ctx, event, [a.user, b.user], items);
    pool.delete(aId);
    pool.delete(bId);
    pairsCreated += 1;
    log(a, b, edge.score, "blossom");
  }

  // 3. Fill the gaps with demo students once someone has waited alone past the demo-fill wait.
  const demoUsers = await ctx.db
    .query("users")
    .withIndex("by_demoKey", (q) => q.gt("demoKey", ""))
    .collect();
  const demos: Member[] = [];
  for (const user of demoUsers.sort((x, y) => (x.demoKey ?? "").localeCompare(y.demoKey ?? ""))) {
    if (!user.isDemo || !(await canHoldSeat(ctx.db, user, eventId))) continue;
    const member = await loadMember(ctx, user, profiles, real);
    if (member !== null) demos.push(member);
  }
  async function bestDemo(person: Member, previous: Set<Id<"users">>) {
    let best: { member: Member; score: PairScore } | null = null;
    for (const demo of demos) {
      if (previous.has(demo.user._id)) continue;
      const score = await evaluate(person, demo);
      if (score !== null && (best === null || score.score > best.score.score)) best = { member: demo, score };
    }
    return best;
  }
  let nextDue: number | null = null;
  const noteDue = (at: number) => {
    if (at > real && (nextDue === null || at < nextDue)) nextDue = at;
  };

  for (const open of openPlans) {
    if (open.filled || open.stayer === null || open.stayerUser.isDemo) continue;
    const due = open.openSince + TIMING.demoFillWaitMs;
    if (due > real) {
      noteDue(due);
      continue;
    }
    const best = await bestDemo(open.stayer, open.previous);
    if (best === null) continue;
    const items = await hookItems(ctx.db, best.score.shared, [open.stayerUser._id, best.member.user._id]);
    await refillSeat(ctx, open.plan, best.member.user, items);
    demos.splice(demos.indexOf(best.member), 1);
    demoFills += 1;
    log(open.stayer, best.member, best.score, "demo fill (open seat)");
  }
  for (const member of [...pool.values()].sort((x, y) => x.waitStart - y.waitStart)) {
    const due = member.waitStart + TIMING.demoFillWaitMs;
    if (due > real) {
      noteDue(due);
      continue;
    }
    const best = await bestDemo(member, new Set());
    if (best === null) continue;
    if (await pastCutoffFor([member.user, best.member.user])) {
      errors.push(`skipped ${member.user._id} + ${best.member.user._id}: demo clock is past the cutoff`);
      continue;
    }
    const items = await hookItems(ctx.db, best.score.shared, [member.user._id, best.member.user._id]);
    await createPlan(ctx, event, [member.user, best.member.user], items);
    demos.splice(demos.indexOf(best.member), 1);
    pool.delete(member.user._id);
    demoFills += 1;
    log(member, best.member, best.score, "demo fill");
  }
  if (nextDue !== null) {
    await ctx.scheduler.runAt(nextDue + 1000, internal.matching.run.forEvent, { eventId, trigger: "demo_wait" });
  }

  return await ctx.db.insert("matchRuns", {
    eventId,
    trigger,
    startedAt: real,
    finishedAt: Date.now(),
    seatsRefilled,
    pairsCreated,
    demoFills,
    decisions,
    errors,
  });
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export const forEvent = internalMutation({
  args: { eventId: v.id("events"), trigger: vMatchTrigger },
  returns: v.union(v.null(), v.id("matchRuns")),
  handler: async (ctx, { eventId, trigger }) => await runMatcher(ctx, eventId, trigger),
});

// Every 30 minutes (convex/crons.ts): run the matcher for every event with open yeses, close asks that
// reached their cutoff or whose event was pulled, and reconcile every active plan as a safety net.
export const sweep = internalMutation({
  args: {},
  returns: v.object({ events: v.number(), asksClosed: v.number(), plans: v.number() }),
  handler: async (ctx) => {
    const real = Date.now();
    const openAsks = (await ctx.db.query("asks").collect()).filter((ask) => ask.closedReason === undefined);
    const toMatch = new Set<Id<"events">>();
    const toPick = new Set<Id<"users">>();
    let asksClosed = 0;
    const events = new Map<Id<"events">, Doc<"events"> | null>();
    for (const ask of openAsks) {
      if (!events.has(ask.eventId)) events.set(ask.eventId, await ctx.db.get(ask.eventId));
      const event = events.get(ask.eventId)!;
      const reason =
        event === null || event.status !== "published" ? "event_pulled" : real >= eventCutoff(event) ? "cutoff" : null;
      if (reason !== null) {
        await ctx.db.patch(ask._id, { closedReason: reason });
        toPick.add(ask.userId);
        asksClosed += 1;
      } else if (ask.answer === "yes") {
        toMatch.add(ask.eventId);
      }
    }
    for (const eventId of toMatch) {
      await ctx.scheduler.runAfter(0, internal.matching.run.forEvent, { eventId, trigger: "sweep" });
    }
    for (const userId of toPick) {
      await ctx.scheduler.runAfter(0, internal.asks.picker.pickForUser, { userId });
    }
    let plans = 0;
    for (const status of ["forming", "set"] as const) {
      for (const plan of await ctx.db
        .query("meetups")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect()) {
        await ctx.scheduler.runAfter(0, internal.plans.reconcile.run, { meetupId: plan._id });
        plans += 1;
      }
    }
    return { events: toMatch.size, asksClosed, plans };
  },
});
