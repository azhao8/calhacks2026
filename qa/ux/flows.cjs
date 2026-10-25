#!/usr/bin/env node
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

  // Menu → Privacy → how do you get back?
  async "nav-privacy-from-menu"(browser) {
    const { context, page } = await open(browser, ready());
    await page.goto(BASE + "/menu");
    await wait(page);
    await link(page, "Privacy").click();
    await wait(page);
    await page.screenshot({ path: `${SHOTS}/privacy-from-menu.png` });
    const onPrivacy = at(page);
    const controls = await page.locator("a[href], button").evaluateAll((els) => els.map((e) => `${e.getAttribute("aria-label") || e.innerText.trim()} → ${e.getAttribute("href") || "button"}`));
    await page.locator('a[aria-label="Melos home"]').click();
    await wait(page, 1200);
    const wordmarkGoes = at(page);
    await context.close();
    return { onPrivacy, controls, wordmarkGoes, note: "The only control on /privacy is the wordmark, which goes home (/week), not back to the menu." };
  },

  // Sign in → privacy link → back: is the typed email kept?
  async "nav-privacy-from-sign-in"(browser) {
    const { context, page } = await open(browser, visitor());
    await page.goto(BASE + "/sign-in");
    await wait(page);
    await page.getByLabel("School email").fill("sam@berkeley.edu");
    await link(page, "privacy page").click();
    await wait(page);
    const onPrivacy = at(page);
    await page.goBack();
    await wait(page);
    const kept = await page.getByLabel("School email").inputValue().catch(() => null);
    await context.close();
    return { onPrivacy, emailAfterBack: kept };
  },

  // Menu → Preferences: what do you see, how do you leave without saving, and what does saving say?
  async "state-preferences-edit"(browser) {
    const { context, page, mock } = await open(browser, ready(), { mutationDelayMs: 600 });
    await page.goto(BASE + "/week");
    await wait(page);
    await link(page, "Open menu").click();
    await wait(page);
    await link(page, "Preferences").click();
    await wait(page);
    await page.screenshot({ path: `${SHOTS}/prefs-edit-1.png` });
    const step1 = await text(page);
    const exitsAtStep1 = await page.locator("a[href], button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") || e.innerText.trim()));
    const checked = await page.locator('[aria-checked="true"], [aria-pressed="true"]').allInnerTexts();
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: /^(Continue|Skip)/ }).last().click();
      await wait(page, 300);
    }
    await btn(page, "Save", true).click();
    await wait(page, 200);
    await page.screenshot({ path: `${SHOTS}/prefs-edit-saving.png` });
    await wait(page, 1200);
    await page.screenshot({ path: `${SHOTS}/prefs-edit-after-save.png` });
    const landed = at(page);
    const after = await text(page);
    const savedMessage = /saved|updated/i.test(after);
    await context.close();
    return { step1: step1.slice(0, 200), exitsAtStep1, checkedAtStep1: checked, stepsToSave: 5, landedAfterSave: landed, savedMessage, calls: mock.calls.map((c) => c.path) };
  },

  // Waiting for Spotify → "Change my preferences": can you leave without saving?
  async "nav-preferences-from-waiting"(browser) {
    const data = onboarding("waiting_for_spotify", { "onboarding:access": F.access.requested, "onboarding:preferences": F.preferencesCustom });
    const { context, page, mock } = await open(browser, data);
    await page.goto(BASE + "/waiting");
    await wait(page);
    await link(page, "Change my preferences").click();
    await wait(page);
    await page.screenshot({ path: `${SHOTS}/prefs-from-waiting.png` });
    const menu = await page.locator('a[aria-label="Open menu"]').count();
    const exits = await page.locator("a[href], button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") || e.innerText.trim()));
    await btn(page, "Surprise me").click();
    await wait(page, 1200);
    const afterSurprise = at(page);
    await context.close();
    return { menu: menu > 0, exits, afterSurprise, surpriseOverwroteCustom: mock.calls.some((c) => c.path === "onboarding:surpriseMe"), note: "Surprise me replaced saved custom answers in one tap, with no confirmation." };
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

  // Menu close: where does it take you after a deep link straight to /menu?
  async "nav-menu-close"(browser) {
    const { context, page } = await open(browser, ready());
    await page.goto(BASE + "/menu");
    await wait(page);
    await page.locator('button[aria-label="Close menu"]').click();
    await wait(page, 1200);
    const fromDeepLink = at(page);
    await page.goto(BASE + "/contacts");
    await wait(page);
    await link(page, "Open menu").click();
    await wait(page);
    await page.locator('button[aria-label="Close menu"]').click();
    await wait(page, 1000);
    const fromContacts = at(page);
    await context.close();
    return { fromDeepLink, fromContacts };
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
