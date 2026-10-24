# SpotifyConnectButton

The one place Spotify green appears, with a slot for Spotify's official logo.

**Consumer provides:** `logo` (the official Spotify icon from Spotify's developer branding guidelines, at 28px, black on the green), `state` (`idle`, `connecting`, `connected`), `account`, `note`, `onClick`.

- Never recolor it with a school theme and never draw or redraw the Spotify icon. Until the real asset is in, the slot shows a dashed placeholder.
- The label is Connect Spotify. Keep the note under it that says what we read and that we never post.
- After connecting, it turns into a quiet confirmation row with a check and the word connected.
