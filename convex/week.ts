import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { notBuilt } from "./lib/errors";
import { vWeekCard } from "./lib/views";

// Stream C (matching) owns this file. Contract stubs: names and types are final; bodies come next.

// S10: up to 3 "Can you make it?" cards; no event details.
export const mine = query({
  args: {},
  returns: v.array(vWeekCard),
  handler: async () => [],
});

// S10: "I can make it" (yes) or taking it back (no). A yes wakes the matcher.
export const answer = mutation({
  args: { askId: v.id("asks"), answer: v.union(v.literal("yes"), v.literal("no")) },
  returns: v.null(),
  handler: async () => notBuilt("week.answer"),
});
