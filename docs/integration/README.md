# Integration wiring (temporary)

The coordinator's cross-stream wiring and the admin page, saved as one patch until streams A to D merge into `main`. It applies to the four stream branches merged together at these heads: D `stream-d-screens`, A `stream-a-onboarding`, B `stream-b-events` (e1ab1d1), C `stream-c-matching` (3b2ddba). Verified: applied there, it gives 200 passing tests with clean typecheck and lint.

After the streams are on `main`: `git apply docs/integration/wiring.patch`, regenerate `convex/_generated` with `npx convex codegen`, run the checks, and delete this folder in the same change.

What it does:
1. Registers the webhook route `/apify/webhook`. Picks first asks after a confirmed taste. Releases seats on Spotify disconnect, and picks asks after an import publishes events.
2. One shared name normalization (`convex/lib/normalize.ts`), so demo and real fingerprints match. Hooks name shared liked songs properly, and demo labels come from the fixed list.
3. Demo students go through onboarding's Claude summary and Voyage vector, with a fixture fallback after two minutes.
4. The admin page, plus team-only wrappers for every S17 section, with a test that each one refuses non-team accounts.
5. Pulling an event, or one turning 21+, calls off its plans. A new event time retimes them.
6. Hooks can't name a genre from the fixed list that the pair doesn't share.
