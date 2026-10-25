import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireVerifiedUser } from "./lib/access";
import { verifiedViewerId } from "./plans/viewer";
import { fail } from "./lib/errors";
import { dayLabel, distanceLabel, timeLabel } from "./lib/format";
import { eventPriceLabel } from "./asks/rules";
import { vWeekCard, type WeekCard } from "./lib/views";
import { TIMING } from "./lib/config";
import { wakeForDemoFill, wakeMatcher } from "./matching/wake";
import { eventCutoff, heldSeats } from "./plans/model";

// Stream C (matching) owns this file.

// S10: up to 3 "Can you make it?" cards. Only day and date, start time, price range, and distance:
// event names, venues, and performers stay on the server.
export const mine = query({
  args: {},
  returns: v.array(vWeekCard),
  handler: async (ctx) => {
    const userId = await verifiedViewerId(ctx);
    if (userId === null) return [];
    const now = Date.now();
    const asks = await ctx.db
      .query("asks")
      .withIndex("by_user", (q) => q.eq("userId", userId).gte("createdAt", now - TIMING.asksWindowMs))
      .collect();
    const heldEvents = new Set((await heldSeats(ctx.db, userId)).map(({ plan }) => plan.eventId));
    const cards: (WeekCard & { startsAt: number })[] = [];
    for (const ask of asks) {
      // A dropped event, a pulled one, or one past its cutoff closes quietly.
      if (ask.closedReason !== undefined && ask.closedReason !== "seated") continue;
      const event = await ctx.db.get(ask.eventId);
      if (event === null || event.status !== "published" || now >= eventCutoff(event)) continue;
      const venue = event.venueId ? await ctx.db.get(event.venueId) : null;
      cards.push({
        askId: ask._id,
        dayLabel: dayLabel(event.startsAt),
        timeLabel: timeLabel(event.startsAt),
        priceLabel: eventPriceLabel(event),
        distanceLabel: venue ? distanceLabel(venue.distanceFromCampusMeters) : "",
        answer: ask.answer,
        locked: ask.closedReason === "seated" || heldEvents.has(event._id),
        startsAt: event.startsAt,
      });
    }
    return cards
      .sort((a, b) => a.startsAt - b.startsAt)
      .slice(0, TIMING.asksPerWindow)
      .map((card) => ({
        askId: card.askId,
        dayLabel: card.dayLabel,
        timeLabel: card.timeLabel,
        priceLabel: card.priceLabel,
        distanceLabel: card.distanceLabel,
        answer: card.answer,
        locked: card.locked,
      }));
  },
});

// S10: "I can make it" (yes) or taking it back (no). A yes wakes the matcher.
export const answer = mutation({
  args: { askId: v.id("asks"), answer: v.union(v.literal("yes"), v.literal("no")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireVerifiedUser(ctx);
    const ask = await ctx.db.get(args.askId);
    if (ask === null || ask.userId !== user._id) fail("forbidden");
    if (user.onboarding !== "ready") fail("forbidden");
    const event = await ctx.db.get(ask.eventId);
    const now = Date.now();
    if (event === null || event.status !== "published" || now >= eventCutoff(event) || ask.closedReason !== undefined) {
      fail("validation_failed", "This one has closed. Your week shows what's still open.");
    }
    // Answers can change until you hold a seat for that event.
    if ((await heldSeats(ctx.db, user._id)).some(({ plan }) => plan.eventId === ask.eventId)) fail("already_seated");
    if (ask.answer === args.answer) return null;
    await ctx.db.patch(ask._id, { answer: args.answer, answeredAt: now });
    if (args.answer === "yes") {
      await wakeMatcher(ctx, ask.eventId, "yes");
      if (!user.isDemo) await wakeForDemoFill(ctx, ask.eventId, TIMING.demoFillWaitMs);
    }
    return null;
  },
});
