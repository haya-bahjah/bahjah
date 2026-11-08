# PhaseStrip

The game's cycle in the header — NIGHT → DAWN → DAY → VOTE → VERDICT — with only the phase being played in colour.

| Phase | Token |
|---|---|
| Night | `phase-night` (moonlight) |
| Dawn | `phase-dawn` (sunrise) |
| Day | `phase-day` (gold) |
| Vote | `phase-vote` (brick) |
| Verdict | `phase-verdict` (crimson) |

- Current chip: its phase colour as text, 50% border, 10% fill and a soft inner/outer bloom. Past chips `text-secondary`, upcoming `text-muted`, hairline `border-subtle`.
- Phones: one scrolling line, rotated so it starts with the current phase; every other chip reads as *still to come* (muted).
- Hues are held down in saturation on purpose: the game is a dark room.
