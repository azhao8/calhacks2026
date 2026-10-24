# QuestionnaireStep

One question per screen in the preferences flow, with chips and a way to skip.

**Consumer provides:** `step`, `total`, `title`, `hint`, `options` (`id`, `label`, optional `sub`), `multi`, `value`, `onChange`, `onNext`, `onSurprise`, optional `nextLabel`.

- Questions cover ticket budget, who to meet, year and how far. Ask them as plain questions.
- Surprise me is always available and fills sensible defaults. It is never smaller than a chip.
- Chips wrap onto new lines at large text sizes; never truncate them.
