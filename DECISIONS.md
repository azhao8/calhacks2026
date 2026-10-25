# Decision log

Append-only shared decision record for `CLAUDE.md`. Add new entries at the bottom; never edit or delete earlier ones. A later entry supersedes an earlier one. Git merges this file with the union strategy (see `.gitattributes`), so parallel appends don't conflict.

Entry format:

```
## YYYY-MM-DD HH:MM PT · <who> · <short title>
- Changed: <what is now true>
- Why: <reason>
- Replaces: BASELINE | CONFIRMED | OPEN | new — <which item>
- Affects: <screens (S01–S15), entities, operations, workstreams>
```

## 2026-10-24 04:30 PT · azhao8 · Adopt CLAUDE.md v1 as the source of truth
- Changed: `CLAUDE.md` v1 (mystery small-group meetups for verified students) is the canonical spec for the Cal Hacks 13 build.
- Why: one shared product definition for all teammates and Claude sessions.
- Replaces: new — supersedes the original pitch (two-person matching, fully packaged plans, tickets, calendar invites, public plan library, reviews), now deferred per CLAUDE.md §2.
- Affects: everything.

## 2026-10-24 05:18 PT · grant-j-kim · Claim: workstream A
- Changed: Claim: grant-j-kim takes workstream A — Understand the student; owned files: `features/profile/ui`, `features/profile/service`
- Why: one writer per workstream, per CLAUDE.md §9.
- Replaces: new — workstream A ownership
- Affects: S01–S06 and A's S15 subsections; User, AnalysisJob, InterestProfile, MeetupPreferences; workstream A

## 2026-10-24 10:06 PT · iamjohncao · Claim: workstream B
- Changed: Claim: iamjohncao takes workstream B — Bring the group together; owned files: `features/matching/ui`, `features/matching/service`
- Why: one writer per workstream, per CLAUDE.md §9.
- Replaces: new — workstream B ownership
- Affects: S07–S09 and B's S15 subsection (cancelling an accepted meetup); Meetup, Invitation, Membership; workstream B

## 2026-10-24 14:18 PT · azhao8 · Pivot to Melos (CLAUDE.md v2)
- Changed: The product is now Melos. It pairs two verified UC Berkeley students by their Spotify listening and sends them to a real event together. `CLAUDE.md` v2 replaces v1. Owner decisions:
  - **Flow:** mobile-first web. Berkeley email code first, then Spotify sign-in (Spotify only, no fallback). The questionnaire runs while we allow-list.
  - **Questionnaire:** budget, who to meet, year in school, how far. "Surprise me" sets up to $25, anyone, Berkeley + Oakland.
  - **Taste:** a Claude taste summary that the student reviews and corrects.
  - **Pairing:** pairs only. A two-step invitation: "Can you make it?" (date, time, cost range), then the event, price and shared-taste hook. The meeting spot is revealed after both accept; the partner's first name only on meetup day.
  - **Changes of plan:** a backed-out partner is replaced from the same event's pool. "Next time" lets the person be invited for other events after 1h. The cutoff is 2h before the meeting; invitations expire after 6h or at the cutoff.
  - **Meetup:** a busy public meeting spot 30 min before the event. Tickets are bought through the official seller's link, with a "Got my ticket" check; Melos takes no payments.
  - **Events and matching:** an Apify event catalog curated by the team. Matching rounds run on a schedule plus an admin "run now". The live demo and video use clearly labeled seeded demo students.
  - **Stack:** Next.js + Convex.
- Why: Instagram/TikTok access conflicted with their terms and added friction. Shared music taste plus a real event gives a concrete reason to meet. It fits the Meta, Anthropic, Visa, Apify and Convex tracks.
- Replaces: CONFIRMED — the v1 product definition, the Instagram/TikTok content source, user-chosen group sizes, the date/time/head-count mystery invitation, the guided journey with report adaptation and extension, the no-payments baseline (now an outbound ticket link, still no payment handling), the "no availability questionnaire" leaning (now "Can you make it?" asks), and "interest review precedes comfort preferences" (preferences now come first, during the allow-list wait). OPEN — stack (now Next.js + Convex) and product name (now Melos).
- Affects: everything. Screens are renumbered S01–S16, and the data model and operations are rewritten (`CLAUDE.md` §8).

## 2026-10-24 14:18 PT · azhao8 · Spotify access through several Development Mode apps
- Changed: Students connect Spotify through several Development Mode apps owned by teammates with Premium, 5 allow-listed students per app. Each student gives their Spotify account email; the app owner adds them by hand; Melos emails them when they can connect.
- Why: Spotify engineers at Cal Hacks verbally approved creating several apps purely for demoing. The owner understands that approval to cover analyzing listening data with Claude for matching.
- Replaces: new.
- Affects: S03, S05, S06, S15, S16; spotifyApps, spotifyAccess, spotifyTokens, tasteSnapshots. The conflict with Spotify Developer Terms VI.1.b and Policy III.13/III.14 is recorded in `CLAUDE.md` §1. OPEN: the engineers' names or written confirmation.

## 2026-10-24 14:18 PT · azhao8 · Team roles replace workstream claims
- Changed: azhao8 owns backend and systems. iamjohncao owns frontend, UI/UX and design. nickzjl is project manager and the bridge between people. grant-j-kim owns packaging: Devpost, video, pitch and tester feedback.
- Why: these are the roles people are actually doing after the pivot.
- Replaces: new. Supersedes the 05:18 workstream A claim (grant-j-kim) and the 10:06 workstream B claim (iamjohncao); workstreams A/B/C no longer exist.
- Affects: `CLAUDE.md` §9 and file ownership.

## 2026-10-24 14:18 PT · azhao8 · Designer owns the whole visual system
- Changed: iamjohncao owns the whole visual system: color, type, spacing, components, motion, icons and UI copy polish. The v1 black-and-white tokens are a placeholder until he replaces them once, for everyone.
- Why: one designer, one coherent look.
- Replaces: CONFIRMED — v1's "black background, white text, highly minimal" (the minimal black-and-white look is now the designer's call).
- Affects: `CLAUDE.md` §4 and every screen.

## 2026-10-24 16:33 PT · azhao8 · Sign-up for any .edu email, with a school picker
- Changed: any address whose domain ends in `.edu` (subdomains included, after trimming and lowercasing) can sign up; the server refuses everything else with `not_edu_email` before storing or sending anything. The design's school picker stays, with only UC Berkeley open (UCLA and Stanford shown as "Coming soon"); `universityId` comes from the picker. Students from different schools can be paired: the "same university" filter is dropped. Melos stays built for UC Berkeley, and the named community is unchanged. Sign-in uses 6-digit Convex Auth codes, valid 15 minutes, at most one new code every 30 seconds, sent from "Melos <hello@melos.azhao.dev>"; the site is `melos.azhao.dev`.
- Why: let judges and students from other schools try Melos while the product stays focused on Berkeley.
- Replaces: CONFIRMED — "UC Berkeley only, verified with an @berkeley.edu email code" and "Berkeley email first". OPEN — departmental `*.berkeley.edu` addresses (now accepted) and the Resend domain (now `melos.azhao.dev`).
- Affects: S02 (new school picker), S03, S16; `CLAUDE.md` §1, §3, §6.4, §8.5 `users` and `universities`, error codes, §10 tests 1–2.

## 2026-10-24 16:33 PT · azhao8 · John's design system is the design source of truth, ported into Tailwind
- Changed: `design/` (iamjohncao's tokens, fonts, components, docs and mockups) is the design source of truth, and `design/docs/voice.md` is the copy source. The app uses Tailwind: the tokens become the Tailwind theme and the components are rebuilt in React and Tailwind; the design's React 18 script bundle and CSS are never loaded directly. Screens without a mockup are built in the same style. Owner rulings where the design and the spec disagreed: no chat (`ChatBubble` unused; the day-of "Open chat" becomes Stay in touch); the partner's first name shows from the offer on; the school picker stays with only Berkeley open; phone and Instagram sharing; distance from campus on the week cards; no local artists page; copy fixes (any `.edu`, events arrive daily, "Your Melos number", no pronouns). Touch targets are 48px. Screens are renumbered S01–S17.
- Why: John finished the design; one coherent look; Tailwind is the team's chosen styling tool.
- Replaces: BASELINE — the v1 placeholder tokens, the component names, the copy table, and 44px touch targets. CONFIRMED — "partner's first name only on meetup day" and "optional number sharing" (now phone or Instagram).
- Affects: `CLAUDE.md` §3, §4, §5 (every screen), §8.5 `contactShares`; `components/`, `app/`.

## 2026-10-24 16:33 PT · azhao8 · Events come from an Apify event agent and publish automatically
- Changed: every event is real; demo events are removed. Our own Apify actor, the event scout, is an agent (the Anthropic SDK's tool runner) with tools for web search, reading pages (Apify Proxy for public pages that block plain requests), map lookups (OpenStreetMap), and saving events. One copy runs per source in parallel, and the actor is published on the Apify Store. It runs daily at about 6 AM PT and on admin demand, looking 14 days ahead. Prices come from the listing, then the ticket page, then a web search; when none is found the event shows "Price not listed". The agent chooses one meeting spot per venue under written rules (busy, public, near the entrance, confirmed on the map within about 250 m, 30 minutes before the start). A run reaches Convex through Apify's webhook (shared secret, repeated runs ignored); the import checks the rules, merges duplicates, stores venues keyed by OpenStreetMap ID, and publishes automatically. The team can pull or edit any event. Upcoming events that go missing are flagged, not deleted. Places to visit move to stretch.
- Why: real, current events without a manual vetting bottleneck; fits the Apify track and Best Actor.
- Replaces: CONFIRMED — "events come from an Apify scrape of public listings that the team curates". BASELINE — demo events, team-vetted meeting spots, excluding events with unknown prices, and the 6–12 event weekly set.
- Affects: `CLAUDE.md` §6.1, §7, §8.5 `venues`, `meetingSpots`, `events`, `eventImports`; S10, S17.

## 2026-10-24 16:33 PT · azhao8 · Plans with two seats, matched within seconds
- Changed: a plan (`meetups` row) has two seats (`meetupMembers` rows). The matcher runs about 15 seconds after any yes or reopened seat, plus a 30-minute sweep and the admin "Run matching now", and does three jobs in order: refill open seats, pair the rest with blossom matching, and fill gaps with demo students. Offers show the partner's first name and last until the earlier of 2 hours or the cutoff. "Next time", no answer, or dropping out before the cutoff reopens only that seat; the other person stays in and does nothing more. There is no cooldown after "Next time". A student holds one seat at a time. After the cutoff nothing is refilled, and a plan with an empty seat is called off. One reconcile step per plan drives every time-based change, and the demo clock calls it directly. Plan states: `forming`, `set`, `done`, `called_off`. Seat states: `offered`, `in`, `out`.
- Why: the old flow was slow (2-hour rounds, 6-hour invitations), restarted everything when one person dropped, and had too many states for the time left.
- Replaces: CONFIRMED — "matching runs in scheduled rounds plus an admin run now" (the triggers now include every change), the 6-hour invitation expiry, the 1-hour "Next time" cooldown, and dissolve-and-backfill re-pairing (re-pairing from the same event stays). BASELINE — the meetup and invitation states and the one-pending-invitation limit.
- Affects: S11–S13; `CLAUDE.md` §6.4–§6.6, §8.5 `meetups`, `meetupMembers`, `matchRuns`, §8.7, §10 tests 7–11.

## 2026-10-24 16:33 PT · azhao8 · Matching from taste embeddings and blossom matching
- Changed: each confirmed taste profile gets a Voyage `voyage-4` vector (1024 dimensions) stored with a Convex vector index, and events are embedded in the same space. Labels come from a fixed list of about 150. The ask picker uses vector search over events, the hard rules, a rerank, and Claude's pick of 3. Pair scores combine vector similarity, rarity-weighted shared items (rarity measured across our own students), a year bonus, and a waiting boost; a pair needs at least one real shared artist, track, or label. Every pair in an event's pool is scored exactly in memory; vector-neighbor search is the documented path if one pool reaches hundreds. Blossom matching (`edmonds-blossom`) pairs the most people first, then the best total fit. The admin page gets a matching inspector.
- Why: the owner asked for a technically serious matcher instead of hand-weighted greedy points.
- Replaces: BASELINE — the point-score weights, greedy assignment, and the deterministic event pre-score.
- Affects: S09, S17; `CLAUDE.md` §6.2–§6.4, §7, §8.5 `tasteProfiles`, `events`, `matchRuns`. Adds Voyage as an outside service.

## 2026-10-24 16:33 PT · azhao8 · Demo students act like real students
- Changed: six demo students are created through the app's own functions from generated listening data, so they get real summaries and vectors. They say yes to every ask, fill a seat after a 1-minute wait when no real partner is free, accept offers and tap "Got my ticket" automatically, and are never paired with each other. They share only fictional 555-0100 to 555-0199 numbers and never Instagram handles. They are labeled on the admin page and left out of every number quoted to judges. Demo plans (every member a demo student or team account) follow the demo clock. Reset never deletes a real student's records.
- Why: this is a demo build, and real signups will be few.
- Replaces: BASELINE — demo students kept apart from real students and asked only about demo events.
- Affects: `CLAUDE.md` §6.7, §10 test 15; S17; seed data.

## 2026-10-24 16:33 PT · azhao8 · Architecture and implementation choices
- Changed: Convex Auth runs client-side (no Next.js server-side auth). Every outside service sits behind one module in `convex/services/`, and outside calls go through Convex's Workpool component for retries. Error codes now cover `.edu` and seats (`not_edu_email`, `code_cooldown`, `offer_expired`, `seat_unavailable`, `already_seated`). Email is limited to sign-in codes and the Spotify-ready notice, because Resend's free plan allows 100 a day; offers arrive in the app only. Spotify's February 2026 changes are recorded: `GET /me` no longer returns the email (a 403 now detects a wrong or un-added account), artist popularity is gone, and genres are deprecated. The Spotify OAuth state is signed. Claude is called with the Anthropic SDK (the tool runner for the scout, validated JSON otherwise) on Opus 5.5 with explicit effort and the server-side refusal fallback; no agent frameworks. §8 now explains how the parts interact, and §13 lists the parallel sessions and human steps.
- Why: decisions made while checking the foundation plan against current Spotify, Convex, Apify, Resend, and Voyage documentation.
- Replaces: BASELINE — §8 operations, error codes, and Spotify notes, and "invitations arrive in-app and by email". OPEN — the Spotify reference check (done).
- Affects: S03, S07, S10; `CLAUDE.md` §7, §8, §9 file layout, §13.

## 2026-10-24 16:33 PT · azhao8 · Prize tracks
- Changed: the Apify row now shows the Store-published agent and the webhook into Convex; the Convex row adds vector search and the Workpool component. Added Best People-First Hack (a Cal Hacks general prize) and Microsoft "Built for the Real World" (OPEN: required technology). Bright Data was considered and declined: it duplicates Apify, competes with it directly, and would only be a small fallback here. The live demo now uses a real event and matching on yes instead of a demo event and the admin button.
- Why: raise the odds of winning a track without changing the product.
- Replaces: BASELINE — the §11 prize table and live demo script.
- Affects: `CLAUDE.md` §11; the Devpost write-up.

## 2026-10-24 17:05 PT · azhao8 · Spotify redirects to our own site; foundation choices
- Changed: Spotify redirects to `https://melos.azhao.dev/spotify/callback` (production) and `http://127.0.0.1:3000/spotify/callback` (local), and that page hands the code and state to a Convex action. Each app's client secret is the Convex env var `SPOTIFY_CLIENT_SECRET_<LABEL>`. Foundation choices recorded here once, per `CLAUDE.md` §5 and §9: routes are `/` (S01, then the home router), `/school`, `/sign-in`, `/about-you`, `/preferences`, `/waiting`, `/connect`, `/spotify/callback`, `/analyzing`, `/taste`, `/week`, `/plan` (S11–S13), `/stay-in-touch`, `/contacts`, `/menu`, `/privacy`, `/admin`, defined in `app/_lib/routes.ts`. `convex/lib/` also holds `validators.ts`, `views.ts` (the UI contract), `access.ts`, `edu.ts`, and `format.ts`. Each parallel worktree uses its own local Convex deployment, because every push replaces a deployment's whole set of functions. The Convex project is `melos` on team `tenderpork`.
- Why: Spotify apps can be created now, before any Convex deployment exists, and never need editing when deployments change; parallel sessions must not overwrite each other's functions.
- Replaces: BASELINE — the callback on the deployment's `.convex.site` address (§8.9).
- Affects: S07; `CLAUDE.md` §8.1, §8.2, §8.9; `docs/setup.md` (already uses these addresses).

## 2026-10-24 19:02 PT · azhao8 · Cloud sessions test in memory; production builds only from main
- Changed: Stage 1 runs as Claude Code cloud sessions, which can't download Convex's local backend. Instead of a local Convex deployment per worktree, each stream session tests its functions in memory with convex-test and regenerates types with `npx convex codegen` against the shared dev deployment; codegen uploads code for analysis only and never makes it live. Only the coordinator pushes to dev or production. The cloud environment allows the Convex, Apify, and OpenStreetMap hosts and holds `MELOS_DEV_DEPLOY_KEY`, `APIFY_TOKEN`, `MELOS_ANTHROPIC_API_KEY`, and later `MELOS_PROD_DEPLOY_KEY` (prefixed so neither the Convex CLI nor Claude Code picks them up by default). Vercel builds only production: `vercel.json` runs `npx convex deploy --cmd 'npm run build'`, then the idempotent seed, and skips every other build, so branch builds never touch production. Cross-stream function names are fixed in `docs/stage1-briefs.md`, and calls between streams are wired by the coordinator after merge.
- Why: isolated local backends are blocked in cloud sessions, the owner works from a phone, and a branch build must never push branch code to the production deployment.
- Replaces: BASELINE — one local Convex deployment per worktree (the 17:05 PT entry). Implements `CLAUDE.md` §8.1 "Preview deploys are off".
- Affects: `README.md`, `docs/setup.md`, `docs/stage1-briefs.md`, `vercel.json`; no screens or data contracts.

## 2026-10-24 19:18 PT · azhao8 · Spotify redirect addresses come from config; shared pools and guard
- Changed: `spotifyApps` doesn't store a `redirectUri`. Every app registers the same two addresses (§8.9), so the server builds them from config (`SITE` plus `SPOTIFY.callbackPath`) and accepts only those two, bound into the signed OAuth state. Every stream uses one Workpool client per pool from `convex/lib/pools.ts` (the email pool runs 2 at a time for Resend's free-plan rate) and the shared `requireVerifiedUser` guard in `convex/lib/access.ts`. The `.edu` check normalizes Unicode (NFKC) first and accepts printable ASCII only, so the address that passes is exactly the one stored and sent to.
- Why: one source for the redirect addresses; two clients for the same pool would fight over its settings; and `@auth/core` below 0.41.3 had a critical advisory about validating email before Unicode normalization.
- Replaces: BASELINE — `spotifyApps.redirectUri` in §8.5.
- Affects: S03, S07; `CLAUDE.md` §8.5 `spotifyApps`, §8.9; `convex/lib/`.

## 2026-10-24 19:35 PT · azhao8 · Each matcher run is one mutation per event
- Changed: a matcher run for an event is a single internal mutation that loads the pool, scores every pair, refills seats, runs blossom matching, and fills gaps with demo students, instead of an action that scores and then commits through mutations. Hooks and icebreakers still go through the AI pool after the commit, so no Claude or Voyage call ever runs inside the matcher.
- Why: a mutation is serialized and re-reads current state by construction, so "one run per event at a time" and "re-check before committing" hold without extra locking; a pool of a few dozen students scores well within a mutation's limits.
- Replaces: BASELINE — the matching flow in §8.2 ("the matcher action loads the pool ... a mutation commits each seat").
- Affects: `CLAUDE.md` §6.4, §8.2 Matching; no screens or data contracts.

## 2026-10-24 19:46 PT · azhao8 · Team rehearsals never block the stage demo
- Changed: two team accounts (emails on `ADMIN_EMAILS`) are exempt from the 7-day repeat-pair block with each other, and "Reset demo" also deletes demo plans (every member a demo student or a team account) and the team accounts' asks, so rehearsals don't use up their asks. Reset still never deletes a real student's records.
- Why: the stage demo pairs the two team phones on a real event; a rehearsal earlier that night would otherwise block that pair for 7 days and hand each phone a demo partner instead.
- Replaces: BASELINE — the repeat-pair block for every pair (§6.4, §6.6) and the scope of "Reset demo" (§6.7).
- Affects: `CLAUDE.md` §6.4, §6.6, §6.7; S17 demo controls.

## 2026-10-24 21:37 PT · azhao8 · No account deletion flow or address for the hackathon
- Changed: Melos shows no account-deletion control or address. The privacy page stays: it says what we read from Spotify and why, as Spotify's developer policy requires. Disconnecting Spotify still deletes every Spotify-derived record (tokens, snapshot, taste profile, vector).
- Why: the owner judged account deletion unnecessary for a hackathon build; the Spotify data rules are met by disconnect.
- Replaces: OPEN — the account deletion workflow and address (§5 S16, §13 open items).
- Affects: S16 menu and the privacy page copy.
