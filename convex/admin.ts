import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { isTeamEmail, requireAdmin } from "./lib/access";
import { now } from "./lib/clock";

// S17 admin (stream E). Every admin function checks ADMIN_EMAILS on the server with requireAdmin.

export const whoami = query({
  args: {},
  // Only the caller's own email, so the admin page can say who is signed in.
  // `orphaned`: this session's account was deleted (from the admin page), so the browser should sign out.
  returns: v.object({
    signedIn: v.boolean(),
    isAdmin: v.boolean(),
    email: v.union(v.string(), v.null()),
    orphaned: v.boolean(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { signedIn: false, isAdmin: false, email: null, orphaned: false };
    const user = await ctx.db.get(userId);
    if (user === null) return { signedIn: false, isAdmin: false, email: null, orphaned: true };
    return { signedIn: true, isAdmin: isTeamEmail(user.email), email: user.email ?? null, orphaned: false };
  },
});

// Demo students and team accounts never count toward numbers we quote (§6.7).
export function isRealStudent(user: Doc<"users">): boolean {
  return user.isDemo !== true && !isTeamEmail(user.email);
}

const FUNNEL_STAGES = [
  "Signed up",
  "Verified",
  "Spotify connected",
  "Taste confirmed",
  "Asked",
  "Said yes",
  "Offered a seat",
  "Plan set",
  "Both got tickets",
  "Meetup day reached",
] as const;

// Counts only, real students only, safe to show on stage (S17). Stages read current state, so a
// student who disconnects Spotify leaves the stages whose data that deletes.
export const funnel = query({
  args: {},
  returns: v.array(v.object({ stage: v.string(), count: v.number() })),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = (await ctx.db.query("users").collect()).filter(isRealStudent);
    const real = new Set(users.map((user) => user._id));
    const distinct = (ids: Iterable<Id<"users">>) => {
      const seen = new Set<Id<"users">>();
      for (const id of ids) if (real.has(id)) seen.add(id);
      return seen.size;
    };

    const access = await ctx.db.query("spotifyAccess").collect();
    const profiles = await ctx.db.query("tasteProfiles").collect();
    const asks = await ctx.db.query("asks").collect();
    const seats = await ctx.db.query("meetupMembers").collect();
    const plans = new Map((await ctx.db.query("meetups").collect()).map((plan) => [plan._id, plan]));

    const seatsIn = seats.filter((seat) => seat.seat === "in");
    const inPlan = (statuses: Doc<"meetups">["status"][]) =>
      seatsIn.filter((seat) => {
        const plan = plans.get(seat.meetupId);
        return plan !== undefined && statuses.includes(plan.status);
      });
    const seatsByPlan = new Map<Id<"meetups">, Doc<"meetupMembers">[]>();
    for (const seat of seatsIn) seatsByPlan.set(seat.meetupId, [...(seatsByPlan.get(seat.meetupId) ?? []), seat]);
    const bothTicketed = [...seatsByPlan.values()].filter(
      (pair) => pair.length === 2 && pair.every((seat) => seat.ticket === "got"),
    );

    const counts = [
      users.length,
      users.filter((user) => user.verifiedAt !== undefined).length,
      // A revoked record was connected before the student disconnected (§8.6).
      distinct(access.filter((row) => row.status === "connected" || row.status === "revoked").map((row) => row.userId)),
      distinct(profiles.filter((profile) => profile.confirmedAt !== undefined).map((profile) => profile.userId)),
      distinct(asks.map((ask) => ask.userId)),
      distinct(asks.filter((ask) => ask.answer === "yes").map((ask) => ask.userId)),
      distinct(seats.map((seat) => seat.userId)),
      distinct(inPlan(["set", "done"]).map((seat) => seat.userId)),
      distinct(bothTicketed.flat().map((seat) => seat.userId)),
      distinct(
        seatsIn.filter((seat) => plans.get(seat.meetupId)?.dayRevealedAt !== undefined).map((seat) => seat.userId),
      ),
    ];
    return FUNNEL_STAGES.map((stage, index) => ({ stage, count: counts[index] }));
  },
});

const HELP_NOTES_SHOWN = 100;

// S16 "Tell us about a problem" notes, newest first. Read by the team, not monitored around the clock.
export const helpNotes = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("helpNotes"),
      createdAt: v.number(),
      text: v.string(),
      firstName: v.union(v.string(), v.null()),
      email: v.union(v.string(), v.null()),
      isDemo: v.boolean(),
      meetupId: v.union(v.id("meetups"), v.null()),
      handledAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const notes = await ctx.db.query("helpNotes").order("desc").take(HELP_NOTES_SHOWN);
    return Promise.all(
      notes.map(async (note) => {
        const author = await ctx.db.get(note.userId);
        return {
          _id: note._id,
          createdAt: note.createdAt,
          text: note.text,
          firstName: author?.firstName ?? null,
          email: author?.email ?? null,
          isDemo: author?.isDemo === true,
          meetupId: note.meetupId ?? null,
          handledAt: note.handledAt ?? null,
        };
      }),
    );
  },
});

export const markHelpNoteHandled = mutation({
  args: { noteId: v.id("helpNotes") },
  returns: v.null(),
  handler: async (ctx, { noteId }) => {
    await requireAdmin(ctx);
    const note = await ctx.db.get(noteId);
    if (note !== null && note.handledAt === undefined) await ctx.db.patch(noteId, { handledAt: await now(ctx.db, false) });
    return null;
  },
});
