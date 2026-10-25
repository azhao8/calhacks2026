import * as cheerio from "cheerio";

// Turns a page into compact text plus links, so the model reads content rather than markup.
// The text is data from the web, never instructions; the agent's system prompt says so.

export type PageText = { url: string; title: string; text: string; links: { text: string; url: string }[] };

const DROP = "script, style, noscript, svg, iframe, template, nav[aria-hidden='true'], [hidden]";

function squeeze(text: string): string {
  return text
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function htmlToText(html: string, baseUrl: string, maxLinks: number): PageText {
  const $ = cheerio.load(html);
  const title = squeeze($("title").first().text());
  // JSON-LD often carries exact event data (start time with offset, offers with prices).
  const jsonLd = $("script[type='application/ld+json']")
    .map((_, el) => $(el).text())
    .get()
    .filter((block) => /Event|Offer/.test(block))
    .map((block) => block.replace(/\s+/g, " ").slice(0, 4000));
  $(DROP).remove();
  $("br").replaceWith("\n");
  $("p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article, header, footer, time").each((_, el) => {
    $(el).append("\n");
  });
  const links: { text: string; url: string }[] = [];
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    if (links.length >= maxLinks) return;
    const href = $(el).attr("href") ?? "";
    let url: string;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:/.test(url) || seen.has(url)) return;
    seen.add(url);
    links.push({ text: squeeze($(el).text()).slice(0, 100), url });
  });
  const body = squeeze($("main").length > 0 ? $("main").text() : $("body").text());
  const text = jsonLd.length > 0 ? `${body}\n\nStructured data on this page:\n${jsonLd.join("\n")}` : body;
  return { url: baseUrl, title, text, links };
}

// Plain-text bodies (ICS calendar feeds, JSON, RSS) pass through, trimmed of noise.
export function plainToText(body: string, url: string): PageText {
  const text = body
    .replace(/\r\n/g, "\n")
    // Unfold ICS continuation lines.
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .filter((line) => !/^(UID|DTSTAMP|SEQUENCE|CREATED|LAST-MODIFIED|PRODID|VERSION|CALSCALE|X-[A-Z-]+):/.test(line))
    .join("\n");
  return { url, title: "", text: squeeze(text), links: [] };
}

export function formatPage(page: PageText, maxChars: number): string {
  const text = page.text.length > maxChars ? `${page.text.slice(0, maxChars)}\n[cut off at ${maxChars} characters]` : page.text;
  const links = page.links
    .filter((link) => link.text.length > 0)
    .map((link) => `- ${link.text} -> ${link.url}`)
    .join("\n");
  return [`URL: ${page.url}`, page.title ? `Title: ${page.title}` : "", "Text:", text, links ? `Links:\n${links}` : ""]
    .filter((part) => part.length > 0)
    .join("\n");
}
