# PlayerToken

A seat's avatar: a 2px coloured ring with one noir object (fedora, revolver, cigar, lipstick, watch, dice, shoe, briefcase) inside.

- Tokens are dealt by seat order and cycle every 8; rings cycle `ring-1` … `ring-7`. Neither ever encodes a role.
- Sizes: 24px (chat, whisper), 44px (candidate cards, default), 66px (`--lg`, dawn card).
- `--dead`: grayscale .5 and a `mafia-red` ring at 50% — used on the dawn card for the night's victim.
- Inside the Mafia whisper panel the ring is always `mafia-red`.
- Icons are the single-ink white SVGs in **Assets → Player tokens**; the icon sits at 60% of the ring at 92% opacity.

Consumer provides: the token index (seat) and ring index.
