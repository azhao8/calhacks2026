import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { vResultValidator } from "@convex-dev/workpool";
import { ANALYSIS } from "../lib/config";
import { vAnalysisStatus } from "../lib/validators";
import { summarizeTaste, reviseTaste, type TasteResult } from "../ai/taste";
import { embed } from "../services/voyage";
import { fetchListening, SpotifyAuthError, SpotifyRefusedError } from "../services/spotify";
import { aiPool } from "../lib/pools";
import { distinctArtistCount, fingerprint, tasteDocument, tasteInput, toSnapshotFields } from "./snapshot";
import { accessToken, markRefused } from "./tokens";

// The analysis job (S08): fetch Spotify → too-little-data check → Claude summary → S09 review.
// Every step checks saved state first, so a retry or a reload never repeats a paid call (§8.3).
//
// analysisJobs.error values the UI maps to copy:
//   "too_little_data"  fewer than 5 distinct artists; offer to try again later
//   "spotify_refused"  Spotify answered 403; the student is back on S06
//   "spotify_auth"     the Spotify connection stopped working; reconnect on S07
//   "failed"           anything else after retries; offer retry
//   "correction_failed" a "Not quite" revision failed; the typed correction is kept

export const JOB_ERRORS = ["too_little_data", "spotify_refused", "spotify_auth", "failed", "correction_failed"] as const;

const vListening = v.object({
  topArtists: v.array(
    v.object({
      spotifyId: v.string(),
      name: v.string(),
      genres: v.array(v.string()),
      rank: v.number(),
      range: v.union(v.literal("short_term"), v.literal("medium_term")),
    }),
  ),
  topTracks: v.array(
    v.object({
      spotifyId: v.string(),
      name: v.string(),
      artistNames: v.array(v.string()),
      rank: v.number(),
      range: v.union(v.literal("short_term"), v.literal("medium_term")),
    }),
  ),
  likedSongs: v.array(
    v.object({
      spotifyId: v.string(),
      name: v.string(),
      artistIds: v.array(v.string()),
      artistNames: v.array(v.string()),
    }),
  ),
});

export async function jobFor(ctx: { db: QueryCtx["db"] }, userId: Id<"users">) {
  return await ctx.db
    .query("analysisJobs")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

async function snapshotFor(ctx: { db: QueryCtx["db"] }, userId: Id<"users">) {
  return await ctx.db
    .query("tasteSnapshots")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

export async function profileFor(ctx: { db: QueryCtx["db"] }, userId: Id<"users">) {
  return await ctx.db
    .query("tasteProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

// Starts the job, or returns the existing one. A failed job restarts; a running or finished one never re-runs.
export async function startJob(ctx: MutationCtx, userId: Id<"users">): Promise<Id<"analysisJobs">> {
  const existing = await jobFor(ctx, userId);
  if (existing && existing.status !== "failed") return existing._id;
  const now = Date.now();
  let jobId: Id<"analysisJobs">;
  if (existing) {
    jobId = existing._id;
    await ctx.db.patch(jobId, {
      status: "queued",
      error: undefined,
      attempts: existing.attempts + 1,
      startedAt: now,
      finishedAt: undefined,
    });
  } else {
    jobId = await ctx.db.insert("analysisJobs", { userId, status: "queued", attempts: 1, startedAt: now });
  }
  await aiPool.enqueueAction(
    ctx,
    internal.onboarding.analysis.run,
    { jobId },
    { onComplete: internal.onboarding.analysis.runComplete, context: { jobId } },
  );
  return jobId;
}

export const jobState = internalQuery({
  args: { jobId: v.id("analysisJobs") },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      status: vAnalysisStatus,
      hasSnapshot: v.boolean(),
      hasProfile: v.boolean(),
    }),
  ),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (job === null) return null;
    return {
      userId: job.userId,
      status: job.status,
      hasSnapshot: (await snapshotFor(ctx, job.userId)) !== null,
      hasProfile: (await profileFor(ctx, job.userId)) !== null,
    };
  },
});

// A job may only keep going while it exists (disconnect deletes it), hasn't finished, and the student
// still has a Spotify connection, or is a demo student whose fixture snapshot stands in for one.
async function jobActive(ctx: { db: QueryCtx["db"] }, job: Doc<"analysisJobs"> | null): Promise<boolean> {
  if (job === null || job.status === "done" || job.status === "failed") return false;
  const tokens = await ctx.db
    .query("spotifyTokens")
    .withIndex("by_userId", (q) => q.eq("userId", job.userId))
    .first();
  if (tokens !== null) return true;
  const snapshot = await snapshotFor(ctx, job.userId);
  return snapshot?.source === "demo_fixture";
}

// Moves the job to its next step; false means stop now (for example, the student disconnected),
// so no Claude or Voyage call runs on data that should be gone.
export const setStatus = internalMutation({
  args: { jobId: v.id("analysisJobs"), status: vAnalysisStatus },
  returns: v.boolean(),
  handler: async (ctx, { jobId, status }) => {
    const job = await ctx.db.get(jobId);
    if (!(await jobActive(ctx, job))) return false;
    await ctx.db.patch(jobId, { status });
    return true;
  },
});

export const failJob = internalMutation({
  args: { jobId: v.id("analysisJobs"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { jobId, error }) => {
    const job = await ctx.db.get(jobId);
    if (job === null || job.status === "done") return null;
    await ctx.db.patch(jobId, { status: "failed", error, finishedAt: Date.now() });
    if (error === "spotify_auth") {
      // The stored connection no longer works (a rejected refresh token or a 401), so retrying can't help.
      // Drop the tokens and send the student back to S07 to connect again.
      const tokens = await ctx.db
        .query("spotifyTokens")
        .withIndex("by_userId", (q) => q.eq("userId", job.userId))
        .collect();
      for (const row of tokens) await ctx.db.delete(row._id);
      const user = await ctx.db.get(job.userId);
      if (user && user.onboarding !== "ready") await ctx.db.patch(job.userId, { onboarding: "needs_spotify_connect" });
    }
    if (error === "too_little_data") {
      // Never invent a taste. Drop the thin snapshot so "try again later" fetches fresh data.
      const snapshot = await snapshotFor(ctx, job.userId);
      if (snapshot) await ctx.db.delete(snapshot._id);
    }
    return null;
  },
});

// Stores the fetched listening data only if the job is still running and the student is still connected.
// A disconnect during the fetch deletes the job and tokens, so the late result is dropped, never stored.
export const saveSnapshot = internalMutation({
  args: { jobId: v.id("analysisJobs"), listening: vListening },
  returns: v.boolean(),
  handler: async (ctx, { jobId, listening }) => {
    const job = await ctx.db.get(jobId);
    if (job === null || !(await jobActive(ctx, job))) return false;
    const existing = await snapshotFor(ctx, job.userId);
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("tasteSnapshots", {
      userId: job.userId,
      source: "spotify",
      ...toSnapshotFields(listening),
      fetchedAt: Date.now(),
    });
    return true;
  },
});

// What Claude may see: names only (§7).
export const summaryInput = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      distinctArtists: v.number(),
      input: v.object({
        topArtists: v.array(v.string()),
        topTracks: v.array(v.string()),
        likedArtists: v.array(v.object({ name: v.string(), count: v.number() })),
        genres: v.array(v.string()),
      }),
    }),
  ),
  handler: async (ctx, { userId }) => {
    const snapshot = await snapshotFor(ctx, userId);
    if (snapshot === null) return null;
    return { distinctArtists: distinctArtistCount(snapshot), input: tasteInput(snapshot) };
  },
});

const vTasteResult = v.object({ summary: v.string(), labels: v.array(v.string()), artists: v.array(v.string()) });

export const saveProfile = internalMutation({
  args: { jobId: v.id("analysisJobs"), result: vTasteResult },
  returns: v.null(),
  handler: async (ctx, { jobId, result }) => {
    const job = await ctx.db.get(jobId);
    if (job === null || !(await jobActive(ctx, job))) return null; // disconnected meanwhile
    const snapshot = await snapshotFor(ctx, job.userId);
    if (snapshot === null) return null;
    if ((await profileFor(ctx, job.userId)) === null) {
      await ctx.db.insert("tasteProfiles", {
        userId: job.userId,
        ...result,
        revision: 0,
        fingerprint: fingerprint(snapshot, result.labels),
      });
    }
    await finish(ctx, job);
    return null;
  },
});

export const finishJob = internalMutation({
  args: { jobId: v.id("analysisJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (job) await finish(ctx, job);
    return null;
  },
});

async function finish(ctx: MutationCtx, job: Doc<"analysisJobs">) {
  await ctx.db.patch(job._id, { status: "done", error: undefined, finishedAt: Date.now() });
  const user = await ctx.db.get(job.userId);
  if (user?.onboarding === "analyzing") await ctx.db.patch(job.userId, { onboarding: "needs_review" });
  // Demo students have nobody to review their summary, so they confirm it the way a student would (§6.7).
  if (user?.isDemo === true) await confirmProfile(ctx, job.userId);
}

export const run = internalAction({
  args: { jobId: v.id("analysisJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const state = await ctx.runQuery(internal.onboarding.analysis.jobState, { jobId });
    if (state === null || state.status === "done" || state.status === "failed") return null;
    const { userId } = state;

    if (!state.hasSnapshot) {
      if (!(await ctx.runMutation(internal.onboarding.analysis.setStatus, { jobId, status: "fetching" }))) return null;
      try {
        const token = await accessToken(ctx, userId);
        const listening = await fetchListening(token);
        if (!(await ctx.runMutation(internal.onboarding.analysis.saveSnapshot, { jobId, listening }))) return null;
      } catch (error) {
        if (error instanceof SpotifyRefusedError) {
          await markRefused(ctx, userId);
          await ctx.runMutation(internal.onboarding.analysis.failJob, { jobId, error: "spotify_refused" });
          return null;
        }
        if (error instanceof SpotifyAuthError) {
          await ctx.runMutation(internal.onboarding.analysis.failJob, { jobId, error: "spotify_auth" });
          return null;
        }
        throw error; // retried by the pool
      }
    }

    const summary = await ctx.runQuery(internal.onboarding.analysis.summaryInput, { userId });
    if (summary === null) return null; // disconnected meanwhile
    if (summary.distinctArtists < ANALYSIS.minDistinctArtists) {
      await ctx.runMutation(internal.onboarding.analysis.failJob, { jobId, error: "too_little_data" });
      return null;
    }

    if (!state.hasProfile) {
      // Checked right before the paid call: stop if the student disconnected meanwhile.
      if (!(await ctx.runMutation(internal.onboarding.analysis.setStatus, { jobId, status: "summarizing" }))) return null;
      const result: TasteResult = await summarizeTaste(summary.input);
      await ctx.runMutation(internal.onboarding.analysis.saveProfile, { jobId, result });
    } else {
      await ctx.runMutation(internal.onboarding.analysis.finishJob, { jobId });
    }
    return null;
  },
});

// After the pool's last retry: a job that didn't finish fails with a retry offer.
export const runComplete = internalMutation({
  args: { workId: v.string(), context: v.object({ jobId: v.id("analysisJobs") }), result: vResultValidator },
  returns: v.null(),
  handler: async (ctx, { context, result }) => {
    if (result.kind === "success") return null;
    const job = await ctx.db.get(context.jobId);
    if (job && job.status !== "done" && job.status !== "failed") {
      await ctx.db.patch(job._id, { status: "failed", error: "failed", finishedAt: Date.now() });
    }
    return null;
  },
});

// Demo students (stream C) reuse the whole pipeline: their generated listening data stands in for the
// Spotify fetch, then the same Claude summary runs. Call with an isDemo user; returns the job.
export const analyzeFixture = internalMutation({
  args: { userId: v.id("users"), listening: vListening },
  returns: v.id("analysisJobs"),
  handler: async (ctx, { userId, listening }) => {
    const existing = await snapshotFor(ctx, userId);
    if (existing === null) {
      await ctx.db.insert("tasteSnapshots", {
        userId,
        source: "demo_fixture",
        ...toSnapshotFields(listening),
        fetchedAt: Date.now(),
      });
    }
    const user = await ctx.db.get(userId);
    if (user && (user.onboarding === undefined || user.onboarding === "needs_spotify_connect")) {
      await ctx.db.patch(userId, { onboarding: "analyzing" });
    }
    return await startJob(ctx, userId);
  },
});

// "Not quite" (S09): revise the summary with the student's correction, which wins.
export async function startRevision(ctx: MutationCtx, user: Doc<"users">, profile: Doc<"tasteProfiles">) {
  const job = await jobFor(ctx, user._id);
  const now = Date.now();
  if (job) {
    await ctx.db.patch(job._id, { status: "summarizing", error: undefined, startedAt: now, finishedAt: undefined });
  } else {
    await ctx.db.insert("analysisJobs", { userId: user._id, status: "summarizing", attempts: 1, startedAt: now });
  }
  await aiPool.enqueueAction(
    ctx,
    internal.onboarding.analysis.revise,
    { profileId: profile._id, revision: profile.revision },
    { onComplete: internal.onboarding.analysis.reviseComplete, context: { userId: user._id } },
  );
}

export const reviseInput = internalQuery({
  args: { profileId: v.id("tasteProfiles") },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      revision: v.number(),
      summary: v.string(),
      labels: v.array(v.string()),
      correction: v.string(),
    }),
  ),
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (profile === null || profile.correction === undefined) return null;
    return {
      userId: profile.userId,
      revision: profile.revision,
      summary: profile.summary,
      labels: profile.labels,
      correction: profile.correction,
    };
  },
});

export const revise = internalAction({
  args: { profileId: v.id("tasteProfiles"), revision: v.number() },
  returns: v.null(),
  handler: async (ctx, { profileId, revision }) => {
    const current = await ctx.runQuery(internal.onboarding.analysis.reviseInput, { profileId });
    if (current === null || current.revision !== revision) return null; // already revised, or disconnected
    const summary = await ctx.runQuery(internal.onboarding.analysis.summaryInput, { userId: current.userId });
    if (summary === null) return null;
    const result = await reviseTaste(summary.input, current, current.correction);
    await ctx.runMutation(internal.onboarding.analysis.saveRevision, { profileId, revision, result });
    return null;
  },
});

export const saveRevision = internalMutation({
  args: { profileId: v.id("tasteProfiles"), revision: v.number(), result: vTasteResult },
  returns: v.null(),
  handler: async (ctx, { profileId, revision, result }) => {
    const profile = await ctx.db.get(profileId);
    if (profile === null || profile.revision !== revision) return null;
    await ctx.db.patch(profileId, {
      ...result,
      revision: revision + 1,
      confirmedAt: undefined,
      // The old vector no longer matches; confirming this revision embeds it again.
      embedding: undefined,
      fingerprint: { ...profile.fingerprint, labels: [...new Set(result.labels)].sort() },
    });
    const job = await jobFor(ctx, profile.userId);
    if (job) await ctx.db.patch(job._id, { status: "done", error: undefined, finishedAt: Date.now() });
    return null;
  },
});

export const reviseComplete = internalMutation({
  args: { workId: v.string(), context: v.object({ userId: v.id("users") }), result: vResultValidator },
  returns: v.null(),
  handler: async (ctx, { context, result }) => {
    if (result.kind === "success") return null;
    const job = await jobFor(ctx, context.userId);
    if (job && job.status === "summarizing") {
      await ctx.db.patch(job._id, { status: "failed", error: "correction_failed", finishedAt: Date.now() });
    }
    return null;
  },
});

// "That's me" (S09): confirm the current revision, mark the student ready, and embed the taste document.
// Idempotent per revision: a repeated tap never queues a second Voyage call while one is queued or done.
// A revision whose embedding failed has no vector and no embedding in flight, so confirming again retries it.
export async function confirmProfile(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const profile = await profileFor(ctx, userId);
  if (profile === null) throw new Error("No taste profile to confirm");
  const user = await ctx.db.get(userId);
  if (user && user.onboarding !== "ready") await ctx.db.patch(userId, { onboarding: "ready" });
  const job = await jobFor(ctx, userId);
  const embedded = profile.embedding !== undefined;
  const queued = job?.status === "embedding";
  if (profile.confirmedAt !== undefined && (embedded || queued)) return;
  if (profile.confirmedAt === undefined) await ctx.db.patch(profile._id, { confirmedAt: Date.now() });
  if (job) await ctx.db.patch(job._id, { status: "embedding", error: undefined });
  await aiPool.enqueueAction(
    ctx,
    internal.onboarding.analysis.embedTaste,
    { profileId: profile._id, revision: profile.revision },
    { onComplete: internal.onboarding.analysis.embedComplete, context: { userId } },
  );
}

// Demo students (stream C) confirm their summary through the same path.
export const confirmForUser = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    await confirmProfile(ctx, userId);
    return null;
  },
});

export const embedInput = internalQuery({
  args: { profileId: v.id("tasteProfiles") },
  returns: v.union(v.null(), v.object({ revision: v.number(), document: v.string() })),
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (profile === null) return null;
    const snapshot = await snapshotFor(ctx, profile.userId);
    return { revision: profile.revision, document: tasteDocument(profile, snapshot) };
  },
});

export const embedTaste = internalAction({
  args: { profileId: v.id("tasteProfiles"), revision: v.number() },
  returns: v.null(),
  handler: async (ctx, { profileId, revision }) => {
    const input = await ctx.runQuery(internal.onboarding.analysis.embedInput, { profileId });
    if (input === null || input.revision !== revision) return null;
    const [embedding] = await embed([input.document], "query");
    await ctx.runMutation(internal.onboarding.analysis.saveEmbedding, { profileId, revision, embedding });
    return null;
  },
});

export const saveEmbedding = internalMutation({
  args: { profileId: v.id("tasteProfiles"), revision: v.number(), embedding: v.array(v.float64()) },
  returns: v.null(),
  handler: async (ctx, { profileId, revision, embedding }) => {
    const profile = await ctx.db.get(profileId);
    if (profile === null || profile.revision !== revision) return null;
    await ctx.db.patch(profileId, { embedding });
    return null;
  },
});

// Whether or not Voyage succeeded (until it does, the student is matched on exact shared items),
// the student is ready: pick their first asks.
export const embedComplete = internalMutation({
  args: { workId: v.string(), context: v.object({ userId: v.id("users") }), result: vResultValidator },
  returns: v.null(),
  handler: async (ctx, { context }) => {
    const job = await jobFor(ctx, context.userId);
    if (job?.status === "embedding") {
      await ctx.db.patch(job._id, { status: "done", finishedAt: Date.now() });
    }
    const user = await ctx.db.get(context.userId);
    if (user?.onboarding !== "ready") return null;
    await ctx.scheduler.runAfter(0, internal.asks.picker.pickForUser, { userId: context.userId });
    return null;
  },
});
