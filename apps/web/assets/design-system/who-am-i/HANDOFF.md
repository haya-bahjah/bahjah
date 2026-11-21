# Handoff: Who Am I? | مين أنا؟ — game screens

## Overview
"Who Am I?" is a multiplayer party game on the Bahjah platform. Each round hides one well-known character. Players get up to **6 clues**, which the character speaks in the first person and which get easier as they go. An earlier correct guess earns more points (**600 · 500 · 400 · 300 · 200 · 100**). The host picks either **Timed** reveal (one clue every 15s) or **Host clicks** reveal. Guesses are **free text**, entered privately on each player's phone. **Tries are unlimited and wrong guesses cost nothing.** A correct guess locks that player in at the value of the clue that was visible when they sent it. The highest total wins.

The game uses three surfaces:
1. **Shared screen**: TV or projector, 16:9 and public. It shows the game state, clues, timer and scores. It **never shows guess text**.
2. **Host panel**: on the host's phone. It shows settings, the answer (host only), reveal controls, the live guess feed, answer review and player management.
3. **Player phone**: used to join, see clues, submit guesses, and see personal status and results.

Hosts without a second device can use **host controls on the TV**: a slim pill-shaped bar at the bottom of the shared screen.

## About the design files
The files here are **design references made in HTML**. They are prototypes that show the intended look, layout, copy and states. They are **not production code to copy directly**. Recreate them on the Bahjah website using its existing stack (React, Vue, etc.) and its established patterns. If no front-end environment exists yet, choose the most suitable framework.

Open in a browser:
- `standalone/Wireframes EN.html`: the full flow in English (LTR).
- `standalone/Wireframes AR.html`: the full flow in Arabic (RTL).
- `standalone/Logo.html`: the logo.

Each board has a **Night / Day** switch in its header.

The `*.dc.html` files are the editable sources and use `support.js` plus `_ds/` (the design-system bundle). They are mainly useful for reading exact inline styles. The design-system components (Button, ClueCard, etc.) live in `_ds/.../_ds_bundle.js`, a compiled React bundle. Read it for exact component styling.

## Fidelity
**Mid-fidelity, brand-styled.** The following are final:
- colours, type, radii, glass treatment, grain and logo
- copy direction and screen structure

Exact spacing within screens is indicative. Match it closely, but snap to the spacing scale below. The sample content (Sherlock Holmes, the 6 clues and the player names) is placeholder content.

## Screens (12 steps × 3 surfaces)
Design sizes: shared screen **960×540**, scaling to 1920×1080 at 2×. Phones are **320×720** at 1×.

| # | Step | Shared screen | Host panel | Player phone |
|---|---|---|---|---|
| 01 | Create session + settings | Logo splash, "Waiting for the host to create a session" | Pack select; reveal mode (segmented: Timed / Host clicks); seconds per clue stepper (15, shown only when Timed); identities stepper (5); points ladder; "Host controls on TV" switch; **Create** | — |
| 02 | Join | Join code (IBM Plex Mono, 104px, tracked) + QR (220px white tile) + URL `bahjah.com/join` + joined count | Code + QR card; Share invite; Cast to TV; **To lobby** | Logo; Session code field; Name field; **Join**; Scan QR (ghost) |
| 03 | Lobby | Top bar (logo · host name · code); "How to play", 3 glass cards; player chips; footer "Waiting for the host to start" | Settings badges; player list with remove (×); "Min 2 players"; **Start game** | Avatar initial, "Hi Noura", "You're in", short instruction card |
| 04 | Round start | Masked portrait (arch, 240px, breathing ؟) + "ROUND 1 OF 5" + "Who am I?" + "Clue 1 is worth 600 pts"; TV host bar: **Start clues** | **Host-only** light card with the answer + accepted aliases; list of all 6 clues with points; **Reveal clue 1** | Breathing ؟/?, "Get ready…" |
| 05 | Clue reveal | 3 columns `150px / 1fr / 240px`: portrait (blur lowers as clues reveal) + timer ring · 6 clues (revealed and current as ClueCards; locked as slim 40px blurred rows) · top-5 scoreboard; TV host bar: pause / next / reveal / skip | Current clue card, timer ring + "Next clue in 9s", Pause / Skip, solved counter "2 / 6", **Next clue**, Reveal answer (ghost) | "CLUE 3 OF 6", "+400 pts now", clues seen (newest first), guess field + **Submit** |
| 06 | Guess submission | Clues + "Who's got it" list: per player a badge (Clue 2 · +500 / Under review / Guessing · 2 tries / No guess yet). **No guess text** | Live feed: name · clue #, «guess», badge (Correct / Wrong / Review); **Review 1** (sun button) | (a) Wrong try: struck-through previous tries, field error "Not it — no penalty". (b) Correct: mint check, "+400", "Locked in at clue 3" |
| 07 | Host review | Clues blurred behind; toast "Host is reviewing a guess"; round keeps running | Review card: who, at which clue, «guess» vs answer, "Close match"; explains the points; **Accept** / **Reject** | "Under review", their guess, points held; "Try another" (ghost) |
| 08 | Answer reveal + points | Unveiled portrait + "I am Sherlock Holmes" + winners list with clue # and sun points badge; TV host bar: Leaderboard | Answer, awards list, "3 missed", **Leaderboard** | (a) Solved: "+400 at clue 3", total. (b) Missed: "0", "Not this time", total |
| 09 | Leaderboard | "AFTER ROUND 1 OF 5", ranked PlayerScore rows + delta for this round | Compact ranking; **Next identity**; End early (ghost) | Big rank number, points, "+400 this round" |
| 10 | Game end | Sun glow, crown, "WINNER", name 96px, "Winner! · 2,100 pts", runner-up tiles | Winner card (sun tint), stats; **Continue** | Final place, points, "Solved 4 of 5" |
| 11 | Rematch + share | Logo, "Play again?", "Same players, new identities", code | **Rematch** / New pack / Share / End session (ghost) | Share card (cobalt gradient, logo, "I solved 4 of 5", place · points); **Share**; Leave |
| 12 | Reconnecting + errors | Paused timer ring, "Reconnecting…", "The round is paused. Nothing is lost." | Toast "Fahad disconnected"; list with Online/Offline timer; points kept; Remove Fahad | (a) Invalid code / session full field error. (b) Reconnected toast + "Round locked — guess arrived after time" |

## Interactions & behaviour
- **Server-authoritative**: phase, clue index, deadlines and scoring all come from the server. Client countdowns are display-only.
- **Clue timing**: Timed reveals one clue every 15s by default; Host-clicks mode waits for host action. Clues can never reveal out of order.
- **Scoring**: points = the value of the latest visible clue at the moment the server accepts the correct guess. Each player gets at most one award per identity, and all players who are correct at the same clue get the same points. If nobody solves it after clue 6, reveal the answer with 0 points.
- **Guesses**: free text, unlimited tries, no penalty. Normalise whitespace, case and punctuation, then match against the canonical answer and its aliases (Arabic and English spellings). Uncertain matches go to **Host review**. The guess keeps the clue value from when it was submitted, and the player can keep trying meanwhile.
- **Privacy**: guess text is visible only to its author and the host. The shared screen shows status only.
- **Late submission**: rejected, and the player sees "Round locked".
- **Reconnect**: restore the current clue index, remaining time and the player's own submission state. On the TV, pause visuals and show "Reconnecting…".
- **Host on TV mode**: a bottom pill bar with IconButtons. In this mode the review dialog opens only on the host's tap, and guess text should still be kept off the screen (consider requiring a PIN).
- **Motion** (from the design system): UI 160–280ms `cubic-bezier(.22,.61,.36,1)`; clue reveal 640ms blur → sharp plus a 12px rise (`wai-rise`); answer reveal 1200ms `cubic-bezier(.16,1,.3,1)`; breathing ؟ loop 3.2s (`wai-breathe`). No bounce, no confetti.
- **States**: hover brightness 1.12 · press scale .97 · focus 3px ring `rgba(124,200,255,.55)`.

## Localization
- These are two **separate** experiences: Arabic (RTL, Arabic-Indic digits in copy, Arabic line-height 1.7) and English (LTR, Western digits). Layouts mirror.
- Tracked uppercase eyebrows (e.g. "CLUE 3 OF 6", letter-spacing .2–.24em) are **Latin only**. Arabic eyebrows use no letter-spacing and weight 600.
- Session codes always stay LTR monospace.

## Theming (Night / Day)
Night is the default and uses the design-system tokens as they are. Day overrides these variables at the root:
```
--grad-night: radial-gradient(120% 80% at 50% 0%, #FFFFFF 0%, #EEF3FF 45%, #C9D4F2 100%)
--text-primary: #0A0F3D   --text-secondary: rgba(10,15,61,.74)   --text-muted: rgba(10,15,61,.6)
--surface-glass: rgba(255,255,255,.6)   --surface-glass-strong: rgba(255,255,255,.82)
--border-glass: rgba(24,40,138,.16)     --border-glass-strong: rgba(24,40,138,.32)
--cobalt-100: #1A32B8
accent text for contrast on light: eyebrow #1A32B8 · sun #9A6200 · hot #C4461C · mint #0B8A63 · sky #0A6FB0
TV host bar bg: rgba(255,255,255,.9) (night: rgba(10,15,61,.78)) · locked clue row bg: rgba(24,40,138,.08) (night: rgba(10,15,61,.45))
```
The phone bezels (#1A32B8 host, #18237A player) are mock-up chrome only and are not part of the UI.

## Design tokens (from the design system, `_ds/.../tokens/`)
- **Night blues**: 950 #060A26 · 900 #0A0F3D · 800 #111A5C · 700 #18237A
- **Cobalt**: 50 #EEF3FF · 100 #DCE6FF · 200 #B9CCFF · 300 #8FAEFF · 400 #5E86FF · **500 #2F5BFF (primary)** · 600 #1F43E6 · 700 #1A32B8 · 800 #18288A
- **Ultraviolet**: 300 #9C94FF · 500 #3B2BFF · 700 #2414B8 · **Sky**: 100 #DFF2FF · 300 #7CC8FF · 500 #12A0F5 · 700 #0A6FB0
- **Mist**: 0 #FFFFFF · 50 #F4F7FF · 100 #E6ECFB · 200 #C9D4F2 · 400 #8F9CC9 · 600 #5A6596
- **Warm accents** (small doses only): sun 400 #FFC93C · sun 200 #FFE59A · ember 500 #FF6A3D · ember 300 #FF9C7A · blush 300 #F6B7C1 · **mint 400 #3FD6A6 (correct)**
- **Points ramp** (clue 1 → 6): #FFC93C · #FFB04A · #FF9C7A · #7CC8FF · #8FAEFF · #8F9CC9
- **Gradients**: night `radial-gradient(120% 80% at 50% 0%, #1B3BE0 0%, #111A5C 45%, #060A26 100%)` · cobalt button `linear-gradient(180deg,#5E86FF,#2F5BFF 50%,#1F43E6)`
- **Glass**: fill rgba(255,255,255,.07), border 1px rgba(255,255,255,.18), `backdrop-filter: blur(20px) saturate(140%)`, inset highlight `inset 0 1px 0 rgba(255,255,255,.28)`
- **Shadows**: soft `0 8px 24px rgba(6,10,38,.35)` · float `0 24px 60px rgba(6,10,38,.55)` · glow `0 10px 40px rgba(47,91,255,.55)` · sun glow `0 0 32px rgba(255,201,60,.55)`
- **Grain**: SVG fractal-noise overlay (`--grain` in effects.css), `mix-blend-mode: overlay`, opacity .14 on surfaces and .55 on the logo
- **Type**: display **Reem Kufi** 700; body/UI **Readex Pro** 400–600; codes **IBM Plex Mono** 600. Scale 96 / 72 / 56 / 40 / 32 / 24 / 20 / 16 / 14 / 12. Line-height 1.05 / 1.2 / 1.5 / Arabic 1.7.
- **Spacing**: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80
- **Radii**: 6 · 10 · 16 · 24 · 32 · pill 999. Controls are pills; the portrait uses an arch (top radius = width/2).
- **Control heights**: 36 / 48 / 60

## Components used (design-system bundle)
Button (primary / secondary / ghost / light / sun; sm / md / lg; icon) · IconButton (glass / solid / ghost) · Badge (glass / cobalt / sun / correct / wrong) · TextField (label, icon, error, dir) · SegmentedControl ({value, label, icon}[]) · Stepper · Switch · ClueCard (index, text, points, state: locked / current / revealed, compact) · PointsLadder · TimerRing (remaining, total, paused) · MaskedPortrait (reveal 0–1, revealed, name, shape: arch) · PlayerScore (name, score, rank, colorIndex, leading) · Toast (info / correct / wrong / points).
Player colour dots, in join order: #7CC8FF · #FFC93C · #F6B7C1 · #3FD6A6 · #9C94FF · #FF9C7A.

## Logo
The emblem (`LogoMark.dc.html`) is a 32-radius rounded square with a cobalt sky above and a deep-blue floor below. Its parts, as percentages of the square's size:
- **Horizon:** at 60%. Sky gradient #5E86FF → #2F5BFF; floor #1F43E6 → #18288A.
- **Door:** an arched doorway at left 38.6%, top 17.9%, 22.9% wide and 42.1% tall. Filled with a sun gradient #FFE59A → #FFC93C, with a glow.
- **Light spill:** a trapezoid of light on the floor below the door.
- **Figure:** a tiny navy (#0A0F3D) silhouette standing in the door.
- **Grain:** a grain overlay across the whole square.

The emblem uses percentage positioning, so it scales from 28px to 280px. The wordmark is «مين أنا؟» (or "Who am I?") in Reem Kufi 700, with the ؟/? in sun #FFC93C plus a glow. **Rebuild it as an SVG for production.**

## Assets
- No raster assets are used in the screens. The character portrait is a placeholder that the content pack must supply per identity.
- Icons: **Lucide** via the `lucide-static` icon font (CDN, in `tokens/icons.css`): play, pause, skip-forward, eye, eye-off, rotate-ccw, x, plus, check, lock, timer, mouse-pointer-click, trophy, crown, star, share-2, tv, qr-code, scan-line, hash, user, user-minus, send, hourglass, list-checks, layers, smartphone, chevron-down, moon, sun.
- Fonts: Reem Kufi, Readex Pro and IBM Plex Mono from Google Fonts. These are substitutes; swap in licensed brand files if they exist.

## Files
- `standalone/Wireframes EN.html`, `standalone/Wireframes AR.html`, `standalone/Logo.html`: self-contained, open offline.
- `Wireframes EN.dc.html`, `Wireframes AR.dc.html`, `Logo.dc.html`, `LogoMark.dc.html`: editable sources (need `support.js` + `_ds/` next to them, served over HTTP).
- `_ds/who-am-i-design-system-…/`: design tokens (`tokens/*.css`) and the component bundle.
