// Minimal real-time lobby presence strip for the game pages. Activates
// when the page URL has ?code=ROOMCODE. Renders into #lobby-strip.
// This is intentionally a thin, temporary widget: the full per-game
// lobby/gameplay UI (replacing the demo sections on these pages) lands
// with each game's engine.
(function () {
  const LANG = document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const mount = document.getElementById('lobby-strip');
  if (!code || !mount) return;

  mount.style.display = 'block';

  const token = BahjahSession.getToken();
  if (!token) {
    mount.innerHTML = LANG === 'ar'
      ? `سجّل الدخول للانضمام إلى الغرفة <strong>${code}</strong>. <a href="auth.html">تسجيل الدخول</a>`
      : `Sign in to join room <strong>${code}</strong>. <a href="auth.html">Sign in</a>`;
    return;
  }

  mount.textContent = LANG === 'ar' ? `جارٍ الاتصال بالغرفة ${code}…` : `Connecting to room ${code}…`;

  fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        mount.textContent = (data.error && data.error.message) || (LANG === 'ar' ? 'تعذّر الانضمام إلى هذه الغرفة.' : 'Could not join this room.');
        return;
      }
      connectSocket();
    })
    .catch(() => {
      mount.textContent = LANG === 'ar' ? 'خطأ في الشبكة أثناء الانضمام إلى الغرفة.' : 'Network error joining the room.';
    });

  function connectSocket() {
    const socket = io({ auth: { token } });
    socket.on('connect', () => socket.emit('room:join', { code }));
    socket.on('room:update', renderRoom);
    socket.on('room:error', (err) => {
      mount.textContent = err.message;
    });
  }

  function renderRoom(room) {
    const names = room.members.map((m) => (m.isHost ? `★ ${m.displayName}` : m.displayName)).join(', ');
    mount.innerHTML = LANG === 'ar'
      ? `الغرفة <strong>${room.code}</strong> · انضم ${room.members.length} — ${names}`
      : `Room <strong>${room.code}</strong> · ${room.members.length} joined — ${names}`;
  }
})();
