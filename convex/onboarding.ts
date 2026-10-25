import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { fail } from "./lib/errors";
import { normalizeEmail } from "./lib/edu";
import { SURPRISE_ME } from "./lib/config";
import { vArea, vGenderSelf, vMeetWho, vYear } from "./lib/validators";
import { vAccessView, vPreferencesView } from "./lib/views";
import { requireVerifiedUser } from "./onboarding/guard";
import { accessFor, pickApp } from "./onboarding/apps";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// Stream A (onboarding). The onboarding state machine lives here and in convex/onboarding/ (§8.6).

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// S02 → after sign-in: save the school picked on the device. Only open schools can be chosen.
export const chooseSchool = mutation({
  args: { universityId: v.id("universities") },
  returns: v.null(),
  handler: async (ctx, { universityId }) => {
    const user = await requireVerifiedUser(ctx);
    const school = await ctx.db.get(universityId);
    if (school === null || school.status !== "open") fail("validation_failed", "That school isn't open yet.");
    await ctx.db.patch(user._id, { universityId });
    return null;
  },
});

// S04: first name and Spotify email; creates the allow-list request and assigns an app.
export const saveAboutYou = mutation({
  args: { firstName: v.string(), spotifyEmail: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireVerifiedUser(ctx);
    const firstName = args.firstName.trim().replace(/\s+/g, " ");
    const spotifyEmail = normalizeEmail(args.spotifyEmail);
    if (firstName.length === 0 || firstName.length > 40) {
      fail("validation_failed", "Add your first name, up to 40 characters.");
    }
    if (!EMAIL_SHAPE.test(spotifyEmail) || spotifyEmail.length > 254) {
      fail("validation_failed", "That doesn't look like an email address.");
    }

    const access = await accessFor(ctx, user._id);
    if (access === null) {
      await ctx.db.insert("spotifyAccess", {
        userId: user._id,
        spotifyEmail,
        spotifyAppId: (await pickApp(ctx)) ?? undefined,
        status: "requested",
        requestedAt: Date.now(),
      });
    } else if (access.spotifyEmail !== spotifyEmail) {
      if (access.status === "connected") {
        fail("validation_failed", "Disconnect Spotify before changing its email.");
      }
      // A new address needs the app owner to add it again.
      await ctx.db.patch(access._id, {
        spotifyEmail,
        status: "requested",
        requestedAt: Date.now(),
        spotifyAppId: access.spotifyAppId ?? (await pickApp(ctx)) ?? undefined,
        allowlistedAt: undefined,
        allowlistedBy: undefined,
        refusedAt: undefined,
      });
      if (user.onboarding === "needs_spotify_connect") {
        await ctx.db.patch(user._id, { onboarding: "waiting_for_spotify" });
      }
    } else if (access.spotifyAppId === undefined) {
      const appId = await pickApp(ctx);
      if (appId !== null) await ctx.db.patch(access._id, { spotifyAppId: appId });
    }

    await ctx.db.patch(user._id, {
      firstName,
      ...(user.onboarding === "needs_about_you" || user.onboarding === "needs_verification"
        ? { onboarding: "needs_preferences" as const }
        : {}),
    });
    return null;
  },
});

// S05: custom preferences.
export const savePreferences = mutation({
  args: {
    maxTicketPrice: v.union(v.number(), v.null()),
    meetWho: vMeetWho,
    gender: v.optional(vGenderSelf),
    year: v.optional(vYear),
    prefersSimilarYear: v.boolean(),
    area: vArea,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireVerifiedUser(ctx);
    if (args.maxTicketPrice !== null && (!Number.isInteger(args.maxTicketPrice) || args.maxTicketPrice < 0)) {
      fail("validation_failed", "Budget is a whole number of dollars.");
    }
    if (Array.isArray(args.meetWho) && args.meetWho.length === 0) {
      fail("validation_failed", "Pick who you'd like to meet, or anyone.");
    }
    const meetWho = Array.isArray(args.meetWho) ? [...new Set(args.meetWho)].sort() : args.meetWho;
    await writePreferences(ctx, user, {
      maxTicketPrice: args.maxTicketPrice,
      meetWho,
      area: args.area,
      prefersSimilarYear: args.prefersSimilarYear,
      source: "custom",
    });
    await ctx.db.patch(user._id, { gender: args.gender, year: args.year });
    return null;
  },
});

// S05: "Surprise me" (CONFIRMED defaults: up to $25, anyone, Berkeley and Oakland, any year).
export const surpriseMe = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireVerifiedUser(ctx);
    await writePreferences(ctx, user, {
      maxTicketPrice: SURPRISE_ME.maxTicketPrice,
      meetWho: SURPRISE_ME.meetWho,
      area: SURPRISE_ME.area,
      prefersSimilarYear: SURPRISE_ME.prefersSimilarYear,
      source: "surprise_me",
    });
    return null;
  },
});

// S06: where the Spotify allow-list request stands.
export const access = query({
  args: {},
  returns: vAccessView,
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { status: "none" as const, refused: false, spotifyEmail: null };
    const row = await accessFor(ctx, userId);
    if (row === null) return { status: "none" as const, refused: false, spotifyEmail: null };
    if (row.status === "requested" && row.spotifyAppId === undefined) {
      return { status: "no_capacity" as const, refused: false, spotifyEmail: row.spotifyEmail };
    }
    return {
      status: row.status,
      refused: row.status === "requested" && row.refusedAt !== undefined,
      spotifyEmail: row.spotifyEmail,
    };
  },
});

// S05 from the menu: the saved answers, or null before any are saved. The student's own record only.
export const preferences = query({
  args: {},
  returns: vPreferencesView,
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    const prefs = await ctx.db
      .query("preferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (user === null || prefs === null) return null;
    return {
      maxTicketPrice: prefs.maxTicketPrice,
      meetWho: prefs.meetWho,
      gender: user.gender ?? null,
      year: user.year ?? null,
      prefersSimilarYear: prefs.prefersSimilarYear,
      area: prefs.area,
      source: prefs.source,
    };
  },
});

type PreferencesFields = Omit<Doc<"preferences">, "_id" | "_creationTime" | "userId">;

// Saving preferences moves onboarding past S05: to S07 when the app owner already added the student
// (S06 is skipped), otherwise to S06. Later changes apply to future asks only.
async function writePreferences(ctx: MutationCtx, user: Doc<"users">, fields: PreferencesFields) {
  if (user.onboarding === "needs_about_you" || user.onboarding === "needs_verification") {
    fail("validation_failed", "Tell us your name first.");
  }
  const existing = await ctx.db
    .query("preferences")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .first();
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("preferences", { userId: user._id, ...fields });

  if (user.onboarding === "needs_preferences") {
    const row = await accessFor(ctx, user._id);
    const added = row !== null && (row.status === "allowlisted" || row.status === "revoked");
    await ctx.db.patch(user._id, { onboarding: added ? "needs_spotify_connect" : "waiting_for_spotify" });
  }
}
