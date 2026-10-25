import type { DatabaseReader, MutationCtx } from "../_generated/server";
import { notBuilt } from "../lib/errors";
import type { Infer } from "convex/values";
import type { vAdminDropStatus } from "./views";

// Skeleton: filled in by the full implementation.
export async function adminStatus(_db: DatabaseReader): Promise<Infer<typeof vAdminDropStatus>> {
  return { drop: null };
}
export async function startDrop(_ctx: MutationCtx, _by: string): Promise<void> {
  notBuilt("admin.drops.start");
}
export async function requestEndChoosing(_ctx: MutationCtx): Promise<void> {
  notBuilt("admin.drops.endChoosing");
}
export async function requestMatchNow(_ctx: MutationCtx): Promise<void> {
  notBuilt("admin.drops.matchNow");
}
