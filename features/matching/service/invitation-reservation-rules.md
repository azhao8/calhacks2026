# Invitations and reservations — what B has to guarantee

Workstream B · iamjohncao · 2026-10-24 · Rules and test plan for `CLAUDE.md` §5 (S07–S09), §6, §8 and §10, written before any code exists.

This is a proposal and a checklist, not a decision. Nothing here changes the spec until the team agrees and logs it in `DECISIONS.md`. It adds no code, no dependencies and touches no shared file. Entity and field names are illustrative: the schemas belong to the foundation session (§8, §9).

How rows are labelled:

- **spec** — restates `CLAUDE.md` as written, with the section.
- **proposal** — my reading where the spec is silent or ambiguous. B can build against it behind fixture adapters as provisional; anything another lane or the foundation can observe waits for a `DECISIONS.md` entry.
- **question** — something B cannot settle alone. Collected in the last section.

Citations: §6.N means item N of the §6 Lifecycle list, §10.N means item N of the §10 core end-to-end test, and S01–S15 are the §5 screens.

Nothing in this note has been run. There is no stack to run it on yet (§8: transport, backend and database are OPEN), so the rules are written as behavior any valid implementation must provide, not as tables or endpoints.

## Scope

| B owns | B reads or hands off |
| --- | --- |
| Matching, invitations, reservations, replacements (§9) | A: reviewed profile and preferences, through a restricted matching view (§8) |
| S07 home / finding a group, S08 invitation, S09 accepted meetup (§5) | C: journey preparation, start, advance, leave, participation updates (§6, §8) |
| `Meetup`, `Invitation`, `Membership` records (§8) | Foundation: schemas, auth, navigation, design tokens, university config (§8, §9). The injectable clock and shared timing configuration that §6 requires have no assigned owner (question 12). |
| Cancelling an accepted meetup, the B subsection of S15 (§5) | |

Owned folders: `features/matching/ui` and `features/matching/service` (§9, claimed in `DECISIONS.md`).

## State machines

State names are the suggested vocabularies in §8. The transitions and triggers are my reading of §5 and §6.

### Invitation

| From → to | Trigger | Notes | Source |
| --- | --- | --- | --- |
| (new) → `pending` | B issues it | Only after C has prepared the journey. A failed preparation never yields a usable-looking invitation. | spec §6.3 |
| `pending` → `accepted` | User taps "Accept" | One atomic step that also creates a `reserved` membership (see Accept). | spec §6.4, §8 |
| `pending` → `declined` | User taps "Next time" | Once only, no reason asked. | spec §5 S08 |
| `pending` → `expired` | Server clock reaches the expiry | Also set by a background sweep, but correctness must not depend on the sweep having run. | spec §6 table |
| `pending` → `revoked` | Meetup is cancelled | The spec lists `revoked` but no trigger. I read it as "the offer was withdrawn by the system" (question 3). | proposal |
| `accepted` stays `accepted` | Member later cancels | The membership carries the cancellation, so the history stays readable. | proposal |

`accepted`, `declined`, `expired` and `revoked` are terminal. A declined or expired invitation can never be accepted later.

### Meetup

| From → to | Trigger | Source |
| --- | --- | --- |
| `preparing` → `inviting` | C returned a journey ID and B issued the first invitations | spec §6.2–3 |
| `preparing` → `cancelled` | Preparation failed and B gave up (how many retries: question 9). No invitation has been shown, so no user sees anything. | proposal |
| `inviting` → `confirmed` | Reservation cutoff reached and the accepted group is a compatible size | spec §6.7 |
| `inviting` → `cancelled` | Cutoff reached and the accepted group is not a compatible size | spec §6.7 |
| `confirmed` → `cancelled` | Before the start, cancellations reduce the group below the remaining members' compatible sizes (§6.8's wording; how it relates to the §6.7 test is question 10) | spec §6.8 |
| `confirmed` → `active` | C asks B to record the start, and B accepts it only from `confirmed`. The spec names only participation end and completion as handoffs to B, so this one is new (question 2). | proposal |
| `confirmed` → `cancelled` | Nobody starts the journey within a grace window after the scheduled start (window: question 14), so a no-show meetup cannot sit `confirmed` forever | proposal |
| `active` → `completed` | C reports that all participants finished or left, or the journey closed | spec §6, §8 |

One person leaving never completes the meetup (§8). Before cutoff the meetup is `inviting`, so S09 can only say the group is still being finalized. It must not call the group confirmed (§5 S09).

### Membership

| From → to | Trigger | Owner |
| --- | --- | --- |
| (new) → `reserved` | The atomic accept | B |
| `reserved` → `cancelled` | Member cancels on S09 before the start, or the meetup is cancelled | B |
| `reserved` → `participating` | Member joins the live journey | C emits, B records |
| `participating` → `finished` / `left` | Member finishes or leaves | C emits, B records |

Directory eligibility for C (S14): an accepted member whose reservation was not cancelled before the meetup started. Leaving after the start keeps access. B's eligibility read has to expose enough (status, cancelled-at, meetup started-at) for C to apply that rule on the server, and C must never trust a client-supplied participant list (§8).

## Operations

### Accept (S08 → S09)

Identity comes from the authenticated session, never from a client-supplied user ID (§8). The checks and the writes happen as one serialized step against everything that can touch the same invitation, the same meetup's seat count, or the same user's active-meetup slot. Transactions, conditional writes or compare-and-set all qualify; the choice waits for the stack (§8: "atomic reservations").

Every writer of meetup state (accept, decline, member cancel, the cutoff job, meetup cancellation and C's start) serializes on one per-meetup version, whether a lock or a compare-and-set, so check 6 below can never read a status the cutoff job is changing. Issuing an invitation is a conditional write too: it fails if the user already has a pending invitation or an active meetup, so I4 is enforced where invitations are written and not only when candidates are chosen. (proposal)

Checks, in this order:

1. Caller is authenticated, otherwise **authentication failure**.
2. The invitation exists and belongs to the caller, otherwise **forbidden**. The answer is the same for "missing" and "someone else's" so IDs cannot be probed.
3. If it is already `accepted` by this caller and the membership is `reserved` or `participating`, return the same success and the same data. No second membership. (Idempotent, §8.)
4. Status is `pending`. `declined`, `expired`, `revoked` or a cancelled membership → **expired invitation** (see question 4 on the missing "cancelled" category).
5. Server clock is before the invitation's expiry, even if the sweep has not flipped the status yet. (proposal: the boundary is exclusive, so a request at exactly the expiry instant is expired.)
6. Meetup is `inviting` and the clock is before the cutoff, otherwise **expired invitation**.
7. Reserved memberships for this meetup are fewer than its target count, otherwise **unavailable seat**.
8. The caller has no other `reserved` or `participating` membership in a meetup that is not completed, and belongs to the meetup's university. By construction this cannot fail (one pending invitation and one active meetup at a time, §6), so a failure is rejected and logged rather than surfaced as ordinary copy. (proposal)

Effects: invitation → `accepted`, membership created as `reserved` with the acceptance time, and the S09 view returned. A transient failure is **retryable** and safe to repeat because of check 3. The UI keeps the pending state until the server answers, never reveals the location optimistically, and never shows success after a failed reservation (spec §5 S08).

### Decline ("Next time")

- Caller authenticated and owns the invitation. Outcome by invitation state: `pending` → `declined`, once; `declined` → the same success with no new side effects; `accepted` (a stale "Next time" after an accept) → no change, and the response carries the current state so the UI opens S09, where the member can cancel on purpose; `expired` or `revoked` → S07 without an error. (spec §8: atomic, idempotent, authorized; the per-state outcomes are proposal)
- Never invite this user to this meetup again, and start the 1-hour cooldown before another meetup. (spec §6 table)
- Before cutoff, request a replacement for the vacated seat (see Replacement). (spec §5 S08)
- Return to S07. Declining an already-expired or revoked invitation is not an error the user sees; the screen is S07 either way, and nothing shames declining (§3). (proposal)

### Cancel participation (S09 secondary action)

- `reserved` → `cancelled`, idempotent, authorized, and only while the meetup is not `active`. Once it is active, leaving belongs to C (§5 S15), so a cancel that loses the race to the start is answered with a pointer to the live experience. The meetup's own status decides which operation won; the start and the cancel need to be serialized against the same meetup version. (proposal, cross-lane: question 2)
- Record the cancellation time; the directory rule depends on it.
- Before cutoff, the seat reopens and a replacement is requested. After cutoff, no replacement; re-check size compatibility (see Cutoff).
- Cancelling is not rejecting a new invitation (spec §5 S09). I propose no cooldown after a cancel beyond the normal rules; the spec only defines one after "Next time". (question 8)

### Read current invitation (S07, S08)

Returns only the invitation-safe fields (spec §8). I propose exactly these: invitation ID, status, start instant (rendered as an explicit date and local time in the university's timezone), target group count, and the expiry time. The spec allows operational expiry notices (S08).

Never returned before acceptance: landmark, address, coordinates, route preview, names, avatars, social handles, common-interest explanation (spec §5 S08; §10.4 requires both API and UI to withhold them). The response is built from an allowlist of those fields, not by deleting fields from a fuller record, so a new column cannot leak by default.

The server state is fetched before showing an invitation, including through a deep link, with the same membership checks as normal navigation (spec §5).

### Read accepted meetup (S09)

The response depends on who is asking (proposal, except where cited):

| Caller | Response |
| --- | --- |
| `reserved` or `participating` member of a live meetup | Full view: date, time, target size, starting landmark, a short locating description, the directions target (where the landmark is stored is question 13), and the journey ID C needs so everyone opens the same journey (§10.6). No attendee identities and no future itinerary (spec §5 S09). |
| Member whose meetup was cancelled by the system | The cancellation state only: no landmark and no time-to-start call to action (spec §5 S09). |
| Pending, declined, expired, self-cancelled or unrelated user, or not signed in | The same refusal in every case (authentication failure or forbidden), with nothing that confirms the meetup exists (spec §10.6). |

Group status and "Open experience" come from the committed `Meetup.status`, not from the clock: `inviting` shows "still being finalized" and `confirmed` shows the group as confirmed. The clock only decides whether "Open experience" is enabled once the meetup is `confirmed` and the scheduled time has passed, using the server clock so demo clock changes apply. If a read finds `inviting` with the clock at or past the cutoff, it runs the cutoff step itself (idempotent) rather than guessing. If the confirmed group is smaller than the target, S09 shows the current count as a number only, with no who or why.

### Home state (S07)

An accepted or live meetup takes priority over a new invitation (spec §5 S07). The invariants below mean a user never has both, so the priority rule is a backstop. States B contributes: searching, invitation pending, accepted meetup, and a notice that a meetup was cancelled. No participant browsing, no compatibility percentages, no countdown, and no pretending a group exists while searching (§5 S07, §3). Searching is a static state with the baseline copy: no spinner, progress figure or live counts (§3: no fake progress, no fake users). With an empty eligible pool it says plainly that nothing is available yet and what happens next. A user whose membership is `finished` or `left` lands back on S07 searching and can be matched again once C's handoff releases them (§8). (proposal)

## Time

| Rule | Value | Source |
| --- | --- | --- |
| First invitation lead time | issued at least 12 h before the start | spec §6 table |
| Reservation and replacement cutoff | start − 2 h | spec §6 table |
| Pending invitation expiry | earlier of issue + 6 h or the cutoff | spec §6 table |
| Cooldown after "Next time" | 1 h before another meetup; never the same meetup | spec §6 table |
| Replacement lead time | the 12 h lead applies to first invitations only; a replacement just has to be issued before the cutoff | proposal |
| Expiry and cutoff boundary | exclusive: the instant itself counts as expired | proposal |

All of these are baselines, not founder-confirmed (§6). They come from one shared configuration and one injectable clock. Accelerated demo scenarios change the configuration, never add "demo-only" branches in B's code (§6). Timestamps are stored in UTC and rendered in the university's configured timezone; the device timezone never changes the meetup's intended time (§6).

## Replacement and cutoff

### Replacement

A seat is vacated by a decline, an expiry, or a member's cancel before the cutoff. Each vacancy has an identity, the invitation or membership that was vacated, and a replacement is keyed on it with a uniqueness rule, so one vacancy produces exactly one replacement attempt even if the decline handler and the sweep both react. Seat accounting: the first wave issues exactly the target count, and a replacement is issued only while reserved memberships plus live pending invitations are fewer than the target. An invitation past its expiry no longer counts, even before the sweep flips it. The capacity check in Accept (check 7) stays as the backstop. (proposal)

A replacement candidate must fit the existing time, starting point and experience constraints (spec §6.5), and must be:

- from the same university, with a reviewed profile and saved preferences;
- willing to join the group size already chosen for the meetup;
- free of conflicts with hard activity constraints, checked before interest overlap is ranked (spec §6);
- without another pending invitation or active accepted meetup, and outside any cooldown;
- never previously invited to this meetup (the spec bars a repeat only after "Next time"; extending that to expired and cancelled invitations is my proposal).

Candidates are ranked by a simple interest overlap with stable tie-breakers, so the demo repeats (spec §6). If nobody fits, the vacancy stays and the cutoff resolves it. Members only see "still being finalized".

A replacement issued minutes before the cutoff would give the person almost no time to answer: question 5.

### Cutoff job

Runs once per meetup, keyed on the meetup ID, and acts only on a meetup that is still `inviting`, so a duplicate run changes nothing. (spec §8: background work must be retry-safe)

1. Any remaining `pending` invitation has already reached its expiry (expiry is never later than the cutoff).
2. Let *n* be the number of `reserved` memberships. If *n* equals the target count, the meetup becomes `confirmed`.
3. If *n* is smaller, it becomes `confirmed` only if *n* is in every accepted member's stored set of allowed sizes. Otherwise it becomes `cancelled` and accepted members are told. (spec §6.7)
4. Group sizes are 2–6 and include the user (spec §5 S06), so *n* below 2 is never compatible. I read the Meetup's "compatible minimum policy" as this rule evaluated against the accepted members' arrays at cutoff, not a number fixed at creation, because the accepted set changes: question 10.

### After the cutoff

- No new people join a journey that is about to start (spec §6.8).
- If a member cancels before the start and the remaining size is still compatible with everyone left, the meetup continues without a replacement. If not, it is cancelled with a clear notice (spec §6.8).
- If the group arrives short at the start, that is C's report and adaptation flow, not B's (spec §6.8).

### Cancelling a meetup

Pending invitations become `revoked`, reserved memberships become `cancelled`, and S08 or S09 show a brief explanation that returns to S07 (spec §5 S08, S09). Accepted members get a notice. The spec gives no copy and no delivery channel for it: question 6. I propose no cooldown after a system cancellation, because the person did nothing. (proposal)

## Invariants

Each of these should be asserted by a test once a stack exists.

| # | Invariant | Source |
| --- | --- | --- |
| I1 | Reserved memberships per meetup never exceed the target count, including under concurrent accepts. | spec §10.5 |
| I2 | At most one membership per (meetup, user). | proposal |
| I3 | An invitation is `accepted` if and only if a membership exists for it. | spec §6.4 |
| I4 | A user has at most one pending invitation and one active accepted meetup at a time. | spec §6 |
| I5 | No invitation exists for a meetup without a prepared journey. | spec §6.3 |
| I6 | No invitation is issued at or after the cutoff. | spec §6.8 (the "at" boundary is a proposal) |
| I7 | Everyone in a meetup shares one university, verified on the server. | spec §6 |
| I8a | The starting landmark and address appear only in responses to the meetup's own `reserved` or `participating` members. | spec §10.4, §10.6 |
| I8b | B never returns another participant's identity before the meetup; the S09 view carries none. | spec §8 `Membership` |
| I9 | A terminal invitation never becomes `pending` or `accepted`, and a declined user is never re-invited to the same meetup. | spec §6 table |
| I10 | An expired invitation cannot be accepted even if no sweep has run. | proposal |
| I11 | One vacated seat leads to at most one replacement invitation. | proposal |
| I12 | Eligibility is released only for the correct user or a completed meetup. | spec §8 |

## What runs without a user action

Expiry, replacement, the cutoff job, system cancellation and the matching run are driven by time, not by someone opening a screen. Each is idempotent and safe to run twice. Reads and accepts also evaluate time against the server clock themselves, so correctness never depends on a sweep having run; the sweep exists to trigger replacements and notices. Whether this is a scheduler, a queue or something else waits for the stack decision.

The matching run is B-internal. It applies the §6 eligibility and ranking rules: same university, a reviewed profile and saved preferences, a target size taken from the sizes every invited member allows (four by default if compatible, otherwise another compatible supported size), hard constraints excluded before interest overlap is ranked, no overlapping meetups, and a start time from the configured campus slots at least 12 h away. It also needs a deterministic order (stable tie-breakers, so seed data plus a fixed clock gives the same groups) and "never pretend there are users when the pool is empty" (spec §6). Demo users stay labelled in development and demo contexts (spec §6).

## What B needs from other lanes

| From | Need | Why |
| --- | --- | --- |
| A | Restricted matching view: user ID, university ID, verification state, profile ready, interests in a comparable form, allowed group sizes (array), adventure preference, hard constraints | Eligibility and ranking (§6, §8). Hard constraints are used to filter and are never shown. How interests are compared: question 11. Hard constraints are one free-text field in S06, so what B can filter on is question 15. |
| A | Not needed: synthesis text, correction history, source content, display name | Nothing before meeting uses them (§5, §8). |
| C | Prepare journey, idempotent on meetup ID, returning a journey ID | Lifecycle step 2 (§6) |
| C | A way to test whether a candidate fits the prepared journey's constraints | Replacement candidates must fit the experience (§6.5): question 7 |
| C | Retry-safe handoffs to B: participation ended and meetup completed (spec §6.9, §8). Plus a "record the start" request that B can refuse (proposal, question 2). | Spec §6.9, §8 |
| B → C | Server-side membership eligibility read | Spec §8 |
| Foundation | Auth identity on every call, university timezone and domain mapping, vetted location catalog, error contract, injectable clock, shared timing configuration, fixture IDs | Spec §8, §9 |
| Foundation | Where the configured campus time slots live | §6 says schedule from "explicit configured campus time slots", but §8's `University` has no such field: question 12 |

Until services exist, the S07–S09 UI should run against fixture adapters that use the same fixture IDs and schemas (spec §9). A stub is a development boundary, not proof of reservation behavior.

## Test plan

To run once a stack exists. None of this has been run.

| # | Scenario | Assertion | Source |
| --- | --- | --- | --- |
| T1 | 2 and 10 simultaneous accepts from different users for one open seat | Exactly one succeeds; the rest get "unavailable seat"; I1 holds | §10.5 |
| T2 | Same user taps Accept twice at once | One membership; both calls report the same success | §8 |
| T3 | Accept just before, exactly at, and after the expiry, using the injectable clock | Succeeds, fails, fails; the post-expiry case holds with no sweep run | §6 plus proposal (exclusive boundary) |
| T4 | Accept races the expiry sweep | Never both accepted and replaced | proposal |
| T5 | Accept races Decline from the same user | One winner, consistent final state, no orphan membership | I3 |
| T6 | Decline and the sweep both trigger replacement | Exactly one replacement; it fits time, start point and constraints | I11, §6.5 |
| T7 | "Next time", then a new matching run inside and after the cooldown | No invitation inside 1 h; never re-invited to the same meetup | §6 |
| T8 | Cancel races the start (needs C) | Exactly one outcome; the loser gets a clear answer | question 2 |
| T9 | Cutoff with a compatible smaller group, an incompatible one, and a group of 1; run the job twice | Confirmed, cancelled with notice, cancelled; second run changes nothing | §6.7 |
| T10 | Cancel after the cutoff | Compatibility re-check; no stranger added | §6.8 |
| T11 | Landmark and identity requested by an unauthenticated, pending, declined, unrelated and cancelled user | None receive it. Assert on the raw response, not only the UI. | §10.4, §10.6 |
| T12 | Invitation response against the allowlist | Fails if any extra field appears | §8 |
| T13 | User with an active meetup, and user with a pending invitation, run through matching | Neither gets a new invitation | §6 |
| T14 | Empty eligible pool | S07 shows an honest state; no fabricated invitation or user | §5 S07, §6 |
| T15 | Device timezone differs from the university's; a schedule across a daylight-saving change | UTC stored; the intended local date and time render unchanged | §6 |
| T16 | Meetup cancelled with pending and reserved members | Invitations revoked, memberships cancelled, S09 shows cancellation with no stale call to action | §5 S09 |
| T17 | C's journey preparation fails | No invitation is created or visible | §6.3 |
| T18 | Same seed data and clock, run twice; reset from clean seed | Same groups both times | §6, §10.11 |
| T19 | Eligibility read for a member who cancelled before the start, left after it, and a participation end reported for another user | Excluded; included; nobody else's eligibility released | §5 S14, I12 |
| T20 | "Next time" arrives after the same user accepted | No change to the membership; the response opens S09 | proposal |
| T21 | A `confirmed` meetup that nobody starts, read after the grace window | B closes it; no stale call to action | proposal, question 14 |
| T22 | S09 read right after the cutoff with the job not yet run, and once per caller state in the read table | The cutoff step runs idempotently; each caller state gets exactly the stated response, checked on the raw response | proposal |

## Questions for the team

1. **Stack.** Everything above waits for §12 step 1 (native or web, one stack, and the transport and database). Nothing here depends on the answer. *Team.*
2. **Who writes `active` and `completed`?** §6.9 says C owns start and live progression, and names only participation end and completion as handoffs to B, but B owns the `Meetup` record. I lean towards the start being a request B can refuse rather than an event, because an event cannot undo a start that already happened: C asks B to move `confirmed` → `active`, and a member cancel that won the race makes it fail. Completion and participation end stay retry-safe events. *B and C.*
3. **What triggers `revoked`?** The spec lists the status but no trigger. Under the transitions above no meetup is cancelled while an invitation is pending (cancellation happens at the cutoff, after it, or before any invitation exists), so `revoked` is reachable only through an operational cancel before the cutoff, such as a demo reset. Is that wanted, or should `revoked` be dropped? *B.*
4. **Error category for a cancelled meetup or an already-declined invitation.** §8 lists validation, authentication, forbidden, expired invitation, unavailable seat, stale version, generation failure and retryable. I fold cancelled, declined and revoked into "expired invitation" with a reason the UI can use. *Foundation (error contract).*
5. **Minimum response window for late replacements.** Nothing stops a replacement being issued ten minutes before the cutoff. Options: no replacement inside some window, or accept the short window. The number is the team's. *Team, with the §12 step 3 baselines.*
6. **Cancellation notice.** Copy and delivery channel. §5 S07 says to state "in-app only" if no push channel exists, and §2 refers to a chosen demo delivery channel. *Team (copy), foundation (channel).*
7. **Replacement fit.** A candidate must fit the prepared journey's constraints, which only C knows. Options: C publishes the journey's constraint envelope with the journey, or exposes a fit check. *B and C.*
8. **Cooldown after cancel or expiry.** The spec defines one only for "Next time". I propose none after a cancel and none after a system cancellation, and ask whether an unanswered invitation should count like "Next time". *Team.*
9. **Preparation retries.** How many times B retries a failed preparation before cancelling a meetup nobody has seen. *B and C.*
10. **Meetup's "compatible minimum policy".** I read it as a rule evaluated at cutoff (sizes are 2–6 including the user), not a stored number. If the foundation wants a stored field, it should be a cached value derived from members' size arrays. Also, §6.8 words the later test as the group falling "below all members' compatible sizes"; I applied the same test as §6.7, and the team should confirm that is the intent. *Foundation and team.*
11. **Interest format for matching.** S05 produces plain-language labels. Overlap on free text will rarely match. I lean towards A storing a canonical, comparable key per interest alongside the display label, and B computing overlap on the keys. This touches A's contract. *A and B, then the foundation.*
12. **Where do the configured time slots live?** `University` in §8 has no field for them. Also, §6 requires one injectable clock and one shared timing configuration, but §9 and §12 step 4 do not say who builds them. *Foundation.*
13. **Where does the starting landmark live?** `Meetup` in §8 has no location field. The landmark appears to belong to the first journey step (C), yet S09 is B's screen. Either S09 reads it through a membership-checked read provided by C, or `Meetup` carries a start-location ID. *Foundation, B and C.*
14. **Grace window for a meetup nobody starts.** A `confirmed` meetup needs a way to close if no member starts it. B proposes closing it as `cancelled` once a configured grace window after the scheduled start has passed. The length is the team's. *Team.*
15. **Hard constraints are free text.** S06 collects them in one text field. Either A derives a structured set that B can filter on, or B never sees them and only the journey side (C) does, with the fit check from question 7 covering replacements. *A, B and C.*
