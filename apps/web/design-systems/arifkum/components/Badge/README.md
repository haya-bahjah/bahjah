# Badge

Pixel-type HUD labels: the round badge, the phase status and pill badges.

- **Round badge** (`kyb-round`): cyan, a 1px border with 4px radius, Silkscreen 13px. *ROUND 2/3*. The category name sits beside it in `kyb-smeta` (ink-40).
- **Status** (`kyb-status`): the phase the room is in. Pink while writing (default). Set `data-tone` to `green` for matching, `yellow` for the truth and scores, or `purple` for waiting and steps.
- **Pill badge** (`kyb-badge` plus `--cyan|green|pink|purple|yellow`): 2px border, `radius-pill`, 10px.
- Always uppercase in English. In Arabic, Silkscreen has no glyphs, so the labels switch to Readex Pro with no tracking.
