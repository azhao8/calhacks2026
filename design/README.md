# Melos design system

The design guidelines, tokens, components and screen mockups for Melos, the college only app that turns your Spotify taste into plans. Launching at UC Berkeley; every campus gets its own theme on the same parts.

Treat this folder as the source of truth for how Melos looks, reads and behaves. Build product UI from these tokens and components; if something is missing, add it here first.

## What's inside

```
melos-design-system/
├── README.md               this file
├── docs/
│   ├── brand.md            color, type, spacing, motion, accessibility, Spotify attribution, iconography
│   ├── backgrounds.md      the Backdrop: layers, objects per screen, top bar and menu
│   ├── voice.md            how Melos writes, with real lines for every step
│   └── school-theming.md   how to add a campus theme
├── tokens/
│   ├── tokens.json         every token, both themes (berkeley, base). Edit this.
│   └── tokens.css          CSS custom properties and type classes generated from tokens.json
├── components/
│   ├── bundle.js           React 18 components on window.Melos (no build step)
│   ├── bundle.css          component styles, all values from tokens
│   ├── index.d.ts          props for every component
│   ├── vendor/             React 18.3.1 and ReactDOM, for the previews
│   └── <Component>/        README.md (guidelines) and preview.html (open in a browser)
├── assets/
│   ├── fonts/              Bricolage Grotesque and Figtree, self hosted, with fonts.css and licenses
│   ├── grain.png           the noise texture used by Backdrop
│   └── cover.html          the system cover
└── mockups/
    ├── index.html          every screen built from the real components (open in a browser)
    ├── png/                the same screens rendered at 2x
    └── canvas-source/      source of the Claude design canvas these mockups came from
```

## Using it in the app

Load in this order:

```html
<link rel="stylesheet" href="design/assets/fonts/fonts.css">
<link rel="stylesheet" href="design/tokens/tokens.css">
<link rel="stylesheet" href="design/components/bundle.css">
<script src="react.production.min.js"></script>
<script src="react-dom.production.min.js"></script>
<script src="design/components/bundle.js"></script>
```

Then `window.Melos.Button`, `window.Melos.Backdrop` and the rest are ready. Set `data-theme="berkeley"` (or another campus id) on the root element.

Components: Backdrop, MenuButton, Canvas, Wordmark, Button, SpotifyConnectButton, SchoolPicker, QuestionnaireStep, TasteSummary, ConcertCard, ArtistCard, MatchCard, ChatBubble, ConnectorButton, InfoCard, StateView, Icon.

If the app uses its own component framework (React Native, Swift, a different web stack), port from `tokens/tokens.json` and treat `bundle.css` and each component README as the spec. Token names should stay the same across platforms.

## Ground rules

- Tokens, not hex values. Never hard code a color, size or radius that has a token.
- School themes change only the accent, brand regions and Backdrop colors. Layout and components never change per school.
- The `melos` wordmark is always white and always on top.
- Copy follows docs/voice.md: warm, short, sentence case, no hyphens or dashes, and saying no is never shamed.
- 48px touch targets, text that grows with system text size, visible focus rings, reduced motion respected.
- Spotify's official logo still needs to be dropped into the Spotify button and attribution slots (see docs/brand.md).

## Changing the system

1. Edit `tokens/tokens.json` and regenerate `tokens/tokens.css` (keep the same layout: one block per theme, then the shared block, then type classes).
2. Update the component, its README and its preview together.
3. Re-render `mockups/` if a screen changes.

The online versions live in Claude: the "Melos" design system and the "Melos backgrounds" canvas. This folder adds the Backdrop and MenuButton components and self hosted fonts on top of them.
