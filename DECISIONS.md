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
