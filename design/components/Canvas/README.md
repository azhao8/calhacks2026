# Canvas

The dark grain gradient every Melos screen sits on, recolored by the school theme.

**Consumer provides:** `school` (a theme id, such as `berkeley`), the screen content as children, optional `actions` for the top bar, and optionally one of `pattern` (a CSS `background-image` value) or `image` (a URL).

- The `melos` wordmark sits top left on every Canvas and always renders above the pattern or image. Pass `logo={false}` only inside a sheet that already shows it.
- The glow layers read `canvas-glow-a`, `canvas-glow-b` and `canvas-glow-c`; the grain reads `grain-opacity`. Change the theme, never these layers.
- A pattern renders at `pattern-opacity` and fades out toward the bottom so text there stays on plain canvas. An image renders at 50% with a `scrim` behind the top bar.
- Keep body text on the lower half of the Canvas, where the slot has faded.
- Do not put text directly on a school image without the scrim. Do not use the school image as a card background.
