# Handoff: Majlisak · مجلسك (Your Gatherings) — party trivia game

## Overview
A mobile-first party trivia game. A host builds a personal quiz about someone being celebrated (graduation, bridal shower, birthday, Eid, Mother's Day…), dresses it in an event theme, and guests join from their phones while a shared screen (TV/laptop) shows the lobby, questions, reveals and winners. The host controls pace from their phone. Full functional spec: `reference/Your Gatherings.docx`.

Three surfaces:
1. **Guest phone** — join, answer, feedback, final.
2. **Shared screen** (16:9) — lobby with join code/QR, question, reveal, winners.
3. **Host phone** — create flow (details → theme → questions → preview/publish) and live control panel.

Every screen exists in **English (LTR)** and **Arabic (RTL)**, and in **Day** and **Dark** mode.

## About the design files
The files here are **design references built in HTML**, not production code. Recreate them in the target codebase's environment (e.g. React Native / Expo, Flutter, or React + Next.js for the shared screen), using its patterns. If no codebase exists, a reasonable pick is **Expo (React Native)** for host + guest apps and a **web app** for the shared screen, with a realtime backend (Supabase Realtime / Firebase / websockets) for session sync.

Open `Game Wireframes v3.dc.html` in a browser (keep `support.js`, `assets/` and `_ds/` next to it). The Tweaks controls (or the `mode` / `language` props) switch **Day/Dark** and **English/Arabic/Both**.

## Fidelity
**Low-to-mid fidelity wireframes.** Layout, flow, copy, content hierarchy and states are final-intent; colours, fonts and radii already come from the Majlisak design system (`_ds/…`), so apply that system's real components (Button, AnswerOption, MatchPair, ThemeCard, PlayerChip, ProgressBar, etc.) rather than copying the wireframe boxes literally. Grey placeholder boxes (QR, avatar circles, photo drop zones) are stand-ins.

## Screens / views
Phone frames are drawn at **300×620** (target 390 wide in production: 20px side padding). Shared screen frames at **880×495** (scale to 1920×1080).

### Part 1 — Host creates a game (phone)
1. **Home** — 1f logo sticker (Arabic wordmark مجلسك in Fustat 800 + "Your Gatherings"); primary "Create a game"; secondary "Join with code"; "My games" list of cards (theme thumbnail 38px r10, title, status badge Draft = lavender / Published = green).
2. **Event details** (Step 1 of 4) — Event title input; Occasion chips (Graduation, Bridal shower, Farewell, Baby shower, Custom; single-select, selected = ink fill); **Who are we celebrating?** (honoree name — used across all guest copy); Description (optional); Game language segmented (العربية / English / Both); CTA "Next: theme".
3. **Theme** (Step 2 of 4) — Live preview card (theme art fading to paper with event title); Phone / Shared screen toggle; 3-col grid of theme tiles (64px, r12, label below): Graduation, Bridal shower, Birthday, Eid, Mother's Day + dashed "Upload image" tile. Selected tile = 2.5px ink border + 3px ink offset shadow. Upload: JPG/PNG, crop & position, falls back to default if removed.
4. **Questions list** (Step 3 of 4) — Draggable rows (⋮⋮ handle, prompt, format badge with points or "unscored"); dashed "+ Add question"; CTA "Next: preview".
5. **Question editor** (bottom sheet over dimmed list) — Format chips: Multiple choice, Textbox, Checklist (multi-select answer), Match, Photo; prompt input; options with correct-answer marking (green tint + ✓); "+ Add option"; Scored toggle + points; optional timer; "Save question".
6. **Preview & publish** (Step 4 of 4) — Guest phone / Shared screen toggle; tap-through preview over theme art (‹ Q1 of 4 ›); note "Edits after publishing apply to the next session"; "Save draft" (secondary) + "Publish & launch" (primary).

### Part 2 — Live session (dressed in the event theme)
**Theme rule:** every guest-facing screen shows the chosen theme art + event name. Waiting moments = full-bleed art (top ~330px) fading into paper; gameplay = 104px top banner fading into paper with an **event chip** (theme accent fill, 1.5px ink border, pill, 11–15px Baloo 700) at its bottom edge. Answer states and chrome stay neutral.

Theme → accent mapping (Day / Dark):
- Graduation → butter `#FEEDB6` / `#5A4A16`
- Bridal shower → lavender `#DCDAF8` / `#3D3870`
- Birthday → peach `#FDE1CF` / `#5C3A22`
- Eid → aqua `#D6F3F5` / `#1F4F53`
- Mother's Day → pink `#FCE3EE` / `#5C3047`
- Custom upload → default lavender

**Guest phone**
- 7 Enter code — 6 boxes (38×50, r12, 2px ink when filled), "Shown on the big screen, or scan the QR", QR scan button (dashed), Next.
- 8 Your name — "You're joining {event}" card with theme art; name input; avatar tint picker (5 pastel circles); Join.
- 9 Waiting — full-bleed theme, event chip, "You're in, {name}!", "The host will start soon", footer card with guest count + stacked avatars.
- 10 Multiple choice — banner, "Question 3 of 10" + timer, progress bar, prompt (Cairo 700), 4 options (48px, r16, white + 2px hairline; selected = grey `#E2DED6` + 2px `#8A8690`), "Lock in answer".
- 11 Textbox — 150px input, char counter "42 / 120", Submit.
- 12 Checklist — "Pick all that apply", checkbox rows (multi-select), Lock in.
- 13 Match — two columns, "Tap a name, then its nickname"; unmatched targets = 2px dashed; remaining pills below.
- 14 Photo upload — dashed drop zone "Take a photo or choose one", note "Goes into {honoree}'s memory album", Submit.
- 15 Locked in — "Answer locked in / Watch the big screen".
- 16 Correct — chosen option green (`#C9EFD9` + `#4E9C72` border), "Nice! +100 points", rank line.
- 17 Not quite — chosen red (`#F8D6D3` + `#C46A63`), correct shown green, "Not quite — keep going".
- 18 Final — full-bleed theme, "Thanks for celebrating {honoree}!", place + points, Share (primary), "Leave a note for {honoree}" (secondary).

**Shared screen**
- S1 Lobby — left 52%: "Welcome to", event title (46px Baloo 800), sticker card with QR + join URL + code (44px, letter-spacing 6px); guest chips at bottom. Right 46%: theme art fading toward content.
- S2 Question — 130px themed banner with event chip + timer pill; question number; prompt 36px Cairo; 2×2 option grid; "9 of 12 answered".
- S3 Reveal — horizontal bars sized by vote count; correct bar green; counts at end.
- S4 Winners — 1f logo (small), "Mabrouk, {honoree}!", "{event} · Winners", 3-step podium (1st in theme accent) sitting on the bottom edge; theme art on the right.

**Host control panel (phone)**
- H1 Lobby — join code in header; player list with Remove; "Need at least 2 players"; Start game.
- H2 During play — question/timer, progress, "9 of 12 answered", disconnect alert (red tint), Pause / Skip / Reveal (secondary), Next question (primary), End game (red text).
- H3 Results — Leaderboard / Answers tabs; ranked rows (1st in theme accent); status pills Submitted / Unanswered / Unscored; Share.
- H4 Share sheet — themed results card, Copy link, WhatsApp, Instagram story, Save image; "Private answers and photos are never shared".

"Same game, any occasion" row shows waiting + question screens across all 5 themes as a reference for theming.

## Interactions & behavior
- **Pace:** host advances everyone together (Start → Q → Reveal → Next). Guests can't move ahead.
- **Timer:** optional per question, set by the host; when it hits 0, answers lock automatically.
- **Scoring:** per question, scored or unscored. Faster correct answers earn more. Leaderboard and podium only if at least one question is scored; otherwise show a summary.
- **Checklist** = multi-select answer; scoring is an exact match (or partial credit, product decision).
- **Match:** tap left then right to pair; tap a pair to undo.
- **Photo / Textbox** are unscored by default; photos are visible to the host only and go into the honoree's album.
- **States:** selection = grey; correct/incorrect shown only on reveal. Copy stays kind ("Not quite — keep going", never "Wrong").
- **Join:** 6-char code or QR → name → waiting. Late join allowed until the host ends the game.
- **Disconnects:** host sees an alert; the guest rejoins with the same name.
- **Motion:** 120–200ms ease-out for UI; slight overshoot "pop" for reveals; fades, not slides.
- **RTL:** use logical properties throughout; Arabic line-height 1.7; mirror back arrows (→ رجوع).

## State management (suggested)
- `Game { id, title, occasion, honoreeName, description, language: 'ar'|'en'|'both', themeId | customImageUrl, questions[], status: 'draft'|'published' }`
- `Question { id, format: 'mc'|'text'|'checklist'|'match'|'photo', prompt, options[], correct, scored, points, timerSec? }`
- `Session { code, gameId, phase: 'lobby'|'question'|'locked'|'reveal'|'final', currentIndex, startedAt, players[] }`
- `Player { id, name, tint, score, connected }`, `Answer { playerId, questionId, value, submittedAt, isCorrect, points }`
- Realtime channel per session: the host emits phase changes; guests submit answers; the shared screen subscribes read-only.
- User prefs: `colorScheme: 'day'|'dark'`, `locale: 'ar'|'en'`.

## Design tokens
Source of truth: `_ds/majlisak-design-system-…/tokens/*.css`. Values used in the wireframes:

Day / Dark
- Canvas `#EAE5DA` / `#0E0C12`
- Paper (screen bg) `#FAF8F4` / `#16131B`
- Card `#FFFFFF` / `#221F28`
- Ink (text, primary button bg) `#1D1B20` / `#F4F1EA`
- Muted text `#55515C` / `#B5B1BA`
- Surface-2 `#EDEAE3` / `#2A2631`
- Selection `#E2DED6` + border `#8A8690` / `#34303B`
- Hairline `#E9E7EB` / `#3A3641`
- Input border `#B5B1BA` / `#5A5562`
- Correct `#C9EFD9` + `#4E9C72` / `#1F4A33`
- Incorrect `#F8D6D3` + `#C46A63` / `#5A2622`
- Pastels: lavender `#DCDAF8`, pink `#FCE3EE`, aqua `#D6F3F5`, butter `#FEEDB6`, peach `#FDE1CF` (dark variants above)
- Brand accent (focus/links) `#5B55B8` (day), `#C3C0F3` (dark)

Dark mode is an extension authored here; the design system defines Day only.

Type:
- Wordmark: **Fustat** 800 (Arabic مجلسك only)
- Display (headings, buttons, labels, scores): **Baloo Bhaijaan 2** 600–800
- Content (questions, answers): **Cairo** — question 700 20px on phone / 36px on shared screen; answer 600 15px / 21px
- Phone sizes: title 22, body 14–15, labels 12, chips 11–12; buttons 15/700

Radius: inputs/answers 16, small tiles 12, cards 20–22, phone sheet 26, dialogs 32, buttons/chips pill (999).
Borders: 1.5px hairlines; 2px interactive/answer states; 2px dashed for drop zones and empty match slots.
Shadows: "sticker" = 2–2.5px ink border + 3–5px solid ink offset (selected/playful items, logo, join card); otherwise soft 6–12% ink.
Heights: buttons 44, answer rows 46–48, inputs 42–48. Spacing: 12px vertical gap on phone screens; 18px side padding (production 20).

## Assets
- `assets/themes/` — graduation, bridal-shower, birthday, eid, mothers-day (event theme art, from the design system)
- `assets/sunburst-grain.jpg`, `assets/night-sparkles-grain.jpg`, `assets/pastel-sparkle-pattern.jpg`, `assets/shooting-stars.jpg` — brand backgrounds
- `assets/sparkle-line-*.png` — hand-drawn sparkles (decorative only)
- Fonts: Fustat and Cairo variable TTFs in `_ds/…/assets/fonts/`; Baloo Bhaijaan 2 from Google Fonts
- Icons: the design system uses Lucide (outline, 2px stroke)
- QR codes, avatars and user photos are placeholders

## Logo
Main game logo = **1f** in `Majlisak Logo.dc.html`: Arabic wordmark مجلسك (Fustat 800) over "Your Gatherings" (Baloo 700) in a white sticker card (2.5px ink border, 5px ink offset shadow, r32) on the sunburst. 2b and 2b·day are alternates for night and day contexts.

## Files
- `Game Wireframes v3.dc.html` — all wireframes; props `mode` (Day|Dark) and `language` (English|Arabic|Both)
- `Majlisak Logo.dc.html` — logo options (1f primary)
- `support.js` — runtime needed to open the .dc.html files in a browser
- `_ds/majlisak-design-system-…/` — design system tokens, components, fonts
- `reference/Your Gatherings.docx` — game development document (functional spec)
