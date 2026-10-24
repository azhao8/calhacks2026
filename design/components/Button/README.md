# Button

Pill buttons for every action in the flow, 48px tall at minimum.

**Consumer provides:** `variant` (`primary`, `secondary`, `quiet`), the label as children, optional `icon`, `iconAfter`, `loading`, `pressed` (for toggles), `block`, and any native button props.

- One `primary` per view, for the step that moves the plan forward: Accept, I can make it, Continue.
- `secondary` sits beside it for the gentle alternative: Next time, Not quite. Both options get the same size so declining never looks like the wrong answer.
- `quiet` is for Surprise me, Not now, Copy.
- A toggle such as I can make it uses `pressed`; its label changes to say the current state.
- Labels are short verbs in sentence case with no punctuation.
