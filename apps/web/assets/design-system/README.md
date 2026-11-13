# Bahjah design system

## Platform (loaded by the site)

- `tokens.css`: game-agnostic tokens for the whole platform (the arcade palette, type, spacing, effects).
- `base.css`: base element styles.
- `arcade.css`: the arcade cabinet background (side rails, glows, grid, scanlines).

These are the only files in this folder that pages actually load.

## Games (reference systems)

One folder per game. Each mirrors a Design System artifact on claude.ai, which you can browse with live previews:

| Game | Folder | Artifact |
|---|---|---|
| Mafia (مافيا) | `mafia/` (Mafia Noir) | https://claude.ai/artifact/5QmicudhuTz3pENcHEQxuj |
| Knows You Best (عارفكم) | `arifkum/` (Arifkum Paper) | https://claude.ai/artifact/YNgXshxHwHaqDca8n2sU5B |
| Malarkey (تخاريف) | `malarkey/` (Riso Print) | design handoff, see `malarkey/README.md` |

### What's in a game folder

- `README.md`: the brand book: principles, colour, type, layout, motion, voice, iconography, and what isn't covered yet. Start here.
- `tokens.json`: the source of truth for colours (per theme), type styles, spacing, radius, shadows and timing.
- `tokens.css`: CSS custom properties compiled from `tokens.json` (one class per type style).
- `components/bundle.css`: the component styles (`.mn-*` for Mafia, `.kyb-*` for Arifkum).
- `components/<Name>/README.md`: guidelines for one component; `preview.html` renders it.
- `assets/<Group>/README.md`: usage notes for the logos and art. The files themselves live in `apps/web/assets/`, and the previews load them from there.

To view a preview, serve `apps/web` (for example `npx serve apps/web`) and open `/assets/design-system/<game>/components/<Name>/preview.html`. They need the site root so the `/assets/...` paths resolve.

The games don't load these folders. They still use their own stylesheets (`assets/mafia-game/mafia-game.css`, `assets/kyb-theme.css`). If you change a value here, change it in the game code too, and the other way round.
