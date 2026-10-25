import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { notBuilt } from "./lib/errors";
import { vShareKind } from "./lib/validators";
import { vContactView, vMySharesView } from "./lib/views";

// Stream C (matching) owns this file. Contract stubs: names and types are final; bodies come next.

// S14: share a phone number or Instagram handle with the partner. Opt-in per plan.
export const share = mutation({
  args: { meetupId: v.id("meetups"), kind: vShareKind, value: v.string() },
  returns: v.null(),
  handler: async () => notBuilt("contacts.share"),
});

export const stopSharing = mutation({
  args: { meetupId: v.id("meetups"), kind: vShareKind },
  returns: v.null(),
  handler: async () => notBuilt("contacts.stopSharing"),
});

// S14: what I've shared in this plan.
export const myShares = query({
  args: { meetupId: v.id("meetups") },
  returns: vMySharesView,
  handler: async () => ({ phone: null, instagram: null }),
});

// S15: values volunteered to me by eligible partners only.
export const list = query({
  args: {},
  returns: v.array(vContactView),
  handler: async () => [],
});
