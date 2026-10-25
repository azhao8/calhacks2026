/* eslint-disable @typescript-eslint/no-require-imports -- plain Node scripts run outside the app build */
// Interactions a scenario runs before its screenshot. Each takes (page, mock).

const { MockConvex } = require("./mock-convex.cjs");

const click = (page, name, opts = {}) => page.getByRole("button", { name, exact: opts.exact ?? false }).first().click();
const settle = (page, ms = 500) => page.waitForTimeout(ms);

const scripts = {
  async signInBadEmail(page) {
    await page.getByLabel("School email").fill("sam@gmail.com");
    await click(page, "Continue");
    await settle(page);
  },
  async signInCode(page, mock) {
    mock.handlers["auth:signIn"] = () => ({ started: true });
    await page.getByLabel("School email").fill("sam@berkeley.edu");
    await click(page, "Continue");
    await settle(page, 800);
  },
  async signInCodeLong(page, mock) {
    mock.handlers["auth:signIn"] = () => ({ started: true });
    await page.getByLabel("School email").fill("maximiliana.wolfgangalexandria.longname@eecs.berkeley.edu");
    await click(page, "Continue");
    await settle(page, 800);
  },
  async signInWrongCode(page, mock) {
    mock.handlers["auth:signIn"] = (args) => {
      if (args.params && args.params.code) throw MockConvex.fail("retryable", "Invalid code");
      return { started: true };
    };
    await page.getByLabel("School email").fill("sam@berkeley.edu");
    await click(page, "Continue");
    await settle(page, 800);
    await page.locator("input").first().click();
    await page.keyboard.type("123456");
    await settle(page, 800);
  },
  async submitEmpty(page) {
    await click(page, "Continue");
    await settle(page);
  },
  async submitForm(page) {
    await click(page, "Continue");
    await settle(page, 800);
  },
  async clickSurprise(page) {
    await click(page, "Surprise me");
    await settle(page, 800);
  },
  async clickConnect(page) {
    await page.getByRole("button", { name: /Spotify/i }).first().click();
    await settle(page, 800);
  },
  // Walk every preferences step from the menu, screenshotting each, to see whether saved answers show.
  async prefsWalk(page) {
    for (let i = 1; i <= 4; i++) {
      await page.screenshot({ path: `${__dirname}/out/shots/s05-prefs-edit-walk-step${i}.png` });
      await page.getByRole("button", { name: /^(Continue|Skip)/ }).last().click();
      await settle(page, 300);
    }
  },
  async notQuite(page) {
    await click(page, "Not quite");
    await settle(page);
  },
  async notQuiteSave(page) {
    await click(page, "Not quite");
    await page.getByLabel("What should we change?").fill("Less folk, more jazz");
    await click(page, "Save", { exact: true });
    await settle(page, 800);
  },
  async tapFirstCard(page) {
    await click(page, "I can make it");
    await settle(page, 800);
  },
  async clickAccept(page) {
    await click(page, "Accept", { exact: true });
    await settle(page, 800);
  },
  async clickNextTime(page) {
    await click(page, "Next time", { exact: true });
    await settle(page, 800);
  },
  async cantMakeIt(page) {
    await click(page, /can't make it/i);
    await settle(page);
  },
  async cantMakeItYes(page) {
    await click(page, /can't make it/i);
    await click(page, "Yes, I can't");
    await settle(page, 800);
  },
  async couldntGetOne(page) {
    await click(page, "I couldn't get one");
    await settle(page);
  },
  async openPhone(page) {
    await click(page, /number/i);
    await settle(page);
  },
  async badPhone(page) {
    await click(page, /number/i);
    await page.getByLabel("Your phone number").fill("12");
    await click(page, "Share", { exact: true });
    await settle(page);
  },
  async disconnect(page) {
    await click(page, "Disconnect Spotify");
    await settle(page);
  },
  async helpSend(page) {
    await page.getByLabel("What happened?").fill("The week page showed the wrong day.");
    await click(page, "Send", { exact: true });
    await settle(page, 800);
  },
};

module.exports = { scripts };
