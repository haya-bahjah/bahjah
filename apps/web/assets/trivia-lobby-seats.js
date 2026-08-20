// Trivia's big-screen roster, per the redesign's lobby screen.
//
// lobby-room.js hands the whole #tv-players fill to this module when it is
// present (see the BahjahLobbySeats hook there). Every other game keeps the
// shared avatar-and-name cards, so nothing about Mafia's or Knows You Best's
// lobby changes.
//
// The design shows a fixed grid of twelve seats -- Trivia's real maximum, from
// GAME_PLAYER_LIMITS in @bahjah/shared -- with the empty ones drawn as dashed
// "Open seat" placeholders, so a half-full room reads as a room with space
// rather than a short list.
(function () {
  const MAX_SEATS = 12;

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
    const seats = members.slice(0, MAX_SEATS).map((m) => seat(m, opts));
    for (let i = seats.length; i < MAX_SEATS; i += 1) seats.push(openSeat(opts.lang));
    host.innerHTML = seats.join('');

    // The panel header's "6 / 12" counter lives outside #tv-players, so it is
    // refreshed here rather than needing its own render pass.
    const counter = document.getElementById('tv-player-count');
    if (counter) {
      counter.innerHTML = `${members.length}<span> / ${MAX_SEATS}</span>`;
    }
  }

  window.BahjahLobbySeats = { render, MAX_SEATS };
})();
