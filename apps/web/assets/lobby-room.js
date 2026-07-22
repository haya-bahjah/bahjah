// Drives a dedicated per-game lobby page (trivia-lobby.html, mafia-lobby.html,
// knows-you-best-lobby.html). Each page provides the themed HTML shell with
// these hooks; this script owns all the joining/socket/avatar/ready logic.
//
// Expected DOM, all inside the page:
//   #lobby-gate            shown while signing in / joining
//   #lobby-gate-message    text inside the gate
//   #lobby-main            shown once room data has arrived
//   .room-code-text         room code text (one per layout, class not id -- both tv+phone show it)
//   #room-qr               <img> for the QR code
//   #copy-link-btn         "copy link" button
//   #tv-players            player grid (big-screen layout)
//   #phone-players         compact player list (phone layout)
//   #phone-avatar          clickable container for the current player's avatar markup
//   #phone-name            current player's display name
//   .ready-btn              ready/not-ready toggle
//   .start-btn              host-only "start game" button (one per layout)
//
// Optional per-page opt-ins, both via data-* attributes on <body>:
//   data-guest-join="true"    shows a nickname+avatar "join as a guest" panel
//                              instead of redirecting to auth.html when no
//                              session exists. Expects
//                              #guest-entry/#guest-avatar/#guest-nickname/
//                              #guest-error/#guest-join-btn/#guest-signin-link.
//   data-host-plays="false"   the host never plays (trivia) -- instead of
//                              being redirected to the game page when the
//                              room leaves 'lobby', the host stays on this
//                              page and a companion script (e.g.
//                              trivia-host-console.js) takes over via the
//                              bahjah:lobby-update event this file already
//                              dispatches. Omitted (default) means the host
//                              redirects along with everyone else, as today.
//
// The page's <body> must have data-game="trivia|mafia|knows-you-best" and
// data-game-page="trivia-play.html|mafia.html|knows-you-best.html" (where
// non-host players land once the game actually starts).
(function () {
  // A live read (not a value captured once at load) -- the host page's own
  // EN/AR switch just flips the <html lang> attribute client-side with no
  // reload, so anything computed from a frozen constant would get stuck in
  // whichever language was active on first render.
  function LANG_ATTR() {
    return document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  }
  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const gameType = document.body.dataset.game;
  const gamePage = document.body.dataset.gamePage;
  const guestJoinEnabled = document.body.dataset.guestJoin === 'true';
  const hostPlays = document.body.dataset.hostPlays !== 'false';

  const gate = document.getElementById('lobby-gate');
  const gateMessage = document.getElementById('lobby-gate-message');
  const main = document.getElementById('lobby-main');
  const guestEntry = document.getElementById('guest-entry');

  function showGate(message) {
    if (gate) gate.style.display = 'flex';
    if (main) main.style.display = 'none';
    if (guestEntry) guestEntry.style.display = 'none';
    if (gateMessage) {
      gateMessage.style.display = '';
      gateMessage.textContent = message;
    }
  }

  if (!code) {
    showGate(LANG_ATTR() === 'ar' ? 'لا يوجد رمز غرفة.' : 'No room code given.');
    return;
  }

  let socket = null;
  let me = null;
  let latestRoom = null;
  let myReady = false;
  let guestAvatar = null;

  const realToken = BahjahSession.getToken();
  let token = realToken || BahjahSession.getGuestToken();
  if (!token) {
    if (guestJoinEnabled) {
      showGuestEntry();
    } else {
      showGate(LANG_ATTR() === 'ar' ? 'سجّل الدخول أولاً…' : 'Sign in first…');
      setTimeout(() => {
        window.location.href = `auth.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      }, 700);
    }
    return;
  }

  joinWithToken();

  function showGuestEntry() {
    if (gateMessage) gateMessage.style.display = 'none';
    if (guestEntry) guestEntry.style.display = 'block';

    const signinLink = document.getElementById('guest-signin-link');
    if (signinLink) signinLink.href = `auth.html?next=${encodeURIComponent(location.pathname + location.search)}`;

    renderGuestAvatarPreview();

    const joinBtn = document.getElementById('guest-join-btn');
    if (joinBtn) joinBtn.addEventListener('click', submitGuestJoin);
    const nicknameInput = document.getElementById('guest-nickname');
    if (nicknameInput) {
      nicknameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitGuestJoin();
      });
    }
    const avatarBtn = document.getElementById('guest-avatar');
    if (avatarBtn) {
      avatarBtn.addEventListener('click', () => {
        window.BahjahAvatarPicker.open(guestAvatar, (newValue) => {
          guestAvatar = newValue;
          renderGuestAvatarPreview();
        });
      });
    }
  }

  function renderGuestAvatarPreview() {
    const avatarBtn = document.getElementById('guest-avatar');
    if (avatarBtn) avatarBtn.innerHTML = window.BahjahAvatars.renderAvatarHtml(guestAvatar, 'guest-preview');
  }

  function submitGuestJoin() {
    const errorEl = document.getElementById('guest-error');
    const nicknameInput = document.getElementById('guest-nickname');
    const nickname = nicknameInput ? nicknameInput.value.trim() : '';
    if (!nickname) {
      if (errorEl) errorEl.textContent = LANG_ATTR() === 'ar' ? 'أدخل اسمًا.' : 'Enter a nickname.';
      return;
    }
    if (errorEl) errorEl.textContent = '';

    fetch(`/api/rooms/${encodeURIComponent(code)}/guest-join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, avatar: guestAvatar }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          if (errorEl) errorEl.textContent = (data.error && data.error.message) || (LANG_ATTR() === 'ar' ? 'تعذّر الانضمام.' : 'Could not join.');
          return;
        }
        BahjahSession.saveGuest(data.token, data.user);
        token = data.token;
        me = data.user;
        showGate(LANG_ATTR() === 'ar' ? `جارٍ الانضمام إلى الغرفة ${code}…` : `Joining room ${code}…`);
        proceedWithRoom(data.room);
      })
      .catch(() => {
        if (errorEl) errorEl.textContent = LANG_ATTR() === 'ar' ? 'خطأ في الشبكة.' : 'Network error.';
      });
  }

  function joinWithToken() {
    showGate(LANG_ATTR() === 'ar' ? `جارٍ الانضمام إلى الغرفة ${code}…` : `Joining room ${code}…`);

    // Real accounts go through the no-arg fetchMe() so their cached
    // bahjah_user stays refreshed exactly as before; a returning guest
    // (revisiting within the 6h window) just verifies their guest token
    // without touching either storage namespace.
    (realToken ? BahjahSession.fetchMe() : BahjahSession.fetchMe(token))
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
          if (data.error && data.error.code === 'TRIAL_EXPIRED') {
            showGate(LANG_ATTR() === 'ar' ? 'انتهت تجربتك المجانية — جارٍ تحويلك إلى الإعدادات لاختيار باقة.' : 'Your free trial has ended — redirecting to Settings to choose a plan.');
            setTimeout(() => { window.location.href = 'settings.html'; }, 1400);
            return;
          }
          showGate((data.error && data.error.message) || (LANG_ATTR() === 'ar' ? 'تعذّر الانضمام إلى هذه الغرفة.' : 'Could not join this room.'));
          return;
        }
        proceedWithRoom(data.room);
      })
      .catch(() => {
        showGate(LANG_ATTR() === 'ar' ? 'خطأ في الشبكة أثناء الانضمام إلى الغرفة.' : 'Network error joining the room.');
      });
  }

  // Shared continuation for both the full-account join and the guest-join
  // response -- both hand back a room summary at this point.
  function proceedWithRoom(room) {
    if (room.gameType !== gameType) {
      // Wrong lobby page for this room's game -- bounce to the right one.
      window.location.href = `${room.gameType}-lobby.html?code=${encodeURIComponent(code)}`;
      return;
    }
    if (room.status !== 'lobby') {
      const amHost = room.members.some((m) => m.userId === me.id && m.isHost);
      if (!hostPlays && amHost) {
        // The host never plays -- stay here and let the host-console
        // companion script take over once the socket connects below.
        connectSocket();
        return;
      }
      window.location.href = `${gamePage}?code=${encodeURIComponent(code)}`;
      return;
    }
    connectSocket();
  }

  function connectSocket() {
    socket = io({ auth: { token } });
    window.BahjahRoom = { code, socket };
    socket.on('connect', () => socket.emit('room:join', { code }));
    socket.on('room:update', (room) => {
      latestRoom = room;
      const mine = room.members.find((m) => m.userId === me.id);
      myReady = Boolean(mine && mine.isReady);
      if (room.status !== 'lobby') {
        if (!hostPlays && isHost()) {
          // Stay put -- swap from the waiting-room view to the host
          // console instead of navigating away. render() below still
          // fires bahjah:lobby-update so that companion script can react.
          if (gate) gate.style.display = 'none';
          if (main) main.style.display = 'none';
          render();
          return;
        }
        window.location.href = `${gamePage}?code=${encodeURIComponent(code)}`;
        return;
      }
      if (gate) gate.style.display = 'none';
      if (main) main.style.display = 'block';
      render();
    });
    socket.on('game:state', (state) => {
      document.dispatchEvent(new CustomEvent('bahjah:game-state', { detail: state }));
    });
    socket.on('room:error', (err) => {
      if (err.code === 'NOT_A_MEMBER') return; // transient, join REST call above already handles it
      showGate(err.message);
    });
  }

  function isHost() {
    return Boolean(latestRoom && me && latestRoom.members.some((m) => m.userId === me.id && m.isHost));
  }

  function avatarSeed(userId) {
    return userId;
  }

  function playerCard(member, big) {
    const size = big ? 64 : 40;
    const readyBadge = member.isReady
      ? `<span style="position:absolute; bottom:-2px; inset-inline-end:-2px; background:var(--good); color:#fff; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:11px; border:2px solid var(--surface);">✓</span>`
      : '';
    const offlineDot = !member.connected
      ? `<span style="position:absolute; top:-2px; inset-inline-start:-2px; background:var(--muted); border-radius:50%; width:10px; height:10px; border:2px solid var(--surface);"></span>`
      : '';
    return `
      <div style="display:flex; flex-direction:column; align-items:center; gap:6px; width:${size + 60}px;">
        <div style="position:relative; width:${size}px; height:${size}px;">
          ${window.BahjahAvatars.renderAvatarHtml(member.avatar, avatarSeed(member.userId))}
          ${readyBadge}${offlineDot}
        </div>
        <span style="font-size:${big ? 13 : 11}px; font-weight:700; text-align:center; color:var(--text); word-break:break-word;">${member.displayName}</span>
      </div>`;
  }

  function render() {
    if (!latestRoom || !me) return;

    const codeEls = document.querySelectorAll('.room-code-text');
    codeEls.forEach((el) => (el.textContent = latestRoom.code));

    // The host runs the room (config, start) but isn't one of the players
    // joining to play, so they're called out separately above the players
    // box instead of being listed inside it.
    const hostMember = latestRoom.members.find((m) => m.isHost);
    const nonHostMembers = latestRoom.members.filter((m) => !m.isHost);
    const emptyPlayersNote = `<span class="players-empty-note">${
      LANG_ATTR() === 'ar' ? 'بانتظار انضمام اللاعبين…' : 'Waiting for players to join…'
    }</span>`;

    document.querySelectorAll('.host-banner').forEach((el) => {
      el.textContent = hostMember
        ? (LANG_ATTR() === 'ar' ? `هذه اللعبة يستضيفها ${hostMember.displayName}.` : `This game is hosted by ${hostMember.displayName}.`)
        : '';
    });

    const tvPlayers = document.getElementById('tv-players');
    if (tvPlayers) tvPlayers.innerHTML = nonHostMembers.length ? nonHostMembers.map((m) => playerCard(m, true)).join('') : emptyPlayersNote;

    const phonePlayers = document.getElementById('phone-players');
    if (phonePlayers) phonePlayers.innerHTML = nonHostMembers.length ? nonHostMembers.map((m) => playerCard(m, false)).join('') : emptyPlayersNote;

    const myMember = latestRoom.members.find((m) => m.userId === me.id);
    const phoneAvatar = document.getElementById('phone-avatar');
    if (phoneAvatar && myMember) phoneAvatar.innerHTML = window.BahjahAvatars.renderAvatarHtml(myMember.avatar, avatarSeed(me.id));
    const phoneName = document.getElementById('phone-name');
    if (phoneName) phoneName.textContent = me.fullName;

    document.querySelectorAll('.ready-btn').forEach((btn) => {
      btn.textContent = myReady
        ? (LANG_ATTR() === 'ar' ? 'جاهز ✓' : "You're ready ✓")
        : (LANG_ATTR() === 'ar' ? 'اضغط عند الجاهزية' : "I'm ready");
      btn.classList.toggle('is-ready', myReady);
    });

    document.querySelectorAll('.start-btn').forEach((btn) => {
      btn.style.display = isHost() ? 'inline-block' : 'none';
    });

    const waitingLabel = document.querySelectorAll('.waiting-label');
    waitingLabel.forEach((el) => {
      el.style.display = isHost() ? 'none' : '';
      el.textContent = LANG_ATTR() === 'ar' ? 'بانتظار أن يبدأ المضيف اللعبة…' : 'Waiting for the host to start…';
    });

    const playerCount = document.querySelectorAll('.player-count');
    playerCount.forEach((el) => {
      el.textContent = LANG_ATTR() === 'ar' ? `${nonHostMembers.length} انضموا` : `${nonHostMembers.length} joined`;
    });

    // Generic hook for a per-game companion script (e.g. trivia's
    // category/difficulty config panel, or the host-console live-match
    // view) to react to lobby state without this shared script needing to
    // know anything game-specific.
    document.dispatchEvent(
      new CustomEvent('bahjah:lobby-update', { detail: { room: latestRoom, me, isHost: isHost(), code, socket } })
    );
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('.ready-btn')) {
      myReady = !myReady;
      socket.emit('room:ready', { isReady: myReady });
      render();
    }
    if (e.target.closest('.start-btn')) {
      socket.emit('room:start');
    }
    if (e.target.closest('#phone-avatar, .avatar-edit')) {
      const myMember = latestRoom && latestRoom.members.find((m) => m.userId === me.id);
      window.BahjahAvatarPicker.open(myMember ? myMember.avatar : null, (newValue) => {
        socket.emit('user:avatar', { avatar: newValue });
      });
    }
  });

  const copyBtn = document.getElementById('copy-link-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const url = `${location.origin}/${gameType}-lobby.html?code=${encodeURIComponent(code)}`;
      navigator.clipboard.writeText(url).then(() => {
        const original = copyBtn.textContent;
        copyBtn.textContent = LANG_ATTR() === 'ar' ? 'تم النسخ!' : 'Copied!';
        setTimeout(() => (copyBtn.textContent = original), 1500);
      });
    });
  }

  const qrImg = document.getElementById('room-qr');
  if (qrImg) qrImg.src = `/api/rooms/${encodeURIComponent(code)}/qr.svg`;

  // The page's own EN/AR switch flips <html lang> with no reload and no
  // socket event, so render() (whose text is all LANG_ATTR()-driven) would
  // otherwise never re-run until the next room:update. Re-render on demand
  // instead of relying on that toggle to know about this file.
  new MutationObserver(() => {
    if (latestRoom && me) render();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
