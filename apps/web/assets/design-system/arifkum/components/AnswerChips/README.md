# AnswerChips

One initial per player on the TV, filled in their colour the moment their answer is in.

- 44px square, 3px ink outline, 12px radius, display 17px in `kyb-on-accent`. A chip pops in with `kybPop` when its player answers.
- Not yet answered: dashed outline, transparent, ink-40, 55% opacity.
- Player colours cycle pink → cyan → green → purple → yellow (`CHIP_ACCENTS`), and a player keeps that colour across the lobby, chips and reveal.
- Shows *who* has answered, never *what*.
