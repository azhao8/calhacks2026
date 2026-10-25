import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { fail } from "./lib/errors";
import { vAnalysisView, vTasteView } from "./lib/views";
import { requireVerifiedUser } from "./lib/access";
import { confirmProfile, jobFor, profileFor, startJob, startRevision } from "./onboarding/analysis";

// Stream A (onboarding). S08 analysis and S09 taste review.
//
// analysis().error is null or one of: "too_little_data", "spotify_refused", "spotify_auth", "failed",
// "correction_failed" (see convex/onboarding/analysis.ts). While a "Not quite" revision runs, status is
// "summarizing"; when it lands, status is "done" and profile().revision goes up by one.

const MAX_CORRECTION = 500;

// S08: the analysis job's state (resumes on reload; never re-runs paid calls).
export const analysis = query({
  args: {},
  returns: vAnalysisView,
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const job = await jobFor(ctx, userId);
    if (job === null) return null;
    return {
      status: job.status,
      error: job.error ?? null,
      failure: job.status !== "failed" ? null : job.error === "too_little_data" ? ("too_little_data" as const) : ("other" as const),
    };
  },
});

// Starts the job, returns the running one, or retries a failed one. Safe to call on every visit to S08.
export const startAnalysis = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireVerifiedUser(ctx);
    const tokens = await ctx.db
      .query("spotifyTokens")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    const snapshot = await ctx.db
      .query("tasteSnapshots")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (tokens === null && snapshot === null) fail("spotify_not_ready", "Connect Spotify first.");
    if (user.onboarding === "needs_spotify_connect" || user.onboarding === "waiting_for_spotify") {
      if (tokens === null) fail("spotify_not_ready", "Connect Spotify first.");
      await ctx.db.patch(user._id, { onboarding: "analyzing" });
    }
    await startJob(ctx, user._id);
    return null;
  },
});

// S09: the summary to review. Never the snapshot, fingerprint, or vector.
export const profile = query({
  args: {},
  returns: vTasteView,
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const profile = await profileFor(ctx, userId);
    if (profile === null) return null;
    return {
      summary: profile.summary,
      artists: profile.artists,
      labels: profile.labels,
      revision: profile.revision,
      confirmed: profile.confirmedAt !== undefined,
    };
  },
});

// S09 "Not quite": the student's correction wins. The typed text is saved before the revision runs.
export const correct = mutation({
  args: { text: v.string() },
  returns: v.null(),
  handler: async (ctx, { text }) => {
    const user = await requireVerifiedUser(ctx);
    const correction = text.trim();
    if (correction.length === 0 || correction.length > MAX_CORRECTION) {
      fail("validation_failed", `Tell us what to change, up to ${MAX_CORRECTION} characters.`);
    }
    const profile = await profileFor(ctx, user._id);
    if (profile === null) fail("validation_failed", "Your summary isn't ready yet.");
    const job = await jobFor(ctx, user._id);
    if (job && (job.status === "summarizing" || job.status === "fetching" || job.status === "queued")) {
      fail("retryable", "We're still working on your summary.");
    }
    await ctx.db.patch(profile._id, { correction });
    await startRevision(ctx, user, profile);
    return null;
  },
});

// S09 "That's me": stores the taste vector, marks the student ready, starts the ask picker.
export const confirm = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireVerifiedUser(ctx);
    const profile = await profileFor(ctx, user._id);
    if (profile === null) fail("validation_failed", "Your summary isn't ready yet.");
    const job = await jobFor(ctx, user._id);
    if (job?.status === "summarizing") fail("retryable", "We're still working on your summary.");
    await confirmProfile(ctx, user._id);
    return null;
  },
});
