# AnswerCard

An anonymous answer on the TV: first in the matching phase, then flipped over to show its author.

- 197px wide, 4px outline, the asymmetric `--kyb-r-card` corner and a per-card tilt (±0.7–1.4°). On the TV, up to five stand side by side.
- Before the reveal there's no accent: the doodle tag (●▲✕◼✦★), the answer, and a dashed footer that reads *Whose is it?*.
- On the reveal the card flips (`kybFlipIn` 380ms) and takes the author's colour. The footer shows their character and name, then a verdict: *3 got it* or *Nobody got it*.
- The reveal choreography is strictly serial: one card's flip, its answer, author, *got it* line and matcher pills all finish before the next card starts. That's about 22s for 12 answers. Don't restagger it.
