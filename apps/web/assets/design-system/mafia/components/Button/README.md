# Button

Uppercase Tektur buttons with four variants; every move in the game is one of them.

## Variants
| Class | Fill | Use |
|---|---|---|
| `mn-btn--primary` | `action-steel`, text `text-on-accent` | The one move the screen is for: *Begin night 1*, *Start the day*, *Lock in my vote*, *Start game*. One per screen. |
| `mn-btn--ghost` | transparent, `border-strong` | Secondary: *Share*, *Hide*, *Send*, *Stay in*. |
| `mn-btn--hot` | `brick` | *Play again* after a Mafia win, *Leave game*. Use at `lg` only (brick is 3.3:1). |
| `mn-btn--secondary` | `smoke-violet` | Rare; kept for parity with the platform button. |

Sizes `--sm` (13px, 8×16), `--md` (15px, 12×24), `--lg` (18px, 18×40). Radius `radius-sm`.

## Behaviour
- Hover lifts 2px on `ease-arcade`; press scales to .97; disabled is 40% opacity and stays in place so the layout never jumps while a room waits.
- Focus uses `focus-ring`.
- Labels are verbs naming what happens (*Confirm the hit*, *Protect them*, *Investigate*), never *OK*/*Submit*.
- Arabic: Readex Pro 700, no tracking, no uppercase.

Consumer provides: the label and the click handler.
