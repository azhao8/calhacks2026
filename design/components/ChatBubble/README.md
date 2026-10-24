# ChatBubble

Messages between two matched students, plus system lines.

**Consumer provides:** `from` (`me`, `them`, `system`), the text as children, `name` (for screen readers), `time`.

- Your own bubbles use `surface-brand`; theirs use `surface-raised`; system lines are centered `ink-muted` text.
- Bubbles wrap long words and grow with text size; never cap their height.
