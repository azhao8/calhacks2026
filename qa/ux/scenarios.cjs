/* eslint-disable @typescript-eslint/no-require-imports -- plain Node scripts run outside the app build */
// Every student screen in every meaningful state. Each scenario is a path plus the data its live
// queries return. `variants` adds extra renders: text200 (200% text), w320 (320px wide),
// offline (the browser's offline signal after load), reduced (prefers-reduced-motion).

const { MockConvex } = require("./mock-convex.cjs");
const F = require("./fixtures.cjs");

const hold = MockConvex.hold;
const fail = MockConvex.fail;
const ALL = ["text200", "w320"];

const ready = (over = {}) => ({
  "me:get": F.me("ready"),
  "schools:list": F.schools,
  "plans:current": null,
  "week:mine": F.week3,
  "onboarding:access": F.access.connected,
  "onboarding:preferences": F.preferencesCustom,
  "taste:profile": { ...F.taste, confirmed: true },
  "contacts:list": F.contacts.one,
  "contacts:myShares": { phone: null, instagram: null },
  "contacts:mine": [{ meetupId: "meetup_1", partnerFirstName: "Maya", kind: "phone", value: "+15105550123" }],
  "contacts:shareable": [],
  ...over,
});
const onboarding = (state, over = {}) => ({ ...ready(), "me:get": F.me(state), "plans:current": null, ...over });
const visitor = (over = {}) => ({ "me:get": null, "schools:list": F.schools, ...over });

const T0 = Date.now();
const DROP_EVENT = { title: "Indie folk night", venue: "The UC Theatre", startsAt: Date.UTC(2026, 9, 30, 3, 0), price: "$18 to $25", kind: "concert" };
const DROP = {
  none: { kind: "none" },
  choosing: { kind: "choosing", phase: "choosing", endsAt: T0 + 2 * 3600e3, card: { startsAt: Date.UTC(2026, 9, 30, 3, 0), price: "$18 to $25" } },
  deciding: { kind: "deciding", phase: "choosing", endsAt: T0 + 2 * 3600e3, acceptBy: T0 + 24 * 3600e3 - 1000, event: DROP_EVENT },
  accepted: { kind: "accepted", phase: "confirming", endsAt: T0 + 3600e3, matchAt: Date.UTC(2026, 9, 26, 12, 30), event: DROP_EVENT },
  done: { kind: "done", phase: "confirming", endsAt: T0 + 45 * 60e3 },
};

const scenarios = [
  // S01 Welcome
  { id: "s01-welcome", screen: "S01 Welcome", path: "/", data: visitor(), variants: [...ALL, "reduced"] },
  { id: "s01-loading", screen: "S01 Welcome", path: "/", data: visitor({ "me:get": hold }) },
  { id: "s01-error", screen: "S01 Welcome", path: "/", data: visitor({ "me:get": fail("retryable") }) },
  // S02 School
  { id: "s02-school", screen: "S02 School", path: "/school", data: visitor(), variants: ALL },
  { id: "s02-school-loading", screen: "S02 School", path: "/school", data: visitor({ "schools:list": hold }) },
  { id: "s02-school-empty", screen: "S02 School", path: "/school", data: visitor({ "schools:list": [] }) },
  { id: "s02-school-offline", screen: "S02 School", path: "/school", data: visitor(), variants: ["offline"] },
  { id: "s02-school-signed-in", screen: "S02 School", path: "/school", data: onboarding("needs_about_you", { "me:get": F.me("needs_about_you", { school: null }) }) },
  // S03 Verify email
  { id: "s03-email", screen: "S03 Verify email", path: "/sign-up", data: visitor(), variants: [...ALL, "offline"] },
  { id: "s03-sign-in", screen: "S03 Sign in", path: "/sign-in", data: visitor() },
  { id: "s03-sign-in-code", screen: "S03 Sign in", path: "/sign-in", data: visitor(), script: "signInCode" },
  { id: "s03-email-invalid", screen: "S03 Verify email", path: "/sign-up", data: visitor(), script: "signInBadEmail" },
  { id: "s03-code", screen: "S03 Verify email", path: "/sign-up", data: visitor(), script: "signInCode", variants: ALL },
  { id: "s03-code-long-email", screen: "S03 Verify email", path: "/sign-up", data: visitor(), script: "signInCodeLong" },
  { id: "s03-code-wrong", screen: "S03 Verify email", path: "/sign-up", data: visitor(), script: "signInWrongCode" },
  // S04 About you
  { id: "s04-about-you", screen: "S04 About you", path: "/about-you", data: onboarding("needs_about_you", { "me:get": F.me("needs_about_you", { firstName: null }) }), variants: ALL },
  { id: "s04-about-you-long", screen: "S04 About you", path: "/about-you", data: onboarding("needs_about_you", { "me:get": F.me("needs_about_you", { firstName: F.LONG.firstName, email: F.LONG.email }) }) },
  { id: "s04-about-you-errors", screen: "S04 About you", path: "/about-you", data: onboarding("needs_about_you", { "me:get": F.me("needs_about_you", { firstName: null, email: null }) }), script: "submitEmpty" },
  { id: "s04-about-you-save-fail", screen: "S04 About you", path: "/about-you", data: onboarding("needs_about_you"), handlers: { "onboarding:saveAboutYou": () => { throw fail("retryable"); } }, script: "submitForm" },
  // S05 Preferences
  { id: "s05-prefs-new", screen: "S05 Preferences", path: "/preferences", data: onboarding("needs_preferences", { "onboarding:preferences": null }), variants: ALL },
  { id: "s05-prefs-edit-step1", screen: "S05 Preferences", path: "/preferences", data: ready(), variants: ALL },
  { id: "s05-prefs-edit-change", screen: "S05 Preferences", path: "/preferences", data: ready(), script: "prefsChangeBudget" },
  { id: "s05-prefs-edit-changed", screen: "S05 Preferences", path: "/preferences", data: ready(), script: "prefsChangedUnsaved" },
  { id: "s05-prefs-surprise-confirm", screen: "S05 Preferences", path: "/preferences", data: ready(), script: "clickSurprise", fullPage: true },
  { id: "s05-prefs-new-q2", screen: "S05 Preferences", path: "/preferences", data: onboarding("needs_preferences", { "onboarding:preferences": null }), script: "firstQuestionThenNext" },
  { id: "s05-prefs-waiting-open", screen: "S05 Preferences", path: "/preferences", data: onboarding("waiting_for_spotify", { "onboarding:access": F.access.requested, "onboarding:preferences": F.preferencesSurprise }) },
  { id: "s05-prefs-save-fail", screen: "S05 Preferences", path: "/preferences", data: ready(), handlers: { "onboarding:savePreferences": () => { throw fail("retryable"); } }, script: "clickSave" },
  // S06 Waiting
  { id: "s06-waiting", screen: "S06 Waiting", path: "/waiting", data: onboarding("waiting_for_spotify", { "onboarding:access": F.access.requested }), variants: [...ALL, "offline"] },
  { id: "s06-waiting-refused", screen: "S06 Waiting", path: "/waiting", data: onboarding("waiting_for_spotify", { "onboarding:access": F.access.refused }) },
  { id: "s06-waiting-capacity", screen: "S06 Waiting", path: "/waiting", data: onboarding("waiting_for_spotify", { "onboarding:access": F.access.noCapacity }) },
  { id: "s06-waiting-long-email", screen: "S06 Waiting", path: "/waiting", data: onboarding("waiting_for_spotify", { "onboarding:access": { ...F.access.requested, spotifyEmail: F.LONG.email } }), variants: ["w320"] },
  // S07 Connect
  { id: "s07-connect", screen: "S07 Connect Spotify", path: "/connect", data: onboarding("needs_spotify_connect"), variants: [...ALL, "offline"] },
  { id: "s07-connect-fail", screen: "S07 Connect Spotify", path: "/connect", data: onboarding("needs_spotify_connect"), handlers: { "spotify:connectUrl": () => { throw fail("spotify_not_ready"); } }, script: "clickConnect" },
  // Spotify callback
  { id: "callback-working", screen: "Spotify callback", path: "/spotify/callback?code=abc&state=xyz", data: onboarding("needs_spotify_connect"), mutationDelayMs: 60000 },
  { id: "callback-declined", screen: "Spotify callback", path: "/spotify/callback?error=access_denied", data: onboarding("needs_spotify_connect") },
  { id: "callback-refused", screen: "Spotify callback", path: "/spotify/callback?code=abc&state=xyz", data: onboarding("needs_spotify_connect"), handlers: { "spotify:completeConnect": () => { throw fail("spotify_refused"); } } },
  { id: "callback-failed", screen: "Spotify callback", path: "/spotify/callback?code=abc&state=xyz", data: onboarding("needs_spotify_connect"), handlers: { "spotify:completeConnect": () => { throw fail("retryable"); } } },
  { id: "callback-no-params", screen: "Spotify callback", path: "/spotify/callback", data: onboarding("needs_spotify_connect") },
  // S08 Analyzing
  { id: "s08-analyzing-fetching", screen: "S08 Analyzing", path: "/analyzing", data: onboarding("analyzing", { "taste:analysis": { status: "fetching", error: null, failure: null } }), variants: ["reduced"] },
  { id: "s08-analyzing-summarizing", screen: "S08 Analyzing", path: "/analyzing", data: onboarding("analyzing", { "taste:analysis": { status: "summarizing", error: null, failure: null } }) },
  { id: "s08-analyzing-failed", screen: "S08 Analyzing", path: "/analyzing", data: onboarding("analyzing", { "taste:analysis": { status: "failed", error: "boom", failure: "other" } }) },
  { id: "s08-analyzing-too-little", screen: "S08 Analyzing", path: "/analyzing", data: onboarding("analyzing", { "taste:analysis": { status: "failed", error: null, failure: "too_little_data" } }), variants: ALL },
  // S09 Taste
  { id: "s09-taste-review", screen: "S09 Taste review", path: "/taste", data: onboarding("needs_review", { "taste:profile": F.taste }), variants: ALL },
  { id: "s09-taste-not-quite", screen: "S09 Taste review", path: "/taste", data: onboarding("needs_review", { "taste:profile": F.taste }), script: "notQuite" },
  { id: "s09-taste-correct-fail", screen: "S09 Taste review", path: "/taste", data: onboarding("needs_review", { "taste:profile": F.taste }), handlers: { "taste:correct": () => { throw fail("ai_failure"); } }, script: "notQuiteSave" },
  { id: "s09-taste-from-menu", screen: "S09 Taste review", path: "/taste", data: ready() },
  { id: "s09-taste-none", screen: "S09 Taste review", path: "/taste", data: ready({ "taste:profile": null }) },
  // S10 Week
  { id: "s10-week", screen: "S10 Your week", path: "/week", data: ready(), variants: [...ALL, "offline", "reduced"] },
  { id: "s10-week-empty", screen: "S10 Your week", path: "/week", data: ready({ "week:mine": [] }), variants: ALL },
  { id: "s10-week-many", screen: "S10 Your week", path: "/week", data: ready({ "week:mine": F.weekMany }), fullPage: true },
  { id: "s10-week-long", screen: "S10 Your week", path: "/week", data: ready({ "week:mine": F.weekLong }), variants: ALL },
  { id: "s10-week-loading", screen: "S10 Your week", path: "/week", data: ready({ "week:mine": hold }) },
  { id: "s10-week-error", screen: "S10 Your week", path: "/week", data: ready({ "week:mine": fail("retryable") }) },
  { id: "s10-week-answer-fail", screen: "S10 Your week", path: "/week", data: ready(), handlers: { "week:answer": () => { throw fail("retryable"); } }, script: "tapFirstCard" },
  { id: "s10-week-called-off", screen: "S10 Your week", path: "/week", data: ready({ "plans:current": F.plans.calledOff }) },
  { id: "s10-week-event-pulled", screen: "S10 Your week", path: "/week", data: ready({ "plans:current": F.plans.eventPulled }) },
  { id: "s10-week-after", screen: "S10 Your week", path: "/week", data: ready({ "plans:current": F.plans.after }) },
  // S11 Offer
  { id: "s11-offer", screen: "S11 Offer", path: "/plan", data: ready({ "plans:current": F.plans.offer }), variants: [...ALL, "offline"] },
  { id: "s11-offer-expired", screen: "S11 Offer", path: "/plan", data: ready({ "plans:current": F.plans.offerExpired }) },
  { id: "s11-offer-long", screen: "S11 Offer", path: "/plan", data: ready({ "plans:current": F.plans.offerLong }), variants: ALL },
  { id: "s11-offer-accept-fail", screen: "S11 Offer", path: "/plan", data: ready({ "plans:current": F.plans.offer }), handlers: { "plans:accept": () => { throw fail("offer_expired"); } }, script: "clickAccept" },
  { id: "s11-offer-next-time", screen: "S11 Offer", path: "/plan", data: ready({ "plans:current": F.plans.offer }), script: "clickNextTime" },
  { id: "s11-waiting", screen: "S11 Waiting on partner", path: "/plan", data: ready({ "plans:current": F.plans.waiting }), variants: ALL },
  { id: "s11-waiting-open-seat", screen: "S11 Waiting on partner", path: "/plan", data: ready({ "plans:current": F.plans.waitingOpenSeat }) },
  // S12 Plan set
  { id: "s12-set", screen: "S12 Plan set", path: "/plan", data: ready({ "plans:current": F.plans.set }), variants: ALL, fullPage: true },
  { id: "s12-set-my-ticket", screen: "S12 Plan set", path: "/plan", data: ready({ "plans:current": F.plans.setMyTicket }), fullPage: true },
  { id: "s12-set-both-tickets", screen: "S12 Plan set", path: "/plan", data: ready({ "plans:current": F.plans.setBothTickets }), fullPage: true },
  { id: "s12-set-long", screen: "S12 Plan set", path: "/plan", data: ready({ "plans:current": F.plans.setLong }), variants: ALL, fullPage: true },
  { id: "s12-set-cant-confirm", screen: "S12 Plan set", path: "/plan", data: ready({ "plans:current": F.plans.set }), script: "cantMakeIt", fullPage: true },
  { id: "s12-set-cant-after-cutoff", screen: "S12 Plan set", path: "/plan", data: ready({ "plans:current": F.plans.setAfterCutoff }), script: "cantMakeIt", fullPage: true },
  { id: "s12-set-couldnt-confirm", screen: "S12 Plan set", path: "/plan", data: ready({ "plans:current": F.plans.set }), script: "couldntGetOne", fullPage: true },
  { id: "s12-after-leaving", screen: "S12 Plan set", path: "/plan", data: ready({ "plans:current": F.plans.set }), script: "cantMakeItYes" },
  { id: "s12-partner-dropped", screen: "S12 Partner dropped", path: "/plan", data: ready({ "plans:current": F.plans.partnerDropped }) },
  { id: "s12-partner-dropped-after-cutoff", screen: "S12 Partner dropped", path: "/plan", data: ready({ "plans:current": F.plans.partnerDroppedAfterCutoff }) },
  { id: "s12-refilled-offered", screen: "S12 Seat refilled", path: "/plan", data: ready({ "plans:current": F.plans.refilledOffered }) },
  { id: "s12-refilled-set", screen: "S12 Seat refilled", path: "/plan", data: ready({ "plans:current": F.plans.refilledSet }), fullPage: true },
  // S13 Meetup day
  { id: "s13-meetup-day", screen: "S13 Meetup day", path: "/plan", data: ready({ "plans:current": F.plans.meetupDay }), variants: [...ALL, "reduced"], fullPage: true },
  { id: "s13-at-meeting", screen: "S13 Meetup day", path: "/plan", data: ready({ "plans:current": F.plans.meetupDayAtMeeting }), fullPage: true },
  { id: "s13-partner-left", screen: "S13 Meetup day", path: "/plan", data: ready({ "plans:current": F.plans.meetupDayPartnerLeft }), fullPage: true },
  { id: "s13-i-left", screen: "S13 Meetup day", path: "/plan", data: ready({ "plans:current": F.plans.meetupDayILeft }), fullPage: true },
  { id: "s13-long", screen: "S13 Meetup day", path: "/plan", data: ready({ "plans:current": F.plans.meetupDayLong }), variants: ALL, fullPage: true },
  // S14 Stay in touch
  { id: "s14-stay", screen: "S14 Stay in touch", path: "/stay-in-touch", data: ready({ "plans:current": F.plans.meetupDayAtMeeting }), variants: ALL },
  { id: "s14-stay-phone-open", screen: "S14 Stay in touch", path: "/stay-in-touch", data: ready({ "plans:current": F.plans.meetupDayAtMeeting }), script: "openPhone" },
  { id: "s14-stay-bad-phone", screen: "S14 Stay in touch", path: "/stay-in-touch", data: ready({ "plans:current": F.plans.meetupDayAtMeeting }), script: "badPhone" },
  { id: "s14-stay-shared", screen: "S14 Stay in touch", path: "/stay-in-touch", data: ready({ "plans:current": F.plans.after, "contacts:myShares": { phone: "+15105550123", instagram: "a.very.long.instagram.handle.for.testing" } }), variants: ["w320"], fullPage: true },
  { id: "s14-stay-not-yet", screen: "S14 Stay in touch", path: "/stay-in-touch", data: ready({ "plans:current": F.plans.set }) },
  // S15 Contacts
  { id: "s15-contacts", screen: "S15 Contacts", path: "/contacts", data: ready(), variants: ALL },
  { id: "s15-contacts-empty", screen: "S15 Contacts", path: "/contacts", data: ready({ "contacts:list": [] }) },
  { id: "s15-contacts-many", screen: "S15 Contacts", path: "/contacts", data: ready({ "contacts:list": F.contacts.many }), variants: ["text200", "w320"], fullPage: true },
  { id: "s15-contacts-loading", screen: "S15 Contacts", path: "/contacts", data: ready({ "contacts:list": hold }) },
  // S16 Menu
  { id: "s16-menu", screen: "S16 Menu", path: "/menu", data: ready(), variants: ALL, fullPage: true },
  { id: "s16-menu-long-email", screen: "S16 Menu", path: "/menu", data: ready({ "me:get": F.me("ready", { email: F.LONG.email }) }), variants: ["w320"] },
  { id: "s16-menu-onboarding", screen: "S16 Menu", path: "/menu", data: onboarding("waiting_for_spotify", { "onboarding:access": F.access.requested }), fullPage: true },
  { id: "s16-menu-disconnect-confirm", screen: "S16 Menu", path: "/menu", data: ready(), script: "disconnect", fullPage: true },
  { id: "s16-menu-help-sent", screen: "S16 Menu", path: "/menu", data: ready(), script: "helpSend", fullPage: true },
  { id: "s16-menu-offline", screen: "S16 Menu", path: "/menu", data: ready(), variants: ["offline"], fullPage: true },
  // Privacy
  { id: "privacy", screen: "Privacy", path: "/privacy", data: ready(), variants: ALL, fullPage: true },
  { id: "privacy-visitor", screen: "Privacy", path: "/privacy", data: visitor() },
  // Issue #17 re-checks
  { id: "x17-35-not-found", screen: "404", path: "/no-such-page", data: ready() },
  { id: "x17-35-not-found-visitor", screen: "404", path: "/no-such-page", data: visitor() },
  { id: "x17-19-about-you-saved", screen: "S04 About you", path: "/about-you", data: onboarding("needs_preferences", { "onboarding:access": { ...F.access.requested, spotifyEmail: "sam.spotify@gmail.com" } }) },
  { id: "x17-9-refill-offer-newcomer", screen: "S11 Offer", path: "/plan", data: ready({ "plans:current": F.plan("offer", { me: { seat: "offered", ticket: "none", offerExpiresAt: Date.now() + 3600000, left: false }, partner: { firstName: "Maya", seat: "in", ticket: "none", left: false }, notice: "partner_replaced", previousPartnerFirstName: "Alex" }) }) },
  { id: "x17-31-offer-partner-dropped", screen: "S11 Offer", path: "/plan", data: ready({ "plans:current": F.plan("offer", { partner: null, notice: "partner_dropped", previousPartnerFirstName: "Maya" }) }) },
  // The Drop (/drop). Times are relative to when the harness starts.
  { id: "drop-none", screen: "Drop", path: "/drop", data: ready({ "drops:mine": DROP.none }) },
  { id: "drop-choosing", screen: "Drop", path: "/drop", data: ready({ "drops:mine": DROP.choosing }), variants: [...ALL, "offline", "reduced"] },
  { id: "drop-deciding", screen: "Drop", path: "/drop", data: ready({ "drops:mine": DROP.deciding }), variants: [...ALL, "offline"] },
  { id: "drop-deciding-fail", screen: "Drop", path: "/drop", data: ready({ "drops:mine": DROP.deciding }), handlers: { "drops:accept": () => { throw fail("offer_expired"); } }, script: "tapDropAccept" },
  { id: "drop-accepted", screen: "Drop", path: "/drop", data: ready({ "drops:mine": DROP.accepted }), variants: ALL },
  { id: "drop-done", screen: "Drop", path: "/drop", data: ready({ "drops:mine": DROP.done }) },
  { id: "drop-called-off", screen: "Drop", path: "/drop", data: ready({ "drops:mine": DROP.none, "plans:current": F.plans.calledOff }) },
  { id: "drop-after", screen: "Drop", path: "/drop", data: ready({ "drops:mine": DROP.choosing, "plans:current": F.plans.after, "contacts:shareable": [{ meetupId: "meetup_1", partnerFirstName: "Maya", eventTitle: "Indie folk night", startsAt: Date.UTC(2026, 9, 30, 3, 0) }] }) },
  { id: "drop-loading", screen: "Drop", path: "/drop", data: ready({ "drops:mine": hold }) },
];

module.exports = { scenarios, ready, onboarding, visitor };
