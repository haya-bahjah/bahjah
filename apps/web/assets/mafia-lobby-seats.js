// Mafia's big-screen lobby roster, per the design's lobby screen.
//
// lobby-room.js hands the whole #tv-players fill to this module when it is
// present (the BahjahLobbySeats hook there). Trivia and Knows You Best each
// define their own; this is Mafia's.
//
// The design draws the room as a two-column grid of pills: each player's noir
// identity token in a ring, then their name. The token -- not an avatar -- is
// the point: it is assigned by join order and follows that player into the
// chat, the vote grid and the verdict, so recognising it here is how you learn
// to recognise it later. A player who uploaded a photo of themselves keeps it,
// the same rule every other Mafia surface follows.
window.BahjahLobbySeats = (() => {
  // Cycles with the token list, so a player's ring colour and their token come
  // from the same step of the same pattern all game.
  const RINGS = ['#B9BEC9', '#8E96A4', '#C8A94E', '#A2A9B6', '#E8EAF0', '#7E8794', '#AEB8C4', '#9AA3B0'];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function faceHtml(members, m, opts) {
    const custom = m.avatar && String(m.avatar).indexOf('data:image/') === 0;
    if (custom && opts && typeof opts.avatarHtml === 'function') return opts.avatarHtml(m);
    const token = window.BahjahMafiaIdentity
      ? window.BahjahMafiaIdentity.tokenFor(members, m.userId)
      : '';
    return token ? `<span class="mf-seat-token" style="background-image:url('${esc(token)}')"></span>` : '';
  }

  function render(mount, members, opts) {
    const lang = (opts && opts.lang) === 'ar' ? 'ar' : 'en';
    if (!members.length) {
      mount.innerHTML = `<span class="players-empty-note">${
        lang === 'ar' ? 'بانتظار انضمام اللاعبين…' : 'Waiting for players to join…'
      }</span>`;
      return;
    }
    mount.innerHTML = members.map((m, i) => {
      const ring = RINGS[i % RINGS.length];
      return `<div class="mf-seat" style="--seat-ring:${ring}">
        <span class="mf-seat-face">${faceHtml(members, m, opts)}</span>
        <span class="mf-seat-name">${esc(m.displayName)}</span>
      </div>`;
    }).join('');
  }

  return { render };
})();
