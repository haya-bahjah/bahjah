# Bahjah Design System

Bahjah (بهجة — "joy") is a social party-gaming platform: open it on a host device (TV, console, browser) like you'd open Netflix, pick from a library of party games (Mafia, Trivia, digitized partner titles), and everyone joins instantly from their phones. The phone is the controller. No setup. Just play.

**Aesthetic:** 90s arcade culture meets modern digital entertainment — pixel nostalgia, CRT scanlines, neon lighting, game-HUD chrome — executed as a premium, contemporary platform. Never childish, cheap, or generic-esports.

**Sources provided:** two logo SVGs (`uploads/1.svg` wordmark, `uploads/2.svg` mark) + a written brand brief (personality, palette direction, voice). No codebase, Figma, or font binaries were provided; components below are authored from the brief.

## Products / surfaces
- **TV / Host app** — the big screen everyone watches: game library, lobby with QR join, live scoreboard. `ui_kits/tv/`
- **Mobile controller** — each player's phone: join, pick avatar, answer/vote. `ui_kits/mobile/`

## CONTENT FUNDAMENTALS
- Voice: **Short. Playful. Confident. Social.** Sentences of 2–5 words. Fragments welcome.
- Address the player as "you"; the brand never says "we" in-product.
- Sentence case for body/UI labels; ALL-CAPS (with wide tracking) reserved for HUD labels, buttons, and pixel-font accents.
- Arcade vocabulary: "Press Start", "Game on", "Ready?", "Player 2 joined", "Let the chaos begin", "Your phone is the controller", "No setup. Just play."
- Periods used even on fragments — they add punch: "Everyone's playing."
- No emoji in UI chrome. Expressive color and motion carry the fun instead.
- Never corporate, technical, or promotional ("leverage", "seamless", "best-in-class" are banned).
- Numbers are celebrated: scores, streaks, player counts get big pixel/display type.

## VISUAL FOUNDATIONS
- **Dark foundation.** Every surface starts at Arcade Black `#0B0B14`; raised surfaces step to `#12121F` / `#1A1A2B`. Light backgrounds are rare (print/marketing only).
- **Color roles:** Electric Purple = brand/primary; Pixel Green = the action color ("Press Start", join, success); Neon Pink = hot moments (elimination, live, danger); Cyber Cyan = info/links/focus; Arcade Yellow = scores & wins. One accent per element — never rainbow a single component.
- **Type:** Tektur (display, 700–900) for titles/HUD; Space Grotesk (body); Silkscreen (pixel accent) ONLY for tiny labels, scores, and badges — never long copy. CAPS labels get `letter-spacing:.14em`.
- **Glow, not gradient.** The signature effect is a single-color neon glow (`--glow-*` box-shadows, `--text-glow-*`). Avoid multi-color gradient washes; backgrounds are flat dark with optional scanline overlay (`.scanlines`) and subtle radial vignettes.
- **Borders do elevation.** Cards: `--surface-card`, 1px `--border-subtle` border, `--radius-md` (12px), `--shadow-card`. Selected/active cards swap the border to an accent + its glow.
- **Corner radii:** tight and techy — 4/8/12/16. Pills only for status chips and player tags.
- **Motion:** snappy and springy. `--ease-arcade` (overshoot) for entrances/presses, 120–220ms. Hover = border/glow brightens + slight lift (`translateY(-2px)`); press = `scale(.97)`. Countdown/score moments may pulse. No slow fades.
- **Focus:** 2px cyan ring offset from the surface (`--ring-focus`) — TV UIs are focus-driven, make it loud.
- **Scanlines & CRT:** `.scanlines` overlay class for hero/lobby moments; use sparingly (one per screen).
- **Imagery:** dark, saturated, neon-lit. Photography of real gatherings tinted toward the palette. No stock-corporate imagery.
- **Transparency/blur:** overlays use `--surface-overlay` + `backdrop-filter: blur(12px)`; used for modals and QR join sheets only.

## ICONOGRAPHY
- No brand icon set was provided. Use **Lucide** (CDN) at 2px stroke, sized 16/20/24, colored via `currentColor` — its geometric stroke style fits the HUD look. Flagged as a substitution.
- Unicode/HUD glyphs (▲ ▶ ● ◼ ✕) are legitimate accents in scoreboards and controller D-pads.
- No emoji.
- Logos in `assets/`: `logo-wordmark.svg` (بهجة wordmark), `logo-mark.svg` (mark) — both `currentColor`, recolorable. Default renders: Soft White on dark; Pixel Green or Neon Pink for hero moments.

## Index
- `styles.css` → `tokens/` (fonts, colors, typography, spacing, effects, base)
- `assets/` — logo-wordmark.svg, logo-mark.svg
- `guidelines/` — foundation specimen cards (Design System tab)
- `components/core/` — Button, Avatar, PixelBadge, PlayerChip
- `components/game/` — GameCard, ScoreRow, CountdownRing, JoinCode, AchievementBadge
- `ui_kits/tv/` — host-screen kit (library, lobby, scoreboard)
- `ui_kits/mobile/` — player controller kit
- `SKILL.md` — agent skill entry point

## Intentional additions
No source defined a component inventory, so a party-game-specific set was authored from the brief's list (game cards, press-start buttons, join screens, lobbies, scoreboards, countdowns, avatars, badges).

## Caveats
- Fonts are Google Fonts substitutions (Tektur / Space Grotesk / Silkscreen) — no brand binaries provided.
- Icon set is Lucide via CDN — substitution, no brand set provided.
