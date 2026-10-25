import type { AnalysisView } from "./views";

// Where a "Not quite" correction stands on S09. The revision runs as the analysis job: on this
// screen "summarizing" means the summary is being rewritten, and a failed job with
// "correction_failed" means the rewrite failed (the server keeps the student's correction).
export type RevisionState = "idle" | "rewriting" | "failed" | "revised";

export function revisionState(job: AnalysisView | undefined, sentRevision: number | null, revision: number): RevisionState {
  if (sentRevision !== null && revision > sentRevision) return "revised";
  if (job?.status === "summarizing") return "rewriting";
  if (job?.status === "failed" && job.error === "correction_failed") return "failed";
  return "idle";
}
