# Malarkey (تخاريف) — Riso Print

The design handoff for Malarkey, kept as a reference. The game does not load anything from this folder.

- `HANDOFF.md`: the handoff brief, covering the screens, rules, motion and tokens. Start here.
- `tokens/`: the design-system tokens and component classes (`mk-*`) exactly as handed off.
- `prototype-source.dc.html`: the clickable prototype's source, with the full bilingual copy (`T.ar` / `T.en`).
- `logomark-source.dc.html`: the logomark, built from CSS shapes.

The live game uses its own copies:

- `assets/malarkey-theme.css` holds the tokens and components, plus the phone and big-screen layouts.
- `assets/malarkey-ui.js` holds the copy, PlayerAvatar, Timer, RoundProgress, RisoShape and the logomark.
- `assets/logos/malarkey-logo.png` and `assets/logos/malarkey-icon-512.png` are rendered from the logomark.

If you change a value here, change it in the game too, and the other way round.

## Where the build differs from the handoff, on the owner's instructions

- **Rounds.** There are N rounds for N players: the opening line, then N−1 continuations. The opening line counts as the author's turn in their own story. (The handoff says N+1.)
- **Timers.** 45 seconds for an opening line and 60 seconds for a continuation. (The handoff gives 45 seconds per line.)
- **Players.** 3 to 10. (The handoff says 2 to 10.)
- **Host plays too.** When it is off, the host's screen *is* the big screen. The host's controls (Next story, Play again, End room, and "Move on now" for a stuck round) sit in its corners, rather than on a separate host phone.
