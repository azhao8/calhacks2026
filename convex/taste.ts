import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { notBuilt } from "./lib/errors";
import { vAnalysisView, vTasteView } from "./lib/views";

// Stream A (onboarding) owns this file. Contract stubs: names and types are final; bodies come next.

// S08: the analysis job's state (resumes on reload; never re-runs paid calls).
export const analysis = query({
  args: {},
  returns: vAnalysisView,
  handler: async () => null,
});

export const startAnalysis = mutation({
  args: {},
  returns: v.null(),
  handler: async () => notBuilt("taste.startAnalysis"),
});

// S09: the summary to review.
export const profile = query({
  args: {},
  returns: vTasteView,
  handler: async () => null,
});

// S09 "Not quite": the student's correction wins.
export const correct = mutation({
  args: { text: v.string() },
  returns: v.null(),
  handler: async () => notBuilt("taste.correct"),
});

// S09 "That's me": stores the taste vector, marks the student ready, starts the ask picker.
export const confirm = mutation({
  args: {},
  returns: v.null(),
  handler: async () => notBuilt("taste.confirm"),
});
