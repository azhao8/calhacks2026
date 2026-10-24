# ConcertCard

A weekly event. Before a match it shows only the day, time and cost range; after, the artist and venue.

**Consumer provides:** `day`, `time`, `price` (a range written with "to"), `distance`, `going`, `onToggle`; once revealed, `revealed`, `artist`, `venue`, `kind`.

- Up to three per week. Show them stacked, never in a carousel.
- The teaser tag says Revealed when you match. The surprise is the point; do not hint at the artist.
- When `going`, the card gets `shadow-glow` and the button reads You can make it.
