import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUserId } from "./lib/access";
import { fail } from "./lib/errors";
import { dayLabel } from "./lib/format";
import { vShareKind } from "./lib/validators";
import { vContactView, vMySharesView } from "./lib/views";

// Stream C (matching) owns this file. Stay in touch (S14) and Contacts (S15).
// Eligibility: both people were in the plan at the meeting time; leaving after it keeps access.
// Values nobody shared are absent from every response.

type Eligible = { plan: Doc<"meetups">; mySeat: Doc<"meetupMembers">; partnerSeat: Doc<"meetupMembers"> };

async function eligibility(ctx: QueryCtx, userId: Id<"users">, meetupId: Id<"meetups">): Promise<Eligible | null> {
  const plan = await ctx.db.get(meetupId);
  if (plan === null || plan.meetingStartedAt === undefined) return null;
  const seats = await ctx.db
    .query("meetupMembers")
    .withIndex("by_meetup", (q) => q.eq("meetupId", meetupId))
    .collect();
  const inSeats = seats.filter((seat) => seat.seat === "in");
  const mySeat = inSeats.find((seat) => seat.userId === userId);
  const partnerSeat = inSeats.find((seat) => seat.userId !== userId);
  if (mySeat === undefined || partnerSeat === undefined || inSeats.length !== 2) return null;
  return { plan, mySeat, partnerSeat };
}

async function activeShares(ctx: QueryCtx, userId: Id<"users">, meetupId: Id<"meetups">) {
  const shares = await ctx.db
    .query("contactShares")
    .withIndex("by_user_meetup", (q) => q.eq("userId", userId).eq("meetupId", meetupId))
    .collect();
  return shares.filter((share) => share.revokedAt === undefined);
}

// Format checks only: Melos never claims a number or handle is verified.
export function normalizeShare(kind: "phone" | "instagram", raw: string): string | null {
  const value = raw.trim();
  if (kind === "phone") {
    if (!/^\+?[\d\s().-]+$/.test(value)) return null;
    const digits = value.replace(/\D/g, "");
    const international = value.startsWith("+");
    if (!international && digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits.startsWith("1")) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (international && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
    return null;
  }
  const handle = value.replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle) || handle.startsWith(".") || handle.endsWith(".") || handle.includes("..")) {
    return null;
  }
  return `@${handle}`;
}

// S14: share a phone number or Instagram handle with the partner. Opt-in per plan.
export const share = mutation({
  args: { meetupId: v.id("meetups"), kind: vShareKind, value: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if ((await eligibility(ctx, userId, args.meetupId)) === null) fail("forbidden");
    const value = normalizeShare(args.kind, args.value);
    if (value === null) fail("validation_failed", args.kind === "phone" ? "Check the phone number" : "Check the handle");
    const existing = (await activeShares(ctx, userId, args.meetupId)).filter((share) => share.kind === args.kind);
    const now = Date.now();
    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, { value, sharedAt: now });
      for (const extra of existing.slice(1)) await ctx.db.patch(extra._id, { revokedAt: now });
    } else {
      await ctx.db.insert("contactShares", { meetupId: args.meetupId, userId, kind: args.kind, value, sharedAt: now });
    }
    return null;
  },
});

// Removes future visibility in Melos; it can't remove copies someone already saved.
export const stopSharing = mutation({
  args: { meetupId: v.id("meetups"), kind: vShareKind },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    for (const share of await activeShares(ctx, userId, args.meetupId)) {
      if (share.kind === args.kind) await ctx.db.patch(share._id, { revokedAt: now });
    }
    return null;
  },
});

// S14: what I've shared in this plan.
export const myShares = query({
  args: { meetupId: v.id("meetups") },
  returns: vMySharesView,
  handler: async (ctx, { meetupId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { phone: null, instagram: null };
    const shares = await activeShares(ctx, userId, meetupId);
    return {
      phone: shares.find((share) => share.kind === "phone")?.value ?? null,
      instagram: shares.find((share) => share.kind === "instagram")?.value ?? null,
    };
  },
});

// S15: values volunteered to me by eligible partners only.
export const list = query({
  args: {},
  returns: v.array(vContactView),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const mySeats = await ctx.db
      .query("meetupMembers")
      .withIndex("by_user_seat", (q) => q.eq("userId", userId).eq("seat", "in"))
      .collect();
    const contacts = [];
    for (const seat of mySeats) {
      const eligible = await eligibility(ctx, userId, seat.meetupId);
      if (eligible === null) continue;
      const shares = await activeShares(ctx, eligible.partnerSeat.userId, seat.meetupId);
      if (shares.length === 0) continue;
      const partner = await ctx.db.get(eligible.partnerSeat.userId);
      const event = await ctx.db.get(eligible.plan.eventId);
      if (partner === null || event === null) continue;
      contacts.push({
        meetupId: seat.meetupId,
        firstName: partner.firstName ?? "",
        eventTitle: event.title,
        dayLabel: dayLabel(event.startsAt),
        shares: shares
          .sort((a, b) => a.kind.localeCompare(b.kind))
          .map((share) => ({ kind: share.kind, value: share.value })),
        startsAt: event.startsAt,
      });
    }
    return contacts
      .sort((a, b) => b.startsAt - a.startsAt)
      .map((contact) => ({
        meetupId: contact.meetupId,
        firstName: contact.firstName,
        eventTitle: contact.eventTitle,
        dayLabel: contact.dayLabel,
        shares: contact.shares,
      }));
  },
});
