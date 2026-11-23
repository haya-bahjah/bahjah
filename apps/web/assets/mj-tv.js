// مجلسك -- the shared screen (S1-S4): the host's wide screen, from the lobby
// to the winners. Public state only: questions, how many answered, the
// reveal and the results -- never a guest's own answer or photo.
//
// The host runs the game from their phone (assets/mj-panel.js, opened from
// this screen's "Host panel" code); a pill bar here offers the same controls
// for a host without a second device (it hides after 4 s; H toggles it).
(function () {
  const frame = document.getElementById('mj-tv');
  const stage = document.getElementById('mj-stage');
  if (!frame || !stage) return;
  const UI = window.MjUI;
  const S = window.MjScreens;
  const Host = window.MjHost;
  const esc = UI.esc;
  const params = new URLSearchParams(location.search);
  const panelMode = () => params.get('panel') === '1' || window.innerWidth < 700;

  let room = null;
  let state = null;
  let socket = null;
  let session = null;
  let active = false;
  let offline = false;
  let barShown = true;
  let barTimer = null;
  let pinned = false;
  let showPanelQr = false;

  document.addEventListener('bahjah:lobby-update', async (e) => {
    const lobby = e.detail || {};
    room = lobby.room;
    socket = lobby.socket;
    active = Boolean(room && lobby.isHost && !panelMode());
    frame.style.display = active ? 'flex' : 'none';
    if (!active) return;
    ['lobby-gate', 'lobby-main'].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    if (!session && room.code) {
      try { session = (await UI.api('GET', `/rooms/${encodeURIComponent(room.code)}/session`)).session; UI.applyTheme(session.themeId); } catch (_) { /* shown once it loads */ }
    }
    render();
  });
  document.addEventListener('bahjah:game-state', (e) => {
    if (!e.detail || e.detail.gameType !== 'majlisak') return;
    const before = state;
    state = e.detail;
    if (!active) return;
    if (!before || before.phase !== state.phase || (before.data || {}).index !== (state.data || {}).index) wake();
    render();
  });
  document.addEventListener('bahjah:connection', (e) => { const s = e.detail && e.detail.state; offline = s === 'offline' || s === 'expired'; if (active) render(); });
  document.addEventListener('bahjah:lang-change', () => { if (active) render(); });
  window.addEventListener('resize', () => { if (active) UI.fitStage(stage); });

  function wake() {
    if (pinned) return;
    barShown = true;
    applyBar();
    clearTimeout(barTimer);
    barTimer = setTimeout(() => { if (!pinned && room && room.status !== 'lobby') { barShown = false; applyBar(); } }, 4000);
  }
  function applyBar() { const bar = document.getElementById('mj-bar'); if (bar) bar.style.opacity = barShown ? '1' : '0'; }
  document.addEventListener('keydown', (e) => {
    if (!active || e.target.closest('input,textarea')) return;
    if (e.key === 'h' || e.key === 'H') { barShown = !barShown; pinned = !barShown; clearTimeout(barTimer); applyBar(); }
  });
  frame.addEventListener('pointermove', () => { if (active) wake(); });
  frame.addEventListener('click', async (e) => {
    if (!active) return;
    if (e.target.closest('[data-tv-panel]')) { showPanelQr = !showPanelQr; render(); return; }
    if (e.target.closest('[data-tv-start]')) { if (socket) socket.emit('room:start'); return; }
    const b = e.target.closest('[data-host-act]');
    if (b) { await Host.run(b.dataset.hostAct, { state, socket, onShare: () => UI.shareOrCopy(Host.resultsText(state), `${location.origin}/majlisak.html`) }); wake(); }
  });

  const ev = () => (state && state.data) || session || {};

  function sLobby() {
    const t = UI.t();
    const s = session || { title: '', themeId: 'bridal' };
    const guests = room.members.filter((m) => !m.isHost || (session && session.hostPlays));
    const shown = guests.slice(0, 14);
    return `<div class="mj-tv__screen"><div class="mj-side-art" style="background-image:url('${UI.themeUrl(s.themeId, s.themeImageId)}')"></div>
      <div style="position:relative;width:56%;padding:34px 36px 74px;display:flex;flex-direction:column;gap:14px">
        <span class="mj-label" style="font-size:16px;color:var(--muted)">${esc(t.welcomeTo)}</span>
        <h1 style="font:800 44px/1.1 var(--font-display);margin:0" dir="auto">${esc(s.title)}</h1>
        <div class="mj-sticker" style="display:flex;align-items:center;gap:18px;padding:14px 18px;align-self:flex-start">
          <img src="/api/rooms/${encodeURIComponent(room.code)}/qr.svg" alt="QR" style="width:104px;height:104px;border-radius:12px;background:#fff">
          <div style="display:flex;flex-direction:column;gap:6px"><span class="mj-small" style="color:var(--ink)">${esc(t.joinAt(`${location.host}/j/${room.code}`))}</span><span class="mj-code">${esc(room.code)}</span></div></div>
        <div style="flex:1"></div>
        <span class="mj-label">${esc(guests.length ? t.guestsJoined(guests.length) : t.waitingGuests)}</span>
        <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:96px;overflow:hidden">${shown.map((m) => `<span class="mj-chip" style="cursor:default;border-color:var(--hair);${m.connected ? '' : 'opacity:.5'}">${UI.dot({ name: m.displayName, avatar: m.avatar, userId: m.userId }, 20)}<bdi>${esc(m.displayName)}</bdi></span>`).join('')}${guests.length > shown.length ? `<span class="mj-chip" style="cursor:default">${UI.plus(guests.length - shown.length)}</span>` : ''}</div>
      </div>
      ${showPanelQr ? `<div class="mj-sticker" style="position:absolute;inset-inline-end:28px;bottom:70px;width:250px;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;z-index:6"><span class="mj-label">${esc(t.hostPanel)}</span><img src="/api/rooms/${encodeURIComponent(room.code)}/qr.svg?target=panel" alt="QR" style="width:130px;height:130px;background:#fff;border-radius:10px"><span class="mj-small">${esc(t.hostPanelHow)}</span></div>` : ''}
      <div class="mj-tvbar" id="mj-bar"><button type="button" class="mj-btn mj-btn--secondary" data-tv-panel>${UI.icon('phone', 15)}${esc(t.hostPanel)}</button><span class="mj-small" style="padding:0 6px">${esc(t.needTwo)}</span><button type="button" class="mj-btn start-btn" data-tv-start${guests.length >= 2 ? '' : ' disabled'}>${UI.icon('play', 15)}${esc(t.start)}</button></div></div>`;
  }

  function sReveal(x) {
    const t = UI.t();
    const q = x.question;
    const r = x.reveal || {};
    let body = '';
    if (q.format === 'mc' || q.format === 'checklist') {
      const max = Math.max(1, ...(r.counts || [0]));
      body = `<div style="display:flex;flex-direction:column;gap:10px">${q.options.map((o, i) => {
        const ok = (r.correct || []).includes(i);
        const n = (r.counts || [])[i] || 0;
        return `<div class="mj-bar"><div class="mj-bar__track${ok ? ' is-ok' : ''}" style="max-width:${30 + (70 * n) / max}%"><div class="mj-bar__fill" style="width:100%"></div><span class="mj-bar__label" dir="auto">${ok ? UI.icon('check', 18) : ''}&nbsp;${esc(o)}</span></div><span class="mj-score" style="font-size:22px">${UI.d(n)}</span></div>`;
      }).join('')}</div>`;
    } else if (q.format === 'match') {
      body = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${(r.pairs || []).map((p) => `<div class="mj-opt is-ok" style="cursor:default;font-size:20px" dir="auto">${esc(p.left)}</div><div class="mj-opt is-ok" style="cursor:default;font-size:20px" dir="auto">${esc(p.right)}</div>`).join('')}</div>
        <span class="mj-label" style="font-size:16px">${esc(UI.isAr() ? `${UI.d(r.right || 0)} طابقوا الكل` : `${r.right || 0} matched them all`)}</span>`;
    } else if (q.format === 'text' && (r.accepted || []).length) {
      body = `<div class="mj-opt is-ok" style="cursor:default;font-size:22px;align-self:flex-start" dir="auto">${UI.icon('check', 20)}&nbsp;${esc(r.accepted[0])}</div><span class="mj-label" style="font-size:16px">${esc(UI.isAr() ? `${UI.d(r.right || 0)} أصابوا` : `${r.right || 0} got it`)}</span>`;
    } else {
      body = `<div class="mj-sticker" style="padding:22px;display:flex;align-items:center;gap:14px;font:700 22px var(--font-display);align-self:flex-start">${UI.icon(q.format === 'photo' ? 'camera' : 'heart', 28)}${esc(t.answersIn(r.answered || 0))} · ${esc(t.goesTo(x.honoree))}</div>`;
    }
    return `<div class="mj-tv__screen" style="flex-direction:column">
      <div class="mj-art" style="height:110px;flex:none;background-image:url('${UI.themeUrl(x.themeId, x.themeImageId)}')"><span class="mj-event" style="top:12px;inset-inline-start:28px;height:30px;font-size:15px" dir="auto">${esc(x.title)}</span></div>
      <div style="padding:10px 36px 24px;display:flex;flex-direction:column;gap:14px;flex:1;min-height:0">
        <span class="mj-label" style="font-size:15px">${esc(t.qOf(x.index + 1, x.total))}</span>
        <h1 style="font:700 32px/1.3 var(--font-content);margin:0" dir="auto">${esc(q.prompt)}</h1>${body}</div></div>`;
  }

  function sFinal(x) {
    const t = UI.t();
    const art = `<div class="mj-side-art" style="background-image:url('${UI.themeUrl(x.themeId, x.themeImageId)}')"></div>`;
    const head = `<div style="display:flex;flex-direction:column;gap:6px"><div style="align-self:flex-start">${UI.logo(true)}</div><h1 style="font:800 44px/1.1 var(--font-display);margin:10px 0 0" dir="auto">${esc(t.mabrouk(x.honoree))}</h1><span class="mj-body" dir="auto">${esc(x.title)} · ${esc(x.scoredGame ? t.winners : t.summary)}</span></div>`;
    if (!x.scoredGame || !(x.ranking || []).length) {
      const rows = (x.summary || []).filter((s) => s.played).slice(0, 6).map((s) => `<div class="mj-item" style="min-height:40px"><span class="grow mj-label" dir="auto">${esc(s.prompt)}</span><span class="mj-badge mj-badge--pub">${esc(t.submitted(s.submitted))}</span></div>`).join('');
      return `<div class="mj-tv__screen">${art}<div style="position:relative;width:58%;padding:30px 36px;display:flex;flex-direction:column;gap:14px">${head}<div class="mj-list">${rows}</div></div></div>`;
    }
    const top = x.ranking.slice(0, 3);
    const order = [top[1], top[0], top[2]].filter(Boolean);
    const height = (r) => (r.rank === 1 ? 190 : r.rank === 2 ? 150 : 120);
    return `<div class="mj-tv__screen">${art}<div style="position:relative;width:60%;padding:30px 36px 0;display:flex;flex-direction:column;gap:12px">${head}
      <div style="flex:1"></div><div class="mj-podium">${order.map((r) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><span class="mj-label" style="font-size:16px" dir="auto">${esc(r.name)}</span><div class="mj-step${r.rank === 1 ? ' mj-step--1' : ''}" style="height:${height(r)}px"><span class="mj-score">${UI.pts(r.score)}</span></div></div>`).join('')}</div></div></div>`;
  }

  function gameBar() {
    if (!state || !room || room.status === 'ended') return '';
    const bs = Host.controls(state);
    return `<div class="mj-tvbar" id="mj-bar" style="transition:opacity 200ms ease-out;opacity:${barShown ? 1 : 0}">${bs.map((b) => Host.buttonHtml(b)).join('')}</div>`;
  }

  function render() {
    if (!active || !room) return;
    const t = UI.t();
    let body;
    if (room.status === 'ended') body = `<div class="mj-tv__screen" style="align-items:center;justify-content:center;flex-direction:column;gap:16px">${UI.logo()}<h1 class="mj-title">${esc(t.ended)}</h1><a class="mj-btn" href="majlisak.html">${esc(t.home)}</a></div>`;
    else if (room.status === 'lobby') body = sLobby();
    else if (offline) body = `<div class="mj-tv__screen" style="align-items:center;justify-content:center;flex-direction:column;gap:12px">${UI.logo()}<h1 class="mj-title">${esc(t.reconnecting)}</h1><p class="mj-body">${esc(t.keepOpen)}</p></div>`;
    else if (!state) body = `<div class="mj-tv__screen" style="align-items:center;justify-content:center">${UI.logo()}</div>`;
    else {
      const x = state.data || {};
      UI.applyTheme(x.themeId);
      if (state.phase === 'question' || state.phase === 'locked') body = S.tvQuestion(x, x) + (state.phase === 'locked' ? `<div style="position:absolute;top:92px;inset-inline-end:28px;z-index:3" class="mj-badge mj-badge--warn">${UI.icon('lock', 12)}&nbsp;${esc(UI.isAr() ? 'أُغلقت الإجابات' : 'Answers closed')}</div>` : '');
      else if (state.phase === 'reveal') body = sReveal(x);
      else if (state.phase === 'final') body = sFinal(x);
      else body = '';
    }
    stage.innerHTML = body + (room.status === 'lobby' || offline ? '' : gameBar());
    UI.fitStage(stage);
    UI.tick();
  }
})();
