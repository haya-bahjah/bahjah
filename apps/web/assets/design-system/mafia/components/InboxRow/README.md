# InboxRow

One conversation in the night's private-chat inbox, laid out like a phone's messages list rather than a stack of cards.

- One surface (`radius-inbox`), hairline `border-subtle` between rows, 44px+ touch height.
- **Unread** (`is-unread`): faint `info-steel` wash, a 3px bar on the inline-start edge, the preview line in `info-steel` 600, a glowing dot at the end.
- **Team** (`is-team`): the Mafia channel — dark red ground, `mafia-red` bar and name. Pinned first, Mafia only.
- **Quiet** (`is-quiet`): a thread nobody opened — italic muted invitation, not a quote.
- The list scrolls inside itself on phones so the phase clock and action card stay on screen.
- Everyone may whisper to anyone at night; the Sheriff's *Read* can later open one of these threads anonymously.
