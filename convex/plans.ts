import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireVerifiedUser } from "./lib/access";
import { verifiedViewerId } from "./plans/viewer";
import { fail } from "./lib/errors";
import { dayLabel, timeLabel } from "./lib/format";
import { eventPriceLabel } from "./asks/rules";
import { vPlanView, type PlanView } from "./lib/views";
import { TIMING } from "./lib/config";
import {
  acceptSeat,
  cantMakeIt as giveUpSeat,
  dropSeat,
  isActivePlan,
  isActiveSeat,
  ownSeat,
  planClock,
  seatsOf,
  setTicketGot,
} from "./plans/model";
import { reconcilePlan } from "./plans/reconcile";

// Stream C (matching) owns this file.

const DAY = 24 * 60 * 60 * 1000;

// Plans that ended stay on home for a while: "after" offers Stay in touch once, and a called-off plan
// tells the person who stayed that they can still go.
const SHOW_ENDED_FOR_MS = DAY;

async function currentSeat(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<{ seat: Doc<"meetupMembers">; plan: Doc<"meetups"> } | null> {
  const mine: { seat: Doc<"meetupMembers">; plan: Doc<"meetups"> }[] = [];
  for (const state of ["offered", "in"] as const) {
    const seats = await ctx.db
      .query("meetupMembers")
      .withIndex("by_user_seat", (q) => q.eq("userId", userId).eq("seat", state))
      .collect();
    for (const seat of seats) {
      const plan = await ctx.db.get(seat.meetupId);
      if (plan !== null) mine.push({ seat, plan });
    }
  }
  // Home priority: meetup day > set > offer or waiting (CLAUDE.md §5).
  const rank = ({ plan }: { plan: Doc<"meetups"> }) => {
    if (plan.status === "set") return plan.dayRevealedAt !== undefined ? 0 : 1;
    if (plan.status === "forming") return 2;
    return 3;
  };
  const active = mine.filter(({ plan }) => isActivePlan(plan));
  if (active.length > 0) {
    return active.sort((a, b) => rank(a) - rank(b) || a.plan.meetAt - b.plan.meetAt)[0];
  }
  // Recently ended plans this person was in at the end.
  const ended = [];
  for (const entry of mine) {
    if (entry.seat.seat !== "in") continue;
    const event = await ctx.db.get(entry.plan.eventId);
    if (event === null) continue;
    const { now } = await planClock(ctx.db, entry.plan);
    const endsAt =
      entry.plan.status === "done"
        ? event.startsAt + TIMING.completionAfterStartMs + SHOW_ENDED_FOR_MS
        : event.startsAt + TIMING.completionAfterStartMs;
    if (now < endsAt) ended.push(entry);
  }
  return ended.sort((a, b) => b.plan.meetAt - a.plan.meetAt)[0] ?? null;
}

// S11–S14: the student's current plan, with withholding by stage (CLAUDE.md §8.7). Fields a student
// may not see yet are null in the response, not hidden by the UI.
export const current = query({
  args: {},
  returns: v.union(v.null(), vPlanView),
  handler: async (ctx): Promise<PlanView | null> => {
    const userId = await verifiedViewerId(ctx);
    if (userId === null) return null;
    const found = await currentSeat(ctx, userId);
    if (found === null) return null;
    const { seat, plan } = found;
    const event = await ctx.db.get(plan.eventId);
    if (event === null) return null;
    const venue = event.venueId ? await ctx.db.get(event.venueId) : null;
    const { offset, now: planNow } = await planClock(ctx.db, plan);
    const seats = await seatsOf(ctx.db, plan._id);
    const partnerSeat = seats.find((other) => other._id !== seat._id && isActiveSeat(other)) ?? null;
    const partnerUser = partnerSeat ? await ctx.db.get(partnerSeat.userId) : null;
    // Only seats that went out while this student held theirs: someone refilled into a seat is never
    // told who left it.
    const leftWhileIHeld = seats.filter(
      (other) => other.userId !== userId && other.seat === "out" && (other.outAt ?? 0) >= seat.offeredAt,
    );
    const someoneLeftSeat = leftWhileIHeld.length > 0;
    const metAtMeetingTime = plan.meetingStartedAt !== undefined;

    const stage: PlanView["stage"] =
      plan.status === "done" || (plan.status === "called_off" && metAtMeetingTime)
        ? "after"
        : plan.status === "called_off"
          ? "called_off"
          : seat.seat === "offered"
            ? "offer"
            : plan.status === "set"
              ? plan.dayRevealedAt !== undefined
                ? "meetup_day"
                : "set"
              : "waiting";

    // The meeting spot appears once both are in. The person who stayed keeps it while a dropped seat is
    // refilled; someone newly offered a seat doesn't see it until they're in.
    // Keeping the spot after a drop needs the student to have been in when the plan was last set.
    const wasSetWithMe = plan.setAt !== undefined && (seat.respondedAt ?? Infinity) <= plan.setAt;
    const seesMeeting =
      seat.seat === "in" &&
      (plan.status === "set" ||
        stage === "after" ||
        (wasSetWithMe &&
          plan.status !== "called_off" &&
          seats.some((other) => other.seat === "out" && (other.outReason === "cant_make_it" || other.outReason === "no_ticket"))) ||
        (wasSetWithMe && plan.status === "called_off" && plan.endReason === "nobody_by_cutoff"));
    const spot = seesMeeting && plan.meetingSpotId ? await ctx.db.get(plan.meetingSpotId) : null;
    const meeting =
      seesMeeting && spot
        ? {
            spotName: spot.name,
            howToFind: spot.howToFind,
            directionsUrl: spot.directionsUrl,
            meetTimeLabel: timeLabel(plan.meetAt),
          }
        : null;

    const revealDay = (stage === "meetup_day" || stage === "after") && plan.dayRevealedAt !== undefined;

    let notice: PlanView["notice"] = null;
    if (plan.status === "called_off" && plan.endReason === "event_pulled") notice = "event_pulled";
    else if (plan.status === "called_off" && plan.endReason === "nobody_by_cutoff") notice = "nobody_by_cutoff";
    else if (partnerSeat?.leftAt !== undefined) notice = "partner_left";
    // Whether I'm in or still deciding on my offer, a partner who gave up their seat is named.
    else if (partnerSeat === null && someoneLeftSeat) notice = "partner_dropped";
    // The partner arrived after me to take a seat someone gave up while I was here.
    else if (partnerSeat !== null && someoneLeftSeat && partnerSeat.offeredAt > seat.offeredAt)
      notice = "partner_replaced";

    // The person who gave up the seat; this student already saw the name in the offer.
    let previousPartnerFirstName: string | null = null;
    if (notice === "partner_dropped" || notice === "partner_replaced") {
      const lastOut = [...leftWhileIHeld].sort((a, b) => (b.outAt ?? 0) - (a.outAt ?? 0))[0];
      const previous = lastOut ? await ctx.db.get(lastOut.userId) : null;
      previousPartnerFirstName = previous?.firstName ?? null;
    }

    const meetingTimeReached = metAtMeetingTime;
    const eligible =
      metAtMeetingTime && seat.seat === "in" && partnerSeat?.seat === "in";

    return {
      meetupId: plan._id,
      seatId: seat._id,
      stage,
      event: {
        title: event.title,
        venueName: venue?.name ?? "",
        dayLabel: dayLabel(event.startsAt),
        timeLabel: timeLabel(event.startsAt),
        priceLabel: eventPriceLabel(event),
      },
      hook: partnerSeat !== null ? plan.hook : null,
      me: {
        seat: seat.seat === "offered" ? "offered" : "in",
        ticket: seat.ticket,
        // Real time, so the UI can say when the offer runs out.
        offerExpiresAt: seat.seat === "offered" ? seat.offerExpiresAt - offset : null,
        left: seat.leftAt !== undefined,
      },
      partner:
        partnerSeat && partnerUser
          ? {
              firstName: partnerUser.firstName ?? "",
              seat: partnerSeat.seat === "offered" ? "offered" : "in",
              ticket: partnerSeat.ticket,
              left: partnerSeat.leftAt !== undefined,
            }
          : null,
      notice,
      previousPartnerFirstName,
      meeting,
      ticketUrl: meeting ? (event.ticketUrl ?? null) : null,
      marker: revealDay ? plan.marker : null,
      icebreaker: revealDay ? plan.icebreaker : null,
      // A seat given up now reopens and is refilled only before the cutoff (same clock as reconcile).
      beforeCutoff: isActivePlan(plan) && plan.cutoffPassedAt === undefined,
      canCantMakeIt: seat.seat === "in" && isActivePlan(plan) && !meetingTimeReached && planNow < plan.meetAt,
      canLeave: plan.status === "set" && (meetingTimeReached || planNow >= plan.meetAt) && seat.leftAt === undefined,
      canShare: eligible,
    };
  },
});

// The student's most recent seat that ended with no answer or "Next time" in the last 24 hours, so
// home can acknowledge it. Nothing about the partner; identity from the session only.
const LAST_ENDED_FOR_MS = 24 * 60 * 60 * 1000;

export const lastEnded = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      meetupId: v.id("meetups"),
      outReason: v.union(v.literal("no_answer"), v.literal("next_time")),
      outAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await verifiedViewerId(ctx);
    if (userId === null) return null;
    const outSeats = await ctx.db
      .query("meetupMembers")
      .withIndex("by_user_seat", (q) => q.eq("userId", userId).eq("seat", "out"))
      .collect();
    let latest: { meetupId: Id<"meetups">; outReason: "no_answer" | "next_time"; outAt: number } | null = null;
    for (const seat of outSeats) {
      if (seat.outAt === undefined || (seat.outReason !== "no_answer" && seat.outReason !== "next_time")) continue;
      const plan = await ctx.db.get(seat.meetupId);
      if (plan === null) continue;
      // outAt is on the plan's clock.
      const { now } = await planClock(ctx.db, plan);
      if (now - seat.outAt > LAST_ENDED_FOR_MS) continue;
      if (latest === null || seat.outAt > latest.outAt) {
        latest = { meetupId: seat.meetupId, outReason: seat.outReason, outAt: seat.outAt };
      }
    }
    return latest;
  },
});

export const accept = mutation({
  args: { seatId: v.id("meetupMembers") },
  returns: v.null(),
  handler: async (ctx, { seatId }) => {
    const userId = (await requireVerifiedUser(ctx))._id;
    const seat = await ownSeat(ctx, userId, seatId);
    // Settle anything the clock has already decided (an offer that ran out) before accepting.
    await reconcilePlan(ctx, seat.meetupId);
    await acceptSeat(ctx, (await ctx.db.get(seatId))!);
    return null;
  },
});

export const nextTime = mutation({
  args: { seatId: v.id("meetupMembers") },
  returns: v.null(),
  handler: async (ctx, { seatId }) => {
    const userId = (await requireVerifiedUser(ctx))._id;
    const seat = await ownSeat(ctx, userId, seatId);
    if (seat.seat === "out") return null; // Already given up: repeating is harmless.
    // The seat changed under the student (it was accepted or reopened): the screen refreshes.
    if (seat.seat !== "offered") fail("seat_unavailable");
    await dropSeat(ctx, seat, "next_time");
    return null;
  },
});

// "Got my ticket", or "I couldn't get one" (which gives up the seat like "I can't make it").
export const setTicket = mutation({
  args: { seatId: v.id("meetupMembers"), ticket: v.union(v.literal("got"), v.literal("couldnt")) },
  returns: v.null(),
  handler: async (ctx, { seatId, ticket }) => {
    const userId = (await requireVerifiedUser(ctx))._id;
    const seat = await ownSeat(ctx, userId, seatId);
    if (ticket === "got") await setTicketGot(ctx, seat);
    else await giveUpSeat(ctx, seat, "no_ticket");
    return null;
  },
});

export const cantMakeIt = mutation({
  args: { seatId: v.id("meetupMembers") },
  returns: v.null(),
  handler: async (ctx, { seatId }) => {
    const userId = (await requireVerifiedUser(ctx))._id;
    const seat = await ownSeat(ctx, userId, seatId);
    await giveUpSeat(ctx, seat, "cant_make_it");
    return null;
  },
});

// From the meeting time on: "I need to leave". Never needs permission; the plan continues.
export const leave = mutation({
  args: { seatId: v.id("meetupMembers") },
  returns: v.null(),
  handler: async (ctx, { seatId }) => {
    const userId = (await requireVerifiedUser(ctx))._id;
    const seat = await ownSeat(ctx, userId, seatId);
    if (seat.leftAt !== undefined) return null;
    const plan = await ctx.db.get(seat.meetupId);
    if (plan === null || seat.seat !== "in") fail("seat_unavailable");
    await reconcilePlan(ctx, plan._id);
    const current = (await ctx.db.get(plan._id))!;
    if (current.meetingStartedAt === undefined) fail("seat_unavailable");
    const { now } = await planClock(ctx.db, current);
    await ctx.db.patch(seat._id, { leftAt: now });
    await reconcilePlan(ctx, plan._id);
    return null;
  },
});
