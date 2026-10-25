import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { MODELS } from "../lib/config";
import { generateJson } from "../services/claude";
import { HOOK_SYSTEM, hookPrompt, hookSchema, templateHook, validateHook, type HookItem } from "../ai/hooks";
import { aiPool } from "../lib/pools";
import { itemSets, normalizeName } from "../matching/taste";
import { TASTE_LABELS } from "../ai/labels";

// Hooks and icebreakers for a pair (CLAUDE.md §6.4, §7): the template is written at once, then Claude's
// version replaces it if it validates and the pair hasn't changed in the meantime.

const vItem = v.object({
  kind: v.union(v.literal("artist"), v.literal("track"), v.literal("label")),
  name: v.string(),
});

async function pairKey(ctx: MutationCtx, meetupId: Id<"meetups">): Promise<{ key: string; userIds: Id<"users">[] }> {
  const seats = await ctx.db
    .query("meetupMembers")
    .withIndex("by_meetup", (q) => q.eq("meetupId", meetupId))
    .collect();
  const userIds = seats.filter((seat) => seat.seat !== "out").map((seat) => seat.userId);
  return { key: [...userIds].sort().join(","), userIds };
}

export async function setPairHook(ctx: MutationCtx, meetupId: Id<"meetups">, items: HookItem[]): Promise<void> {
  const template = templateHook(items);
  await ctx.db.patch(meetupId, { ...template, hookFromClaude: false });
  const plan = await ctx.db.get(meetupId);
  const event = plan ? await ctx.db.get(plan.eventId) : null;
  if (plan === null || event === null || items.length === 0) return;

  // Every artist and track either student has, plus every label on the fixed list, so the validator can
  // reject any name or genre the two don't share (a label neither has can't slip in either).
  const { key, userIds } = await pairKey(ctx, meetupId);
  const known = new Set<string>(TASTE_LABELS.map(normalizeName));
  for (const userId of userIds) {
    const profile = await ctx.db
      .query("tasteProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (profile === null) continue;
    const sets = itemSets(profile.fingerprint);
    // Labels too: a label only one of them has may not appear either.
    for (const name of [...sets.artist, ...sets.track, ...sets.label]) known.add(normalizeName(name));
    for (const name of profile.artists) known.add(normalizeName(name));
  }
  await aiPool.enqueueAction(
    ctx,
    internal.plans.hooks.generate,
    {
      meetupId,
      pairKey: key,
      items,
      known: [...known],
      event: { title: event.title, kind: event.kind, performers: event.performers },
    },
    { retry: false },
  );
}

// Sends Claude only shared item names and public event details (§7, §8.4).
export const generate = internalAction({
  args: {
    meetupId: v.id("meetups"),
    pairKey: v.string(),
    items: v.array(vItem),
    known: v.array(v.string()),
    event: v.object({ title: v.string(), kind: v.string(), performers: v.array(v.string()) }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let candidate: { hook: string; icebreaker: string };
    try {
      candidate = await generateJson({
        schema: hookSchema,
        system: HOOK_SYSTEM,
        prompt: hookPrompt(args.items, args.event),
        effort: MODELS.effort.hook,
        maxTokens: 2000,
      });
    } catch {
      return null; // The template stays (§8.3).
    }
    const valid = validateHook(candidate, args.items, new Set(args.known));
    if (valid === null) return null;
    await ctx.runMutation(internal.plans.hooks.apply, { meetupId: args.meetupId, pairKey: args.pairKey, ...valid });
    return null;
  },
});

export const apply = internalMutation({
  args: { meetupId: v.id("meetups"), pairKey: v.string(), hook: v.string(), icebreaker: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.meetupId);
    if (plan === null) return false;
    const { key } = await pairKey(ctx, args.meetupId);
    // The pair changed while Claude was writing: a newer hook is on its way.
    if (key !== args.pairKey) return false;
    await ctx.db.patch(args.meetupId, { hook: args.hook, icebreaker: args.icebreaker, hookFromClaude: true });
    return true;
  },
});
