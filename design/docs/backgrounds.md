# Backgrounds

Every full screen in Melos sits on the **Backdrop**: a bright grain gradient with a light streak along the horizon and one blurred object glowing in heat map colors, like a thermal photo of something on a table. Rendered examples are in `mockups/png/`.

## Layers, back to front

| Layer | What it is | Tokens |
| --- | --- | --- |
| Field | Vertical gradient from electric blue at the top to slate at the bottom, with a violet bloom top left | `backdrop-sky`, `backdrop-sky-2`, `backdrop-horizon`, `backdrop-lake`, `backdrop-ground`, `backdrop-deep`, `backdrop-bloom` |
| Haze | Soft cool glow above the horizon | `streak-cool-2` |
| Streak | Blurred band across the screen at about 41% height, tilted 4 degrees, warm on the left, cool in the middle, fading out on the right | `streak-warm`, `streak-warm-2`, `streak-cool`, `streak-cool-2` |
| Core | Thin bright line inside the streak | `streak-core-hot`, `streak-core-cool` |
| Floor | Faint band under the horizon | `backdrop-floor` |
| Cast shadow | Violet blurred ellipse under the object, skewed to the right | `backdrop-cast` |
| Object | Simple shapes in the heat map ramp, blurred | `thermal-*`, `object-blur` (7px) |
| Vignette | Darkens the bottom 45% so white text reads | `backdrop-vignette` |
| Grain | `assets/grain.png`, overlay blend | `grain-opacity` (0.14) |

On Berkeley the streak runs California Gold to Lawrence blue. On the base theme it runs lemon to cyan over a more violet field.

## One object per moment

| Screen | Object |
| --- | --- |
| Welcome, school picker | speaker |
| Berkeley email code | headphones |
| Connect Spotify | cassette |
| This week | ticket |
| Invitation | two overlapping records (two people, one taste) |
| Day of the show | microphone |
| Empty week | radio |
| Chat | none, and `quiet` to darken the whole frame |

New objects follow the same rules: built from a few simple shapes, colored only with the `thermal-*` ramp (hot white center, then yellow, amber, red, green, deep green at the edges), blurred at `object-blur`, sitting on the horizon right of center. No logos, faces or recognizable products.

## Rules

- Grain stays subtle: `grain-opacity` between 0.10 and 0.18. It should read as texture, not static.
- Text lives in two zones: the sky (top third, under the top bar) and the lower 40% over the vignette. Never over the streak or the object.
- Anything mid screen gets a `.ml-panel` behind it.
- Only the Backdrop uses the thermal colors. They never appear in UI, text or status.
- Under reduced motion nothing on the Backdrop moves. If the grain or streak is ever animated, it stops there.

## Top bar and menu

- Every screen has a `.ml-topbar`: the `melos` wordmark on the left.
- After onboarding (This week, invitations, day of, chat, empty states) the **MenuButton** sits on the right: a two line hamburger in a 48px frosted pill, labelled "Open menu".
- Onboarding screens (welcome, email code, school picker, Connect Spotify) show the step count on the right instead, and no menu.

## Usage

```html
<div class="ml-screen" data-theme="berkeley" style="height: 100vh">
  <!-- React: h(Melos.Backdrop, { object: 'ticket' }) -->
  <div class="ml-screen__content"> … </div>
</div>
```
