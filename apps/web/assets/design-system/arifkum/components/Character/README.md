# Character

The six hand-drawn creatures players pick as avatars, built from CSS shapes so they scale from 54px phone tiles to 86px TV seats.

| Character | Body | Rarity | Idle motion |
|---|---|---|---|
| Bouncy Blob | `kyb-cyan` | Common | bob, 1.5s |
| Dino Pop | `kyb-green`, yellow spikes | Rare | hop, 1.15s |
| Bunny Blaze | `kyb-pink`, long yellow ears | Rare | hop, .95s |
| Starry Spark | `kyb-yellow` | Epic | spin-wobble, 2.4s |
| Donut Sprinkles | `kyb-card` with pink icing | Epic | bob, 1.9s |
| Neko Nova | `kyb-purple` | Mythic | float, 2.3s |

- Every outline is `kyb-ink` (2–2.5px), so the characters swap with the theme. Eyes blink every 4s.
- Geometry is a percentage of a 54px box (`avatars.js` › `kybCharacterSvgMarkup`). Size the container and nothing else.
- Rarity colours: Common ink-40, Rare cyan, Epic purple, Mythic yellow.
- Players can use a photo instead. The crown rule on the final screen handles both.
