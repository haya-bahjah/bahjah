// Trivia's big-screen roster, per the redesign's lobby screen.
//
// lobby-room.js hands the whole #tv-players fill to this module when it is
// present (see the BahjahLobbySeats hook there). Every other game keeps the
// shared avatar-and-name cards, so nothing about Mafia's or Knows You Best's
// lobby changes.
//
// The design's original 12-seat cap drew one dashed "Open seat" placeholder
// for every unfilled seat, so a half-full room read as a room with space
// rather than a short list. That doesn't scale to Trivia's real maximum from
// GAME_PLAYER_LIMITS in @bahjah/shared: at 50 seats, the same rule would draw
// 48 empty placeholder cards in a brand-new room before anyone has joined.
// Keep the invitation, drop the flood -- render every joined player, plus a
// capped number of open seats rounded up to the next full grid row (so the
// grid never ends mid-row), never fewer than one row and never more than
// OPEN_SEAT_ROWS. MAX_SEATS itself is unchanged as the real, enforced
// capacity (drives the "N / 50" counter and is exported for anyone who needs
// the true ceiling) -- only how many *unfilled* seats get drawn is capped.
(function () {
  const MAX_SEATS = 50;
  const GRID_COLUMNS = 3; // matches .tv-players' grid-template-columns
  const OPEN_SEAT_ROWS = 2;

  // Seat borders cycle through the game's accent set so each player is
  // visually distinct, keyed off the user id so a player keeps their colour
  // across re-renders and reconnects.
  const SEAT_TINTS = [
    'var(--electric-purple)',
    'var(--neon-pink)',
    'var(--cyber-cyan)',
    'var(--pixel-green)',
    'var(--arcade-yellow)',
  ];

  function tintFor(userId) {
    let hash = 0;
    const id = String(userId);
    for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return SEAT_TINTS[hash % SEAT_TINTS.length];
  }

  function seat(member, opts) {
    const tint = tintFor(member.userId);
    const state = member.isReady
      ? { cls: 'is-ready', label: opts.lang === 'ar' ? 'جاهز' : 'Ready' }
      : { cls: '', label: opts.lang === 'ar' ? 'انضم' : 'Joined' };
    const offline = !member.connected ? ' is-offline' : '';
    return `
      <div class="tv-seat ${state.cls}${offline}" data-user-id="${member.userId}" style="--seat-tint:${tint}">
        <span class="tv-seat-av">${opts.avatarHtml(member)}</span>
        <span class="tv-seat-name">${member.displayName}</span>
        <span class="tv-seat-tag">${state.label}</span>
      </div>`;
  }

  function openSeat(lang) {
    return `
      <div class="tv-seat is-open" aria-hidden="true">
        <span class="tv-seat-plus">+</span>
        <span class="tv-seat-name">${lang === 'ar' ? 'مقعد شاغر' : 'Open seat'}</span>
      </div>`;
  }

  function render(host, members, opts) {
    const joined = members.slice(0, MAX_SEATS);
    const seats = joined.map((m) => seat(m, opts));
    // The grid always shows every joined seat's row completed, plus up to
    // OPEN_SEAT_ROWS more full rows of open seats as an invitation -- capped
    // by the real MAX_SEATS so a near-full room never overshoots it. At
    // GRID_COLUMNS=3/OPEN_SEAT_ROWS=2 a brand-new room shows 6 open seats,
    // not 48; a room one seat from full shows exactly the one seat left.
    const rowsForJoined = Math.ceil(joined.length / GRID_COLUMNS);
    const totalRows = Math.min(Math.ceil(MAX_SEATS / GRID_COLUMNS), rowsForJoined + OPEN_SEAT_ROWS);
    const targetSeatCount = Math.min(MAX_SEATS, totalRows * GRID_COLUMNS);
    const openCount = Math.max(0, targetSeatCount - joined.length);
    for (let i = 0; i < openCount; i += 1) seats.push(openSeat(opts.lang));
    host.innerHTML = seats.join('');

    // The panel header's "N / 50" counter lives outside #tv-players, so it is
    // refreshed here rather than needing its own render pass.
    const counter = document.getElementById('tv-player-count');
    if (counter) {
      counter.innerHTML = `${members.length}<span> / ${MAX_SEATS}</span>`;
    }
  }

  window.BahjahLobbySeats = { render, MAX_SEATS };
})();
