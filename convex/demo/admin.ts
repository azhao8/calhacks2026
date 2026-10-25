import { internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { fail } from "../lib/errors";
import {
  acceptSeat,
  afterSeatOut,
  cantMakeIt,
  dropSeat,
  heldSeats,
  isActivePlan,
  scheduleBoundaries,
  seatsOf,
  setTicketGot,
} from "../plans/model";
import { reconcilePlan } from "../plans/reconcile";
import { DEMO_FIXTURES, demoEmail, demoFingerprint, demoSnapshot } from "./fixtures";

// Demo controls for S17 (§6.7). These touch only demo records. The admin page wraps them in
// server-checked ADMIN_EMAILS functions.

// Creates or refreshes the six demo students. Idempotent by demoKey.
export const seed = internalMutation({
  args: {},
  returns: v.object({ created: v.number(), updated: v.number() }),
  handler: async (ctx) => await seedDemoStudents(ctx),
});

async function seedDemoStudents(ctx: MutationCtx): Promise<{ created: number; updated: number }> {
  {
    const now = Date.now();
    const berkeley = await ctx.db
      .query("universities")
      .withIndex("by_themeId", (q) => q.eq("themeId", "berkeley"))
      .unique();
    let created = 0;
    let updated = 0;
    for (const fixture of DEMO_FIXTURES) {
      const fields = {
        email: demoEmail(fixture.key),
        emailDomain: "melos.invalid",
        universityId: berkeley?._id,
        verifiedAt: now,
        firstName: fixture.firstName,
        gender: fixture.gender,
        year: fixture.year,
        onboarding: "ready" as const,
        isDemo: true,
        demoKey: fixture.key,
      };
      const existing = await ctx.db
        .query("users")
        .withIndex("by_demoKey", (q) => q.eq("demoKey", fixture.key))
        .unique();
      let userId: Id<"users">;
      if (existing) {
        await ctx.db.patch(existing._id, fields);
        userId = existing._id;
        updated += 1;
      } else {
        userId = await ctx.db.insert("users", fields);
        created += 1;
      }

      // Demo students meet anyone, go anywhere BART goes, and take any price, so they can fill any seat.
      const prefs = {
        userId,
        maxTicketPrice: null,
        meetWho: "anyone" as const,
        area: "bart" as const,
        prefersSimilarYear: false,
        source: "custom" as const,
      };
      const existingPrefs = await ctx.db
        .query("preferences")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      if (existingPrefs) await ctx.db.patch(existingPrefs._id, prefs);
      else await ctx.db.insert("preferences", prefs);

      // The generated data stands in for the Spotify fetch.
      const snapshot = { userId, source: "demo_fixture" as const, ...demoSnapshot(fixture), fetchedAt: now };
      const existingSnapshot = await ctx.db
        .query("tasteSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (existingSnapshot) await ctx.db.replace(existingSnapshot._id, snapshot);
      else await ctx.db.insert("tasteSnapshots", snapshot);

      // INTEGRATION: once stream A's PR #9 is on main, replace this direct write with
      // internal.onboarding.analysis.analyzeFixture({ userId, listening }) and then
      // internal.onboarding.analysis.confirmForUser({ userId }) (Claude summary from the fixed label list,
      // then the Voyage vector). Until then demo students have no vector and match on exact items.
      const existingProfile = await ctx.db
        .query("tasteProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      const profile = {
        userId,
        summary: fixture.summary,
        labels: fixture.labels,
        artists: fixture.topArtists.slice(0, 5),
        revision: 0,
        confirmedAt: now,
        fingerprint: demoFingerprint(fixture),
      };
      if (existingProfile) await ctx.db.patch(existingProfile._id, profile);
      else await ctx.db.insert("tasteProfiles", profile);

      await ctx.scheduler.runAfter(0, internal.asks.picker.pickForUser, { userId });
    }
    return { created, updated };
  }
}

async function demoUsers(ctx: MutationCtx): Promise<Doc<"users">[]> {
  const users = await ctx.db
    .query("users")
    .withIndex("by_demoKey", (q) => q.gt("demoKey", ""))
    .collect();
  return users.filter((user) => user.isDemo === true);
}

// Deletes and reseeds the demo students with their asks, seats, and shares. A seat a demo student held
// in a plan with a real student reopens instead; a real student's records are never deleted.
export const reset = internalMutation({
  args: {},
  returns: v.object({ deletedStudents: v.number(), reopenedSeats: v.number(), deletedPlans: v.number() }),
  handler: async (ctx) => {
    const demos = await demoUsers(ctx);
    const demoIds = new Set(demos.map((user) => user._id));
    let reopenedSeats = 0;
    let deletedPlans = 0;
    const touchedPlans = new Set<Id<"meetups">>();
    for (const user of demos) {
      const seats = await ctx.db
        .query("meetupMembers")
        .withIndex("by_user_seat", (q) => q.eq("userId", user._id))
        .collect();
      for (const seat of seats) touchedPlans.add(seat.meetupId);
    }
    for (const meetupId of touchedPlans) {
      const plan = await ctx.db.get(meetupId);
      if (plan === null) continue;
      const seats = await seatsOf(ctx.db, meetupId);
      const othersInPlan = seats.filter((seat) => !demoIds.has(seat.userId));
      if (othersInPlan.length === 0) {
        // Only demo students: delete the plan, its seats, and its shares.
        for (const seat of seats) await ctx.db.delete(seat._id);
        for (const share of await ctx.db
          .query("contactShares")
          .withIndex("by_meetup", (q) => q.eq("meetupId", meetupId))
          .collect()) {
          await ctx.db.delete(share._id);
        }
        await ctx.db.delete(meetupId);
        deletedPlans += 1;
        continue;
      }
      // Someone else is in it: the demo seat goes away and reopens for them.
      for (const seat of seats) {
        if (!demoIds.has(seat.userId)) continue;
        if (seat.seat !== "out") reopenedSeats += 1;
        await ctx.db.delete(seat._id);
      }
      for (const share of await ctx.db
        .query("contactShares")
        .withIndex("by_meetup", (q) => q.eq("meetupId", meetupId))
        .collect()) {
        if (demoIds.has(share.userId)) await ctx.db.delete(share._id);
      }
      if (isActivePlan(plan)) await afterSeatOut(ctx, meetupId);
    }

    for (const user of demos) {
      for (const ask of await ctx.db
        .query("asks")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect()) {
        await ctx.db.delete(ask._id);
      }
      for (const table of ["preferences", "tasteSnapshots", "tasteProfiles", "analysisJobs"] as const) {
        const rows = await ctx.db
          .query(table)
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .collect();
        for (const row of rows) await ctx.db.delete(row._id);
      }
      await ctx.db.delete(user._id);
    }
    await seedDemoStudents(ctx);
    return { deletedStudents: demos.length, reopenedSeats, deletedPlans };
  },
});

// The demo clock: applies only to demo plans (every member a demo student or team account). Changing
// it reconciles every demo plan at once and reschedules their boundaries.
export const setClockOffset = internalMutation({
  args: { offsetMs: v.number(), updatedBy: v.optional(v.string()) },
  returns: v.object({ plansReconciled: v.number() }),
  handler: async (ctx, { offsetMs, updatedBy }) => {
    const settings = await ctx.db.query("demoSettings").first();
    const row = { clockOffsetMs: offsetMs, updatedAt: Date.now(), updatedBy };
    if (settings) await ctx.db.patch(settings._id, row);
    else await ctx.db.insert("demoSettings", row);

    let plansReconciled = 0;
    for (const status of ["forming", "set"] as const) {
      const plans = await ctx.db
        .query("meetups")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      for (const plan of plans) {
        if (!plan.isDemoPlan) continue;
        await reconcilePlan(ctx, plan._id);
        const current = await ctx.db.get(plan._id);
        if (current && isActivePlan(current)) await scheduleBoundaries(ctx, current);
        plansReconciled += 1;
      }
    }
    return { plansReconciled };
  },
});

// "Act as" a demo student on the admin page.
export const actAs = internalMutation({
  args: {
    userId: v.id("users"),
    action: v.union(v.literal("accept"), v.literal("next_time"), v.literal("cant_make_it"), v.literal("got_ticket")),
    seatId: v.optional(v.id("meetupMembers")),
  },
  returns: v.null(),
  handler: async (ctx, { userId, action, seatId }) => {
    const user = await ctx.db.get(userId);
    if (user === null || !user.isDemo) fail("forbidden", "Act as works only for demo students");
    const held = await heldSeats(ctx.db, userId);
    const target = seatId ? held.find(({ seat }) => seat._id === seatId) : held.sort((a, b) => b.seat._creationTime - a.seat._creationTime)[0];
    if (target === undefined) fail("seat_unavailable");
    await reconcilePlan(ctx, target.plan._id);
    const seat = (await ctx.db.get(target.seat._id))!;
    if (action === "accept") await acceptSeat(ctx, seat);
    else if (action === "next_time") {
      if (seat.seat !== "offered") fail("validation_failed", "Next time applies to an offered seat");
      await dropSeat(ctx, seat, "next_time");
    } else if (action === "cant_make_it") await cantMakeIt(ctx, seat, "cant_make_it");
    else await setTicketGot(ctx, seat);
    return null;
  },
});
