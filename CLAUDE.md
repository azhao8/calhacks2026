# CLAUDE.md — Shared product and implementation specification

Version 1 · October 24, 2026 · Product name not yet chosen

## 0. Read this before changing the project

This file defines the single product all teammates and coding sessions are building. Read it at session start and before changing shared behavior. A polished isolated feature is not complete until it fits the shared flow, data contracts, and design system.

**Status labels:**

- **CONFIRMED:** the founder explicitly chose this direction in the product discussion. Preserve it.
- **BASELINE:** a concrete proposed implementation/design default added to remove ambiguity. Use consistently for scaffolding and the demo unless the team records a replacement. It is not a claim that the founder personally selected it.
- **OPEN:** needs a shared decision or feasibility evidence. Do not silently invent an answer.
- **STRETCH / DEFERRED:** documented for context; do not build ahead of the core.

Unless labeled otherwise, detailed UI copy, tokens, data names, timing rules, algorithms, and edge-case mechanics below are BASELINE. The product principles and explicit decisions marked CONFIRMED take priority. When a requirement conflicts with the repository or another document, identify the conflict and resolve it once in the shared decision record. Do not independently reinterpret it in each workstream.

The product decision record explains intent; the team build playbook explains parallel sessions. This file is self-contained and governs implementation. Keep one canonical copy at the repository root. Do not maintain different specifications on different branches without reconciling them.

Before coding, identify your workstream, allowed files, current dependencies, and the smallest useful working slice. Inspect existing code before scaffolding. Preserve unrelated work. Do not invent commands, installed libraries, credentials, or working integrations.

### How this file changes

This file is the permanent source of truth, and it is expected to evolve as features change or the product pivots. Only the copy on `main` counts. Chat messages, branch-only edits, and older notes do not override it until they land here.

- Start every session with `git pull` so you read the current version.
- To change it, edit this file in its own commit titled `spec: <summary>`, bump the version line at the top, and append an entry to `DECISIONS.md` in the same commit.
- `DECISIONS.md` is the shared decision record/log referred to throughout this file. It is append-only and says what changed, why, whether it replaces a BASELINE, CONFIRMED, or OPEN item, and which screens and contracts are affected.
- CONFIRMED items change only with the founder's agreement. BASELINE items may be replaced by any team decision recorded this way.
- If this file and code on `main` disagree, flag the conflict to your human; do not silently pick one.

## 1. Product definition

An app for verified college students that understands their interests through Instagram/TikTok content, matches them into compatible small groups, and invites them to mystery experiences that unfold in person.

The user should feel: **“This app gets what I’m into. I can trust it enough to show up. I met people I wouldn’t otherwise have met, and I want to do this again.”**

The app turns scrolling into a reason to leave the screen. Success is a genuine offline interaction, not more time browsing the app. The experience should create the possibility of “I never knew you were interested in that too.” Shared interests and ambitions matter more than personality labels or curated identities.

### The central principle — CONFIRMED

> “A central product idea we need to focus on is building trust initially that it’s safe, people are nice, and interactions are genuine, and you can trust the app, and then ramp it up more and more and do more fun stuff.”

This affects matching, onboarding, campus locations, activity intensity, copy, and how the app responds when a plan stops working. Student verification establishes affiliation; do not claim that it guarantees an individual’s behavior or that every activity is risk-free.

### Product decisions and their intent

| Confirmed direction | Why it exists |
| --- | --- |
| Start with college students verified through university email, meeting within their university | Establish a bounded, understandable community and a basis for trust |
| Analyze reel/content interests; show a synthesis for confirmation and typed changes | Make the app do the work; users correct its understanding instead of completing an interest questionnaire |
| Interest review precedes comfort preferences | Show that the app understands the user before asking them to customize the experience; rationale inferred from the chosen order |
| Comfort onboarding is skippable through “Surprise me” | Reduce friction as aggressively as possible for a college social app |
| “Surprise me” is light–medium, with some walking and under roughly 3,500 planned steps | Provide manageable novelty, not an intimidating expedition or an experience with no challenge |
| Users choose comfortable group sizes; higher adventure is available immediately | One-on-one is uncomfortable for some; adventurous users should not be forced through beginner experiences |
| Personal invitations when compatible groups form | Prefer individual matching over scheduled campus-wide drops |
| Date, time, and participant count before acceptance; exact location afterward | Preserve mystery while establishing a simple commitment |
| No participant profile browsing or social-handle lookup before meeting | Let the first impression happen in person |
| Begin at a recognizable campus landmark associated with safety | Familiar surroundings make meeting unfamiliar people easier; rationale inferred |
| Accept reserves a spot; “Next time” declines and allows replacement | Make declining easy without leaving the service entirely |
| Continuous guided journey with an extension option | Sustain the shared experience beyond an introduction |
| Anyone can report an issue; automatically update everyone’s journey | Avoid voting and coordination overhead; the founder explicitly rejected multi-person approvals |
| Optional contact sharing afterward | Relationships should be able to continue independently of the app |

**Current leaning:** no availability questionnaire. The founder prefers surprise invitations that users can decline. The baseline implements that leaning; changing it requires a shared product decision.

## 2. Scope and feature inventory

### Core vertical slice

1. University verification and session recovery.
2. Supported social-content connection/import, analysis, and clear processing/failure states.
3. Synthesized-interest review and correction.
4. Skippable comfort preferences and saved defaults.
5. Same-university matching and personal invitation creation.
6. Invitation acceptance, “Next time,” reservation, expiry, and replacement.
7. Location reveal after acceptance and a recognizable campus start.
8. A continuous, shared sequence of prompts and destinations.
9. Reporting issues and automatically adapting the shared journey.
10. Completion and a short optional extension.
11. Optional phone-number sharing and a minimal contact directory.
12. Settings for editable preferences, account/session actions, and accessible help/reporting.
13. Honest empty/error/offline states and a repeatable multi-user demo.

### Stretch — preserve the direction, leave implementation room

- **Adventure progression:** recommend gradually more adventurous experiences as confidence grows. Attendance, lightweight feedback, and user choice can inform it. Avoid forcing a level-up or conflating physical effort, social intensity, and adrenaline. Users can start higher or step down. This is useful parallel work only after the core flow works.
- **In-app friendships and attending together:** add people met through the app and join new groups together. The team should explore how a familiar companion makes meeting new people less intimidating while preserving discovery. Do not invent a complete friend system as a dependency of contact sharing.
- Optional post-meetup feedback, notifications beyond the chosen demo delivery channel, better recommendation quality, and richer motion.

### Deferred / historical context

The initial idea included fully packaged plans, tickets, calendar invites, a public plan library, reviews, and recommendations mixing generated and pre-made plans. The product shifted toward mystery meetups and unfolding journeys. Those original features are not current core requirements.

Skydiving and 21+ drinking/mini-golf outings were examples of possible future intensity, not hackathon commitments. Do not add payments, alcohol, age-restricted bookings, or extreme activities to the baseline. Exclusivity comes from a small personal invitation and a shared moment, not popularity scoring or selective admissions.

Sponsor ideas: Apify for potential content access, Anthropic for analysis/generation, Figma/Claude design work for shared components, Notability for notes. These are opportunities, not proof of integration feasibility or mandatory stack choices. Instagram’s incentives were part of the positioning discussion, not a technical dependency or verified competitive claim.

## 3. Vibe, voice, and experience direction

### The feeling

**Quiet intrigue. Campus familiarity. Human warmth. Small acts of courage.**

Opening an invitation should feel like receiving a personal note: a time, a few people, a reason to go outside. The screen is sparse enough that the invitation matters. Mystery comes from gradual revelation, not confusing navigation or withholding practical help.

The app should feel composed and confident, never clinical, corporate, threatening, or like a competitive challenge leaderboard. Warmth comes through considerate language and reliable behavior rather than colorful decoration. The minimalist design should still feel like an invitation from someone thoughtful.

During a meetup, the phone should give the group one clear next action and let them look up. Avoid chat feeds, complex dashboards, constantly moving maps, excessive instructions, or a long list of unrevealed stops. There is no in-app group chat in core scope.

### Writing rules

- Short, natural sentences. Sentence case. Contractions are welcome.
- Speak to the person directly. Avoid AI terminology in normal flows.
- Never shame declining, leaving, or choosing a gentler experience.
- No “YOLO,” forced slang, “your tribe,” personality diagnoses, exaggerated hype, or promises of guaranteed friendship.
- Do not imply a group exists while only searching. Do not fake progress percentages or live users.
- Keep private reports private. Explain shared changes neutrally.

| Moment | Baseline copy |
| --- | --- |
| Welcome | “Something in common. Somewhere to go.” |
| Verification context | “Meet verified students from your university.” |
| Analysis | “Finding the things you’re into.” |
| Interest review | “Does this sound like you?” |
| Skip preferences | “Surprise me” |
| Skip explanation | “A little adventure. An easy place to start.” |
| Waiting | “We’re finding your next group.” |
| Invitation | Date, time, and “4 people” as the main content |
| Decline | “Next time” |
| Decline confirmation | “No problem. We’ll keep you in mind for another.” |
| Report | “Tell us what’s happening” |
| Adaptation | “A change of plan. Your next stop is ready.” |
| Main journey end | “That’s the plan. Unless you’re up for a little more.” |
| Contact sharing | “Share your number with this group?” |

## 4. Design system — one baseline for every screen

**CONFIRMED:** black background, white text, highly minimal presentation. The following exact values are BASELINE proposals. Use shared tokens; do not choose different values per feature.

### Tokens

| Token | Baseline |
| --- | --- |
| Canvas | `#080808` |
| Raised surface | `#141414` |
| Primary text | `#F5F5F5` |
| Secondary text | `#B8B8B8` |
| Muted text | `#929292` |
| Divider | `#303030` |
| Control outline | `#777777` |
| Primary button | `#F5F5F5` fill, `#080808` text |
| Focus indicator | `#FFFFFF`, 2-unit outline with offset |
| Error/warning/success | Explicit icon + words; monochrome baseline, never color alone |
| Font | Inter; system sans-serif fallback; bundle the selected font when platform permits |
| Weights | 400 regular, 500 medium, 600 semibold |
| Hero | 36/42, medium; scale to 44/50 on larger widths |
| Screen title | 28/34, medium |
| Section title | 20/26, medium |
| Body | 16/24, regular |
| Label/button | 16/20, medium |
| Small text | 13/18, regular; no essential instruction below this size |
| Spacing scale | 4, 8, 12, 16, 24, 32, 48, 64 |
| Mobile horizontal padding | 24; reduce to 20 on narrow screens |
| Content maximum width | 480 logical units; centered on wider screens |
| Control height | 52 minimum; all touch targets at least 44 × 44 |
| Radius | 12 for controls/panels; 8 for small state labels |
| Motion | 160–220 ms fade/short transition; respect reduced-motion preference |

Numbers are logical layout units, adapted consistently to the chosen platform. Preserve text scaling and safe areas. Use a restrained sans-serif everywhere; dates and times use tabular numerals if available. No separate futuristic display font.

### Components every lane reuses

- `ScreenShell`: safe-area-aware canvas, consistent padding, optional back/header action, scrollable content, keyboard-safe bottom actions.
- `PrimaryButton`: white fill, dark text. One primary action per view. Pending state keeps width stable and prevents duplicate taps.
- `SecondaryButton`: transparent/dark surface with visible outline and white text.
- `TextButton`: quiet action with a full touch target; use for “Next time,” edit, or report links.
- `TextField` / `TextArea`: persistent visible label, outlined dark field, inline error; never rely on placeholder-only labels.
- `ChoiceRow`: selected state uses border plus checkmark; group-size choices are not decorative interest chips.
- `InlineNotice`: concise status, explanation, and one recovery action where needed.
- `BottomSheet`: short reports or preference edits; accessible focus/dismiss behavior and a full-screen fallback if the platform requires it.
- `JourneyStep`, `InvitationSummary`, `ContactRow`: shared structure for domain content, using the same basic components.

No gradients, neon accent palette, glass effects, hero photographs, decorative avatar grids, confetti, XP bars, or endless card stacks. Use a single consistent icon family with restrained stroke weight. Reserve illustrations for a later deliberate decision.

Check contrast, keyboard access where applicable, screen-reader labels, text resizing, small-screen wrapping, and reachable actions. Do not sacrifice usability to sparse styling. Essential state changes should be announced accessibly without repeated noisy announcements.

## 5. Navigation and full screen map

One state-driven home destination, not a tab for every feature. A small persistent settings/help entry is enough. State restoration chooses the correct screen after reload. Logical screen names below are canonical; actual routes depend on the chosen platform.

**Primary flow:** Welcome → Verify university → Connect content → Analyze → Review interests → Comfort preferences → Home/searching → Invitation → Accepted/location → Live journey → Completion/extension → Contact sharing → Directory → Home.

Onboarding back navigation preserves completed work. Deep links must enforce the same authentication/membership checks as normal navigation. Before showing an invitation or journey, fetch its current server state.

### S01 — Welcome / returning entry · Owner A

**Purpose:** explain the promise with minimal effort.

- Sparse hero: “Something in common. Somewhere to go.”
- One supporting sentence: “Turn what you’re into into a reason to meet.”
- Trust line: “For verified students at your university.”
- Primary: “Get started.” Secondary: “Already joined? Sign in.”
- No product tour carousel, long feature list, or mandatory notification prompt.
- Returning authenticated users resume onboarding or their current home/meetup state.

### S02 — University verification · Owner A

- University email field, “Continue,” inline validation, privacy/help links.
- Use the foundation’s single authentication provider. Verification UI uses that provider’s actual email-link/code mechanism; do not invent a second auth system.
- Pending state: destination address, instructions, resend with provider-compatible cooldown, “Use a different email.”
- Supported-university mapping determines university ID. A `.edu` suffix alone is not enough to establish same-campus membership.
- Unsupported university: explain that this campus is not available yet; no fake verification or forced unrelated campus selection.
- Invalid/expired verification: clear retry; network failure preserves the entered email.
- Success proceeds to content input. Verification is enforced on the server.

### S03 — Connect social content · Owner A

- Title: “Let’s find what you’re into.”
- Show only implemented Instagram/TikTok input options. At least one functioning supported path is required for a live claim.
- Explain exactly what will be read and that interests will be reviewed before matching.
- Primary follows the chosen connection/import mechanism. If the real mechanism is shared reel links or an export, label it honestly; do not call it automatic feed access.
- No initial interest checklist or “tell us your hobbies” substitution.
- Source access is an OPEN feasibility item. Demo content must be clearly identified as demo content.
- Denied permission, empty content, unsupported link, and fetch failure each have an appropriate retry/change-input action.

### S04 — Analysis state · Owner A

- “Finding the things you’re into.” One short explanation and a restrained progress indicator.
- Show actual stages if available; no fabricated completion percentage.
- Persist job ID so backgrounding/reload resumes rather than re-running paid calls.
- On failure: “We couldn’t read that content yet” with retry or return to input.
- If the evidence is insufficient, request more supported content. Do not invent confident interests.

### S05 — Synthesized interests and corrections · Owner A

- “Does this sound like you?” followed by a short synthesis and approximately 3–6 plain-language interest labels supported by the input.
- Focus on activities, subjects, and ambitions; avoid identity or sensitive-trait speculation.
- Primary: “That sounds right.” Secondary: “Make a change.”
- “Make a change” reveals a labeled text area: “What should we change?” Save updates the synthesis; user reviews the revised result before continuing.
- Corrections override conflicting inferences. Persist both the effective profile and its revision; keep source content private.
- Do not show model confidence scores, embeddings, raw scraped metadata, or analysis logs to the user.
- Saving error preserves typed corrections. This screen comes before S06.

### S06 — Comfort preferences · Owner A

- Title: “How do you want to meet?”
- Primary: **“Surprise me.”** Supporting copy: “A little adventure. An easy place to start.”
- Secondary: “Set my preferences.” No extra required survey after choosing “Surprise me.”
- BASELINE defaults: groups of 3–4 including the user, light–medium activity, planned total under 3,500 estimated steps, approximately 45–60 minutes.
- Custom panel: allowed group sizes (2, 3, 4, 5, 6; multi-select), adventure preference (“Keep it easy,” “A little adventure,” “Up for an adventure”), optional practical constraints in one text field. At least one size is required only if customizing.
- Exact group-size counts always include the user. Store selected sizes as an array, not an ambiguous label.
- Save custom preferences or apply defaults, then enter matching readiness. No availability questionnaire in the baseline.
- Higher intensity means willingness for more adventurous supported activities; it does not authorize unknown cost, alcohol, or extreme activities.

### S07 — Home / finding a group · Owner B

- “We’re finding your next group.” Calm supporting text: “Your invitation will appear here.”
- Settings/help access. If delivery is in-app only, say so; do not promise a push notification that is not implemented.
- No participant browsing, cards of strangers, compatibility percentages, or daily-drop countdown.
- No compatible group yet: remain honest and useful, not an endless fake loading spinner.
- A newly available invitation replaces this state. A current accepted/live meetup takes priority over new invitations.
- Notification permission, if implemented, is optional and requested in context; denial must not block in-app invitations.

### S08 — Invitation · Owner B

- Main content is only **date, local time, and target group count**. Example: “Thursday, Oct 29” / “6:30 PM” / “4 people.” Use explicit dates, not ambiguous “tomorrow” alone.
- Primary: “Accept.” Secondary text action: **“Next time.”**
- No exact landmark, address, coordinates, route preview, names, avatars, social handles, or common-interest explanation before acceptance.
- Operational expiry/failed-action notices may appear without adding participant information.
- Accept shows pending state until the server reserves the spot. Then open S09. Do not reveal a location optimistically.
- Next time declines once, returns to S07, and schedules replacement selection. No mandatory reason question.
- Expired/full/cancelled invitation: explain briefly and return to S07. Never display successful acceptance after a failed reservation.

### S09 — Accepted meetup / location reveal · Owner B

- “You’re in.” Show date, time, target group size, exact starting landmark, short locating description, and an “Open directions” action.
- Start at a recognizable public campus landmark in the vetted location catalog.
- If replacements are still being invited, quietly say the group is still being finalized. Do not call the whole group confirmed prematurely.
- No attendee profiles or future itinerary reveal. Cancel participation through a clear secondary action; cancellation is not the same as rejecting a new invitation.
- Before scheduled time, show the starting information. At start time, enable “Open experience.”
- If the meetup is cancelled, replace this screen with the cancellation state. Do not retain a stale active call-to-action.
- **No separate arrival/find-your-group screen.** Arrival guidance belongs in the first live step.

### S10 — Continuous live experience · Owner C

- Current prompt/destination dominates the screen. One short instruction, supporting practical detail, and one advancement action.
- Show restrained progress (“1 of 3”) for the current segment, without future destination names. Adaptation may change the count.
- First step names a distinct meeting point and can show a shared meetup marker such as “Circle 12” for people to recognize on each other’s screens. It is a display marker, not an access credential or a separate check-in flow.
- BASELINE: any accepted, still-participating member can start at the scheduled time or advance a step. A server version check makes simultaneous taps advance once.
- Directions are available for the current destination only. No live location tracking or continuous GPS permission is required in core scope.
- “Tell us what’s happening” remains available. A quiet “Leave experience” action is also accessible.
- On shared update, refresh the step in place. No page stack of old destinations. Do not rely on a user to manually refresh.
- Offline: retain the last known instruction with an offline label; disable shared mutations until reconnected. Do not claim a report was submitted if it was not.

### S11 — Report / adaptation panel · Owner C

- Open from S10 without losing journey context.
- Quick choices: “Someone hasn’t arrived,” “Someone is leaving,” “This place is unavailable,” “This activity doesn’t work for us,” “We need a break,” and “Something else.” Allow a short typed explanation.
- For missing participants, ask current headcount; do not require identifying or accusing a person.
- Submit creates a report and triggers automatic adaptation. **No voting, host approval, or per-person acceptance screen.**
- Show a brief adapting state. Replace the shared instruction when the validated update is ready. All participating phones receive the same update.
- Preserve allergies and other hard constraints. Do not publicly show the reporter’s private explanation or attribute a sensitive constraint to them.
- Keep a discreet help/leave route accessible for someone who feels uncomfortable; ordinary journey adaptation is not an emergency response service.
- On generation failure, preserve the last valid journey and offer retry/leave. Do not move users to an unvalidated invented destination.

### S12 — Completion and optional extension · Owner C

- Main segment complete: “That’s the plan. Unless you’re up for a little more.”
- Primary: “Keep going.” Secondary: “I’m done for now.”
- BASELINE: one short extension per meetup, approximately 10–15 minutes, within the existing cost and hard constraints. Do not promise an extension if no suitable option exists.
- Any still-participating member can trigger the shared extension; no group vote. Concurrent requests create one extension.
- “I’m done for now” ends only that person’s participation and proceeds to contact sharing. It must not end the meetup for everyone else.
- When an extension starts, remaining participating phones open the extension step. People who finished remain on their completion/contact flow.
- If an extension would exceed the default planned step budget, shorten it or say no suitable extension is available. Higher adventure preferences use their separately agreed constraints.
- After the extension, show completion without another extension offer. Baseline idle completion window: 10 minutes before closing the remaining shared experience.

### S13 — Optional phone sharing · Owner C

- “Share your number with this group?” Explain: “Only people in this meetup can see it.”
- Primary: “Share my number.” Secondary: “Not now.” No default checked consent.
- If sharing, collect phone number and first name/last initial if not already present. Do not collect a full last name solely to generate an initial. Validate number format; do not claim phone verification unless implemented.
- Saving must succeed before the directory exposes the number. Consent is per meetup, not a global permanent opt-in.
- Both choices proceed to the directory. Declining does not prevent seeing numbers other people chose to share.

### S14 — Contact directory · Owner C

- Minimal black-and-white list. First name and last initial on the left; phone number on the right. Example display only: “Alex R.” and a clearly fictional demo number.
- Tap-to-call/copy as supported, with accessible labels and a small confirmation. Do not send messages automatically.
- Display only voluntarily shared numbers belonging to eligible meetup participants. No greyed-out private numbers or hints revealing non-sharers.
- BASELINE directory eligibility: accepted members whose reservation was not cancelled before the meetup started. Leaving after the start does not remove directory access. This checks group membership, not proof of physical attendance. Do not expose this directory to pending, declined, cancelled-before-start, or unrelated users.
- Empty: “No numbers shared yet.” Update if others opt in later. On small screens, wrap gracefully rather than clipping.
- “Stop sharing my number” revokes future in-app visibility; do not imply it removes copies someone already saved.
- “Back home” returns to S07 when the user is eligible for another meetup. A “Recent connections” entry in settings can reopen directories for meetups they participated in; this is a directory history, not a public social profile.

### S15 — Settings and help · Owners A/B/C by subsection

- University verification status, reviewed interests, comfort preferences, optional practical constraints, account sign-out, help/report access, and recent contact directories.
- Preference changes apply to future matching. They do not silently rewrite a currently accepted invitation; use the report flow for a current activity problem.
- Cancelling an accepted meetup is owned by B. Leaving a live experience is owned by C. Do not duplicate these rules in settings.
- Public launch support/account-deletion/data-retention workflows need explicit operational decisions. Do not display dead controls, pretend that reports are monitored, or claim deletion that has not occurred.

### Shared state treatments

Every asynchronous screen needs loading, empty, error, and restored-session behavior. Loading is local to the affected action where possible. Error copy says what happened and the next available action. Keep typed input after failure. Reuse the same components, not custom popups for every lane.

## 6. Matching, invitation, and timing rules

### Eligibility and ranking

- Server-verified supported university; reviewed profile; saved comfort defaults/preferences.
- Same university for the whole group.
- Chosen planned group size must be in every member’s allowed size set. Target four by default if compatible; otherwise choose a compatible supported size.
- Respect hard activity constraints and exclude incompatible activities before ranking interest overlap.
- Rank compatible candidates using a simple consistent interest-overlap method; stable tie-breakers make the demo repeatable. Do not invent a complex recommender first.
- No overlapping accepted meetups. BASELINE: one pending invitation at a time and one active accepted meetup at a time, simplifying coordination.
- No required availability onboarding. Schedule invitations from explicit configured campus time slots. Do not claim to infer free time from a user’s reels.
- Never pretend there are users when the eligible pool is empty. Demo users remain labeled in development/demo contexts.

### Proposed timing constants — one shared configuration

| Constant | BASELINE |
| --- | --- |
| Initial invitation lead time | At least 12 hours before start |
| Reservation/replacement cutoff | 2 hours before start |
| Pending invitation expiry | Earlier of 6 hours after issue or reservation cutoff |
| Immediate repeat invitation after “Next time” | Do not send another invitation for the same meetup; baseline 1-hour cooldown before another meetup |
| Default main duration | 45–60 minutes |
| Extension offer window | 10 minutes after main segment completion |
| Extension length | 10–15 minutes, once |

These are implementation defaults, not founder-confirmed timings. Use one injectable clock and configuration for accelerated demo scenarios; do not scatter “demo-only” time exceptions throughout the code. Store UTC timestamps and render the university’s configured timezone with clear dates. Device timezone must not silently change the meetup’s intended time.

### Lifecycle

1. B selects a compatible candidate group and determines a target size and schedule.
2. B asks C to prepare one journey for the meetup ID using a vetted campus catalog.
3. If preparation succeeds, B issues invitations. Failure must not produce a usable-looking invitation with no valid journey.
4. A pending invite is an offer, not an accepted reservation. Acceptance atomically checks eligibility, expiry, capacity, and current status, then creates the reserved membership.
5. Decline, expiry, or cancellation before cutoff can trigger replacement selection. Replacement candidates must fit the existing time, starting point, and experience constraints.
6. Before cutoff, pending users receive no starting location. Accepted members can retrieve it. The target count includes the user and is not a false claim that everyone has accepted.
7. At cutoff, confirm the target group. A smaller confirmed size is allowed only if that actual size is compatible with every accepted member’s stored choices; otherwise cancel and notify accepted members.
8. After cutoff, do not introduce last-minute strangers to an already starting journey. If cancellations reduce the group below all members’ compatible sizes before the start, cancel with a clear notice. If the group arrives short, use the shared report/adaptation flow.
9. Starting and live progression belong to C. Participation end and final completion are communicated back to B through retry-safe events/operations.

**Reported absence is not revoked membership.** Adapt to the reported headcount without deleting another person’s reserved membership. If only one person remains, do not invent group conversation prompts; provide a calm option to end or a brief ordinary solo step. Ending one’s own participation never requires group permission.

## 7. Journey content and adaptation

### The first experience

BASELINE: 3–4 students, familiar campus start, 45–60 minutes, 2–3 approachable prompts/stops, below roughly 3,500 estimated total steps. Interpret the budget as the planned meetup route, not travel from the user’s home. The estimate is not a pedometer measurement or a guaranteed physical limit.

Begin with low-pressure interaction, then a little exploration. Examples of appropriate initial prompts:

- “Introduce yourselves. Find one thing you’ve all wanted to try.”
- “Walk to the courtyard together. Each person picks something they noticed on the way.”
- “Choose a question you’d actually like to ask someone you just met.”

“Compliment three strangers” was an example from brainstorming; it is not a required first-meetup task. More socially demanding prompts can fit later adventures. No photographic proof, recording strangers, competition, penalties, or public performance requirement in the baseline.

### Generation contract

The model proposes structured steps from allowed activities and locations. Application code validates the result before storing it. Each step has an ID, order, kind, short instruction, optional vetted location ID, estimated duration, estimated walking contribution, and any constraints needed to determine suitability.

Use real checked campus locations for a live demo and clearly fictional ones for fixtures. Store what is actually known about availability. Do not invent hours, accessibility, prices, bookings, tickets, or route distance. Prefer free public stops in the first release; a café visit cannot require an undisclosed purchase.

Social content and user reports are data, not instructions that override application rules. Models cannot grant access, change verification, disclose contacts, or write arbitrary records. Validate both analysis and generation output against explicit schemas.

### Shared changes

- One authoritative shared journey, not separately generated itineraries on each phone.
- Reports create a server-side adaptation request. Serialize conflicting mutations or reject stale versions and refetch; never let two adaptations create two current routes.
- Preserve the latest valid journey while generating. Display an adapting state without claiming success.
- Replace only the needed current/future steps. Do not rewrite completed history as if it never happened.
- Preserve the starting location/time before the meetup. After starting, changes to current destinations are shared visibly.
- Publish a neutral change summary, not raw private reports. Example: “We’ve picked a different stop nearby.”
- Hard constraints persist across regeneration and extension. Costs and activity restrictions cannot be escalated simply because a report asks for something more exciting.
- On failure, allow a retry or ending participation. Do not repeatedly run expensive generation on every client refresh.

## 8. Data model and service boundaries

The foundation session must create exact typed schemas from these definitions. Use stable IDs, UTC timestamps, explicit enums, and one consistent naming convention. Do not let individual sessions invent parallel `Event`, `Trip`, and `Meetup` records for the same thing. Use **Meetup** for the social commitment and **Journey** for its guided activities.

| Entity | Essential fields / rules | Owner |
| --- | --- | --- |
| University | ID, name, supported email domains/mapping, timezone, vetted campus locations | Shared foundation |
| User | Auth ID, university ID, server verification state/time, optional self-entered display name | A |
| AnalysisJob | ID, user ID, source type, status, input reference, validated result/error, timestamps | A |
| InterestProfile | User ID, reviewed interests, short synthesis, correction revision, reviewed timestamp | A |
| MeetupPreferences | User ID, allowed group sizes, adventure preference, optional private hard constraints, default/custom source | A |
| Meetup | ID, university, schedule, target count, compatible minimum policy, cutoff, status, journey ID | B |
| Invitation | ID, meetup ID, user ID, issued/expires times, pending/accepted/declined/expired/revoked status | B |
| Membership | Meetup/user IDs, acceptance timestamp, reserved/cancelled/participating/finished/left status; do not expose peer identities before meeting | B for reservation; C emits participation updates |
| Journey | ID, meetup ID, shared status, version, current step, main/extension phase, extension-used flag, timestamps | C |
| JourneyStep | ID, journey ID, order, content, location ID if any, duration/walk estimate, completion state | C |
| JourneyReport | ID, journey/user IDs, request ID, type, private detail, received version, processing/result state | C |
| ContactConsent | Meetup/user IDs, explicit opted-in state/time, display name, private phone reference | C |

Suggested state vocabularies:

- Profile: `unverified → needs_content → analyzing → needs_review → needs_preferences → ready`; failures belong to the analysis job and recover without resetting verification.
- Meetup: `preparing → inviting → confirmed → active → completed`; `cancelled` is terminal. Do not label a meetup completed when only one person leaves.
- Journey: `prepared → active → main_complete → extending → completed`; extension can be skipped; `ended` handles an early shared end. Shared completion closes membership participation through the agreed operation.
- If all participants finish or leave, close the shared journey. If the main-completion extension window expires, close it without creating another step. Background timer/cleanup operations must be retry-safe; reopening a screen is not the only way a meetup can finish.
- Per-person completion may happen while the shared journey remains active. Keep those states separate.

### Operations everyone uses

| Operation | Owner | Required behavior |
| --- | --- | --- |
| Read/update reviewed profile and preferences | A | Authenticated self-access; B gets a restricted matching view |
| Start/resume analysis | A | Job ID and retry-safe request; preserve pending work |
| Request/find current invitation | B | Returns only the current user’s invitation-safe fields |
| Accept / decline / cancel | B | Atomic, idempotent, authorized state transition |
| Prepare journey | C | Stable meetup ID; repeated requests return the same preparation result |
| Read accepted meetup | B | Exact location only after authorized acceptance |
| Read membership eligibility | B | C uses a server-side membership check; never trusts a client-provided participant list |
| Read/subscribe journey | C | Member-authorized current state; unrevealed content is not unnecessarily exposed to the client |
| Start / advance / report / extend / leave | C | Authenticated actor, unique request ID, expected version where applicable |
| Publish participation end / meetup completion | C → B | Retry-safe handoff; release eligibility only for the correct user or completed meetup |
| Set sharing consent / get directory | C | Own consent only; directory access limited to eligible participants |

Do not use a client-supplied `userId` as proof of identity. Responses should distinguish validation failure, authentication failure, forbidden access, expired invitation, unavailable seat, stale version, generation failure, and retryable network/service failure. The UI maps these to useful recovery text.

The transport, backend provider, database, and synchronization library are OPEN. Choose them once. Any valid implementation must provide the same behavior, atomic reservations, authorization checks, persistent state, and multi-device updates.

## 9. Parallel ownership and Claude session rules

| Claimable workstream | Service session | UI session | Optional reviewer |
| --- | --- | --- | --- |
| A — Understand the student | Verification, source access, analysis, profile persistence | Welcome through preferences | Analysis failure, correction, readiness checks |
| B — Bring the group together | Matching, invitations, reservations, replacements | Waiting, invitation, accepted meetup | Capacity, expiry, access-control tests |
| C — Run the experience | Journey generation/state/adaptation/contact consent | Live journey, reports, completion, directory | Two-device sync, concurrency, privacy tests |

Begin with one writer per person. Add a second writer only after contracts and file ownership are established. Reviewers start read-only. Each writing session uses a separate checkout/worktree and branch; switching branches in a shared folder does not isolate sessions.

Suggested owned directories: `features/profile/{ui,service}`, `features/matching/{ui,service}`, `features/journey/{ui,service}`. Adapt names to the selected framework once, not per teammate.

Shared contracts, dependencies/lockfiles, migrations, navigation, design tokens, authentication setup, and this file have one coordinated writer at a time. A session may propose a shared change but must not independently fork its assumptions. Database migrations are reviewed and applied in one known order.

Use the same fixture IDs and schemas everywhere. UI can run against fixture adapters while services are unfinished. Service builders must not create duplicate UI or authentication just to demonstrate their work. A stub is a development boundary, not a false claim of production behavior.

Before a commit, summarize changed files, verified behavior, remaining mocks, and integration impact. Never commit secrets or real scraped private data. Use environment templates with variable names, not values. Record exact install/run/check commands only after the actual stack exists and they have been verified.

## 10. Acceptance criteria and consistency checks

A feature is done when its screen, saved state, error recovery, and handoff work in the shared app. Screenshots alone are not proof of working matching or synchronization.

### Core end-to-end test

1. A supported student verifies their university email.
2. The selected content mechanism produces an analysis, or the demo clearly identifies fixture content.
3. Student reviews and corrects interests, then chooses “Surprise me.” Reload preserves the result.
4. A compatible same-university group receives invitations. Before acceptance, API and UI both withhold exact location and participant identities.
5. One user chooses “Next time”; a replacement is invited. Two simultaneous acceptance requests cannot overfill the meetup.
6. Accepted users get the same starting landmark and journey ID. A declined/unrelated account cannot retrieve the private view.
7. Two independent authenticated devices open the live journey. One advance updates both once; repeated requests do not skip a step.
8. A report causes one validated adaptation visible on both devices. Reconnect fetches the latest state. Private report detail is not leaked.
9. One participant can finish without ending everyone else’s experience. Extension requests cannot create duplicate extensions.
10. Contact sharing requires each owner’s opt-in. A non-sharing user’s number is absent from responses, not merely hidden visually.
11. The app returns finished users to an appropriate home state and can repeat the demo from clean seed data.

### Also check

- Invalid/expired verification, failed source fetch, insufficient analysis evidence, correction-save failure.
- Unsupported university and empty matching pool.
- Expired/cancelled invitation, late cancellation, smaller incompatible group, failed journey preparation.
- Closed destination, reported allergy, missing participant, simultaneous reports, failed adaptation.
- Small-screen/large-text layout, keyboard-safe forms, contrast, clear labels, reduced motion, loading and offline states.
- No invented bookings, success messages, verification, push delivery, or measured step counts.

Testing effort should focus on integration boundaries, state transitions, privacy, and concurrency. Avoid spending core build time on tests that merely restate styling constants.

## 11. Concrete example — illustrative, not a real event

A verified student’s supplied reel content suggests street photography, casual walks, and coffee. The student confirms the synthesis and chooses “Surprise me.” They receive “Thursday, Oct 29 / 6:30 PM / 4 people.” They accept. Only then does the app show a familiar campus clock tower.

At the scheduled time, their live screen shows a shared marker and a prompt to introduce themselves and find a common curiosity. The group walks to a nearby courtyard. Someone reports the next café is closed. The app substitutes a vetted public stop, updates all phones, and keeps the private report out of the shared copy. At completion, some people extend briefly; someone else finishes and chooses whether to share their number. The directory contains only names and numbers volunteered to this group.

The emotional outcome is “That was easier than I expected, and I met people I want to see again.” Every feature should support that outcome.

## 12. Next steps — continue from here, in this order

1. **Resolve the two implementation blockers together:** choose native mobile versus mobile web and one stack; prove the exact Instagram/TikTok input available. Record evidence and the honest demo fallback. Do not let individual sessions make different choices.
2. **Ratify the visual baseline:** start with **Inter**, canvas **#080808**, primary text **#F5F5F5**, white filled primary buttons, outlined secondary buttons, and quiet text actions. Build one invitation screen and one live-journey screen using the tokens above. Compare them together; revise the shared tokens once if the vibe needs adjustment. Pick the single icon set. Product name remains OPEN; use a neutral internal placeholder, not a polished invented brand.
3. **Ratify the behavioral baselines:** default group sizes, invitation deadlines, progression control, short-group handling, one extension, and per-person finishing. Confirm these in one shared decision log before implementing their services. Keep automatic report adaptation and no group voting intact.
4. **Create the foundation in one session:** repository shell, auth, routing, shared components, schemas, sample campus catalog, fixture profiles/meetup/journey, and verified run/check commands. Record the actual supported university and timezone.
5. **Connect a thin sample-data flow:** profile → invitation → acceptance/location reveal → shared journey → completion/contact sharing. Test it on two sessions before expanding it.
6. **Claim A, B, and C:** map session-owned files, create separate worktrees, then build UI and service slices in parallel against the same contracts. Use the team playbook for starter prompts.
7. **Replace fixtures incrementally:** real analysis input, persisted profiles, matching/reservations, shared journey updates. Keep all remaining demo integrations visibly documented. No big final merge of separate apps.
8. **Run the acceptance scenarios and rehearse:** seed/reset the demo reliably; verify hidden location, replacement, two-device adaptation, and voluntary sharing. Fix broken trust or navigation before adding polish.
9. **Only then pick stretch work:** progression first if useful, or a focused design for friends joining future groups. Preserve teammate autonomy inside those boundaries; do not add a marketplace or unrelated social feed.

At each shared decision, record: what changed, why, whether it replaces a baseline or a confirmed requirement, and which screens/contracts are affected. Update this file and dependent code together so every later session continues toward the same product.
