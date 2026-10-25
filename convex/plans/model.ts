import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseReader, MutationCtx } from "../_generated/server";
import { isTeamEmail } from "../lib/access";
import { demoClockOffsetMs } from "../lib/clock";
import { MATCHING, TIMING } from "../lib/config";
import { fail } from "../lib/errors";
import type { HookItem } from "../ai/hooks";
import { DEMO_FILL_DELAY_MS, wakeForDemoFill, wakeMatcher } from "../matching/wake";
import { setPairHook } from "./hooks";

// Plans and seats (CLAUDE.md §6.5). A plan is a `meetups` row; a seat is a `meetupMembers` row.
// Plan times (offer expiry, cutoff, reveal, meeting, completion) are compared against the plan's own
// clock: the demo offset applies only to demo plans.

const MINUTE = 60 * 1000;
const ACTIVE_PLAN: Doc<"meetups">["status"][] = ["forming", "set"];

export type Seat = Doc<"meetupMembers">;
export type Plan = Doc<"meetups">;

export function isActiveSeat(seat: Seat): boolean {
  return seat.seat !== "out";
}

export function isActivePlan(plan: Plan): boolean {
  return ACTIVE_PLAN.includes(plan.status);
}

export async function planClock(db: DatabaseReader, plan: Pick<Plan, "isDemoPlan">) {
  const offset = plan.isDemoPlan ? await demoClockOffsetMs(db) : 0;
  return { now: Date.now() + offset, offset };
}

// Midnight Pacific at the start of the event's date (the meetup-day reveal).
export function pacificMidnight(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((part) => part.type === type)!.value);
  const [y, m, d] = [get("year"), get("month"), get("day")];
  const hourAt = (utcMs: number) =>
    Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(
        new Date(utcMs),
      ),
    );
  // Pacific is UTC-7 (daylight) or UTC-8 (standard).
  const daylight = Date.UTC(y, m - 1, d, 7);
  return hourAt(daylight) === 0 ? daylight : Date.UTC(y, m - 1, d, 8);
}

export function eventTimes(event: Pick<Doc<"events">, "startsAt" | "meetOffsetMinutes">) {
  const meetAt = event.startsAt - (event.meetOffsetMinutes || TIMING.meetOffsetMinutes) * MINUTE;
  return {
    meetAt,
    cutoffAt: meetAt - TIMING.cutoffBeforeMeetMs,
    dayRevealAt: pacificMidnight(event.startsAt),
    completeAt: event.startsAt + TIMING.completionAfterStartMs,
  };
}

export function eventCutoff(event: Pick<Doc<"events">, "startsAt" | "meetOffsetMinutes">): number {
  return eventTimes(event).cutoffAt;
}

export async function seatsOf(db: DatabaseReader, meetupId: Id<"meetups">): Promise<Seat[]> {
  return await db
    .query("meetupMembers")
    .withIndex("by_meetup", (q) => q.eq("meetupId", meetupId))
    .collect();
}

// Seats a student holds right now: offered or in, in a plan that's forming or set.
export async function heldSeats(db: DatabaseReader, userId: Id<"users">): Promise<{ seat: Seat; plan: Plan }[]> {
  const held: { seat: Seat; plan: Plan }[] = [];
  for (const state of ["offered", "in"] as const) {
    const seats = await db
      .query("meetupMembers")
      .withIndex("by_user_seat", (q) => q.eq("userId", userId).eq("seat", state))
      .collect();
    for (const seat of seats) {
      const plan = await db.get(seat.meetupId);
      if (plan !== null && isActivePlan(plan)) held.push({ seat, plan });
    }
  }
  return held;
}

// Demo students may hold one seat per event, at several events; everyone else holds one seat in all.
export async function canHoldSeat(
  db: DatabaseReader,
  user: Doc<"users">,
  eventId: Id<"events">,
  except?: Id<"meetupMembers">,
): Promise<boolean> {
  const held = (await heldSeats(db, user._id)).filter(({ seat }) => seat._id !== except);
  if (user.isDemo) return !held.some(({ plan }) => plan.eventId === eventId);
  return held.length === 0;
}

export function isDemoOrTeam(user: Doc<"users"> | null): boolean {
  return user !== null && (user.isDemo === true || isTeamEmail(user.email));
}

async function computeIsDemoPlan(db: DatabaseReader, userIds: Id<"users">[]): Promise<boolean> {
  for (const userId of userIds) {
    if (!isDemoOrTeam(await db.get(userId))) return false;
  }
  return true;
}

export async function closeAsk(
  ctx: MutationCtx,
  userId: Id<"users">,
  eventId: Id<"events">,
  reason: NonNullable<Doc<"asks">["closedReason"]>,
): Promise<void> {
  const asks = await ctx.db
    .query("asks")
    .withIndex("by_user_event", (q) => q.eq("userId", userId).eq("eventId", eventId))
    .collect();
  for (const ask of asks) {
    if (ask.closedReason === undefined || (ask.closedReason === "seated" && reason === "dropped")) {
      await ctx.db.patch(ask._id, { closedReason: reason });
    }
  }
}

async function pickMarker(ctx: MutationCtx, eventId: Id<"events">): Promise<number> {
  const taken = new Set<number>();
  for (const status of ["forming", "set", "done", "called_off"] as const) {
    const plans = await ctx.db
      .query("meetups")
      .withIndex("by_event_status", (q) => q.eq("eventId", eventId).eq("status", status))
      .collect();
    for (const plan of plans) taken.add(plan.marker);
  }
  const free: number[] = [];
  for (let n = MATCHING.markerMin; n <= MATCHING.markerMax; n++) if (!taken.has(n)) free.push(n);
  if (free.length === 0) return MATCHING.markerMin + Math.floor(Math.random() * (MATCHING.markerMax - MATCHING.markerMin + 1));
  return free[Math.floor(Math.random() * free.length)];
}

// Schedules the reconcile step at every time boundary still ahead (real time, so demo plans account
// for the demo offset). Extra calls are harmless: reconcile is idempotent.
export async function scheduleBoundaries(ctx: MutationCtx, plan: Plan): Promise<void> {
  const { now, offset } = await planClock(ctx.db, plan);
  const event = await ctx.db.get(plan.eventId);
  if (event === null) return;
  const times = eventTimes(event);
  const seats = await seatsOf(ctx.db, plan._id);
  const boundaries = [
    times.cutoffAt,
    times.dayRevealAt,
    times.meetAt,
    times.completeAt,
    ...seats.filter((seat) => seat.seat === "offered").map((seat) => seat.offerExpiresAt),
  ];
  for (const at of new Set(boundaries)) {
    if (at > now) await ctx.scheduler.runAt(at - offset, internal.plans.reconcile.run, { meetupId: plan._id });
  }
}

async function scheduleOfferExpiry(ctx: MutationCtx, plan: Plan, seat: { offerExpiresAt: number }) {
  const { offset } = await planClock(ctx.db, plan);
  await ctx.scheduler.runAt(seat.offerExpiresAt - offset, internal.plans.reconcile.run, { meetupId: plan._id });
}

async function insertOffer(ctx: MutationCtx, plan: Plan, user: Doc<"users">): Promise<Id<"meetupMembers">> {
  const { now } = await planClock(ctx.db, plan);
  const offerExpiresAt = Math.min(now + TIMING.offerWindowMs, plan.cutoffAt);
  const seatId = await ctx.db.insert("meetupMembers", {
    meetupId: plan._id,
    userId: user._id,
    seat: "offered",
    offeredAt: now,
    offerExpiresAt,
    ticket: "none",
  });
  await scheduleOfferExpiry(ctx, plan, { offerExpiresAt });
  if (user.isDemo) {
    const { min, max } = TIMING.demoReplyDelayMs;
    await ctx.scheduler.runAfter(min + Math.floor(Math.random() * (max - min)), internal.demo.behavior.autoAccept, {
      seatId,
    });
  }
  return seatId;
}

// A new plan for two people, both seats offered.
export async function createPlan(
  ctx: MutationCtx,
  event: Doc<"events">,
  users: [Doc<"users">, Doc<"users">],
  items: HookItem[],
): Promise<Id<"meetups">> {
  const times = eventTimes(event);
  const venue = event.venueId ? await ctx.db.get(event.venueId) : null;
  const isDemoPlan = await computeIsDemoPlan(
    ctx.db,
    users.map((user) => user._id),
  );
  const { now } = await planClock(ctx.db, { isDemoPlan });
  const meetupId = await ctx.db.insert("meetups", {
    eventId: event._id,
    status: "forming",
    marker: await pickMarker(ctx, event._id),
    meetingSpotId: event.meetingSpotId ?? venue?.meetingSpotId,
    meetAt: times.meetAt,
    cutoffAt: times.cutoffAt,
    hook: "",
    icebreaker: "",
    hookFromClaude: false,
    isDemoPlan,
    createdAt: now,
  });
  const plan = (await ctx.db.get(meetupId))!;
  for (const user of users) await insertOffer(ctx, plan, user);
  await setPairHook(ctx, meetupId, items);
  await scheduleBoundaries(ctx, plan);
  return meetupId;
}

// Offers a plan's open seat to someone new; the person who stayed keeps their place.
export async function refillSeat(
  ctx: MutationCtx,
  plan: Plan,
  user: Doc<"users">,
  items: HookItem[],
): Promise<Id<"meetupMembers">> {
  const seats = await seatsOf(ctx.db, plan._id);
  const stayers = seats.filter(isActiveSeat).map((seat) => seat.userId);
  const isDemoPlan = await computeIsDemoPlan(ctx.db, [...stayers, user._id]);
  if (isDemoPlan !== plan.isDemoPlan) await ctx.db.patch(plan._id, { isDemoPlan });
  const current = (await ctx.db.get(plan._id))!;
  const seatId = await insertOffer(ctx, current, user);
  await setPairHook(ctx, plan._id, items);
  return seatId;
}

// Accept is atomic and idempotent (§6.5 step 2). Throws an app error the UI maps to recovery copy.
export async function acceptSeat(ctx: MutationCtx, seat: Seat): Promise<void> {
  if (seat.seat === "in") return;
  if (seat.seat === "out") fail(seat.outReason === "no_answer" ? "offer_expired" : "seat_unavailable");
  const plan = await ctx.db.get(seat.meetupId);
  if (plan === null || !isActivePlan(plan)) fail("seat_unavailable");
  const { now } = await planClock(ctx.db, plan);
  if (now >= seat.offerExpiresAt || now >= plan.cutoffAt) fail("offer_expired");
  const user = await ctx.db.get(seat.userId);
  if (user === null) fail("seat_unavailable");
  if (!(await canHoldSeat(ctx.db, user, plan.eventId, seat._id))) fail("already_seated");
  const active = (await seatsOf(ctx.db, plan._id)).filter(isActiveSeat);
  if (active.length > 2) fail("seat_unavailable");

  await ctx.db.patch(seat._id, { seat: "in", respondedAt: now });
  await closeAsk(ctx, seat.userId, plan.eventId, "seated");

  const bothIn = active.length === 2 && active.every((other) => other._id === seat._id || other.seat === "in");
  if (bothIn) {
    await ctx.db.patch(plan._id, { status: "set" });
    for (const member of active) {
      const memberUser = await ctx.db.get(member.userId);
      if (memberUser?.isDemo) {
        await ctx.scheduler.runAfter(TIMING.demoTicketDelayMs, internal.demo.behavior.autoTicket, {
          seatId: member._id,
        });
      }
    }
  }
}

// A seat goes out (§6.5 steps 3–4). The other person keeps their place; the matcher refills the seat
// before the cutoff, and after it the plan is called off.
export async function dropSeat(ctx: MutationCtx, seat: Seat, reason: NonNullable<Seat["outReason"]>): Promise<void> {
  if (seat.seat === "out") return;
  const plan = await ctx.db.get(seat.meetupId);
  if (plan === null) return;
  const { now } = await planClock(ctx.db, plan);
  await ctx.db.patch(seat._id, { seat: "out", outReason: reason, outAt: now, respondedAt: seat.respondedAt ?? now });
  await closeAsk(ctx, seat.userId, plan.eventId, "dropped");
  // An ask closed, so the student may have room for a new one (no cooldown).
  await ctx.scheduler.runAfter(0, internal.asks.picker.pickForUser, { userId: seat.userId });
  await afterSeatOut(ctx, plan._id);
}

export async function afterSeatOut(ctx: MutationCtx, meetupId: Id<"meetups">): Promise<void> {
  const plan = await ctx.db.get(meetupId);
  if (plan === null || !isActivePlan(plan)) return;
  const { now } = await planClock(ctx.db, plan);
  const active = (await seatsOf(ctx.db, meetupId)).filter(isActiveSeat);
  if (active.length === 0) {
    await ctx.db.patch(meetupId, { status: "called_off", endReason: "everyone_out" });
    return;
  }
  if (active.length >= 2) return;
  if (now >= plan.cutoffAt) {
    await ctx.db.patch(meetupId, { status: "called_off", endReason: "nobody_by_cutoff" });
    return;
  }
  if (plan.status === "set") await ctx.db.patch(meetupId, { status: "forming" });
  await wakeMatcher(ctx, plan.eventId, "seat_open");
  const stayer = await ctx.db.get(active[0].userId);
  if (stayer !== null && !stayer.isDemo) await wakeForDemoFill(ctx, plan.eventId, DEMO_FILL_DELAY_MS);
}

// Seat lookups for the signed-in student's own seat only.
export async function ownSeat(ctx: MutationCtx, userId: Id<"users">, seatId: Id<"meetupMembers">): Promise<Seat> {
  const seat = await ctx.db.get(seatId);
  if (seat === null || seat.userId !== userId) fail("forbidden");
  return seat;
}

// "I can't make it anymore" / "I couldn't get one": allowed until the meeting time.
export async function cantMakeIt(ctx: MutationCtx, seat: Seat, reason: "cant_make_it" | "no_ticket"): Promise<void> {
  if (seat.seat === "out") return;
  const plan = await ctx.db.get(seat.meetupId);
  if (plan === null || !isActivePlan(plan)) fail("seat_unavailable");
  const { now } = await planClock(ctx.db, plan);
  if (now >= plan.meetAt) fail("validation_failed", "From the meeting time on, use leave");
  await dropSeat(ctx, seat, reason);
}

export async function setTicketGot(ctx: MutationCtx, seat: Seat): Promise<void> {
  if (seat.seat !== "in") fail("seat_unavailable");
  const plan = await ctx.db.get(seat.meetupId);
  if (plan === null || !isActivePlan(plan)) fail("seat_unavailable");
  if (seat.ticket !== "got") await ctx.db.patch(seat._id, { ticket: "got" });
}
