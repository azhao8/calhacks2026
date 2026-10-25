# Melos setup checklist

Everything here is a human step (accounts, keys, DNS). Do it now so no build stream waits on it later. Keys never go in chat or git: they go in `.env.secrets.local` and from there straight to Convex.

**Already done:** Convex. Project `melos` on team `tenderpork`; dev deployment `elated-barracuda-447` (https://elated-barracuda-447.convex.cloud); Convex Auth signing keys set on dev.

## azhao8: accounts and keys (about 30 minutes)

1. **Resend and DNS** (first, because DNS can take a while)
   - resend.com → sign up → Domains → Add domain → `melos.azhao.dev`.
   - At the DNS provider for `azhao.dev`, add every record Resend shows (they sit under `send.melos` and `resend._domainkey.melos`).
   - Also add DMARC: type `TXT`, name `_dmarc.melos`, value `v=DMARC1; p=none;`.
   - Click Verify. Then API Keys → Create → "Sending access" for `melos.azhao.dev` → this is `AUTH_RESEND_KEY`.
   - Once verified, send yourself a test code at a real `berkeley.edu` address, because a brand-new domain can land in spam.
2. **Anthropic:** console.anthropic.com → API Keys → Create key `melos` → `ANTHROPIC_API_KEY`. Check the org has credits.
3. **Voyage:** dashboard.voyageai.com → sign up → Billing → add a card (it unlocks normal rate limits; the first 200 million `voyage-4` tokens are free) → API Keys → Create → `VOYAGE_API_KEY`.
4. **Apify:** console.apify.com → sign up → Settings → API & Integrations → copy the personal token → `APIFY_TOKEN`. Ask the Apify booth for hackathon credits; the free plan stops at $5 a month.
5. **`ADMIN_EMAILS`:** the team's school emails, comma-separated.
6. **Put the keys on the dev deployment:**
   - In the repo, copy `.env.secrets.example` to `.env.secrets.local` (gitignored) and fill it in.
   - Run `scripts/push-secrets.sh dev`. It sets each filled value with `npx convex env set`, and generates the Apify webhook secret and the Spotify state secret the first time.
   - Production gets the same command with `prod`, once the production deployment exists (Claude will ask first).
7. **Vercel:** sign in at vercel.com with GitHub now. Importing `azhao8/calhacks2026` and adding the domain waits until Stage 0 is on `main`. Then: add `melos.azhao.dev` to the project and create the CNAME record Vercel shows.

## nickzjl: Spotify apps (about 5 minutes per Premium teammate)

For each teammate with active Spotify Premium:

1. developer.spotify.com/dashboard → sign in → **Create app**:
   - App name: `Melos (<first name>)`
   - App description: `Pairs students with similar music taste to go to shows together. Reads top artists, top tracks, and liked songs.`
   - Website: `https://melos.azhao.dev`
   - Redirect URIs, add both exactly:
     - `https://melos.azhao.dev/spotify/callback`
     - `http://127.0.0.1:3000/spotify/callback`
   - Which APIs: Web API. Accept the terms and save.
2. Settings → copy the **Client ID**. Send azhao8 the label (`melos-<first name>`), the owner's name, and the Client ID. Client IDs aren't secret.
3. Settings → **View client secret** → send it to azhao8 privately, never in the team chat. azhao8 adds it to `.env.secrets.local` as `SPOTIFY_CLIENT_SECRET_<LABEL>` (uppercase, dashes as underscores, for example `SPOTIFY_CLIENT_SECRET_MELOS_ALEX`).
4. **User Management** → add the team's own Spotify accounts first (name, and the email of their Spotify account). Each app allows 5 users, counting everyone.
5. Keep Premium active through Sunday. The app stops working if it lapses.

## iamjohncao: design

- A session will port the design components to React and Tailwind and build the screens. Please review that PR.
- Still needed from design: a `TextField` component; the screens without a mockup (About you, Waiting for Spotify, Analyzing, waiting on a partner, a set plan with its drop-out actions, Stay in touch, Contacts, the menu); the copy fixes in `CLAUDE.md` §4; and the official Spotify logo for the connect button.

## grant-j-kim: Notability

- A side session is building the Notability kit (ordered notebook pages and reference sketches). The link comes when it's done.
