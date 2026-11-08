# Mafia Noir

The design system for **Mafia (مافيا)**, Bahjah's social-deduction party game. Mafia runs on two kinds of screen at once: the host's **television**, which only narrates, and each player's **phone**, which carries a secret role and is never shown to anyone. The look is a city at night: navy sky, smoke, steel, and one red used for blood and for the Mafia.

> *Trust no one. Vote wisely.*

This system is built from the shipping front end (`apps/web/assets/mafia-game/`, `mafia/`, `logos/` on the `staging` branch). Values are copied from it exactly. Where the source fails a contrast check the value is kept and the token's note says so.

## Principles

1. **A dark room.** Players sit in a lit living room looking at a TV, or hold a phone close to their face at night. Grounds stay near-black (`surface-page`), colour is held down in saturation, and only the thing that matters right now glows.
2. **Red means the Mafia.** `mafia-red` is the logo, the night kicker, the Mafia role, a kill target and the face-down card's pulse. Do not use it for generic errors, links or decoration.
3. **Every role has a metal.** Mafia red, Doctor surgical steel (`role-doctor`), Sheriff badge gold (`role-sheriff`), Citizen paper white (`role-citizen`). A role's colour follows it everywhere: card border, role name, candidate tags and the night action card.
4. **One move per screen.** Each phase asks one question (*Choose your target.*, *Who is the Mafia?*) and has one primary button. Everything else is ghost or text.
5. **The phone keeps secrets, the TV keeps time.** Role cards, whisper chat, investigation results and private threads exist only on the player's phone. The TV shows the phase, the clock, counts and public reports.

## Voice

- Short, second person, present tense, a little cinematic: *The town sleeps.* · *Something moves in the dark.* · *The town holds its breath.*
- Buttons are verbs naming what happens: *Begin night 1*, *Confirm the hit*, *Protect them*, *Lock in my vote*, *Start the day*.
- Reports are flat statements: *Reem was found dead.* · *Nobody died tonight.* · *They were innocent. The Mafia is still out there.*
- The morning never says what the dead were. Only a player voted out has their card turned over (if the host allows it).
- Arabic is first class, not a translation afterthought: *الليلة ٢*, *مافيا*, *طبيب*, *عمدة المدينة* (Sheriff), *مواطن*.

## Colour

One theme, **Noir**. The game commits to dark and does not follow the viewer's light mode.

| Role | Tokens |
|---|---|
| Grounds | `surface-page` (page), `night-navy → night-deep` (every card gradient), `surface-raised`, `surface-card`, `surface-team` (Mafia-only surfaces), `surface-overlay` |
| Text | `text-primary`, `text-secondary` (7.6:1), `text-muted` (3.5:1: captions only), `text-on-accent`, `bone` |
| Lines | `border-subtle` (hairlines), `border-strong` (ghost buttons, section rules) |
| Brand | `mafia-red`, `mafia-red-dim`, `whisper-red` |
| Roles | `role-mafia`, `role-doctor`, `role-sheriff`, `role-citizen` (+ `-dim` blooms) |
| Actions | `action-steel` (primary fill), `info-steel` (focus, unread, links), `brick` (hot), `smoke-violet` |
| Phases | `phase-night`, `phase-dawn`, `phase-day`, `phase-vote`, `phase-verdict` |
| Alive | `alive-steady → alive-warm → alive-hot` |
| Chat | `chat-mine-fill`, `chat-mine-border`, `chat-other-fill` |
| Seats | `ring-1 … ring-7` |
| Verdict | `verdict-mafia-glow`, `verdict-mafia-ground`; `verdict-dawn-sky`, `-mid`, `-low`, `-ink` |

**Noir override.** Mafia runs inside Bahjah's arcade platform tokens and re-tints them with a `.noir` class: pixel-green becomes `action-steel`, cyber-cyan becomes `info-steel`, arcade-yellow becomes `role-sheriff` gold, neon-pink becomes `brick`, electric-purple becomes `smoke-violet`. Build Mafia screens on the tokens here, never on the arcade colours.

**Contrast flags (kept from source):** `text-muted` 3.5:1, `phase-vote` 4.3:1, `brick` 3.3:1. Use them only where the notes allow.

## Typography

| Family | Face | Use |
|---|---|---|
| `display` | **Tektur** 700–900 | Titles, role names, buttons, numbers. Usually uppercase with tracking (.04–.14em). |
| `body` | **Space Grotesk** 400–700 | Running text, names, chat. |
| `pixel` | **Silkscreen** | Kickers, tags, captions, the clock. Always uppercase, tracked .12–.2em. Never under 7px. |
| `arabic` | **Readex Pro** 400–700 | Replaces **all three** in Arabic: display and pixel styles become Readex 700, with no tracking or uppercase. Line-height 1.25 for display and 1.4 for labels. |

All four faces load from Google Fonts. Type styles are in **Typography**; the scale runs hero 88 → verdict 64 → report 38 → screen-title 34 → role-name 32 → phase-title 19 → body 16 → chat 14 → caption 12 → pixel 11/9/8.

## Layout

- Phone-first: one column about 420px wide, inside a 16px gutter (`space-4`). The page never scrolls. The header is pinned and only the stage under it scrolls. Heights use `100dvh`, and safe-area insets sit on the root.
- Inside a screen, the list is the thing that scrolls (conversations, candidates, seats, winners). The phase clock, the action card and the primary button stay on screen, down to an iPhone SE.
- Wide screens (TV/laptop): the lobby and day split into two columns, folding to one below 900px.
- Spacing scale `space-1 … space-9` (4 → 96). Radii: `radius-xs` 4 (chips), `radius-sm` 8 (buttons), `radius-md` 12 (cards), `radius-inbox` 14, `radius-lg` 16 (role card), `radius-pill`.
- RTL: Mafia sets `dir` on its own root. Use logical properties (`inset-inline-start`, `margin-inline-start`). Chevrons that point "into" a thread flip; vertical chevrons don't.

## Motion

Springy and sparse. `ease-arcade` (`cubic-bezier(.2,1.4,.4,1)`) on lifts, pops and the card flip. Durations are `duration-fast` 120ms, `duration-base` 220ms and `duration-slow` 400ms.

Named moments: `flipIn` (role card, .55s), `redPulse` (face-down card, 2.6s), `fadeUp` (chat lines, reports), `popIn` (investigation result), the action card's *breath* (2.6s), `smokeDrift` (22s) and `bloomBreathe` (6–7s) on the verdict, and `pulseSoft` (alive heart in the last few, "tap to reveal"). Under `prefers-reduced-motion`, every looping animation stops.

## Iconography and imagery

- **Logo:** the Arabic wordmark *مافيا* in red over a smoke-and-fedora silhouette (`mafia-logo.png`, `mafia-mark.png`). Use the PNGs on dark grounds only. `logo-mark.svg` is a single-ink mark drawn in `currentColor`: set its colour to `mafia-red` or `text-primary`.
- **Role cards:** six illustrated cards (boss, hitman, doctor, sheriff, citizen m/f) at 480×672 with 20px corners. Use them as the art on the revealed card and the verdict fan.
- **Player tokens:** eight single-ink white noir objects (fedora, revolver, cigar, lipstick, watch, dice, shoe, briefcase), each inside a seat ring. A token never implies a role.
- **UI glyphs:** simple stroked SVGs at 13px with stroke-width 3 (chevrons, lock, heart). Don't use emoji.

## Components

16 static components, grouped as they appear in a match: **Actions** (Button, QuickReply), **Identity** (PlayerToken, RoleCard, RoleChips), **Status** (PhaseStrip, AliveCounter, PhaseBar), **Night** (ActionCard, CandidateCard, WhisperPanel, InvestigationResult), **Talk** (InboxRow, ChatBubble), **Reports** (DawnReport, Verdict). Classes are prefixed `.mn-` and live in `components/bundle.css`.

## Not synced

- The previews are **static renditions**, hand-written from the game's markup (`mafia-screens-a.js`, `mafia-screens-b.js`, `mafia-chat.js`, `mafia-view.js`). The game builds its HTML as strings, so there is no component library to bundle.
- Font files are not copied: all four faces are Google-hosted.
- Not covered yet: the lobby room card with its QR code and code tiles, the tutorial overlay, the host's pause overlay, the share card, the landing hero. Their art is in **Key art**.
- `glow-action` (primary hover) is still arcade green in the source. It is flagged for a design decision.
