# Seat

A player's place in the lobby (an 86px face, their name and a state) next to the room-code tiles they joined with.

- 150 × 186+, 3px outline in the player's colour, `--kyb-r-md`, hard shadow, and a rotation set per seat (`--seat-rot`). Seats pop in as people join.
- Empty seat: dashed outline, no shadow, a pixel "?" in a dashed circle.
- **Code tiles**: 52 × 62 cyan tiles with display 30px letters and a 3px hard shadow. Codes are identifiers, so they never mirror in RTL.
- 3 to 12 players. The host's screen is not a seat.
