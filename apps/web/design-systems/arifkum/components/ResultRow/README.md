# ResultRow

The phone's view of the truth: one row per answer showing who wrote it, whether you matched it, and who else did.

- Green outline and ✓ mark (`data-got="1"`) when you matched it, pink and ✕ when you didn't. A row with no `data-got` (your own answer) has no mark.
- The author's name is in the row's accent. Under a dashed rule, guess lines list each guesser: green *✓ Reem* for a correct match, pink *✕ Omar said Noura* for a wrong one.
- Rows flip in one after another (`kybFlipIn` .5s, `ease-flip`).
- **Score box**: yellow 2px frame, pixel label and a 34px yellow number. Scoring is 100 per correct match plus a 100 bonus for a perfect board.
