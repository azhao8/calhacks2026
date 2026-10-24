# Backdrop

The bright background behind every full screen: a grain gradient, a light streak along the horizon and one blurred object glowing in heat map colors.

**Consumer provides:** `object` (`speaker`, `headphones`, `cassette`, `ticket`, `records`, `mic`, `radio`, `none`), optional `school` (a theme id), optional `quiet` (darkens it for text heavy screens like chat).

- Put it as the first child of a `.ml-screen` container; it fills the container and sits behind content.
- One object per screen, matched to the moment: speaker on Welcome, headphones on email code, cassette on Connect Spotify, ticket on This week, two records on an invitation, microphone on the day of the show, radio on an empty week, none plus `quiet` in chat.
- Text goes in the lower part of the screen, where the vignette darkens the gradient, or on the upper sky. Never over the streak or the object.
- Use a `.ml-panel` (the `backdrop-vignette` fill) behind any text that has to sit mid screen.
- Grain stays at `grain-opacity` (0.14). Keep it between 0.10 and 0.18.
- The thermal colors are for these objects only. Never use them for UI or status.
