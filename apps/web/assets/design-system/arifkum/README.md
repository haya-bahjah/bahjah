# Arifkum Paper

The design system for **عارفكم — Knows You Best**, Bahjah's get-to-know-you party game. Everyone answers the same personal question anonymously, then tries to match each answer to the friend who wrote it. The question at the end is *مين عارفكم؟ / Who knows you best?*

The game is drawn on **paper**. It keeps Bahjah's arcade skeleton (Silkscreen HUD labels, scanlines, the same grid) but sits on cream so it reads in a lit living room. Everything on top looks hand-made: wobbly ink outlines, tilted cards, hard offset shadows, doodle marks, and six round little characters.

Built from the shipping front end on `staging`: `apps/web/assets/kyb-theme.css`, `kyb/kyb-tokens.css`, `avatars.js`, `knows-you-best-host-console.js` and `knows-you-best-play.js`. Values are exact. Where a source pair fails contrast, the value is kept and its token note says so.

## Principles

1. **Paper, not a screen.** The ground is `kyb-page` cream with a 7px grain (`kyb-noise`), faint scanlines (`kyb-scan`) and a purple floor glow (`kyb-tint-pu`). Cards are `kyb-card`, a shade lighter, and sit on hard 4px offset shadows (`shadow-hard`) that are never blurred.
2. **Drawn by hand.** Every outline is `kyb-ink` at 2–4px. Big corners are never uniform: `--kyb-r-lg`, `--kyb-r-md` and `--kyb-r-card` use different radii per corner plus an elliptical second half, so nothing reads as a rounded rectangle. Neighbouring cards tilt by different amounts (±0.8–2°, `kyb-tilt-1…6`).
3. **Five inks, five jobs.** Green confirms (the CTA, correct matches). Pink reveals (answer field, wrong matches, game over, the signature). Cyan joins (room code, round badge, links). Purple marks steps (status, floor glow). Yellow means score and winners (prompt frame, score box, first place, crown).
4. **A player owns a colour.** Seats, answered chips, revealed answer cards and winner frames all use the same colour per player, cycling pink → cyan → green → purple → yellow.
5. **The room sets the pace.** There is no clock. Answering ends when the last answer is in, matching ends when the last board is locked, and the results stay up until everyone taps Next. The host can move a stalled room on.
6. **Hold the numbers back.** Between rounds the room sees one round winner and no scores. Only the final screen shows a score, and only the winner's.

## Themes

Two themes, switched by the site's global light/dark toggle, with identical structure:

- **Paper** (`light`): the designed palette from the handoff, verbatim.
- **Ink** (`dark`): a derivation. Ink and paper swap roles (`kyb-ink` becomes cream and the surfaces go deep ink), and the five accents are lifted to hold on the dark ground. Text on an accent fill flips dark (`kyb-on-accent`).

Never mix the two on one screen. The site defaults to dark, so first-time players land on Ink. Make Paper the default if the paper look should lead.

## Colour

| Job | Tokens |
|---|---|
| Ground and surfaces | `kyb-shell`, `kyb-page`, `kyb-card`, `kyb-card2` |
| Ink and text | `kyb-ink`, `kyb-ink-64`, `kyb-ink-55`, `kyb-ink-50`, `kyb-ink-40` |
| Lines and texture | `kyb-line`, `kyb-line-08`, `kyb-chip`, `kyb-tint-n`, `kyb-noise`, `kyb-scan`, `kyb-shadow` |
| Accents | `kyb-green`, `kyb-pink`, `kyb-cyan`, `kyb-purple`, `kyb-yellow`, each with `kyb-glow-*` and `kyb-tint-*` |
| On accent | `kyb-on-accent` |

**Contrast flags (Paper, kept from source):** `kyb-yellow` 2.8:1, `kyb-green` 3.2:1, `kyb-cyan` 3.9:1 and `kyb-ink-40` 3.0:1 on `kyb-page`. Use them for frames, fills, 24px+ numbers and bold 18px+ labels, not for small running text. Pink (4.6:1) and purple (7.5:1) pass.

## Typography

| Family | Face | Role |
|---|---|---|
| `display`, `body` | **Childos Arabic**, falling back to Space Grotesk | One playful face for everything: prompts, names and body text. |
| `pixel` | **Silkscreen** | HUD: round badge, status, labels and tags. Uppercase with .08–.14em tracking. |
| `arabic` | Childos Arabic, then **Noto Kufi Arabic**, then Readex Pro | The Arabic build. Noto Kufi supplies the numerals. Silkscreen has no Arabic glyphs, so pixel labels switch to Readex Pro. |

**Licensing note.** Childos is a *demo cut* served from a third-party font CDN and has to be licensed before production. The cut has no digits and draws a foundry watermark at "&", so its `@font-face` leaves out U+0030–0039 and U+0026, and those characters fall through to Space Grotesk on purpose. Re-widen the range once the licensed cut lands. Previews in this system can't load Childos and show Space Grotesk.

The display scale runs final-title 62, winner-name 62, prompt 44 (weight 400, so the face carries it), stage-title 44, category-name 38, score 34, code tile 30, card text 22–23 and CTA 16. Body sizes are 19 (answer input), 15, 13.5 italic (samples), 13 and 12.5. Pixel sizes are 13, 12, 10, 9 and 8.

## Shape, space and depth

- **Corners:** `--kyb-r-lg` (`26px 14px 30px 16px / 16px 32px 14px 26px`) for prompt, cards and the winner card. `--kyb-r-md` for fields, seats, result rows and the locked sticker. `--kyb-r-card` for category and answer cards. `--kyb-r-splash` for the splash. The only regular radius is `kyb-r-sm` (12px) for chips and code tiles; badges use `radius-tag` (4px) or `radius-pill`.
- **Depth:** hard offsets only (`shadow-hard` 4px, `shadow-hard-lg` 5px, `shadow-ink` 3px solid). Glows (`kyb-glow-*`) mark selection, hover and winners.
- **Space:** `space-1…8` (4 → 44). The TV stage is 1188px wide with a 34px gap. The phone stage is about 900px max with 20px gaps (16 on phones).

## Motion

Bouncy and short. `ease-pop` (`cubic-bezier(.2,1.4,.4,1)`) for pops, flips and lifts; `ease-flip` for result rows. The animations are `kybIn` (320ms rise-and-straighten), `kybPop` (320–420ms overshoot with a twist), `kybFlipIn` (380ms answer cards, .5s result rows) and `kybWig`. Characters idle with bob, hop, float or spin-wobble, and blink every 4s. The TV's truth reveal is strictly serial (about 22s for 12 answers) and must not be retimed. `prefers-reduced-motion` stops every animation.

## Voice

- Warm, cheeky, a little conspiratorial: *Nobody gets hurt.* · *Reveals more than you think.* · *Friendships end here.*
- The room is addressed together: *Speak now if you want a different one — the room starts on confirm.*
- Buttons name the next thing: *Start on Imagine if*, *Lock it in*, *Show the truth*, *Play again*.
- Arabic is first class and colloquial where the English is playful: *مين عارفكم؟*, *اكسروا الجليد*, *تخيل لو …*, *للمقربين فقط*.

## Iconography

- **Logo:** the Arabic wordmark *عارفكم* in indigo over five overlapping profile silhouettes in coral, orange, pink, green and violet on a salmon disc (`knows-you-best-logo.png`). `kyb-logo.webp` is the hero version. Show the logo whole and never recolour it.
- **Doodles:** ● ▲ ✕ ◼ ✦ ★ are used as card tags and margin marks, in accent colours. They are typographic, not emoji. The only emoji is 🏆 in share copy.
- **Characters:** the six CSS-drawn creatures (see Character). There is no separate icon set.

## Components

14 static components, in game order: **HUD** (Badge), **Actions** (Button), **Identity** (Character), **Setup** (Seat, CategoryCard), **Round** (PromptCard, Timer, AnswerChips, AnswerField), **Reveal** (AnswerCard, ResultRow), **Finale** (WinnerCard, Podium, FinalWinner). The classes come straight from the source (`.kyb-*`) and live in `components/bundle.css`. Wrap a screen in `.kyb-root`.

## Not synced

- The previews are **static renditions** hand-written from the game's markup. The game builds its HTML as strings, so there is no component library to bundle.
- Childos Arabic isn't included (unlicensed demo cut on a third-party CDN). The other faces are on Google Fonts.
- Not covered yet: the phone MATCH board (drag names onto answers, `kyb-phone-match.js`), the TV MATCH and TRUTH timelines (`kyb-tv-*.js`), the splash, the QR frame and the avatar picker tab.
