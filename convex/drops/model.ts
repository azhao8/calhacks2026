import type { Id } from "../_generated/dataModel";
import type { DatabaseReader, MutationCtx } from "../_generated/server";
import { notBuilt } from "../lib/errors";
import type { DropView, Reveal } from "./views";

// Skeleton: filled in by the full implementation.
export async function dropView(_db: DatabaseReader, _userId: Id<"users">): Promise<DropView> {
  return { kind: "none" };
}
export async function seeMoreEntry(_ctx: MutationCtx, _userId: Id<"users">): Promise<void> {
  notBuilt("drops.seeMore");
}
export async function passEntry(_ctx: MutationCtx, _userId: Id<"users">): Promise<void> {
  notBuilt("drops.passForever");
}
export async function acceptEntry(_ctx: MutationCtx, _userId: Id<"users">): Promise<void> {
  notBuilt("drops.accept");
}
export async function nextTimeEntry(_ctx: MutationCtx, _userId: Id<"users">): Promise<void> {
  notBuilt("drops.nextTime");
}
export async function revealFor(_db: DatabaseReader, _userId: Id<"users">, _meetupId: Id<"meetups">): Promise<Reveal> {
  return { steps: [] };
}
export async function markRevealed(_ctx: MutationCtx, _userId: Id<"users">, _meetupId: Id<"meetups">): Promise<void> {
  notBuilt("drops.revealed");
}
