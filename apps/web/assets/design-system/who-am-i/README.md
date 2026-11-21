# Who Am I? (مين أنا؟) — Nocturne

The design handoff for Who Am I?, kept as a reference. The game does not load anything from this folder.

- `HANDOFF.md`: the handoff brief, covering the screens, rules, motion, Night/Day theming and tokens. Start here.
- `tokens/`: the design-system tokens exactly as handed off.
- `wireframes-en.dc.html` and `wireframes-ar.dc.html`: the wireframes' editable sources, with the full copy for each language. They need the handoff's `support.js` and component bundle to open, which are not kept here.
- `logomark-source.dc.html`: the emblem, built from CSS shapes.

The live game uses its own copies:

- `assets/wai-theme.css` holds the tokens (Night, and Day under the site's light theme) and the components, plus the phone and big-screen layouts.
- `assets/wai-ui.js` holds the copy (`T.ar` / `T.en`), the emblem rebuilt as an SVG, and ClueCard, PointsLadder, TimerRing, MaskedPortrait, PlayerScore and Toast.
- `assets/logos/who-am-i-logo.png` and `assets/logos/who-am-i-icon-512.png` are rendered from the emblem.

If you change a value here, change it in the game too, and the other way round.

## Where the build differs from the handoff, on the owner's instructions

- **Host setup.** The shared screen is the host's own signed-in laptop or TV. Its lobby shows a "Host panel" code for the host's phone (same account), which opens the host panel. "Host controls on TV" puts the controls in a pill bar on the shared screen instead, and can be switched mid-game from the panel. "Cast to TV" shares the room's link for the host to open on a signed-in screen.
- **Portraits.** No pictures yet: the masked portrait is the glowing arch with the ؟, and the reveal shows the name in it. Each identity can take an `image` later (`apps/server/src/modules/games/whoAmI/identities.ts`).
- **Characters.** 60 identities in three packs (Global icons, Arab & Saudi icons, Fiction & cartoons), living public figures included, written in code rather than the admin questions tool.
- **Close guesses.** Typos within a per-word allowance count automatically; near misses and names among other words go to the host's review. With the controls on the TV there is no review: an unsure guess counts as a free miss.
- **Players.** 2 to 30. Settings: 10–30 seconds per clue (default 15), 1–10 identities (default 5).
