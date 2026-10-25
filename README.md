# Melos

Pairs two verified students who listen to similar music and sends them to a real event together. Built for UC Berkeley at Cal Hacks 13.

- **Spec (source of truth):** [CLAUDE.md](CLAUDE.md). Decisions that change it: [DECISIONS.md](DECISIONS.md).
- **Design (source of truth):** [design/](design/README.md), ported into Tailwind in `app/theme.css`.
- **Accounts, keys, and Spotify apps:** [docs/setup.md](docs/setup.md).

## Stack

Next.js (App Router, TypeScript) and Tailwind on Vercel at `melos.azhao.dev`; Convex for the database, functions, auth, scheduling, and vector search; Resend, Spotify, Anthropic (Claude), Voyage, Apify, and OpenStreetMap behind one module each in `convex/services/`. See CLAUDE.md §8.

## Layout

```
app/              screens (S01–S16), the Spotify callback, and the admin page (S17)
app/_lib/routes.ts  the canonical routes and the home router
convex/schema.ts  every table (CLAUDE.md §8.5)
convex/lib/       config, clock, error codes, access checks, validators, view contracts, formatting
convex/services/  Claude, Voyage, Resend (Spotify, Apify, geocoding arrive with their streams)
convex/*.ts       public functions; stubs throw "not built yet" until their stream lands
design/           the design system (read-only reference)
docs/setup.md     human setup steps
scripts/          push-secrets.sh
```

## Commands

Verified on the foundation branch:

```bash
npm install
```

```bash
npx convex dev --once
```

Pushes `convex/` to the dev deployment and type-checks it. Run `npx convex dev` (without `--once`) to keep watching.

```bash
npm run seed
```

Seeds schools and team meeting spots. Safe to run again.

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run build
```

```bash
npm run dev
```

Open the app at http://127.0.0.1:3000, not `localhost`: Spotify only redirects back to `127.0.0.1`, and the sign-in session is stored per origin.

## Parallel worktrees

Every Convex push replaces the deployment's whole set of functions, so two worktrees must never push to the same deployment. On a laptop, give each worktree its own local deployment:

```bash
npx convex dev --configure existing --project melos --dev-deployment local
```

Then load secrets into it with `scripts/push-secrets.sh dev`.

## Cloud sessions

Cloud sessions can't download Convex's local backend, so they test functions in memory with `npm test` (convex-test) and never push. Verified October 24 in the cloud environment:

```bash
CONVEX_DEPLOY_KEY="$MELOS_DEV_DEPLOY_KEY" npx convex codegen
```

Regenerates `convex/_generated` against the shared dev deployment. Codegen uploads code for analysis only and never makes it live. It is the only Convex command a stream session runs with that key.

```bash
NEXT_PUBLIC_CONVEX_URL=https://elated-barracuda-447.convex.cloud npm run build
```

`npx convex env list`, `data`, and `logs` hang in cloud sessions because their WebSockets ignore the proxy, and Node's built-in `fetch` needs `NODE_USE_ENV_PROXY=1` to reach outside services.

## Deploy (configured, not yet verified)

Vercel builds only production, from `main`: `vercel.json` runs `npx convex deploy --cmd 'npm run build'`, then the idempotent seed, and skips every other build so branches never touch production. Vercel's `CONVEX_DEPLOY_KEY` is the production deploy key, scoped to Production.
