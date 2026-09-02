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
//   data-host-plays="false"   fallback only, for a server too old to send
//                              RoomSummary.hostPlays. When the room says
//                              whether its own host plays, that wins -- a
//                              Knows You Best creator plays on a phone room
//                              and doesn't on a TV room, which no static
//                              attribute can express. The host never plays --
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

  // Knows You Best offers its 6 character avatars as a bonus picker
  // section (see assets/avatars.js/avatar-picker.js) -- every other game
  // just gets the pack grid, unaffected.
  function avatarPickerExtraSection() {
    if (gameType !== 'knows-you-best') return undefined;
    return {
      label: LANG_ATTR() === 'ar' ? 'شخصيات عارفكم' : 'Knows You Best characters',
      values: window.BahjahAvatars.KYB_CHARACTERS.map((c) => `kyb:${c.id}`),
    };
  }

  const gate = document.getElementById('lobby-gate');
  const gateMessage = document.getElementById('lobby-gate-message');
  const main = document.getElementById('lobby-main');
  const guestEntry = document.getElementById('guest-entry');

  // tone is 'wait' (default) or 'error'. Pages that style the gate message
  // differently for the two read it off data-tone; the rest ignore it.
  function showGate(message, tone) {
    if (gate) gate.style.display = 'flex';
    if (main) main.style.display = 'none';
    if (guestEntry) guestEntry.style.display = 'none';
    if (gateMessage) {
      gateMessage.style.display = '';
      gateMessage.textContent = message;
      gateMessage.setAttribute('data-tone', tone === 'error' ? 'error' : 'wait');
    }
  }

  // The room itself is gone or this browser is not in it -- there is nothing
  // to stay on the lobby for. Every other code is a rejected action.
  const FATAL_ROOM_ERRORS = new Set([
    'ROOM_NOT_FOUND',
    'ROOM_ENDED',
    'ROOM_NOT_JOINABLE',
    'NOT_IN_ROOM',
    'INVALID_CODE',
  ]);

  // Shown next to the start button rather than in place of the lobby. The
  // element is created on demand so no lobby page has to remember to include
  // it, and it clears itself once the room changes -- adding the missing
  // player is the fix, and the warning should not outlive it.
  let noticeTimer = null;
  function showActionNotice(message) {
    const anchor = document.querySelector('.start-btn');
    const host = anchor ? anchor.parentElement : document.getElementById('lobby-main');
    if (!host) return;
    let el = host.querySelector('.lobby-notice');
    if (!el) {
      el = document.createElement('p');
      el.className = 'lobby-notice';
      el.setAttribute('role', 'status');
      el.style.cssText =
        'margin:10px 0 0; font-size:13px; font-weight:700; line-height:1.45;' +
        ' color:var(--danger, #FF2DA6); max-width:340px;';
      host.appendChild(el);
    }
    el.textContent = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { el.textContent = ''; }, 6000);
  }

  if (!code) {
    showGate(LANG_ATTR() === 'ar' ? 'لا يوجد رمز غرفة.' : 'No room code given.', 'error');
    return;
  }

  let socket = null;
  let me = null;
  let latestRoom = null;
  let myReady = false;
  let guestAvatar = null;

  // Bound unconditionally, before the "no token yet -- show the guest-join
  // form and stop" branch below can return early. A brand-new guest hasn't
  // joined (so socket/me/latestRoom are still null) when this runs, but
  // that's fine -- these all only read those bindings later, at click time,
  // once submitGuestJoin() -> connectSocket() has populated them. Wiring
  // them only after the early return meant none of this ever activated for
  // a guest joining fresh via a room code/QR (the overwhelmingly common
  // "player" path): no ready toggle, no avatar change, no copy-link.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.ready-btn')) {
      if (!socket) return;
      myReady = !myReady;
      socket.emit('room:ready', { isReady: myReady });
      render();
    }
    if (e.target.closest('.start-btn')) {
      if (socket) socket.emit('room:start');
    }
    if (e.target.closest('#phone-avatar, .avatar-edit')) {
      const myMember = latestRoom && me && latestRoom.members.find((m) => m.userId === me.id);
      window.BahjahAvatarPicker.open(myMember ? myMember.avatar : null, (newValue) => {
        if (socket) socket.emit('user:avatar', { avatar: newValue });
      }, avatarPickerExtraSection());
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
        }, avatarPickerExtraSection());
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
          showGate((data.error && data.error.message) || (LANG_ATTR() === 'ar' ? 'تعذّر الانضمام إلى هذه الغرفة.' : 'Could not join this room.'), 'error');
          return;
        }
        proceedWithRoom(data.room);
      })
      .catch(() => {
        showGate(LANG_ATTR() === 'ar' ? 'خطأ في الشبكة أثناء الانضمام إلى الغرفة.' : 'Network error joining the room.', 'error');
      });
  }

  // Shared continuation for both the full-account join and the guest-join
  // response -- both hand back a room summary at this point.
  // Whether the creator of *this* room is a player. Games that offer a
  // display choice answer differently room to room -- a Knows You Best
  // creator on their own phone plays, the same creator setting the game up on
  // a television does not -- so the page's static data-host-plays can only be
  // the fallback for a server too old to say.
  function roomHostPlaysIn(room) {
    if (!room || typeof room.hostPlays !== 'boolean') return hostPlays;
    return room.hostPlays;
  }

  function isHostIn(room) {
    return Boolean(room && me && room.members.some((m) => m.userId === me.id && m.isHost));
  }

  // Stay on the lobby page rather than following the room into the game: the
  // creator is the screen, and the game's host console takes this page over.
  function staysOnLobby(room) {
    return !roomHostPlaysIn(room) && isHostIn(room);
  }

  function proceedWithRoom(room) {
    if (room.gameType !== gameType) {
      // Wrong lobby page for this room's game -- bounce to the right one.
      window.location.href = `${room.gameType}-lobby.html?code=${encodeURIComponent(code)}`;
      return;
    }
    if (room.status !== 'lobby') {
      if (staysOnLobby(room)) {
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
        if (staysOnLobby(room)) {
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
      // Only errors that mean this browser is no longer in a usable room
      // replace the lobby with the gate. Everything else is a rejected
      // *action* -- pressing Start with too few players, most commonly --
      // and the room is still perfectly fine, so it belongs beside the
      // button that was pressed. Gating on those stranded the host on an
      // apparently-empty page whose only way out was making a new room.
      if (FATAL_ROOM_ERRORS.has(err.code)) {
        showGate(err.message, 'error');
        return;
      }
      showActionNotice(err.message);
    });
  }

  function isHost() {
    return Boolean(latestRoom && me && latestRoom.members.some((m) => m.userId === me.id && m.isHost));
  }

  // Whoever runs the room -- presses Start, and moves the game on. The server
  // works this out (rooms/service.ts) and sends it on every room update, so
  // the lobby never has to guess from isHost, which is wrong the moment the
  // creator is a TV rather than a player.
  function amController() {
    if (!latestRoom || !me) return false;
    if (latestRoom.controllerId === undefined) return isHost(); // pre-displayMode server
    return latestRoom.controllerId === me.id;
  }

  // A creator whose screen is only the display: they neither play nor run the
  // room, so nothing on this page is theirs to press -- it just shows the code
  // and waits. A host who still runs the room from a console (Trivia, Mafia)
  // is not passive, even though they don't play.
  function amPassiveScreen() {
    return Boolean(latestRoom && isHost() && !amController());
  }

  function avatarSeed(userId) {
    return userId;
  }

  // Seats are class-based, not inline-styled, so each game's theme sheet owns
  // how they look -- assets/lobby-players.css carries the shared structure and
  // mafia-theme.css / trivia-theme.css / kyb-theme.css restyle from there.
  // This used to inline every colour and size, which is why Mafia's lobby kept
  // rendering generic seats inside an otherwise fully themed page.
  function playerCard(member, big) {
    const readyBadge = member.isReady ? '<span class="lp-ready" aria-hidden="true">\u2713</span>' : '';
    const offlineDot = !member.connected ? '<span class="lp-offline" aria-hidden="true"></span>' : '';
    return `
      <div class="lp${big ? ' lp--big' : ''}" data-user-id="${member.userId}">
        <span class="lp-avatar">
          ${window.BahjahAvatars.renderAvatarHtml(member.avatar, avatarSeed(member.userId))}
          ${readyBadge}${offlineDot}
        </span>
        <span class="lp-name">${member.displayName}</span>
      </div>`;
  }

  function render() {
    if (!latestRoom || !me) return;

    const codeEls = document.querySelectorAll('.room-code-text');
    codeEls.forEach((el) => {
      // Opt-in: an element marked data-code-tiles gets one <span> per
      // character instead of a plain string, which is how Trivia's lobby
      // draws the code as separate letter tiles. Everything else is
      // unchanged.
      if (el.hasAttribute('data-code-tiles')) {
        // One box per character, but selecting them copies "B H J 4" -- the
        // browser inserts a break between block-level spans -- and that
        // pasted code will not find the room. So the tiles are decorative
        // and unselectable, and a visually-hidden copy of the plain code is
        // what a selection actually picks up.
        const plain = String(latestRoom.code);
        el.innerHTML =
          `<span class="room-code-plain">${plain}</span>` +
          plain
            .split('')
            .map((ch) => `<span aria-hidden="true" style="user-select:none;">${ch}</span>`)
            .join('');
      } else {
        el.textContent = latestRoom.code;
      }
    });

    // In most rooms the host runs things (config, start) without being one of
    // the players, so they're called out separately above the players box
    // instead of being listed inside it. When the room says the host plays --
    // a Knows You Best game made on someone's own phone -- they belong in the
    // roster and in the count like anybody else.
    const hostMember = latestRoom.members.find((m) => m.isHost);
    const hostIsPlaying = roomHostPlaysIn(latestRoom);
    const playerMembers = hostIsPlaying
      ? latestRoom.members
      : latestRoom.members.filter((m) => !m.isHost);
    const emptyPlayersNote = `<span class="players-empty-note">${
      LANG_ATTR() === 'ar' ? 'بانتظار انضمام اللاعبين…' : 'Waiting for players to join…'
    }</span>`;

    document.querySelectorAll('.host-banner').forEach((el) => {
      el.textContent = hostMember
        ? (LANG_ATTR() === 'ar' ? `هذه اللعبة يستضيفها ${hostMember.displayName}.` : `This game is hosted by ${hostMember.displayName}.`)
        : '';
    });

    const tvPlayers = document.getElementById('tv-players');
    if (tvPlayers) {
      // A page can take over the big-screen roster entirely by defining
      // window.BahjahLobbySeats -- Trivia does, to render the redesign's seat
      // pills and open-seat placeholders. Pages that don't keep the shared
      // avatar-and-name cards exactly as before.
      if (window.BahjahLobbySeats && typeof window.BahjahLobbySeats.render === 'function') {
        window.BahjahLobbySeats.render(tvPlayers, playerMembers, {
          avatarHtml: (m) => window.BahjahAvatars.renderAvatarHtml(m.avatar, avatarSeed(m.userId)),
          lang: LANG_ATTR(),
        });
      } else {
        tvPlayers.innerHTML = playerMembers.length ? playerMembers.map((m) => playerCard(m, true)).join('') : emptyPlayersNote;
      }
    }

    const phonePlayers = document.getElementById('phone-players');
    if (phonePlayers) phonePlayers.innerHTML = playerMembers.length ? playerMembers.map((m) => playerCard(m, false)).join('') : emptyPlayersNote;

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
      btn.style.display = amController() ? 'inline-block' : 'none';
    });

    const waitingLabel = document.querySelectorAll('.waiting-label');
    waitingLabel.forEach((el) => {
      el.style.display = amController() ? 'none' : '';
      // A TV is not waiting for its turn -- it is telling the room what to do.
      el.textContent = amPassiveScreen()
        ? (LANG_ATTR() === 'ar'
            ? 'امسحوا الرمز للانضمام. أول لاعب ينضم يبدأ اللعبة.'
            : 'Scan to join. The first player to join starts the game.')
        : (LANG_ATTR() === 'ar'
            ? 'بانتظار أن يبدأ المضيف اللعبة…'
            : 'Waiting for the host to start…');
    });

    // The ready toggle and the avatar are a player's controls; a display has
    // neither, so they are hidden rather than left there doing nothing.
    document.querySelectorAll('.ready-btn, .phone-avatar-row').forEach((el) => {
      el.style.display = amPassiveScreen() ? 'none' : '';
    });

    const playerCount = document.querySelectorAll('.player-count');
    playerCount.forEach((el) => {
      el.textContent = LANG_ATTR() === 'ar' ? `${playerMembers.length} انضموا` : `${playerMembers.length} joined`;
    });

    // Generic hook for a per-game companion script (e.g. trivia's
    // category/difficulty config panel, or the host-console live-match
    // view) to react to lobby state without this shared script needing to
    // know anything game-specific.
    document.dispatchEvent(
      new CustomEvent('bahjah:lobby-update', {
        detail: {
          room: latestRoom,
          me,
          isHost: isHost(),
          isController: amController(),
          isPassiveScreen: amPassiveScreen(),
          code,
          socket,
        },
      })
    );
  }
})();
