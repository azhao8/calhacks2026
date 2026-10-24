# Source-access spike — what Instagram/TikTok input can we actually get?

Workstream A · grant-j-kim · 2026-10-24 · Evidence for CLAUDE.md §12 step 1 and the S03 "source access" OPEN item.

This is evidence and a recommendation, not a decision. Nothing here changes the spec until the team agrees and it is logged in `DECISIONS.md`.

## Recommendation

1. **Primary live path — shared links, fetched through Apify.** The student pastes links to a few reels or TikToks they like. The server fetches public caption, hashtags, sound and optional transcript through Apify (a sponsor), and Claude analyzes that. Label it honestly in S03, e.g. "Paste links to a few reels or TikToks you love" — not "connect your account". **Tested 2026-10-24** on public posts from @instagram and @tiktok and on 10 real liked posts (results below): every direct link fetched, and a bad link comes back as a clear error. Links copied from the phone apps' share sheets are still untested, and the team has to accept the terms-of-service risk below. Keep Instagram transcripts off by default; they cost about 18× more than the post itself.
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
| **Apify scrapers on pasted links** | Instagram reels: caption, hashtags, mentions, sound name, optional transcript. TikTok: text, hashtags, mentions, sound name, auto-caption (ASR) subtitle links | Apify account + `APIFY_TOKEN` (server only) | Instagram ~9 s for 5 links (29 s with transcripts); TikTok 5–28 s | Third-party scraping of public posts — same terms concern, handled by a sponsor | **Recommended** | Tested (official accounts only) |
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

## Apify run (2026-10-24, free plan)

The inputs were 3 recent public posts each from @instagram and @tiktok. Each platform ran twice: once through the profile, then as direct links plus a copy of one link with share-style tracking parameters and one fake link. The script and raw results were kept outside the repo and are not committed.

| | Instagram (`apify/instagram-reel-scraper`) | TikTok (`clockworks/tiktok-scraper`) |
| --- | --- | --- |
| Direct links | 3 of 3 fetched | 3 of 3 fetched |
| Fake link | Error item, `error: not_found` | Error item, `error: "Post not found or private."` |
| Link with tracking parameters | `/reel/<code>/?igsh=…` (a copy of a fetched post) produced no separate item — deduplicated or dropped, inconclusive | `?is_from_webapp=1&sender_device=pc` accepted; the duplicate collapsed into one item |
| Actor run time | 29 s for the direct links (with transcripts); 62 s through the profile | 5–7 s |
| Text available for analysis | `caption` 103–213 chars; `hashtags` 0–1; `mentions` 2–3; `musicInfo.song_name`; `transcript` 2–978 chars (near-empty on music-only reels, and it changed between runs) | `text` 136–187 chars; `hashtags` 0; `mentions`; `musicMeta.musicName`; `textLanguage`; `videoMeta.subtitleLinks` = English ASR captions (links not fetched) |
| List price | $0.0026 per reel, $0.048 per audio minute for transcripts, $0.001 per run | $0.0037 per result, $0.001 per run |
| Charged for this test | ~$0.20, almost all transcripts (4 audio minutes) | under $0.01 |
| Also returned, must be discarded | Latest 10+ comments with commenters' usernames, tagged users, owner name, location | Author profile, detailed mentions, location |

A second run used 10 posts a teammate actually liked, copied from the desktop sites: 5 Instagram reels (`instagram.com/reels/<code>/?hl=en`) and 5 TikToks (`…/video/<id>?is_from_webapp=1&sender_device=pc`). Transcripts were off. What the posts are about is not recorded here.

| | Instagram | TikTok |
| --- | --- | --- |
| Fetched | 5 of 5 (the `/reels/` input came back as the canonical `/p/<code>/`) | 5 of 5 |
| Actor run time | 9 s | 28 s |
| Caption length | 16–1,014 chars | 29–86 chars |
| Posts with hashtags | 3 of 5 (up to 5 each) | 5 of 5 (1–5 each) |
| Sound name | 4 of 5 | 5 of 5 |
| ASR subtitle links | — | 3 of 5 |
| Ads | 1 of 5 was an ad (`productType: "ad"`) | none (`isAd` / `isSponsored` fields exist) |
| Charged | under $0.01 | under $0.01 |

Total Apify spend for the whole spike: $0.22 of the $5 monthly free credit.

What this tells us:

- On brand posts, captions and @mentions carried most of the signal and hashtags were almost absent. Real liked posts had more hashtags (8 of 10) but shorter captions, and one had 16 characters of text and no hashtags. Some links will be too thin on their own, so S04 should ask for more rather than guess (the spec already says this).
- People like and share ads. Analysis should skip or down-weight posts marked as ads or paid partnerships rather than treat them as the student's interests.
- Transcripts cost about 18× the post price and were empty on music-only reels. Five reels cost about $0.015 without transcripts and $0.25–0.35 with them. Keep transcripts off by default.
- Instagram took 9 s for 5 links without transcripts, 29 s with them, and 62 s through a profile; TikTok took 5–28 s. S04's persisted job ID and honest stage display (already in the spec) still matter.
- The free plan's $5 a month covers about 1,900 Instagram reels or 1,350 TikToks without transcripts.

Not tested: screenshots, real exports, and links copied from the phone apps' share sheets (Instagram `/reel/<code>/?igsh=…`, TikTok `vm.tiktok.com/…` short links). Every link tested so far was a desktop-site URL.

## Open questions to close before S03 is built

- **Terms risk:** does the team accept sponsor-run scraping of public posts the student points us to? If not, screenshots become the primary path.
- **Phone share links:** desktop-site URLs all worked, but students will mostly paste from their phones. TikTok's share sheet gives `vm.tiktok.com/…` short links and Instagram's gives `/reel/<code>/?igsh=…`. Try one of each, or resolve and normalize links before calling the actor.
- **Mapping errors to inputs:** Instagram error items don't carry `inputUrl`, so the service needs to match failures back to the student's links itself, e.g. by shortcode.
- **Private accounts:** TikTok reports "not found or private" as one error, so S03's "unsupported link" state should cover both cases.
- **Instagram export contents:** confirm the folder and file names on a real export before writing a parser.

## Effect on the rest of the spec (proposals only — not made)

- `AnalysisJob.sourceType` would need values for whichever paths are chosen, e.g. `shared_links`, `screenshots`, `instagram_export`, `tiktok_export`, `demo_fixture`. Schemas belong to the foundation session, so this is a proposal.
- An Apify path adds one server-only environment variable, `APIFY_TOKEN`, which goes in `.env.example` by name once the stack exists.
- S03 copy changes from "connect" to "paste links" / "add screenshots".
- Storage: keep the fetched captions and screenshots private and short-lived, and keep only the derived, reviewed interests (S05, §7 "social content is data, not instructions").
- The fetch step should keep only caption, hashtags, mentions, sound name, the ad/paid-partnership flags and (if enabled) transcript, and drop everything else immediately. Apify returns other people's comments, usernames, tagged users and locations that we have no reason to hold.

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
