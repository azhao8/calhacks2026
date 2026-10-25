#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- plain Node scripts run outside the app build */
// Navigation and state clarity journeys. Each flow clicks through the app on the mock, records what
// happened (where it landed, what it said, how many server calls a double tap made), and saves
// screenshots. Writes qa/ux/out/flows.json and qa/ux/out/flows.md.
//
//   node qa/ux/flows.cjs            all flows
//   node qa/ux/flows.cjs nav-       flows whose name starts with this

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { MockConvex } = require("./mock-convex.cjs");
const { ready, onboarding, visitor } = require("./scenarios.cjs");
const F = require("./fixtures.cjs");

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const OUT = path.join(__dirname, "out");
const SHOTS = path.join(OUT, "flows");

async function open(browser, data, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const mock = new MockConvex({ data, handlers: opts.handlers, mutationDelayMs: opts.mutationDelayMs ?? 150 });
  await mock.attach(context);
  if (data["me:get"]) await MockConvex.signIn(context);
  const page = await context.newPage();
  return { context, page, mock };
}

const at = (page) => page.url().replace(BASE, "");
const wait = (page, ms = 700) => page.waitForTimeout(ms);
const text = async (page) => (await page.innerText("body")).replace(/\s+/g, " ").slice(0, 400);
const btn = (page, name, exact = false) => page.getByRole("button", { name, exact }).first();
const link = (page, name) => page.getByRole("link", { name }).first();

const flows = {
  // Deep link and reload every signed-in screen as a ready student, then as a student mid-onboarding.
  async "nav-deep-links"(browser) {
    const rows = [];
    const routes = ["/", "/school", "/sign-in", "/about-you", "/preferences", "/waiting", "/connect", "/analyzing", "/taste", "/week", "/plan", "/stay-in-touch", "/contacts", "/menu", "/privacy"];
    for (const [who, data] of [
      ["ready, no plan", ready()],
      ["ready, plan set", ready({ "plans:current": F.plans.set })],
      ["waiting for Spotify", onboarding("waiting_for_spotify", { "onboarding:access": F.access.requested })],
      ["signed out", visitor()],
    ]) {
      const { context, page } = await open(browser, data);
      for (const r of routes) {
        await page.goto(BASE + r);
        await wait(page, 900);
        const landed = at(page);
        await page.reload();
        await wait(page, 900);
        const afterReload = at(page);
        const menu = await page.locator('a[aria-label="Open menu"], button[aria-label="Close menu"]').count();
        const exits = await page.locator("a[href]").evaluateAll((as) => as.filter((a) => a.offsetParent !== null).map((a) => a.getAttribute("href")));
        rows.push({ who, route: r, landed, afterReload, menu: menu > 0, exits: [...new Set(exits)] });
      }
      await context.close();
    }
    return { rows };
  },

  // Menu → Privacy → Back.
  async "nav-privacy-from-menu"(browser) {
    const { context, page } = await open(browser, ready());
    await page.goto(BASE + "/menu");
    await wait(page);
    await link(page, "Privacy").click();
    await wait(page);
    await page.screenshot({ path: `${SHOTS}/privacy-from-menu.png` });
    const onPrivacy = at(page);
    await btn(page, "Back", true).click();
    await wait(page, 1000);
    const backGoes = at(page);
    await context.close();
    return { onPrivacy, backGoes, pass: backGoes === "/menu" };
  },

  // Privacy opened straight from a link: Back stays in Melos.
  async "nav-privacy-deep-link"(browser) {
    const { context, page } = await open(browser, ready());
    await page.goto("about:blank");
    await page.goto(BASE + "/privacy");
    await wait(page);
    await btn(page, "Back", true).click();
    await wait(page, 1200);
    const backGoes = at(page);
    await context.close();
    return { backGoes, pass: backGoes.startsWith("/") };
  },

  // Sign in → privacy link → Back: is the typed email kept?
  async "nav-privacy-from-sign-in"(browser) {
    const { context, page } = await open(browser, visitor());
    await page.goto(BASE + "/sign-in");
    await wait(page);
    await page.getByLabel("School email").fill("sam@berkeley.edu");
    await link(page, "privacy page").click();
    await wait(page);
    const onPrivacy = at(page);
    await btn(page, "Back", true).click();
    await wait(page);
    const kept = await page.getByLabel("School email").inputValue().catch(() => null);
    await context.close();
    return { onPrivacy, backTo: at(page), emailAfterBack: kept, pass: kept === "sam@berkeley.edu" };
  },

  // Welcome → School → Sign in, typing, then Back twice; and Sign in opened from a link.
  async "nav-onboarding-back"(browser) {
    const out = {};
    {
      const { context, page } = await open(browser, visitor());
      await page.goto(BASE + "/");
      await wait(page);
      await link(page, "Get started").click();
      await wait(page);
      await page.getByRole("radio", { name: /UC Berkeley/ }).first().click().catch(() => page.getByText("UC Berkeley").first().click());
      await btn(page, "Continue").click();
      await wait(page);
      await page.getByLabel("School email").fill("sam@berkeley.edu");
      await btn(page, "Back", true).click();
      await wait(page);
      out.signInBackTo = at(page);
      await btn(page, "Back", true).click();
      await wait(page);
      out.schoolBackTo = at(page);
      await link(page, "I already have an account").click();
      await wait(page);
      out.emailKeptAfterRoundTrip = await page.getByLabel("School email").inputValue().catch(() => null);
      await context.close();
    }
    {
      const { context, page } = await open(browser, visitor());
      await page.goto("about:blank");
      await page.goto(BASE + "/sign-in");
      await wait(page);
      await btn(page, "Back", true).click();
      await wait(page);
      out.deepLinkSignInBackTo = at(page);
      await context.close();
    }
    {
      const { context, page } = await open(browser, onboarding("needs_about_you", { "onboarding:access": { ...F.access.requested, spotifyEmail: null } }));
      await page.goto(BASE + "/about-you");
      await wait(page);
      await page.getByLabel("What should we call you?").fill("Sam");
      await link(page, "Back").click();
      await wait(page);
      out.aboutYouBackTo = at(page);
      await context.close();
    }
    {
      const { context, page } = await open(browser, onboarding("needs_preferences", { "onboarding:access": { ...F.access.requested, spotifyEmail: "sam.spotify@gmail.com" }, "onboarding:preferences": null }));
      await page.goto(BASE + "/preferences");
      await wait(page);
      await link(page, "Back to About you").click();
      await wait(page);
      out.prefsQ1BackTo = at(page);
      out.aboutYouPrefill = await page.getByLabel("The email you log in to Spotify with").inputValue().catch(() => null);
      await context.close();
    }
    out.pass =
      out.signInBackTo === "/school" && out.schoolBackTo === "/" && out.deepLinkSignInBackTo === "/school" && out.aboutYouBackTo === "/school" && out.prefsQ1BackTo === "/about-you" && out.aboutYouPrefill === "sam.spotify@gmail.com";
    return out;
  },

  // Menu → Preferences: summary of saved answers, change one, save, confirmation, reopen fresh.
  async "state-preferences-edit"(browser) {
    const { context, page, mock } = await open(browser, ready(), { mutationDelayMs: 600 });
    mock.handlers["onboarding:savePreferences"] = (args, m) =>
      m.set("onboarding:preferences", { ...F.preferencesCustom, maxTicketPrice: args.maxTicketPrice, source: "custom" });
    await page.goto(BASE + "/week");
    await wait(page);
    await link(page, "Open menu").click();
    await wait(page);
    await link(page, "Preferences").click();
    await wait(page);
    await page.screenshot({ path: `${SHOTS}/prefs-edit-summary.png`, fullPage: true });
    const summary = await text(page);
    await page.getByRole("button", { name: "Change ticket budget" }).click();
    await wait(page, 300);
    await page.getByRole("radio", { name: "Up to $15" }).click();
    await btn(page, "Done", true).click();
    await wait(page, 300);
    await btn(page, "Save", true).click();
    await wait(page, 200);
    await page.screenshot({ path: `${SHOTS}/prefs-edit-saving.png` });
    await wait(page, 1200);
    await page.screenshot({ path: `${SHOTS}/prefs-edit-after-save.png`, fullPage: true });
    const landed = at(page);
    const after = await text(page);
    await btn(page, "Back", true).click();
    await wait(page);
    const backTo = at(page);
    await link(page, "Preferences").click();
    await wait(page);
    const reopened = await text(page);
    await context.close();
    return {
      summaryShowsSaved: /Up to \$50/.test(summary) && /Women, Non binary people/.test(summary) && /Anywhere BART goes/.test(summary),
      landedAfterSave: landed,
      savedMessage: /Preferences saved/.test(after),
      showsNewValue: /Up to \$15/.test(after),
      backTo,
      reopensOnSummary: /Your preferences/.test(reopened) && !/Done/.test(reopened),
      calls: mock.calls.map((c) => c.path),
    };
  },

  // First time: answer all five, save, land on the next onboarding screen with a confirmation.
  async "state-preferences-first-time"(browser) {
    const { context, page, mock } = await open(browser, onboarding("needs_preferences", { "onboarding:preferences": null }));
    mock.handlers["onboarding:savePreferences"] = (_a, m) => {
      m.set("onboarding:preferences", F.preferencesCustom);
      m.set("me:get", F.me("waiting_for_spotify"));
    };
    await page.goto(BASE + "/preferences");
    await wait(page);
    const counter = (await text(page)).match(/(Question|Step) \d of \d/)?.[0];
    await page.getByRole("radio", { name: "Up to $25" }).click();
    await btn(page, "Continue").click();
    await page.getByRole("button", { name: "Anyone" }).click();
    await btn(page, "Continue").click();
    await btn(page, "Skip").click();
    await btn(page, "Skip").click();
    await page.getByRole("radio", { name: "Campus" }).click();
    await btn(page, "Save", true).click();
    await wait(page, 1500);
    await page.screenshot({ path: `${SHOTS}/prefs-first-time-after-save.png` });
    const landed = at(page);
    const after = await text(page);
    await context.close();
    return { counter, landed, savedMessage: /Preferences saved/.test(after), pass: landed === "/waiting" && /Preferences saved/.test(after) };
  },

  // Waiting for Spotify → "Change my preferences": a way back, and Surprise me asks first.
  async "nav-preferences-from-waiting"(browser) {
    const data = onboarding("waiting_for_spotify", { "onboarding:access": F.access.requested, "onboarding:preferences": F.preferencesCustom });
    const { context, page, mock } = await open(browser, data);
    await page.goto(BASE + "/waiting");
    await wait(page);
    await link(page, "Change my preferences").click();
    await wait(page);
    await page.screenshot({ path: `${SHOTS}/prefs-from-waiting.png`, fullPage: true });
    await btn(page, "Surprise me").click();
    await wait(page, 300);
    const asked = /This replaces your answers/.test(await text(page));
    const calledBeforeConfirm = mock.calls.some((c) => c.path === "onboarding:surpriseMe");
    await btn(page, "Keep my answers").click();
    await btn(page, "Back", true).click();
    await wait(page);
    const backTo = at(page);
    await context.close();
    return { asked, calledBeforeConfirm, backTo, pass: asked && !calledBeforeConfirm && backTo === "/waiting" };
  },

  // Double taps on the actions that change shared state.
  async "state-double-taps"(browser) {
    const out = {};
    {
      const { context, page, mock } = await open(browser, ready(), { mutationDelayMs: 800 });
      await page.goto(BASE + "/week");
      await wait(page);
      const b = btn(page, "I can make it");
      await b.click();
      await b.click({ force: true }).catch(() => {});
      await wait(page, 100);
      await page.screenshot({ path: `${SHOTS}/week-pending.png` });
      await wait(page, 1200);
      out.weekAnswerCalls = mock.calls.filter((c) => c.path === "week:answer").length;
      await context.close();
    }
    {
      const { context, page, mock } = await open(browser, ready({ "plans:current": F.plans.offer }), { mutationDelayMs: 800 });
      await page.goto(BASE + "/plan");
      await wait(page);
      const b = btn(page, "Accept", true);
      await b.dblclick({ force: true });
      await wait(page, 100);
      await page.screenshot({ path: `${SHOTS}/offer-accept-pending.png` });
      await wait(page, 1200);
      out.acceptCalls = mock.calls.filter((c) => c.path === "plans:accept").length;
      await context.close();
    }
    {
      const { context, page, mock } = await open(browser, ready({ "plans:current": F.plans.set }), { mutationDelayMs: 800 });
      await page.goto(BASE + "/plan");
      await wait(page);
      const b = btn(page, "Got my ticket");
      await b.dblclick({ force: true });
      await wait(page, 1500);
      out.ticketCalls = mock.calls.filter((c) => c.path === "plans:setTicket").length;
      await context.close();
    }
    {
      const { context, page, mock } = await open(browser, ready(), { mutationDelayMs: 800 });
      await page.goto(BASE + "/menu");
      await wait(page);
      await page.getByLabel("What happened?").fill("test");
      await btn(page, "Send", true).dblclick({ force: true });
      await wait(page, 1500);
      out.helpCalls = mock.calls.filter((c) => c.path === "help:submit").length;
      await context.close();
    }
    return out;
  },

  // Live updates: does the screen stay put and say what changed?
  async "state-live-updates"(browser) {
    const out = {};
    {
      // Week: say yes, server confirms; then an offer arrives.
      const { context, page, mock } = await open(browser, ready());
      mock.handlers["week:answer"] = (args, m) => m.set("week:mine", F.week3.map((c) => (c.askId === args.askId ? { ...c, answer: args.answer } : c)));
      await page.goto(BASE + "/week");
      await wait(page);
      await btn(page, "I can make it").click();
      await wait(page, 800);
      await page.screenshot({ path: `${SHOTS}/week-after-yes.png` });
      out.weekAfterYes = { at: at(page), text: (await text(page)).slice(0, 300) };
      mock.set("plans:current", F.plans.offer);
      await wait(page, 1200);
      out.offerArrives = { at: at(page) };
      await page.screenshot({ path: `${SHOTS}/week-offer-arrives.png` });
      await context.close();
    }
    {
      // Offer → Accept → partner hasn't accepted → partner accepts.
      const { context, page, mock } = await open(browser, ready({ "plans:current": F.plans.offer }));
      mock.handlers["plans:accept"] = (_a, m) => m.set("plans:current", F.plans.waiting);
      await page.goto(BASE + "/plan");
      await wait(page);
      await btn(page, "Accept", true).click();
      await wait(page, 800);
      await page.screenshot({ path: `${SHOTS}/offer-after-accept.png` });
      out.afterAccept = (await text(page)).slice(0, 200);
      mock.set("plans:current", F.plans.set);
      await wait(page, 800);
      await page.screenshot({ path: `${SHOTS}/offer-partner-accepts.png` });
      out.afterPartnerAccepts = (await text(page)).slice(0, 200);
      await context.close();
    }
    {
      // Next time → the plan disappears on the server: the kind message stays.
      const { context, page, mock } = await open(browser, ready({ "plans:current": F.plans.offer }));
      mock.handlers["plans:nextTime"] = (_a, m) => m.set("plans:current", null);
      await page.goto(BASE + "/plan");
      await wait(page);
      await btn(page, "Next time", true).click();
      await wait(page, 1200);
      await page.screenshot({ path: `${SHOTS}/offer-after-next-time.png` });
      out.afterNextTime = { at: at(page), text: (await text(page)).slice(0, 200) };
      await context.close();
    }
    {
      // Set plan, partner drops while you watch.
      const { context, page, mock } = await open(browser, ready({ "plans:current": F.plans.set }));
      await page.goto(BASE + "/plan");
      await wait(page);
      mock.set("plans:current", F.plans.partnerDropped);
      await wait(page, 800);
      await page.screenshot({ path: `${SHOTS}/set-partner-drops.png`, fullPage: true });
      out.partnerDrops = (await text(page)).slice(0, 300);
      mock.set("plans:current", F.plans.refilledOffered);
      await wait(page, 800);
      await page.screenshot({ path: `${SHOTS}/set-refilled.png`, fullPage: true });
      out.refilled = (await text(page)).slice(0, 300);
      await context.close();
    }
    {
      // Taste correction: does the student see the revised summary?
      const { context, page, mock } = await open(browser, onboarding("needs_review", { "taste:profile": F.taste }));
      mock.handlers["taste:correct"] = (_a, m) => m.set("taste:profile", { ...F.taste, summary: "Jazz first, then folk.", revision: 1 });
      await page.goto(BASE + "/taste");
      await wait(page);
      await btn(page, "Not quite").click();
      await page.getByLabel("What should we change?").fill("More jazz");
      await btn(page, "Save", true).click();
      await wait(page, 1000);
      await page.screenshot({ path: `${SHOTS}/taste-revised.png`, fullPage: true });
      out.tasteRevised = (await text(page)).slice(0, 300);
      await context.close();
    }
    return out;
  },

  // Issue #17 item 34: an offer runs out unanswered while the student watches.
  async "state-offer-runs-out"(browser) {
    const { context, page, mock } = await open(browser, ready({ "plans:current": F.plans.offer }));
    await page.goto(BASE + "/plan");
    await wait(page);
    mock.set("plans:current", null);
    await wait(page, 1500);
    await page.screenshot({ path: `${SHOTS}/offer-runs-out.png` });
    const out = { at: at(page), text: (await text(page)).slice(0, 250) };
    await context.close();
    return out;
  },

  // Menu → Taste summary (ready): how do you get back, what does "That's me" do?
  async "nav-taste-from-menu"(browser) {
    const { context, page } = await open(browser, ready({ "taste:profile": { ...F.taste, confirmed: true } }));
    await page.goto(BASE + "/menu");
    await wait(page);
    await link(page, "Your taste summary").click();
    await wait(page);
    await page.screenshot({ path: `${SHOTS}/taste-from-menu.png`, fullPage: true });
    const buttons = await page.locator("a[href], button").evaluateAll((els) => els.filter((e) => e.offsetParent !== null).map((e) => e.getAttribute("aria-label") || e.innerText.trim()));
    await context.close();
    return { buttons };
  },

  // A signed-out deep link comes back after sign in (when the account may open it), and the school
  // picker starts on the only open school.
  async "nav-deep-link-after-sign-in"(browser) {
    const out = {};
    for (const [name, path, signedInAs, expect] of [
      ["ready student, /contacts", "/contacts", F.me("ready"), "/contacts"],
      ["mid-onboarding, /plan", "/plan", F.me("waiting_for_spotify"), "/waiting"],
    ]) {
      const { context, page, mock } = await open(browser, visitor({ ...ready(), "me:get": null }));
      await page.goto(BASE + path);
      await wait(page, 1000);
      const bounced = at(page);
      await link(page, "I already have an account").click();
      await wait(page);
      // A real sign in leaves a session in storage; the mock serves the signed-in student from now on.
      await MockConvex.signIn(context);
      mock.data["me:get"] = signedInAs;
      mock.set("me:get", signedInAs);
      await wait(page, 2000);
      out[name] = { bounced, landed: at(page), pass: at(page) === expect };
      await context.close();
    }
    {
      const { context, page } = await open(browser, visitor());
      await page.goto(BASE + "/school");
      await wait(page);
      out.schoolContinueEnabled = await btn(page, "Continue").isEnabled();
      await context.close();
    }
    return out;
  },

  // Menu close goes home, never back through browser history.
  async "nav-menu-close"(browser) {
    const out = {};
    for (const [name, data, expect] of [
      ["ready", ready(), "/week"],
      ["plan set", ready({ "plans:current": F.plans.set }), "/plan"],
      ["waiting", onboarding("waiting_for_spotify", { "onboarding:access": F.access.requested }), "/waiting"],
    ]) {
      const { context, page } = await open(browser, data);
      await page.goto("about:blank");
      await page.goto(BASE + "/menu");
      await wait(page);
      await page.locator('button[aria-label="Close menu"]').click();
      await wait(page, 1200);
      out[name] = { landed: at(page), pass: at(page) === expect };
      await context.close();
    }
    return out;
  },

  // The Spotify email: empty for a new student (never the school email), and fixable from Waiting
  // and Connect, coming back home with the new address shown live.
  async "state-spotify-email"(browser) {
    const out = {};
    {
      const { context, page } = await open(browser, onboarding("needs_about_you", { "onboarding:access": { status: "none", refused: false, spotifyEmail: null } }));
      await page.goto(BASE + "/about-you");
      await wait(page);
      out.newStudentField = await page.getByLabel("The email you log in to Spotify with").inputValue();
      await page.getByLabel("What should we call you?").fill("Sam");
      await btn(page, "Continue").click();
      await wait(page, 500);
      out.emptyError = await page.getByText("Enter the email your Spotify account uses.").isVisible();
      await page.screenshot({ path: `${SHOTS}/about-you-new.png` });
      await context.close();
    }
    {
      // Typing the sign-in email asks first; "Change it" goes back to the field; "Yes" saves.
      const { context, page, mock } = await open(browser, onboarding("needs_about_you", { "onboarding:access": { status: "none", refused: false, spotifyEmail: null } }));
      mock.handlers["onboarding:saveAboutYou"] = (_a, m) => m.set("me:get", F.me("needs_preferences"));
      await page.goto(BASE + "/about-you");
      await wait(page);
      const field = page.getByLabel("The email you log in to Spotify with");
      await page.getByLabel("What should we call you?").fill("Sam");
      await field.fill("Sam@Berkeley.edu ");
      await btn(page, "Continue").click();
      await wait(page, 400);
      await page.screenshot({ path: `${SHOTS}/about-you-same-email.png` });
      const asked = await page.getByText("Is this the email you log in to Spotify with?").isVisible();
      const savedBeforeConfirm = mock.calls.some((c) => c.path === "onboarding:saveAboutYou");
      await btn(page, "Change it", true).click();
      await wait(page, 200);
      const focused = await field.evaluate((el) => el === document.activeElement);
      await btn(page, "Continue").click();
      await wait(page, 300);
      await btn(page, "Yes, that's my Spotify email", true).click();
      await wait(page, 1000);
      out.sameEmail = { asked, savedBeforeConfirm, focused, savedAfterYes: mock.calls.filter((c) => c.path === "onboarding:saveAboutYou").length === 1, landed: at(page) };
      out.sameEmail.pass = asked && !savedBeforeConfirm && focused && out.sameEmail.savedAfterYes && out.sameEmail.landed === "/preferences";
      await context.close();
    }
    {
      // From Waiting's Change, a saved school email asks too.
      const { context, page, mock } = await open(browser, onboarding("waiting_for_spotify", { "onboarding:access": { ...F.access.requested, spotifyEmail: "sam@berkeley.edu" } }));
      await page.goto(BASE + "/waiting");
      await wait(page);
      await link(page, "Change the Spotify email").click();
      await wait(page);
      await btn(page, "Save", true).click();
      await wait(page, 400);
      out.sameEmailFromWaiting = { asked: await page.getByText("Is this the email you log in to Spotify with?").isVisible(), saved: mock.calls.some((c) => c.path === "onboarding:saveAboutYou") };
      out.sameEmailFromWaiting.pass = out.sameEmailFromWaiting.asked && !out.sameEmailFromWaiting.saved;
      await context.close();
    }
    for (const [from, state] of [
      ["/waiting", "waiting_for_spotify"],
      ["/connect", "needs_spotify_connect"],
    ]) {
      const access = { ...F.access.requested, status: state === "needs_spotify_connect" ? "allowlisted" : "requested", spotifyEmail: "sam@berkeley.edu" };
      const { context, page, mock } = await open(browser, onboarding(state, { "onboarding:access": access }));
      mock.handlers["onboarding:saveAboutYou"] = (args, m) => {
        m.set("onboarding:access", { ...F.access.requested, spotifyEmail: args.spotifyEmail });
        m.set("me:get", F.me("waiting_for_spotify"));
      };
      await page.goto(BASE + from);
      await wait(page);
      await page.screenshot({ path: `${SHOTS}/spotify-email-on${from.replace("/", "-")}.png` });
      await link(page, "Change the Spotify email").click();
      await wait(page);
      const prefill = await page.getByLabel("The email you log in to Spotify with").inputValue();
      await page.getByLabel("The email you log in to Spotify with").fill("sam.spotify@gmail.com");
      await btn(page, "Save", true).click();
      await wait(page, 1500);
      await page.screenshot({ path: `${SHOTS}/spotify-email-saved-from${from.replace("/", "-")}.png` });
      const after = await text(page);
      const landed = at(page);
      // Change again: the kept-alive form must be ready to save, not stuck on its spinner.
      await link(page, "Change the Spotify email").click();
      await wait(page);
      const saveReadyAgain = await btn(page, "Save", true).isEnabled();
      out[from] = { prefill, landed, showsNew: after.includes("sam.spotify@gmail.com"), saved: /Saved\./.test(after), saveReadyAgain };
      out[from].pass = prefill === "sam@berkeley.edu" && out[from].landed === "/waiting" && out[from].showsNew && out[from].saved && saveReadyAgain;
      await context.close();
    }
    out.pass = out.newStudentField === "" && out.emptyError && out.sameEmail.pass && out.sameEmailFromWaiting.pass && out["/waiting"].pass && out["/connect"].pass;
    return out;
  },

  // Disconnect Spotify from the menu: what happens next, and is there a way to reconnect?
  async "state-disconnect"(browser) {
    const { context, page, mock } = await open(browser, ready());
    mock.handlers["settings:disconnectSpotify"] = (_a, m) => {
      m.set("onboarding:access", { ...F.access.connected, status: "revoked" });
      m.set("me:get", F.me("needs_spotify_connect"));
    };
    await page.goto(BASE + "/menu");
    await wait(page);
    await btn(page, "Disconnect Spotify").click();
    await btn(page, "Disconnect", true).click();
    await wait(page, 1200);
    await page.screenshot({ path: `${SHOTS}/menu-after-disconnect.png`, fullPage: true });
    const menuText = await text(page);
    const links = await page.locator("a[href]").evaluateAll((as) => as.map((a) => `${a.innerText.trim()} → ${a.getAttribute("href")}`));
    await context.close();
    return { at: at(page), menuText: menuText.slice(0, 400), links };
  },
};

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const filter = process.argv[2];
  const browser = await chromium.launch();
  const results = {};
  for (const [name, fn] of Object.entries(flows)) {
    if (filter && !name.startsWith(filter)) continue;
    try {
      results[name] = await fn(browser);
      process.stdout.write(".");
    } catch (e) {
      results[name] = { crash: String(e).slice(0, 500) };
      process.stdout.write("x");
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "flows.json"), JSON.stringify(results, null, 2));
  const md = ["# UX stress test: flows", ""];
  for (const [name, r] of Object.entries(results)) md.push(`## ${name}`, "", "```json", JSON.stringify(r, null, 2), "```", "");
  fs.writeFileSync(path.join(OUT, "flows.md"), md.join("\n"));
  console.log(`\n${Object.keys(results).length} flows → qa/ux/out/flows.md`);
}

if (require.main === module) main().catch((e) => (console.error(e), process.exit(1)));
