import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { notBuilt } from "./lib/errors";
import { vArea, vGenderSelf, vMeetWho, vYear } from "./lib/validators";
import { vAccessView } from "./lib/views";

// Stream A (onboarding) owns this file. Contract stubs: names and types are final; bodies come next.

// S02 → after sign-in: save the school picked on the device.
export const chooseSchool = mutation({
  args: { universityId: v.id("universities") },
  returns: v.null(),
  handler: async () => notBuilt("onboarding.chooseSchool"),
});

// S04: first name and Spotify email; creates the allow-list request and assigns an app.
export const saveAboutYou = mutation({
  args: { firstName: v.string(), spotifyEmail: v.string() },
  returns: v.null(),
  handler: async () => notBuilt("onboarding.saveAboutYou"),
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
  handler: async () => notBuilt("onboarding.savePreferences"),
});

// S05: "Surprise me" (CONFIRMED defaults in lib/config SURPRISE_ME).
export const surpriseMe = mutation({
  args: {},
  returns: v.null(),
  handler: async () => notBuilt("onboarding.surpriseMe"),
});

// S06: where the Spotify allow-list request stands.
export const access = query({
  args: {},
  returns: vAccessView,
  handler: async () => ({ status: "none" as const, refused: false }),
});
