# Game design systems

Per-game design systems, one folder each. Each folder mirrors a Design System artifact on claude.ai, which you can browse with live previews:

| Game | Folder | Artifact |
|---|---|---|
| Mafia (مافيا) | `mafia/` (Mafia Noir) | https://claude.ai/artifact/5QmicudhuTz3pENcHEQxuj |
| Knows You Best (عارفكم) | `arifkum/` (Arifkum Paper) | https://claude.ai/artifact/YNgXshxHwHaqDca8n2sU5B |

## What's in a folder

- `README.md`: the brand book: principles, colour, type, layout, motion, voice, iconography, and what isn't covered yet. Start here.
- `tokens.json`: the source of truth for colours (per theme), type styles, spacing, radius, shadows and timing.
- `tokens.css`: CSS custom properties compiled from `tokens.json` (one class per type style).
- `components/bundle.css`: the component styles (`.mn-*` for Mafia, `.kyb-*` for Arifkum).
- `components/<Name>/README.md`: guidelines for one component; `preview.html` renders it.
- `assets/<Group>/README.md`: usage notes for the logos and art. The files themselves live in `apps/web/assets/`, and the previews load them from there.

To view a preview, serve `apps/web` (for example `npx serve apps/web`) and open `/design-systems/<game>/components/<Name>/preview.html`. They need the site root so the `/assets/...` paths resolve.

These are reference systems built from the shipping game code. The games themselves still load their own stylesheets (`assets/mafia-game/mafia-game.css`, `assets/kyb-theme.css`). If you change a value here, change it in the game code too, and the other way round.
