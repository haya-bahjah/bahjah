// Knows You Best's big-screen roster, per the handoff's LOBBY screen.
//
// lobby-room.js hands the whole #tv-players fill to this module when it is
// present (see the BahjahLobbySeats hook there). Trivia defines its own; Mafia
// keeps the shared avatar-and-name cards, so neither changes because of this.
//
// The handoff draws a three-column grid of seat cards: each player in a card
// outlined in their own colour, with the avatar over a SELFIE tab, the name,
// and READY underneath. Unfilled seats are dashed placeholders with a "?" so a
// half-full room reads as a room with space.
(function () {
  // Knows You Best's real maximum, from GAME_PLAYER_LIMITS in @bahjah/shared.
  const MAX_SEATS = 10;

  // Seat colours cycle through the handoff's palette, keyed off the user id so
  // a player keeps their colour across re-renders and reconnects rather than
  // changing whenever someone else joins or leaves.
  const SEAT_TINTS = [
    'var(--kyb-pink)',
    'var(--kyb-cyan)',
    'var(--kyb-green)',
    'var(--kyb-purple)',
    'var(--kyb-yellow)',
  ];

  function tintFor(userId) {
    let hash = 0;
    const id = String(userId);
    for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return SEAT_TINTS[hash % SEAT_TINTS.length];
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  function seatCard(member, opts) {
    const ar = opts.lang === 'ar';
    const tint = tintFor(member.userId);
    // lobby-room.js marks readiness on the member; treat a missing flag as
    // not-ready rather than assuming everyone is in.
    const ready = Boolean(member.ready);
    return `
      <div class="kyb-seat" style="--seat-accent:${tint}">
        <span class="kyb-seat-face">
          ${opts.avatarHtml(member)}
          <span class="kyb-seat-tab">${ar ? 'صورة' : 'Selfie'}</span>
        </span>
        <span class="kyb-seat-name">${escapeHtml(member.displayName)}</span>
        <span class="kyb-seat-state" data-ready="${ready ? 1 : 0}">${
          ready ? (ar ? 'جاهز' : 'Ready') : (ar ? 'انضم' : 'Joined')
        }</span>
      </div>`;
  }

  function emptySeat(ar) {
    return `
      <div class="kyb-seat is-empty">
        <span class="kyb-seat-face"><span class="kyb-seat-q" aria-hidden="true">?</span></span>
        <span class="kyb-seat-state">${ar ? 'بانتظار' : 'Waiting'}</span>
      </div>`;
  }

  function render(host, members, opts) {
    const ar = opts.lang === 'ar';
    const filled = members.map((m) => seatCard(m, opts)).join('');
    const blanks = Math.max(0, MAX_SEATS - members.length);
    host.innerHTML = filled + Array.from({ length: blanks }, () => emptySeat(ar)).join('');
  }

  window.BahjahLobbySeats = { render };
})();
