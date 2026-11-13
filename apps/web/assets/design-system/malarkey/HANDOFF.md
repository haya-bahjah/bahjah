# Handoff: Malarkey · تخاريف (multiplayer storytelling game)

## Overview
Malarkey (تخاريف, "tall tales") is a bilingual Arabic/English party game on the Bahjah platform. Each player writes an opening sentence. Stories then rotate, and each player sees **only the previous line** and writes the next one. Every player writes once in every story, and at the end each story is revealed line by line as a chat.

This handoff covers the full game flow for two setups:
- **Big screen + phones:** a shared main screen (TV or laptop) shows public state, and each player uses their own phone for private input.
- **Phones only ("Host plays too"):** there is no main screen and everything happens on the phones. This also covers remote play over a video call.

## About the design files
The files in this bundle are **design references created in HTML**. They are prototypes that show the intended look and behaviour, not production code to copy. Your job is to **recreate these designs in the target codebase's environment**, using its established patterns. If no codebase exists yet, pick a suitable stack. A good fit is a React or Next.js web app with a realtime layer: WebSocket, Supabase Realtime, Firebase or similar. The server must be authoritative.

- `Malarkey Prototype.html` is a self-contained clickable prototype that runs offline. Open it in a browser. The toolbar at the top switches the language (ع / EN) and the setup (Big screen + phones / Phones only), and has a Restart button.
- `source/Malarkey Prototype.dc.html` contains the readable source. The markup is inline-styled and all game logic is in the `class Component` script. It holds the exact copy dictionary (`T.ar` / `T.en`), the rotation logic and the timings.
- `source/MalarkeyLogomark.dc.html` is the logo, built from CSS shapes. It has two variants: `full` (the round checker stamp with a speech bubble) and `icon` (a rounded square with ت).
- `tokens/*.css` holds the Malarkey design-system tokens and component classes (`mk-btn`, `mk-input`, `mk-textarea`, `mk-avatar`, `mk-timer`, `mk-progress`, `mk-card`, …).

In the prototype, the other three players are simulated bots. In the real app they are real clients.

## Fidelity
**High-fidelity.** Colours, type, radii, shadows, copy and motion are final. Recreate them faithfully using the tokens below. The fixed phone size (360×740) and main-screen size (800×450) are only preview frames. Real layouts must be responsive: the phone layout is a single column up to 460px wide, and the main screen is a 16:9 stage that scales to fit the display.

## Game rules and server logic (from the Bahjah spec)
- **Players:** 2–10. Players can't join after the game starts; the list is frozen at start.
- **Number of stories:** N players produce N stories. There are **N + 1 rounds**: 1 opening round plus N continuation rounds, so each player also writes once in their own story. The prototype uses 4 players, so 5 rounds.
- **Rotation:** in round *j*, player *p* writes on story `(p + j) mod N`. The story's opening line comes from player `s` in round 0, so in round 1 nobody receives their own story.
- **What each player sees:** only the last line of the story they've been given. Never show who wrote it while writing ("Written by one of you").
- **Timer:** 45 seconds per line. The server holds the deadline; client countdowns are only for display. When time runs out, submit the saved draft. If the draft is empty, store a *missing* contribution, rendered as «(خلص الحبر)» / "(ran out of ink)".
- **Length:** at most 250 characters, with a live counter. Send is disabled while the draft is empty. A line can't be edited once it's sent.
- **Duplicates:** submissions are idempotent per (player, round), so the same line can't be stored twice.
- **Reconnects:** a client that reconnects gets back the current phase, its assignment and its draft.
- **Reveal order:** the same on every client. Stories go in seat order, lines in round order.
- **Scoring:** none. There is no ranking and no leaderboard.
- **Analytics events:** session_created, player_joined, game_started, phase_started, submission_received, phase_ended, game_completed.

## Screens (phone)
All phone screens share the same frame: 22px side padding, the paper-1 background with a riso grain overlay, and a single primary button at the bottom (`mk-btn--lg --block`, min height 62px). Direction is `rtl` for Arabic and `ltr` for English; use logical CSS properties throughout.

1. **Home:** large logomark (250px) in the centre, the tagline "حكايات تكتبونها سوا / Stories you write together", one line of supporting copy, then **Start a room** (orange) and **I have a code** (paper button with aqua shadow), with "2–10 players" underneath. Two large tinted RisoShapes are cropped off the edges as decoration.
2. **Join / Name:**
   - Joiner: heading "What's the room code?", a 4-character code input (`mk-input--code`, Lalezar 34px, letter-spacing .24em, forced uppercase, LTR), then a name input.
   - Host: heading "What should we call you?" and the name field only.
   - The CTA is disabled until the code has 4 characters.
3. **Lobby:**
   - Header: logo icon, "Room K7Q2" and a share button (host only).
   - Players appear in a 4-column grid of `PlayerAvatar` (56px, with names).
   - **Host plays too** switch (host only): ON means phones only and the main screen is turned off; OFF means the game shows on the main screen.
   - **How to play** card with 3 numbered steps, plus the summary "N players = N stories".
   - Host: **Let's go** button, disabled until at least 2 players are in.
   - Player: "Waiting for the host…".
4. **Write:**
   - Header: "Round x of y" with `RoundProgress` dots, and a `Timer` (68px) at the end of the header.
   - Round 1: "Start a new story / Weirder is better."
   - Later rounds: "Keep it going", with the previous line in a speech bubble (paper-0, 2.5px ink border, 22px radius, 5px orange offset shadow, tilted −1.5°, Amiri 20px) and an anonymous avatar labelled "Written by one of you".
   - Ruled textarea (`mk-textarea`), a counter "n / 250", the info line "When time's up, we send what you have", then **Send my line**.
5. **Sent:** a yellow burst with an orange offset and a check icon, "Your line is in!", and the avatars of players still writing, each with a pencil badge ("2 still writing"). Move on automatically when everyone is done (about 1s of "Everyone's in!").
6. **Pass (about 2.3s interstitial):** large logo icon, "A new story is coming / You won't know who wrote it".
7. **Reveal:**
   - Header card: **all players' avatars**. The writer of the current line is at full opacity and scaled to 1.08 (raised 3px); the others are at 40% opacity.
   - Below it: "Story x of N" and line-progress dots.
   - The story card shows **chat bubbles**: avatar plus a bubble with the author's name (Baloo 12px bold, muted) and the line (Amiri 16px).
     - Other players' lines start on the leading side with corner radius 16 16 16 4.
     - **Your own lines** sit on the opposite side (row-reverse) with a tint-aqua fill and corner radius 16 16 4 16.
     - The opening line has a tint-yellow fill, bold text in ink-blue.
     - Each bubble's shadow is `3px 3px 0` in the author's seat ink.
     - Missing lines are italic in ink-300.
   - Lines appear **automatically every 2.6s**. Three pulsing aqua dots show while the next line is coming. When the story is complete, a yellow "The end!" stamp pops into the top corner. The card scrolls to the newest bubble.
   - Host: the button reads "The story is unfolding…" (disabled) until the story is complete, then becomes **Next story** (orange), and **The end** on the last story.
   - Players: "Waiting for {host} to open the next story".
8. **The end:** logomark, "N new stories", and a list of story cards showing the starter's avatar, the first line (clamped to 2 lines) and "Started by X". Tapping a card opens **Story detail**: every line with its author's avatar and name, plus **Share story**, which shows the toast "Link copied". Host: **Play again** returns to the lobby with the same players. Everyone: **Leave room**.

## Screens (main screen, 16:9)
- **Idle:** large logomark and "Start a room on a phone".
- **Lobby:** logomark (240px) with the tagline. A join card (paper-0, 6px aqua shadow) with a QR code and the 4 code tiles: 50×60px, alternating ink-blue/paper text and tint-aqua/blue text, Lalezar 34px. An avatar strip along the bottom with "N players = N stories".
- **Round 1:** "Everyone's writing a first line". The logomark sits in the centre with the players' avatars around it, each showing a pencil (writing) or check (done) badge. A large Timer (130px) and "x of N done".
- **Rounds 2+:** "The stories are growing…". One card per story with 5 slots: filled (ink-blue), in progress (tint-aqua with a blue border) or empty (dashed ink-300).
- **Pass:** "Passing the stories along…".
- **Reveal:** ink-blue background. On the leading side: logo icon, "Story x of N", "Line x of y". The story card (paper-0, 7px orange shadow) holds the same chat bubbles as the phone (avatar 30px, text 16px), stacked from the bottom.
- **End:** yellow burst, logomark and the closer «وتوتة توتة، خلصت الحدوتة» / "And that's the end of the tale", plus a 2×2 grid of story cards.

## Interactions and motion
- **Buttons (DS):** on hover they lift 1–2px and the shadow grows; on press they move +3px and the shadow collapses to 1px over 120ms. Focus shows a 3px aqua outline.
- **New reveal bubble:** `mkStamp`, 480ms `cubic-bezier(.3,1.6,.5,1)`, from opacity 0, scale .92, rotate −2° and translateY 6px to rest.
- **"The end!" stamp:** `mkPop`, 420ms with the same easing, from scale .6 rotated −8° to scale 1 rotated −3°.
- **Pending dots:** `mkDot`, 1.2s infinite, staggered by .15s.
- **Speaker highlight:** opacity and transform over 240ms.
- **Timer:** turns red with a wobble in the last 10 seconds (DS `mk-timer--urgent`).
- **Toasts:** yellow, tilted −1.5°, auto-dismiss after 2.2s.

## State (per session, server)
`session {id, code, hostId, setup: 'tv'|'phones', phase: lobby|write|pass|reveal|end, round, deadlineAt, revealStory, revealLine}` · `players[] {id, name, seat}` · `stories[] {seat, lines[] {round, authorId, text|null, submittedAt}}`. Client-only state: language, the draft, and the currently opened story detail.

The reveal is driven by the server: it advances `revealLine` every 2.6s. Only the host can advance `revealStory`, and only once the current story is complete.

## Design tokens
These are in `tokens/`.
- **Inks:** pink #FF48B0, yellow #FFE800, aqua #5EC8E5, blue #3255A4, teal #00838A, green #00A95C, orange #FF6C2F, red #F15060, black #1E1B18.
- **Tints:** pink #FFC6E5, yellow #FFF6A3, aqua #C5EBF5, blue #C3CDE6, green #B8E6CC, orange #FFCDB5.
- **Paper:** #FCF8EE, #F5EEDC, #EBE2CA, #D8CBAA.
- **Neutrals:** ink-700 #3D3830, ink-500 #6B6356, ink-300 #A49A88.
- **Primary action in this game:** orange #FF6C2F with a `4px 4px 0` ink-blue shadow, to match the logo. This is a deliberate choice over the DS default pink.
- **Seat inks (player index 0–7):** pink, aqua, yellow, green, orange, blue, teal, red.
- **Type:**
  - Lalezar: display, titles, buttons, numbers.
  - Baloo Bhaijaan 2: UI text, 400–700.
  - Amiri: player-written story text only.
  - Space Mono 700 caps: tiny metadata.
  - Sizes: display 44–64, h1 34, h2 26, story 16–22, body 16, small 13–14.
- **Radius:** 6 / 12 (controls) / 20 (cards) / 28 / pill. **Border:** 2.5px ink-black. **Hit target:** at least 44px.
- **Shadows:** hard offsets only (2/4/6–7px), never blurred.
- **Textures:** grain (`.riso-grain`), speckle, and aqua ruled lines in the textarea.
- **Rules:** no gradients, no pure white or black, no emoji in the UI.

## Assets
- **Logo:** built from CSS shapes in `MalarkeyLogomark.dc.html` (checker circle in aqua and blue, orange offset, yellow sparkle, cream speech bubble with تخاريف). Export it as SVG for production.
- **Icons:** Phosphor Icons (bold weight).
- **Fonts:** Google Fonts.
- **QR code:** a placeholder; generate it from the join URL at runtime.

## Copy
The full bilingual strings live in `T.ar` / `T.en` in the prototype source. Arabic is casual Saudi/Gulf dialect. Numbers in Arabic copy use Arabic-Indic digits; room codes and timers stay in Western digits.

## Files
- `Malarkey Prototype.html`: offline clickable prototype.
- `source/Malarkey Prototype.dc.html`: prototype source (layout, copy, logic).
- `source/MalarkeyLogomark.dc.html`: logo.
- `tokens/`: design-system CSS (colours, type, spacing, effects, fonts, component classes).
