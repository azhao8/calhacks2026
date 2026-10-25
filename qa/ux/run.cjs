#!/usr/bin/env node
// Renders every scenario in Chromium at 375×812 (plus variants), saves a screenshot, and runs the
// automatic checks in checks.cjs. Writes qa/ux/out/report.json and qa/ux/out/report.md.
//
//   node qa/ux/run.cjs                 all scenarios
//   node qa/ux/run.cjs s11 s12         only scenarios whose id starts with one of these
//   BASE_URL=http://127.0.0.1:3100     the app to test (default shown); see qa/README.md

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { MockConvex } = require("./mock-convex.cjs");
const { scenarios } = require("./scenarios.cjs");
const { scripts } = require("./scripts.cjs");
const { inspect } = require("./checks.cjs");

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const OUT = path.join(__dirname, "out");
const SHOTS = path.join(OUT, "shots");
const CONCURRENCY = Number(process.env.QA_CONCURRENCY || 4);

const VARIANTS = {
  base: { viewport: { width: 375, height: 812 } },
  text200: { viewport: { width: 375, height: 812 }, css: "html{font-size:200% !important}" },
  w320: { viewport: { width: 320, height: 640 } },
  offline: { viewport: { width: 375, height: 812 }, offline: true },
  reduced: { viewport: { width: 375, height: 812 }, reducedMotion: "reduce" },
};

async function render(browser, scenario, variantName) {
  const variant = VARIANTS[variantName];
  const context = await browser.newContext({
    viewport: variant.viewport,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    reducedMotion: variant.reducedMotion ?? "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e).slice(0, 300)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 300));
  });
  const mock = new MockConvex({ data: scenario.data, handlers: scenario.handlers, mutationDelayMs: scenario.mutationDelayMs });
  await mock.attach(context);
  if (scenario.data["me:get"]) await MockConvex.signIn(context);
  if (variant.css) await context.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.head.appendChild(s);
    });
  }, variant.css);

  await page.goto(BASE + scenario.path, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  if (scenario.script) await scripts[scenario.script](page, mock);
  if (variant.offline) {
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(400);

  const name = `${scenario.id}${variantName === "base" ? "" : "--" + variantName}`;
  const shot = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: shot, fullPage: !!scenario.fullPage });
  const findings = await inspect(page, { variant: variantName, width: variant.viewport.width });
  const result = {
    name,
    id: scenario.id,
    screen: scenario.screen,
    variant: variantName,
    requested: scenario.path,
    finalUrl: page.url().replace(BASE, ""),
    shot: path.relative(path.join(__dirname, "..", ".."), shot),
    calls: mock.calls.map((c) => c.path),
    errors,
    ...findings,
  };
  await context.close();
  return result;
}

async function main() {
  const filters = process.argv.slice(2);
  fs.mkdirSync(SHOTS, { recursive: true });
  const jobs = [];
  for (const s of scenarios) {
    if (filters.length && !filters.some((f) => s.id.startsWith(f))) continue;
    for (const v of ["base", ...(s.variants || [])]) jobs.push([s, v]);
  }
  const browser = await chromium.launch();
  const results = [];
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const [s, v] = jobs[next++];
      try {
        results.push(await render(browser, s, v));
        process.stdout.write(".");
      } catch (e) {
        results.push({ name: `${s.id}--${v}`, id: s.id, screen: s.screen, variant: v, crash: String(e).slice(0, 400) });
        process.stdout.write("x");
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();
  results.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, "report.md"), summarize(results));
  console.log(`\n${results.length} renders → ${path.relative(process.cwd(), path.join(OUT, "report.md"))}`);
}

function summarize(results) {
  const lines = ["# UX stress test: automatic findings", "", `${results.length} renders. Screenshots in qa/ux/out/shots/.`, ""];
  for (const r of results) {
    const issues = [];
    if (r.crash) issues.push(`crash: ${r.crash}`);
    if (r.finalUrl && r.finalUrl !== r.requested) issues.push(`redirected ${r.requested} → ${r.finalUrl}`);
    if (r.overflowX) issues.push(`horizontal scroll: page is ${r.overflowX}px wide`);
    for (const t of r.smallTargets || []) issues.push(`touch target ${t.w}×${t.h}: ${t.label}`);
    for (const t of r.truncated || []) issues.push(`truncated: ${t}`);
    for (const t of r.offscreen || []) issues.push(`past the right edge: ${t}`);
    for (const t of r.unlabeled || []) issues.push(`input without a label: ${t}`);
    for (const t of r.copy || []) issues.push(`copy: ${t}`);
    for (const t of r.noFocusRing || []) issues.push(`no visible focus ring: ${t}`);
    if (r.runningAnimations) issues.push(`animations still running with reduced motion: ${r.runningAnimations}`);
    for (const e of r.errors || []) issues.push(`console: ${e}`);
    lines.push(`## ${r.name} (${r.screen})`, "", `![](shots/${r.name}.png)`, "");
    if (r.nav) lines.push(`Nav: menu ${r.nav.menu ? "yes" : "no"} · back ${r.nav.back.length ? r.nav.back.join(", ") : "none"} · links ${r.nav.links.join(", ") || "none"}`, "");
    if (r.buttons) lines.push(`Buttons: ${r.buttons.join(" · ") || "none"}`, "");
    lines.push(...(issues.length ? issues.map((i) => `- ${i}`) : ["- no automatic findings"]), "");
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
