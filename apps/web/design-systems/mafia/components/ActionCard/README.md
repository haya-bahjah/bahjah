# ActionCard

The one thing a player with a night role must do before the night can end, shown collapsed above their conversations.

- The whole card is the button (`role="button"`, Enter/Space open it). It sits on `surface-team` with a border in the role's colour.
- The call-to-action bar runs the full width in the role colour at 16% fill and *breathes* (2.6s) so it stands apart from the tappable chat rows below — the glow is mixed from the role colour, so Mafia breathes red, Doctor steel, Sheriff gold.
- Chevron points down: the card expands in place (no RTL mirroring needed).
- Expanded it becomes the action panel: kicker + *Hide*, title, sub-line, then a grid of CandidateCards and the confirm Button.
- Citizens get no card; once a move is made it collapses to a one-line *done* summary.
