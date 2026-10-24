# StateView

Loading, empty, error and offline states in one voice.

**Consumer provides:** `kind` (`loading`, `empty`, `error`, `offline`), optional `title`, `body`, `action`, `onAction`, `inline` (offline as a slim banner).

- Loading shows equalizer bars that hold still under reduced motion.
- Errors say what happened and what to do, with a Try again action, in `danger` with an icon.
- Offline keeps the screen usable; prefer the inline banner over replacing content.
- Empty says when new things arrive. Never blame the person.
