# RoleCard

The secret role, dealt face down and flipped by the player on their own phone.

## Face down (`mn-card-back`)
300×430, `radius-lg`, a 16px dot grid over the `night-navy → night-deep` gradient, the red fedora mark, and *TAP TO REVEAL* pulsing. The whole card breathes a `glow-red-pulse` every 2.6s: it is the first thing in the game that asks to be touched.

## Face up (`mn-card-front`)
Flips in with `flipIn` (.55s, `ease-arcade`). From top: *SECRET ROLE* caption, the role art (170×234), role name in `role-name` type and the role colour, a 48px rule, the description (`body-sm`), the win condition in `pixel-caption`.

| Role | Modifier | Colour | Art |
|---|---|---|---|
| Mafia | — | `role-mafia` | `mafia-boss.svg` (`mafia-hitman.svg` for the partners on the verdict) |
| Doctor | `mn-role--doctor` | `role-doctor` | `doctor.svg` |
| Sheriff | `mn-role--sheriff` | `role-sheriff` | `sheriff.svg` |
| Citizen | `mn-role--citizen` | `role-citizen` | `citizen-m.svg` / `citizen-f.svg` |

Rules: never show a role card face up on the TV; the dawn report reuses the face-down back for the victim because the morning never reveals what they were.
