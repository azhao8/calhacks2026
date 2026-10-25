# Integration wiring (temporary)

The coordinator's cross-stream wiring, saved as patches until streams A to D merge into `main`. Each applies on top of all four stream branches merged together; after they're on `main`, apply them in order with `git am docs/integration/*.patch`, regenerate `convex/_generated` with `npx convex codegen`, run the checks, and delete this folder in the same change.

1. Webhook route `/apify/webhook`; first asks after a confirmed taste; seats released on Spotify disconnect; asks after an import publishes events.
2. One shared name normalization (`convex/lib/normalize.ts`), so demo and real fingerprints match, with a cross-stream test.
3. Demo students go through onboarding's Claude summary and Voyage vector, with a fixture fallback after two minutes.
4. The admin page and team-only wrappers for every S17 section, with a test that each refuses non-team accounts.
5. Pulling an event calls off its plans; a new event time retimes them.
6. Hooks name shared liked songs properly; demo labels come from the fixed list.
