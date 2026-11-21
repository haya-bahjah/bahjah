# For or Against (مع أو ضد) — Bauhaus

The design handoff for For or Against, kept as a reference. The game does not load anything from this folder.

- `HANDOFF.md`: the handoff brief, covering the flow, screens, host controls and tokens. Start here.
- `wireframes-en.dc.html` and `wireframes-ar.dc.html`: the wireframes, as bundled pages, with the full copy for each language.

The live game uses its own copies:

- `assets/foa-theme.css` holds the tokens and components, plus the phone and TV layouts and the host bar.
- `assets/foa-ui.js` holds the copy (`T.ar` / `T.en`), the logo, player tokens, statement card, timer, meter, team panel and vote buttons.
- `assets/foa-host.js` holds the host controls for each phase, shared by the TV host bar and the host's phone.
- `assets/logos/for-or-against-logo.png` and `assets/logos/for-or-against-icon-512.png` are rendered from the logo (version 4a).

If you change a value here, change it in the game too, and the other way round.

## Where the build differs from the handoff, on the owner's instructions

- **Players.** 2 to 50.
- **Host plays too.** Off by default: the host's screen is the TV and the controls sit in the on-TV host bar (it hides 4 seconds after the last interaction; press H to toggle it). When it is on, the host votes from their phone and the same controls appear there.
- **Statements.** The starter bank (40 statements in four categories) lives in code, in `apps/server/src/games/forOrAgainst/statements.ts`. Hosts can add up to 30 of their own in the setup sheet.
- **Home page.** The handoff has no home or join screen, so `for-or-against.html` is built in the same style.
