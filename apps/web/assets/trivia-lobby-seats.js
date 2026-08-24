// Trivia's big-screen roster, per the redesign's lobby screen.
//
// lobby-room.js hands the whole #tv-players fill to this module when it is
// present (see the BahjahLobbySeats hook there). Every other game keeps the
// shared avatar-and-name cards, so nothing about Mafia's or Knows You Best's
// lobby changes.
//
// The design's original 12-seat cap drew one dashed "Open seat" placeholder
// for every unfilled seat. That never scaled to Trivia's real maximum from
// GAME_PLAYER_LIMITS in @bahjah/shared: at 50 seats a brand-new room drew 48
// placeholders, and on a phone -- where the grid collapses to one column --
// the host had to scroll past all of them to reach Start.
//
// So the roster now lists only players who have actually joined, growing as
// each one arrives, with a single line standing in for the empty room. The
// room's spare capacity is still legible from the "N / 50" counter in the
// panel header. MAX_SEATS is unchanged as the real, enforced capacity.

(function () {
  const MAX_SEATS = 50;

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

  // Stands in for the whole grid while the room is empty, instead of one
  // placeholder card per unfilled seat.
  function emptyRoomNote(lang) {
    return `
      <p class="tv-seats-empty">${lang === 'ar'
        ? 'شارك الرمز أعلاه — سيظهر اللاعبون هنا فور انضمامهم.'
        : 'Share the code above — players appear here as they join.'}</p>`;
  }

  function render(host, members, opts) {
    const joined = members.slice(0, MAX_SEATS);
    host.innerHTML = joined.length
      ? joined.map((m) => seat(m, opts)).join('')
      : emptyRoomNote(opts.lang);
    // One column while the room is empty, so the standalone note is not
    // stretched across a third of the grid.
    host.classList.toggle('is-empty', joined.length === 0);

    // The panel header's "N / 50" counter lives outside #tv-players, so it is
    // refreshed here rather than needing its own render pass.
    const counter = document.getElementById('tv-player-count');
    if (counter) {
      counter.innerHTML = `${members.length}<span> / ${MAX_SEATS}</span>`;
    }
  }

  window.BahjahLobbySeats = { render, MAX_SEATS };
})();
