# Source-access spike — what Instagram/TikTok input can we actually get?

Workstream A · grant-j-kim · 2026-10-24 · Evidence for CLAUDE.md §12 step 1 and the S03 "source access" OPEN item.

This is evidence and a recommendation, not a decision. Nothing here changes the spec until the team agrees and it is logged in `DECISIONS.md`.

## Recommendation

1. **Primary live path — shared links, fetched through Apify.** The student pastes links to a few reels or TikToks they like. The server fetches public caption, hashtags, sound and optional transcript through Apify (a sponsor), and Claude analyzes that. Label it honestly in S03, e.g. "Paste links to a few reels or TikToks you love" — not "connect your account". **Not yet verified:** needs one run with an Apify token, and the team has to accept the terms-of-service risk below.
2. **Second path — screenshots.** The student uploads 2–3 screenshots of their Reels/Explore or For You feed, and Claude reads them directly. No platform API and no third-party scraping, so it works regardless of what happens with Apify. **Untested.**
3. **Optional — data export upload.** Richest source (likes, saves, watch history), but it takes hours to days to arrive. Anyone who wants to demo with their own export should request it **today**.
4. **Fallback — fixture content**, labelled "Demo content" on screen as S03 and §10 require.

Everything else we looked at is ruled out for this build (table below).

## Options compared

| Path | What we'd get | Access needed | Time to data | Policy | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Instagram API with Instagram Login | The account's own published media | Professional (business/creator) accounts only; Meta app | — | — | **No.** Students mostly have personal accounts, and it doesn't expose liked/saved/watched content | Docs |
| Instagram Basic Display API | — | — | — | — | **No.** Shut down 2024-12-04 | Docs |
| Instagram oEmbed (Graph API) | Embed HTML only | Meta app token | Instant | Meta allows it only for displaying the embed; "using metadata or content for other purposes, including analytics, is prohibited" | **No** | Docs + tested |
| TikTok oEmbed | For a video: an iframe player, no caption/author/thumbnail. For a profile: name only | None | Instant | — | **No.** No usable text, and TikTok says this endpoint "will be deprecated soon" | Docs + tested |
| TikTok Display API | The user's own posted videos (`video.list`) | TikTok app + review; sandbox limited to testers | — | — | **No.** Own uploads only; most students watch rather than post | Docs |
| TikTok Data Portability API | Activity incl. watch history | Approved app; returns data **only for EEA/UK users** | — | — | **No** for a US campus | Docs |
| Scraping the public post page ourselves | The post page HTML does contain the caption | None | Instant | Automated collection is against TikTok's and Instagram's terms | **No.** We won't build our own scraper | Observed once, not pursued |
| **Apify scrapers on pasted links** | Instagram reels: caption, hashtags, mentions, sound info, thumbnail, optional transcript. TikTok: text, hashtags, music, subtitle links, cover | Apify account + `APIFY_TOKEN` (server only) | Seconds to minutes per run (unmeasured) | Third-party scraping of public posts — same terms concern, handled by a sponsor | **Recommended, pending verification** | Docs only |
| **Screenshots → Claude vision** | Whatever is visible: thumbnails, captions, topic labels | None | Instant | Student shares their own screen | **Recommended second path** | Not tested |
| **Data export upload** | TikTok: JSON/TXT; watch history is link + date only. Instagram: JSON with likes and saves | Student requests it in-app | TikTok ~1–7 days; Instagram "up to 48 hours" (some reports longer); download links expire after a few days | Student's own data | **Optional** — too slow for a live sign-up | Docs (third-party); exact file names unverified |

Exports mostly contain links, not captions, so turning an export into interests still needs a fetch step (Apify) or works from whatever text the export includes.

## What was tested (2026-10-24, plain `curl`, no credentials)

```bash
curl -s 'https://www.tiktok.com/oembed?url=https://www.tiktok.com/@scout2015/video/6718335390845095173'
```

HTTP 200 with only `version, type, width, height, html, provider_url, provider_name, embed_product_id, embed_type`. `html` is an iframe to `tiktok.com/player/v1/<id>`. No `title`, `author_name` or `thumbnail_url`, although the video is live (its page loads normally). This is the example URL from TikTok's own docs.

```bash
curl -s 'https://www.tiktok.com/oembed?url=https://www.tiktok.com/@scout2015'
```

A profile URL returns `type: rich`, `title`, `author_name`, `author_url` — the account name only.

```bash
curl -s 'https://graph.facebook.com/v21.0/instagram_oembed?url=https://www.instagram.com/instagram/'
```

Without a token this still returned `html, provider_name, provider_url, type, version, width` — embed markup only. Meta's terms rule out using it for analysis either way.

`https://api.instagram.com/oembed/` (the legacy endpoint) now redirects (302) to `www.instagram.com/oembed/`.

Not tested: Apify (no token yet), screenshots, real exports.

## Open questions to close before S03 is built

- **Apify run:** with a token, run both actors on ~5 public links each. Record which fields actually come back, run time, cost, and how often a link fails. (CLAUDE.md §9: do not commit raw results.)
- **Terms risk:** does the team accept sponsor-run scraping of public posts the student points us to? If not, screenshots become the primary path.
- **Link format:** links copied from the share sheet are often short links (`vm.tiktok.com/…`, `instagram.com/reel/…?igsh=…`). Check that the actors accept them, or normalize them first.
- **Private accounts:** posts from private accounts won't fetch. S03 needs an "unsupported link" state for these (it already lists one).
- **Instagram export contents:** confirm the folder and file names on a real export before writing a parser.

## Effect on the rest of the spec (proposals only — not made)

- `AnalysisJob.sourceType` would need values for whichever paths are chosen, e.g. `shared_links`, `screenshots`, `instagram_export`, `tiktok_export`, `demo_fixture`. Schemas belong to the foundation session, so this is a proposal.
- An Apify path adds one server-only environment variable, `APIFY_TOKEN`, which goes in `.env.example` by name once the stack exists.
- S03 copy changes from "connect" to "paste links" / "add screenshots".
- Storage: keep the fetched captions and screenshots private and short-lived, and keep only the derived, reviewed interests (S05, §7 "social content is data, not instructions").

## Draft DECISIONS.md entry (for the team to edit, then log on main)

```
## 2026-10-24 HH:MM PT · <who> · Source access for S03
- Changed: S03 offers <paths agreed>, labelled honestly as shared links / screenshots. Fixture content stays available and is labelled "Demo content". Official Instagram/TikTok APIs, oEmbed and our own scraping are not used.
- Why: official APIs don't expose a personal account's watched/liked content for US users; oEmbed returns no usable text or forbids analysis; see features/profile/service/source-access-spike.md.
- Replaces: OPEN — S03 source access (CLAUDE.md §12 step 1)
- Affects: S03, S04, AnalysisJob.sourceType, environment template; workstream A
```

## Sources

- TikTok — [Embed Videos (oEmbed)](https://developers.tiktok.com/doc/embed-videos), [Display API get started](https://developers.tiktok.com/doc/display-api-get-started/), [App review guidelines](https://developers.tiktok.com/docs/en/app-review-guidelines), [Data Portability API](https://developers.tiktok.com/products/data-portability-api)
- Meta — [Instagram oEmbed](https://developers.facebook.com/docs/instagram-platform/oembed), [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login), [Basic Display API](https://developers.secure.facebook.com/docs/instagram-basic-display-api)
- Apify — [Instagram Reel Scraper](https://apify.com/apify/instagram-reel-scraper), [TikTok Scraper](https://apify.com/clockworks/tiktok-scraper); free plan $5/month of usage per [costbench](https://costbench.com/software/web-scraping/apify/free-plan/)
- Third-party, for `video.list` scope: [Phyllo — TikTok API scopes](https://www.getphyllo.com/post/tiktok-api-scopes)
- Exports, third-party: [Phyllo — download TikTok data](https://www.getphyllo.com/post/how-to-download-tiktok-data-see-everything-the-app-knows-about-you), [DTI — TikTok video browsing history](https://portmap.dtinit.org/articles/watch-history3.md/), [Decipher Tools — export Instagram data](https://deciphertools.com/blog/how-to-export-instagram-data/), [takeoutday — Instagram export](https://takeoutday.org/guides/how-to-export-instagram-data)
