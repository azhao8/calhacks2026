# Melos brand and UI guidelines

Melos turns a student's Spotify into plans. Sign in with Spotify, pick your school, get matched with students who share your taste, and go to a show together. It launches at UC Berkeley, and every campus gets its own look on the same set of parts.

## How the system works

- **One base, many schools.** Full screens sit on the bright Backdrop (see backgrounds.md); sheets, cards and the Canvas component use the dark `canvas`. Text is white. A school theme changes only the accent and the brand regions: `accent`, `on-accent`, `accent-soft`, `accent-strong`, `surface-brand`, the three `canvas-glow` colors and the canvas tint. Layout, type, spacing and components never change per school.
- **Themes.** `berkeley` is the launch theme and the default. `base` is the house look shown before someone picks a school. Adding a campus is a new theme; see the School theming section.
- **The logo always wins.** The `melos` wordmark sits on top of every themed surface in `ink`, with a `scrim` behind it when a school image is in play. Never recolor it.

## Color

- Set full screens on the Backdrop component (backgrounds.md). Use `canvas` inside the Canvas component, sheets and fallback states. The gradient blooms come from `canvas-glow-a`, `canvas-glow-b` and `canvas-glow-c`; the grain sits over them at `grain-opacity`.
- Text is `ink` for anything a person must read, `ink-muted` for metadata and hints, `ink-faint` only for placeholders and disabled labels.
- Cards use `surface` with a `line` edge and `shadow-card`. Inputs, chips and the other person's chat bubble use `surface-raised`.
- `surface-brand` is the school's brand region: the match card header, your own chat bubble, the selected school row. On Berkeley it is Berkeley Blue `#003262`.
- `accent` carries the school's energy: the primary button, selected chips, the Melos number, accent text. On Berkeley it is California Gold `#fdb515`. Text on an accent fill is always `on-accent`.
- **Berkeley navy is a surface, never text.** `#003262` is about 1.5:1 on the canvas. Use gold or white for any text or control on dark ground, and keep navy for fills behind them.
- `spotify` and `on-spotify` belong to the Spotify button only and are never themed.
- `success` is a light cyan and `danger` a warm coral, so they stay apart for people who confuse red and green. Each always comes with an icon and words.
- Every text token clears 4.5:1 on `canvas`, `surface`, `surface-raised` and `surface-brand` in both themes. `line-strong` and `focus` clear 3:1 on all of them.

## Type

- Display face: Bricolage Grotesque, for `number`, `display`, `title` and the `wordmark`. Use `display` once per screen at most.
- Body face: Figtree, for `headline`, `body`, `body-strong`, `small` and `caption`. Running text is 17px.
- Both are self hosted in `assets/fonts/` (SIL Open Font License); load `assets/fonts/fonts.css` first. Use tabular figures for times, prices and the Melos number.
- Sizes are in rem in the components, so they follow the phone's text size setting. Layouts wrap; nothing truncates a name, price or button label.

## Space, shape and depth

- Spacing steps: `space-1` 4, `space-2` 8, `space-3` 12, `space-4` 16, `space-5` 20, `space-6` 24, `space-8` 32, `space-12` 48. The screen gutter is `space-4`.
- Every tappable thing is at least `space-12` (48px) in both directions.
- Corners: `radius-sm` for inputs and slots, `radius-md` for chat bubbles, `radius-lg` for cards, `radius-pill` for buttons and chips.
- `shadow-card` lifts cards off the gradient. `shadow-glow` marks the one thing that just changed, such as a new invitation or a show you said yes to.

## Motion

- Keep it small: 160ms ease on press and hover, a gentle scale to 0.98 on press, equalizer bars while loading.
- Under reduced motion, transitions and press scaling turn off, spinners and equalizer bars hold still, and the grain never moves.

## Focus and accessibility

- Focus ring: 2px solid `focus` with a 2px offset on every interactive element.
- Touch targets 48px or more. Chips and buttons wrap at large text sizes.
- Choices are real radios or toggle buttons with `aria-checked` or `aria-pressed`. Status changes use `role="status"`; errors use `role="alert"`.
- Color never carries meaning alone. Selected chips get a check, success gets a check, errors get an icon.

## Spotify attribution

- The Connect Spotify button and every Listen on Spotify row have a slot for Spotify's official logo. Use the asset from Spotify's developer branding guidelines; never draw, recolor or crop it. Until it is added, the slots show a dashed placeholder.
- Artwork and artist data from Spotify always keep the Listen on Spotify row linking back to Spotify.

## Iconography

- A small line icon set lives in the bundle as `Melos.Icon`: 24px grid, 2px round stroke, `currentColor`. Names: check, pin, clock, ticket, music, spark, at, phone, copy, alert, offline, calendar, search, arrow, back.
- Instagram sharing uses the generic `at` icon. Do not use other companies' logos except Spotify's where attribution requires it.
- No emoji in the interface.

## Components

Backdrop, MenuButton, Canvas, Wordmark, Button, SpotifyConnectButton, SchoolPicker, QuestionnaireStep, TasteSummary, ConcertCard, ArtistCard, MatchCard, ChatBubble, ConnectorButton, InfoCard and StateView. Load `assets/fonts/fonts.css`, `tokens/tokens.css` and `components/bundle.css`, then React 18 and `components/bundle.js`; everything is on `window.Melos`.

Intentional additions beyond the brief: **Wordmark**, so the text logo is one shared part; **Button**, because every step needs the same primary, secondary and quiet actions; **TasteSummary**, for step 3 where people confirm or correct their taste; **Backdrop** and **MenuButton**, from the screen mockups.
