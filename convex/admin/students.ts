import { internalMutation, mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import { v } from "convex/values";
import { isTeamEmail, requireAdmin } from "../lib/access";
import { fail } from "../lib/errors";
import { assignWaitingRequests } from "../onboarding/apps";
import { adminStatus } from "../onboarding/admin";

// S17 Students and the danger zone (owner request, Oct 25). Team only: every public function checks
// ADMIN_EMAILS on the server. Deleting is permanent and removes every record tied to the student.

const vKind = v.union(v.literal("real"), v.literal("demo"), v.literal("team"));
type Kind = "real" | "demo" | "team";
const kindOf = (user: Doc<"users">): Kind => (user.isDemo ? "demo" : isTeamEmail(user.email) ? "team" : "real");

const vStage = v.union(
  v.literal("needs_verification"),
  v.literal("needs_about_you"),
  v.literal("needs_preferences"),
  v.literal("waiting_for_spotify"),
  v.literal("needs_spotify_connect"),
  v.literal("analyzing"),
  v.literal("needs_review"),
  v.literal("ready"),
);

const PAGE = 25;
const PAGE_MAX = 500;

// Every account, newest first, with where it is in onboarding and any seat it holds now.
export const list = query({
  args: {
    kind: v.optional(vKind),
    stage: v.optional(vStage),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    rows: v.array(
      v.object({
        userId: v.id("users"),
        firstName: v.union(v.string(), v.null()),
        email: v.union(v.string(), v.null()),
        kind: vKind,
        stage: v.union(vStage, v.null()),
        signedUpAt: v.number(),
        verified: v.boolean(),
        spotify: v.union(v.string(), v.null()),
        spotifyEmail: v.union(v.string(), v.null()),
        appLabel: v.union(v.string(), v.null()),
        seat: v.union(v.null(), v.object({ eventTitle: v.string(), seat: v.string(), planStatus: v.string() })),
        isYou: v.boolean(),
      }),
    ),
    total: v.number(),
    kinds: v.object({ real: v.number(), demo: v.number(), team: v.number() }),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").collect();
    const kinds = { real: 0, demo: 0, team: 0 };
    for (const user of users) kinds[kindOf(user)] += 1;
    const search = (args.search ?? "").trim().toLowerCase();
    const spotifyEmails = new Map((await ctx.db.query("spotifyAccess").collect()).map((row) => [row.userId, row.spotifyEmail]));
    const matching = users.filter((user) => {
      if (args.kind !== undefined && kindOf(user) !== args.kind) return false;
      if (args.stage !== undefined && user.onboarding !== args.stage) return false;
      if (search && !`${user.firstName ?? ""} ${user.email ?? ""} ${spotifyEmails.get(user._id) ?? ""}`.toLowerCase().includes(search)) return false;
      return true;
    });
    const limit = Math.min(Math.max(1, Math.floor(args.limit ?? PAGE)), PAGE_MAX);
    const rows = await Promise.all(
      matching.slice(0, limit).map(async (user) => {
        const access = await ctx.db
          .query("spotifyAccess")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .first();
        const held =
          (await ctx.db
            .query("meetupMembers")
            .withIndex("by_user_seat", (q) => q.eq("userId", user._id).eq("seat", "in"))
            .order("desc")
            .first()) ??
          (await ctx.db
            .query("meetupMembers")
            .withIndex("by_user_seat", (q) => q.eq("userId", user._id).eq("seat", "offered"))
            .first());
        const app = access?.spotifyAppId ? await ctx.db.get(access.spotifyAppId) : null;
        const plan = held ? await ctx.db.get(held.meetupId) : null;
        const event = plan ? await ctx.db.get(plan.eventId) : null;
        return {
          userId: user._id,
          firstName: user.firstName ?? null,
          email: user.email ?? null,
          kind: kindOf(user),
          stage: user.onboarding ?? null,
          signedUpAt: user._creationTime,
          verified: user.verifiedAt !== undefined,
          spotify: access ? adminStatus(access) : null,
          spotifyEmail: access?.spotifyEmail ?? null,
          appLabel: app?.label ?? null,
          seat: held && plan && event ? { eventTitle: event.title, seat: held.seat, planStatus: plan.status } : null,
          isYou: user._id === admin._id,
        };
      }),
    );
    return { rows, total: matching.length, kinds };
  },
});

async function deleteWhere<T extends TableNames>(ctx: MutationCtx, rows: Doc<T>[]) {
  for (const row of rows) await ctx.db.delete(row._id);
}

// Removes one account and everything tied to it. Any seat it holds is given up first, so a partner's
// plan reopens and refills as if the student had dropped. Plans left with nobody are deleted.
async function deleteUserData(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const user = await ctx.db.get(userId);
  if (user === null) return;
  await ctx.runMutation(internal.plans.release.forUser, { userId });

  const byUser = { userId };
  for (const table of ["preferences", "spotifyAccess", "spotifyTokens", "tasteSnapshots", "analysisJobs", "tasteProfiles"] as const) {
    await deleteWhere(ctx, await ctx.db.query(table).withIndex("by_userId", (q) => q.eq("userId", byUser.userId)).collect());
  }
  const asks = await ctx.db.query("asks").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  await deleteWhere(ctx, asks);
  await deleteWhere(ctx, await ctx.db.query("contactShares").withIndex("by_user_meetup", (q) => q.eq("userId", userId)).collect());
  await deleteWhere(ctx, (await ctx.db.query("helpNotes").collect()).filter((note) => note.userId === userId));

  const seats = await ctx.db.query("meetupMembers").withIndex("by_user_seat", (q) => q.eq("userId", userId)).collect();
  await deleteWhere(ctx, seats);
  for (const meetupId of new Set(seats.map((seat) => seat.meetupId))) {
    const left = await ctx.db.query("meetupMembers").withIndex("by_meetup", (q) => q.eq("meetupId", meetupId)).first();
    if (left !== null) continue;
    await deleteWhere(ctx, await ctx.db.query("contactShares").withIndex("by_meetup", (q) => q.eq("meetupId", meetupId)).collect());
    await ctx.db.delete(meetupId);
  }

  // Matcher logs name the student and what they shared; drop those decisions, a batch at a time.
  const eventIds = [...new Set(asks.map((ask) => ask.eventId))];
  if (eventIds.length > 0) await ctx.scheduler.runAfter(0, internal.admin.students.purgeDecisions, { userId, eventIds, cursor: null });

  // Convex Auth's records: sign-in accounts, their codes, sessions and refresh tokens.
  for (const account of await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", userId)).collect()) {
    await deleteWhere(ctx, await ctx.db.query("authVerificationCodes").withIndex("accountId", (q) => q.eq("accountId", account._id)).collect());
    await ctx.db.delete(account._id);
  }
  const sessions = await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId)).collect();
  const sessionIds = new Set(sessions.map((session) => session._id));
  if (sessionIds.size > 0) {
    // OAuth verifiers have no index by session; the table only holds short-lived rows.
    await deleteWhere(ctx, (await ctx.db.query("authVerifiers").collect()).filter((row) => row.sessionId !== undefined && sessionIds.has(row.sessionId)));
  }
  for (const session of sessions) {
    await deleteWhere(ctx, await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", session._id)).collect());
    await ctx.db.delete(session._id);
  }
  if (user.email) {
    await deleteWhere(ctx, await ctx.db.query("authRateLimits").withIndex("identifier", (q) => q.eq("identifier", user.email!)).collect());
  }
  await ctx.db.delete(userId);
}

const DECISION_BATCH = 50;

export const purgeDecisions = internalMutation({
  args: { userId: v.id("users"), eventIds: v.array(v.id("events")), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { userId, eventIds, cursor }): Promise<null> => {
    const [eventId, ...rest] = eventIds;
    if (eventId === undefined) return null;
    const page = await ctx.db
      .query("matchRuns")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .paginate({ numItems: DECISION_BATCH, cursor });
    for (const run of page.page) {
      if (!run.decisions.some((d) => d.a === userId || d.b === userId)) continue;
      await ctx.db.patch(run._id, { decisions: run.decisions.filter((d) => d.a !== userId && d.b !== userId) });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.admin.students.purgeDecisions, { userId, eventIds, cursor: page.continueCursor });
    } else if (rest.length > 0) {
      await ctx.scheduler.runAfter(0, internal.admin.students.purgeDecisions, { userId, eventIds: rest, cursor: null });
    }
    return null;
  },
});

// "Delete student": permanent, including your own account. That isn't a lockout: admin access comes
// from ADMIN_EMAILS, so signing in again with the same school email makes a fresh account that is
// still on the team. `deletedSelf` tells the page to sign out.
export const deleteStudent = mutation({
  args: { userId: v.id("users") },
  returns: v.object({ deletedSelf: v.boolean() }),
  handler: async (ctx, { userId }): Promise<{ deletedSelf: boolean }> => {
    const admin = await requireAdmin(ctx);
    const deletedSelf = userId === admin._id;
    if ((await ctx.db.get(userId)) === null) return { deletedSelf };
    await deleteUserData(ctx, userId);
    // Their Spotify slot is free now.
    await assignWaitingRequests(ctx);
    return { deletedSelf };
  },
});

// ---- Danger zone ----

const vScope = v.union(v.literal("students"), v.literal("events"), v.literal("everything"));
type Scope = "students" | "events" | "everything";

// The words the admin types to confirm, checked on the server too.
export const NUKE_PHRASES: Record<Scope, string> = {
  students: "delete all students",
  events: "delete all events",
  everything: "delete everything",
};

type Step = "students" | TableNames;
const EVENT_TABLES: TableNames[] = ["contactShares", "meetupMembers", "meetups", "asks", "matchRuns", "events", "eventImports"];
const STEPS: Record<Scope, Step[]> = {
  // Every account, team accounts included (the caller too), and its data, then the matcher logs.
  students: ["students", "matchRuns"],
  // Events and everything built on them: asks, plans, seats, shares and matcher logs. Venues and
  // meeting spots stay; they're a map cache with no student data.
  events: EVENT_TABLES,
  everything: [...EVENT_TABLES, "students", "helpNotes"],
};

const ROWS_PER_STEP = 400;
const USERS_PER_STEP = 10;

export const nuke = mutation({
  args: { scope: vScope, confirm: v.string() },
  returns: v.null(),
  handler: async (ctx, { scope, confirm }): Promise<null> => {
    const admin = await requireAdmin(ctx);
    if (confirm.trim().toLowerCase() !== NUKE_PHRASES[scope]) fail("validation_failed", `Type "${NUKE_PHRASES[scope]}" to confirm.`);
    console.warn(`Danger zone: ${admin.email ?? "team"} started "${NUKE_PHRASES[scope]}"`);
    if (scope === "everything") {
      const settings = await ctx.db.query("demoSettings").first();
      if (settings) await ctx.db.patch(settings._id, { clockOffsetMs: 0, updatedAt: Date.now(), updatedBy: admin.email ?? "team" });
    }
    await ctx.scheduler.runAfter(0, internal.admin.students.nukeStep, { scope, step: 0 });
    return null;
  },
});

// One bounded chunk of a danger zone wipe per transaction, rescheduling itself until every step is done.
export const nukeStep = internalMutation({
  args: { scope: vScope, step: v.number() },
  returns: v.null(),
  handler: async (ctx, { scope, step }): Promise<null> => {
    const name = STEPS[scope][step];
    if (name === undefined) return null;
    let more: boolean;
    if (name === "students") {
      // Every account, team ones too. The steps run with no session, so the caller losing theirs doesn't stop them.
      const users = await ctx.db.query("users").take(USERS_PER_STEP + 1);
      for (const user of users.slice(0, USERS_PER_STEP)) await deleteUserData(ctx, user._id);
      more = users.length > USERS_PER_STEP;
      if (!more) await assignWaitingRequests(ctx);
    } else {
      const rows = await ctx.db.query(name).take(ROWS_PER_STEP);
      for (const row of rows) await ctx.db.delete(row._id);
      more = rows.length === ROWS_PER_STEP;
    }
    await ctx.scheduler.runAfter(0, internal.admin.students.nukeStep, { scope, step: more ? step : step + 1 });
    return null;
  },
});

// Row counts for the danger zone, so the admin sees what a wipe would remove.
export const dangerCounts = query({
  args: {},
  returns: v.object({
    students: v.number(),
    teamAccounts: v.number(),
    events: v.number(),
    plans: v.number(),
    asks: v.number(),
    helpNotes: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return {
      students: users.filter((user) => kindOf(user) !== "team").length,
      teamAccounts: users.filter((user) => kindOf(user) === "team").length,
      events: (await ctx.db.query("events").collect()).length,
      plans: (await ctx.db.query("meetups").collect()).length,
      asks: (await ctx.db.query("asks").collect()).length,
      helpNotes: (await ctx.db.query("helpNotes").collect()).length,
    };
  },
});
