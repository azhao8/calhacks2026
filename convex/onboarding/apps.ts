import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export type AppUsage = { app: Doc<"spotifyApps">; used: number };

// Every access row assigned to an app holds one of its slots: requested ones are about to be added,
// and revoked ones stay on the Spotify allow-list until the owner removes them (§8.9).
export async function appUsage(ctx: QueryCtx): Promise<AppUsage[]> {
  const apps = await ctx.db.query("spotifyApps").collect();
  return await Promise.all(
    apps.map(async (app) => {
      const rows = await ctx.db
        .query("spotifyAccess")
        .withIndex("by_app", (q) => q.eq("spotifyAppId", app._id))
        .collect();
      return { app, used: rows.length };
    }),
  );
}

// The active app with the most free slots; ties go to the oldest app so assignment is deterministic.
export async function pickApp(ctx: QueryCtx): Promise<Id<"spotifyApps"> | null> {
  const usage = (await appUsage(ctx))
    .filter(({ app, used }) => app.active && used < app.capacity)
    .sort((a, b) => b.app.capacity - b.used - (a.app.capacity - a.used) || a.app._creationTime - b.app._creationTime);
  return usage[0]?.app._id ?? null;
}

export async function accessFor(ctx: QueryCtx, userId: Id<"users">): Promise<Doc<"spotifyAccess"> | null> {
  return await ctx.db
    .query("spotifyAccess")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

// Requests that arrived while every app was full get an app as soon as one has room.
export async function assignWaitingRequests(ctx: MutationCtx): Promise<number> {
  const waiting = (await ctx.db.query("spotifyAccess").withIndex("by_app", (q) => q.eq("spotifyAppId", undefined)).collect())
    .filter((row) => row.status === "requested")
    .sort((a, b) => a.requestedAt - b.requestedAt);
  let assigned = 0;
  for (const row of waiting) {
    const appId = await pickApp(ctx);
    if (appId === null) break;
    await ctx.db.patch(row._id, { spotifyAppId: appId });
    assigned += 1;
  }
  return assigned;
}
