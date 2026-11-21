# Handoff: مع أو ضد · For or Against — Game Wireframes (AR + EN)

## Overview
A party debate game. The host shows a **statement**; every player votes **For (مع)** or **Against (ضد)** on their phone. The split forms two teams; each team argues for **2:30**; everyone votes again; the side with more final votes wins and players on it score +1. Repeat for N statements.

Three surfaces:
1. **Host screen** — shared TV / laptop, fixed 1280×720 stage scaled to fit.
2. **Player phone** — 390×780 mobile web (join via QR / code).
3. **Host controls** — either a **phone** (390×780) or an **on-TV host bar** overlaying the bottom of the host screen (auto-hides after 4s, `H` toggles). Same actions in both.

## About the design files
The files in this bundle are **design references created in HTML** — wireframes showing intended layout, copy and behaviour, not production code. Recreate them in the target codebase's environment (e.g. Next.js/React + a realtime layer such as WebSockets/Supabase/Firebase) using its own patterns. If no environment exists yet, pick the most suitable stack.

- `wireframes-ar.html` — Arabic, RTL (primary language)
- `wireframes-en.html` — English, LTR
Each is self-contained; open in a browser and pan/zoom. Each step is a row: Host screen · Player phone · Host controls (phone) · dev notes. The on-TV host bar sits under each host screen.

## Fidelity
**Mid-fidelity.** Final brand colours, type, borders, shadows and the logo are applied; layouts and copy are close to final. Spacing should follow the 8px grid; refine details during build. Icons in buttons are Lucide (rendered as black squares in some screenshots — they're CSS masks).

## Localisation
- Arabic is the default (`<html lang="ar" dir="rtl">`); English is `lang="en" dir="ltr"`. Mirror layouts with logical properties (`margin-inline-start`, `inset-inline-end`, flex/grid) — don't hand-flip.
- Numbers, timers and codes always LTR in Western digits (`02:30`, `05 / 08`, `K7Q4`) — wrap in `<bdi dir="ltr">` / `dir="ltr"`.
- Small UPPERCASE Space Mono captions (`ROUND 03`, `FOR`) are English in both locales — decorative, part of the brand.
- The **logo stays Arabic in both locales** ("مع أو ضد").
- Statements need both `ar` and `en` fields; the host's own statements are single-language.
- Use an i18n dictionary keyed by string id; all copy below is in the wireframes in both languages.

## Screens / steps
| # | Step | Host screen | Player phone | Host controls |
|---|---|---|---|---|
| 01 | Setup | Logo splash | — (not joined yet) | Statement source (Packs / Mine / Both), category chips, add-statement input, count (default 10), time per team (02:30), "allow switching" switch, **Create session** |
| 02 | Join & lobby | Yellow panel: logo flush top, QR + 4-char code + URL; right: player tokens grid + count; "How to play" | Session code + name inputs, assigned token, **Join** | Player list with Remove, **Start game** (enabled at ≥2), Settings |
| 03 | Statement | Phase stepper, large StatementCard centred | Statement card, "think it over" | **Open voting**, Skip statement (confirm) |
| 04 | First vote | Statement, "Vote on your phone", `05 / 08` counter, tokens with voted dot (choice hidden) | Statement + two stacked VoteButtons (For blue circle / Against red square); can change until closed | Counter, waiting list, **Close voting**. No vote = abstain |
| 05 | Teams | Two TeamPanels, abstainers listed, "Team For starts · 02:30" | Full-bleed team colour: "You're on team **For**", teammates | For/Against count bar, **Start Team For** |
| 06 | Debate · For | Timer on For side (lg), statement, active/muted TeamPanels | Team For: "Your turn" + timer | Timer, **Pause**, End team's turn (confirm) |
| 07 | Debate · Against | Mirrored: timer on Against side | Listening state: red strip, "Team Against's turn" + timer | Same as 06 |
| 08 | Pause / skip | 72% ink scrim + yellow "Paused" slab with remaining time | Paused state | **Resume**; bottom-sheet confirm for any skip |
| 09 | Final vote | "Changed your mind?", counter, tokens | Shows first choice badge, VoteButtons | Counter, **Close & reveal verdict** |
| 10 | Verdict | Winning colour field, "For wins", VoteMeter; before/after counts, # switched, +1 point note | Win/lose message, round points, total | **Next statement**, End game |
| 11 | Tie | Yellow field: "Tie.", 4:4 meter, sudden-death 01:00 timer | "Tie." + timer | **Start sudden death**, No winner → next |
| 12 | Empty side | One TeamPanel + dashed empty slot "Nobody is Against" | — | **Start Team For**, Skip statement |
| 13 | Disconnected | Ink banner "X disconnected", ghosted token, seat kept | "Reconnecting…" + Try again | Card: Wait / Remove, timer, Pause |
| 14 | Game over | Leaderboard (rank, token, name, bar, points) + statements list with outcome shape | Your rank, points, **Share your result**, Leave | **New game**, Share results, Close session |

## Game rules / behaviour
- Min players **2**. Host may also play.
- Timer is **server-authoritative**, 150s active time per side; pause freezes it and is logged.
- The whole team argues freely (no mic hand-off).
- Empty side → that side's debate slot is skipped automatically; final vote still runs.
- Only the **final vote** decides the winner. +1 point to each player whose final vote = winning side.
- Tie → sudden death: 60s per side + one more vote; second tie = "no winner", no points. Zero votes = no result.
- Abstainers in vote 1 may vote in the final vote.
- Disconnect: seat kept; on reconnect restore current phase; host decides pause; not back by vote close = abstain.
- Every skip (side or statement) requires confirmation.
- Next statement unlocks only after the result is saved.

## State (suggested)
`session { code, hostId, status: setup|lobby|playing|ended, settings { count, sideSeconds, allowSwitch, packs[], custom[] } }`
`players[] { id, name, tokenIndex, connected, score }`
`round { statementId, index, phase: statement|vote1|teams|debateFor|debateAgainst|vote2|result|tie, votes1{playerId:for|against}, votes2{}, timer { side, remaining, paused }, outcome: for|against|tie|none }`
Phase transitions are host-driven (or automatic on timer end / all voted). Broadcast state to all clients over a realtime channel.

## Design tokens
- Colours: Blue/For `#1D5FBF` · Red/Against `#E1372B` · Yellow/host-neutral `#F4BF1A` · Ink `#111111` · Paper `#F6F1E6` · Cream `#EDDFC2` · White `#FFFFFF`
- Side coding (always colour + shape): For = blue + **circle**, Against = red + **square**, host/neutral = yellow + **triangle**.
- Type: Readex Pro (Arabic + body, 400–900; Arabic line-height ≥ 1.25), Jost (Latin display), Space Mono (timers, counts, captions, UPPERCASE + 0.15–0.2em tracking).
- Scale used: 120/80/72/56/48/36/30/26/22/20/18/16/15/14/13/12px.
- Spacing: 8px grid; host stage gutter 48px; phone padding 20–24px.
- Borders: 3px ink (default), 2px small, 6px frames/emphasis. Radius: 0 or full only.
- Shadows: hard ink offsets, no blur — 3/6/12px (`12px 12px 0 #111`).
- Scrim: `rgba(17,17,17,.72)`. Dimmed: opacity .35–.45.
- Motion: `cubic-bezier(.2,.8,.2,1)` 120/220/480ms; result bars 800ms ease-in-out. Hover lifts −2px + bigger shadow; press slides into shadow.

## Components (from the For or Against design system)
Button (primary, accent, secondary, ghost, for, against · sm/md/lg), Badge, Input, Switch, StatementCard, VoteButton, Timer, VoteMeter, PlayerToken, PhaseStepper, TeamPanel, Dialog/bottom-sheet. Rebuild these in your component library with the tokens above. Note: in the EN wireframe, TeamPanel and VoteButton still show their built-in Arabic primary labels ("فريق مع", "مع"/"ضد") — in production, localise them (EN: "Team For", "For"/"Against") and drive direction from the page locale instead of hard-coding `dir="rtl"` inside components.

## Logo (4a)
Blue field `#1D5FBF` with the words "مع أو ضد" (Readex Pro 900) in paper colour; a red `#E1372B` field clipped by `polygon(0 0, 38% 0, 62% 100%, 0 100%)` overlays the left with the same words in ink — the slanted split recolours the text. Yellow downward triangle at the top of the split (x = 38%), cream circle cropped off the top-right corner, small ink square bottom-left, 3px ink frame. Aspect 640×440. Build as SVG for production. On phone headers it's used at 80×55.

## Files
- `wireframes-ar.html` — all 14 steps, Arabic/RTL
- `wireframes-en.html` — all 14 steps, English/LTR
(The language link at the top of each file points to the editor source and won't resolve inside this folder — open the other file directly.)
