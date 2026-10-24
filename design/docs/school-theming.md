# School theming

Each campus is one color theme in `tokens.json`. Components never change; the theme swaps a fixed set of tokens, and the Canvas can take one pattern or image.

## What a school theme sets

| Token | What it does | Berkeley |
| --- | --- | --- |
| `canvas` | Canvas tint, barely off black | `#060a16` |
| `canvas-glow-a` | Main gradient bloom | Berkeley Blue `#003262` |
| `canvas-glow-b` | Second bloom | Founders Rock `#3b7ea1` |
| `canvas-glow-c` | Low warm streak, under 35% | Medalist `#c4820e` |
| `surface`, `surface-raised` | Cards and inputs, tinted toward the school's dark color | `#0d1830`, `#16284a` |
| `surface-brand` | Brand regions | Berkeley Blue `#003262` |
| `accent`, `accent-strong` | Primary actions, selection, the Melos number | California Gold `#fdb515`, `#ffc94d` |
| `on-accent` | Text on accent | `#0a0f1e` |
| `accent-soft` | Tint behind accent text | gold at 14% |
| `shadow-glow` | Glow on the selected card | gold |

Everything else (`ink`, `ink-muted`, `line`, `line-strong`, `focus`, `success`, `danger`, `spotify`) stays the same for every school.

## Picking colors for a new campus

1. Start from the school's official primary and secondary colors.
2. Decide which one is the **accent**. It must reach 4.5:1 on `canvas`, `surface`, `surface-raised` and `surface-brand`. Bright golds, yellows, light blues and light reds usually pass; navy, maroon, forest green and deep purple never do.
3. A school color that is too dark for text becomes `surface-brand` and `canvas-glow-a` instead. If a school only has dark colors, use a lighter tint of its main color as the accent and note it in the token's usage.
4. Pick `on-accent` as a near black or white, whichever reaches 4.5:1 on the accent.
5. Check `ink`, `ink-muted` and `accent` against every surface in the new theme before shipping.

## Pattern and image slot

- One per school, passed to Canvas as `pattern` or `image`. It shows at `pattern-opacity` (images at 50%) and fades out over the lower half of the screen.
- Use simple geometry or a campus photo the school has cleared for use. No school seals or athletic marks unless the school has licensed them to us.
- The `melos` wordmark always renders on top, with a `scrim` behind the top bar when an image is in the slot.
