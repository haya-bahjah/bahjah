// Minimal real-time lobby presence strip for the game pages. Activates
// when the page URL has ?code=ROOMCODE. Renders into #lobby-strip.
//
// It also exposes `window.BahjahRoom = { code, socket }` and dispatches
// `bahjah:room-update` / `bahjah:game-state` CustomEvents on `document` so
// a per-game script (e.g. assets/trivia-game.js) can render the actual
// round without lobby.js needing to know anything game-specific.
(function () {
  const LANG = document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const mount = document.getElementById('lobby-strip');
  if (!code || !mount) return;

  // Errors from a game's own action (e.g. answering twice) are surfaced by
  // that game's own UI instead of clobbering this generic status strip.
  const GAME_ACTION_ERROR_CODES = new Set(['ALREADY_ANSWERED', 'NOT_IMPLEMENTED', 'GAME_NOT_STARTED', 'INVALID_PHASE', 'INVALID_ACTION']);

  window.BahjahRoom = { code };

  mount.style.display = 'block';

  const token = BahjahSession.getToken();
  if (!token) {
    mount.innerHTML = LANG === 'ar'
      ? `سجّل الدخول للانضمام إلى الغرفة <strong>${code}</strong>. <a href="auth.html">تسجيل الدخول</a>`
      : `Sign in to join room <strong>${code}</strong>. <a href="auth.html">Sign in</a>`;
    return;
  }

  let socket = null;
  let me = null;
  let latestRoom = null;
  let latestState = null;
  let connected = true;
  let joinPanel = null;

  // Built once (not on every render) so the QR <img> doesn't re-fetch on
  // every socket event -- only its visibility toggles after that.
  function ensureJoinPanel() {
    if (joinPanel) return joinPanel;
    joinPanel = document.createElement('div');
    joinPanel.style.cssText =
      'display:none; margin-bottom:14px; padding:20px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-a); align-items:center; gap:20px; flex-wrap:wrap;';

    const qrImg = document.createElement('img');
    qrImg.src = `/api/rooms/${encodeURIComponent(code)}/qr.svg`;
    qrImg.alt = LANG === 'ar' ? 'امسح للانضمام' : 'Scan to join';
    qrImg.width = 140;
    qrImg.height = 140;
    qrImg.style.cssText = 'border-radius:8px; background:#fff; padding:8px; flex-shrink:0;';
    joinPanel.appendChild(qrImg);

    const info = document.createElement('div');
    info.style.cssText = 'flex:1; min-width:200px;';

    const label = document.createElement('div');
    label.textContent = LANG === 'ar' ? 'ادعُ اللاعبين' : 'Invite players';
    label.style.cssText = 'font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;';
    info.appendChild(label);

    const codeRow = document.createElement('div');
    codeRow.style.cssText = 'display:flex; align-items:center; gap:12px; flex-wrap:wrap;';

    const codeText = document.createElement('span');
    codeText.textContent = code;
    codeText.style.cssText = 'font-family:var(--font-display); font-size:32px; font-weight:800; letter-spacing:.1em; color:var(--text);';
    codeRow.appendChild(codeText);

    const copyBtn = document.createElement('button');
    copyBtn.textContent = LANG === 'ar' ? 'انسخ الرابط' : 'Copy link';
    copyBtn.style.cssText =
      'background:var(--surface-2); color:var(--text); border:1px solid var(--line); border-radius:6px; padding:6px 14px; font-weight:700; font-size:13px; cursor:pointer;';
    copyBtn.onclick = () => {
      const url = `${location.origin}${location.pathname}?code=${encodeURIComponent(code)}`;
      navigator.clipboard.writeText(url).then(() => {
        copyBtn.textContent = LANG === 'ar' ? 'تم النسخ!' : 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = LANG === 'ar' ? 'انسخ الرابط' : 'Copy link';
        }, 1500);
      });
    };
    codeRow.appendChild(copyBtn);
    info.appendChild(codeRow);

    const hint = document.createElement('p');
    hint.textContent = LANG === 'ar'
      ? 'شارك الرمز أو امسح رمز QR للانضمام من الهاتف.'
      : 'Share the code, or scan the QR code to join from a phone.';
    hint.style.cssText = 'font-size:13px; color:var(--muted); margin-top:8px;';
    info.appendChild(hint);

    joinPanel.appendChild(info);
    mount.parentNode.insertBefore(joinPanel, mount);
    return joinPanel;
  }

  mount.textContent = LANG === 'ar' ? `جارٍ الاتصال بالغرفة ${code}…` : `Connecting to room ${code}…`;

  BahjahSession.fetchMe()
    .then((user) => {
      me = user;
      return fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
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
    socket = io({ auth: { token } });
    window.BahjahRoom.socket = socket;
    socket.on('connect', () => {
      connected = true;
      socket.emit('room:join', { code });
      render();
    });
    // Socket.IO auto-reconnects on transient drops (network blip, brief
    // backgrounding) and re-fires 'connect' above once it succeeds — this
    // just gives the visible-while-it-lasts feedback in between.
    socket.on('disconnect', () => {
      connected = false;
      render();
    });
    socket.on('room:update', (room) => {
      latestRoom = room;
      document.dispatchEvent(new CustomEvent('bahjah:room-update', { detail: room }));
      render();
    });
    socket.on('game:state', (state) => {
      latestState = state;
      document.dispatchEvent(new CustomEvent('bahjah:game-state', { detail: state }));
      render();
    });
    socket.on('room:error', (err) => {
      if (GAME_ACTION_ERROR_CODES.has(err.code)) return;
      mount.textContent = err.message;
    });
  }

  function isHost() {
    return Boolean(latestRoom && me && latestRoom.members.some((m) => m.userId === me.id && m.isHost));
  }

  function statusLabel() {
    if (!latestRoom) return '';
    const names = latestRoom.members.map((m) => (m.isHost ? `★ ${m.displayName}` : m.displayName)).join(', ');
    if (latestRoom.status === 'ended') {
      return LANG === 'ar' ? `انتهت الغرفة ${latestRoom.code}.` : `Room ${latestRoom.code} has ended.`;
    }
    if (latestRoom.status === 'in-progress') {
      const detail = latestState && latestState.data && latestState.data.message ? ` — ${latestState.data.message}` : '';
      return LANG === 'ar' ? `الغرفة ${latestRoom.code} · قيد اللعب${detail}` : `Room ${latestRoom.code} · in progress${detail}`;
    }
    return LANG === 'ar'
      ? `الغرفة ${latestRoom.code} · انضم ${latestRoom.members.length} — ${names}`
      : `Room ${latestRoom.code} · ${latestRoom.members.length} joined — ${names}`;
  }

  function makeButton(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText =
      'margin-inline-start:12px; background:var(--brand); color:var(--on-accent); border:none; border-radius:6px; padding:6px 14px; font-weight:700; font-size:13px; cursor:pointer;';
    btn.onclick = onClick;
    return btn;
  }

  function render() {
    if (!latestRoom) return;

    const panel = ensureJoinPanel();
    panel.style.display = latestRoom.status === 'lobby' ? 'flex' : 'none';

    mount.innerHTML = '';

    if (!connected) {
      const badge = document.createElement('span');
      badge.textContent = LANG === 'ar' ? 'إعادة الاتصال… · ' : 'Reconnecting… · ';
      badge.style.cssText = 'color:var(--muted); font-style:italic;';
      mount.appendChild(badge);
    }

    const label = document.createElement('span');
    label.textContent = statusLabel();
    mount.appendChild(label);

    if (isHost() && latestRoom.status === 'lobby') {
      mount.appendChild(makeButton(LANG === 'ar' ? 'ابدأ اللعبة' : 'Start game', () => socket.emit('room:start')));
    }
    if (isHost() && latestRoom.status === 'in-progress') {
      mount.appendChild(makeButton(LANG === 'ar' ? 'أنهِ اللعبة' : 'End game', () => socket.emit('room:end')));
    }
  }
})();
