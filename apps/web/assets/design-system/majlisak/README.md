# Majlisak (مجلسك) · Your Gatherings

The design handoff for مجلسك, kept as a reference. The game does not load anything from this folder.

- `HANDOFF.md`: the handoff brief, covering the screens, theming, behaviour and tokens. Start here.
- `wireframes.dc.html`: the wireframes' source (English and Arabic, Day and Dark). It needs the handoff's `support.js` and component bundle to open, which are not kept here.
- `logo-source.dc.html`: the logo options; 1f is the one in use.
- `tokens/`: the design-system tokens exactly as handed off.

The live game uses its own copies:

- `assets/mj-theme.css` holds the tokens (Day, and Dark under the site's dark theme) and the components, plus the phone and shared-screen layouts.
- `assets/mj-ui.js` holds the copy (`T.ar` / `T.en`), the logo, the theme art, tints and the helpers; `assets/mj-screens.js` draws the answer screens and the shared screen's question.
- `assets/majlisak/` holds the theme art; `assets/logos/majlisak-logo.jpg` and `majlisak-icon-512.jpg` are rendered from logo 1f on the sunburst.

If you change a value here, change it in the game too, and the other way round.

## Where the build differs from the handoff, on the owner's instructions

- **Join code.** Four characters, the platform's own codes, rather than six.
- **Photos and theme pictures** are kept in the database (the platform has no file storage), shrunk on the phone first, and served only behind unguessable ids: photos to the host, or through the album's private link. They are never deleted.
- **Album.** Photo answers and guests' notes go into the honoree's album, which the host sees under My games and can share with the honoree as a private link.
- **Host plays too.** The host answers from their phone like a guest (their answers appear in the results) but is never ranked.
- **Scoring.** Timed questions pay 50–100% of their points depending on how quickly the right answer came in; untimed ones pay in full. A checklist must match exactly; a match question pays per right pair; a textbox counts only when the host adds accepted answers; photos are never scored.
- **Host controls.** The host runs the game from their phone (the shared screen shows a "Host panel" code); the shared screen also has a pill bar with the same controls for a host without a second device.
- **Share sheet.** Copy link, WhatsApp and the phone's own share; "Instagram story" and "Save image" are left out for now.
