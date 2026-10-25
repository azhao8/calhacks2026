# qa/

Test harnesses that aren't unit tests. Nothing here ships or runs in CI.

## ux/: student screen stress test

Renders every student screen (S01 to S16, /privacy, /spotify/callback) in Chromium at 375×812, in each
meaningful state, against a fake Convex deployment. No sign-in, no real data, no network. It saves a
screenshot per state and flags what it can check automatically:

- horizontal scroll (compared with the device width, because mobile emulation widens the page to fit)
- touch targets under 48×48 (inline text links are marked as such)
- text cut off by overflow, ellipsis or line clamp
- inputs without a persistent label
- copy rules from CLAUDE.md §3: dashes, exclamation marks, emoji, gendered pronouns, date language
- a visible focus ring on the first 14 tab stops
- animations still running under reduced motion
- console errors, redirects, and the server calls each scenario made

Variants per scenario: `text200` (200% text), `w320` (320px wide), `offline`, `reduced` (reduced motion).

`flows.cjs` clicks through journeys: deep links and reloads for every route in four account states,
Menu → Privacy and back, editing preferences from the menu and from the waiting screen, double taps on
every shared-state action, live updates (an offer arriving, a partner accepting, dropping, being replaced),
menu close after a deep link, and disconnecting Spotify.

### Run it

```sh
npm ci
# Build against a fake deployment URL; the harness answers its WebSocket, so nothing reaches Convex.
NEXT_PUBLIC_CONVEX_URL=https://qa-mock.convex.cloud npm run build
npx next start -H 127.0.0.1 -p 3100 &

node qa/ux/run.cjs              # every scenario (about 2 minutes), or: node qa/ux/run.cjs s11 s12
node qa/ux/flows.cjs            # every flow, or: node qa/ux/flows.cjs nav-
python3 qa/ux/sheet.py base     # contact sheets of the base renders (needs Pillow); also text200, w320, ...
```

Playwright must be installed (`require("playwright")`). Use the Chromium that comes with it; in Claude
Code cloud sessions it is preinstalled. `BASE_URL` points the harness at another server.

Output lands in `qa/ux/out/` (git ignored): `report.md` and `report.json` per render, `flows.md` and
`flows.json`, `shots/`, `flows/` and `sheets/`.

### How the fake Convex works

`mock-convex.cjs` answers the browser's sync socket (`/api/<version>/sync`) through Playwright's
`routeWebSocket`: `ModifyQuerySet` gets a `Transition` with each query's fixture value, and `Mutation` and
`Action` get a response after `mutationDelayMs`. Fixture values per function path (`"plans:current"`):

- a value: the query returns it
- `MockConvex.hold`: the query never answers (loading state)
- `MockConvex.fail(code)`: the query fails with `ConvexError({ code })`

Handlers can change data mid-test with `mock.set(path, value)`, which pushes a live update the way the
real server would. Signed-in scenarios put a fake JWT where Convex Auth's client looks for one, so
`useConvexAuth()` reports signed in; the mock answers `Authenticate`.

### Adding a state

Fixtures in `fixtures.cjs` follow the view types in `convex/lib/views.ts`. When a view gains a field,
add it there. Add scenarios in `scenarios.cjs` and interactions in `scripts.cjs`.
