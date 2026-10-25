// Automatic checks against CLAUDE.md §3 (copy) and §4 (layout and accessibility) on a rendered page.
// They find candidates; a person still reads the screenshot. Anything they flag is listed per render.

async function inspect(page, { variant, width }) {
  const dom = await page.evaluate((vw) => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.01;
    };
    const label = (el) =>
      (el.getAttribute("aria-label") || el.innerText || el.getAttribute("title") || el.getAttribute("name") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 70);

    // Horizontal page scroll.
    const doc = document.scrollingElement;
    // Mobile emulation widens the layout viewport to fit wide content, so compare with the device width.
    const overflowX = Math.max(doc.scrollWidth, window.innerWidth) > vw + 1 ? Math.max(doc.scrollWidth, window.innerWidth) : 0;

    // Touch targets under 48×48. Inline links inside running text are noted separately.
    const interactive = [...document.querySelectorAll("a[href], button, input, select, textarea, [role=button], [role=radio], [tabindex]:not([tabindex='-1'])")].filter(visible);
    const smallTargets = [];
    for (const el of interactive) {
      if (el.matches("input[type=hidden]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5) {
        const inline = el.tagName === "A" && getComputedStyle(el).display === "inline";
        smallTargets.push({ w: Math.round(r.width), h: Math.round(r.height), label: (inline ? "[inline link] " : "") + label(el) });
      }
    }

    // Text cut off: overflow hidden/ellipsis/line clamp with content wider or taller than the box.
    const truncated = [];
    const offscreen = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el) || el.children.length > 3) continue;
      const s = getComputedStyle(el);
      const text = (el.innerText || "").trim();
      if (!text) continue;
      const clips = s.overflowX !== "visible" || s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none";
      if (clips && (el.scrollWidth > el.clientWidth + 1 || (s.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1))) {
        truncated.push(text.slice(0, 70));
      }
      const r = el.getBoundingClientRect();
      if (el.children.length === 0 && r.right > vw + 1) offscreen.push(`${text.slice(0, 60)} (right ${Math.round(r.right)})`);
    }

    // Inputs need a persistent label.
    const unlabeled = [];
    for (const el of document.querySelectorAll("input:not([type=hidden]), textarea, select")) {
      if (!visible(el)) continue;
      const id = el.id;
      const has =
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
        el.closest("label");
      if (!has) unlabeled.push(`${el.tagName.toLowerCase()} ${el.getAttribute("placeholder") || el.name || ""}`.trim());
    }

    // Visible text, for the copy rules.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (t && n.parentElement && visible(n.parentElement) && !n.parentElement.closest("script,style")) texts.push(t);
    }

    const buttons = [...document.querySelectorAll("button, a[href]")].filter(visible).map(label);

    // Navigation out of this screen.
    const links = [...document.querySelectorAll("a[href]")].filter(visible).map((a) => a.getAttribute("href"));
    const menu = !!document.querySelector('a[aria-label="Open menu"], button[aria-label="Close menu"]');
    const back = [...document.querySelectorAll("a[href], button")]
      .filter(visible)
      .map(label)
      .filter((t) => /\b(back|close|home|cancel|done)\b/i.test(t));

    const runningAnimations = document.getAnimations().filter((a) => a.playState === "running").length;

    return { overflowX, smallTargets, truncated, offscreen, unlabeled, texts, buttons, nav: { menu, back, links: [...new Set(links)] }, runningAnimations };
  }, width);

  // Copy rules (CLAUDE.md §3). Emails, URLs and @handles are data, not copy.
  const copy = [];
  const seen = new Set();
  for (const raw of dom.texts) {
    const t = raw.replace(/\S+@\S+|https?:\/\/\S+|@[\w.]+/g, "");
    const add = (why) => {
      const key = `${why}: “${raw.slice(0, 90)}”`;
      if (seen.has(key)) return;
      copy.push(key);
      seen.add(key);
    };
    if (/[–—]/.test(t) || /\s-\s/.test(t) || /[A-Za-z]-[A-Za-z]/.test(t)) add("dash or hyphen");
    if (/!/.test(t)) add("exclamation mark");
    if (/\p{Extended_Pictographic}/u.test(t)) add("emoji");
    if (/\b(he|she|her|him|his|hers)\b/i.test(t)) add("gendered pronoun");
    if (/\byour match\b|\bmatched with\b/i.test(t)) add("date language");
    if (/\d+\s?%/.test(t) && !/font|zoom/i.test(t)) add("percentage");
  }
  for (const b of dom.buttons) {
    const words = b.split(" ").filter((w) => /^[A-Za-z]/.test(w));
    if (words.length >= 2 && words.slice(1).every((w) => /^[A-Z]/.test(w)) && !/UC Berkeley|Melos|Spotify|Instagram/.test(b)) copy.push(`title case button: “${b}”`);
  }

  // Focus rings: tab through the first focusable elements and look for an outline or ring.
  const noFocusRing = [];
  if (variant === "base") {
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 1.5) || (s.boxShadow && s.boxShadow !== "none");
        const name = (el.getAttribute("aria-label") || el.innerText || el.tagName).trim().replace(/\s+/g, " ").slice(0, 60);
        return { ring, name };
      });
      if (!info) break;
      if (!info.ring && !noFocusRing.includes(info.name)) noFocusRing.push(info.name);
    }
  }

  return {
    overflowX: dom.overflowX,
    smallTargets: dom.smallTargets,
    truncated: dom.truncated,
    offscreen: dom.offscreen,
    unlabeled: dom.unlabeled,
    copy,
    noFocusRing,
    runningAnimations: variant === "reduced" ? dom.runningAnimations : 0,
    nav: dom.nav,
    buttons: dom.buttons,
  };
}

module.exports = { inspect };
