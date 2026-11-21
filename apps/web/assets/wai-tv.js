// مين أنا؟ -- the shared screen (the wireframes' "Shared screen" column): the
// host's wide screen, for the lobby and the whole game. It never draws the
// answer before the reveal, nor anybody's guess text.
//
// Controls: with "Host controls on TV" on, a pill bar along the bottom (it
// hides 4 s after the last touch; H toggles it). With it off the host runs
// the game from the host panel on their phone, and the TV keeps only a small
// "Controls" button in case that phone is not to hand.
(function () {
  const frame = document.getElementById('wai-tv');
  const stage = document.getElementById('wai-stage');
  if (!frame || !stage) return;
  const UI = window.WaiUI;
  const Host = window.WaiHost;
  const Setup = window.WaiSetup;
  const esc = UI.esc;
  const params = new URLSearchParams(location.search);
  const panelMode = () => params.get('panel') === '1' || window.innerWidth < 700;

  let lobby = null;
  let room = null;
  let state = null;
  let socket = null;
  let active = false;
  let offline = false;
  let barShown = false;
  let barTimer = null;
  let pinned = false;
  let showPanelQr = false;

  document.addEventListener('bahjah:lobby-update', (e) => {
    lobby = e.detail || {};
    room = lobby.room;
    socket = lobby.socket;
    active = Boolean(room && lobby.isHost && !panelMode());
    frame.style.display = active ? 'flex' : 'none';
    document.body.classList.toggle('wai-tv-on', active);
    if (!active) return;
    ['lobby-gate', 'lobby-main'].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    if (room.code) Setup.init(room.code).then(render);
    if (room.status === 'lobby') { try { if (sessionStorage.getItem('wai_open_setup')) { sessionStorage.removeItem('wai_open_setup'); Setup.show(); } } catch (_) { /* private mode */ } }
    render();
  });
  document.addEventListener('bahjah:game-state', (e) => {
    if (!e.detail || e.detail.gameType !== 'who-am-i') return;
    const before = state;
    state = e.detail;
    if (!active) return;
    // Back after every host screen dropped: lift the pause that caused.
    if (state.phase === 'clue' && state.data && state.data.paused && state.data.autoPaused && socket) socket.emit('game:action', { action: { type: 'resumeAuto' } });
    cue(before, state);
    if (!before || before.phase !== state.phase) wake();
    render();
  });
  document.addEventListener('bahjah:connection', (e) => {
    const s = e.detail && e.detail.state;
    offline = s === 'offline' || s === 'expired' || s === 'reconnecting';
    if (active) render();
  });
  document.addEventListener('bahjah:lang-change', () => { if (active) render(); });
  window.addEventListener('resize', () => { if (active) UI.fitStage(stage); });
  Setup.onChange(() => { if (active) render(); });
  // Settings changed on the host's phone reach this screen within seconds.
  setInterval(() => { if (active && room && room.status === 'lobby' && !Setup.isOpen()) Setup.refresh().then(render); }, 4000);

  function cue(before, next) {
    if (!before) return;
    const b = before.data || {};
    const n = next.data || {};
    if (next.phase === 'clue' && (before.phase !== 'clue' || b.clue !== n.clue)) UI.sfx('click');
    else if (next.phase === 'reveal' && before.phase !== 'reveal') UI.sfx('reveal');
    else if (next.phase === 'finished' && before.phase !== 'finished') UI.sfx('win');
    const solvedB = (b.status || []).filter((s) => s.state === 'solved').length;
    const solvedN = (n.status || []).filter((s) => s.state === 'solved').length;
    if (next.phase === 'clue' && solvedN > solvedB) UI.sfx('correct');
  }

  // --- Bar visibility --------------------------------------------------------
  const barOn = () => Boolean(state && state.data && state.data.hostOnTv) || (room && room.status === 'lobby');
  function wake() {
    if (pinned) return;
    barShown = true;
    applyBar();
    clearTimeout(barTimer);
    barTimer = setTimeout(() => {
      if (pinned || !room || room.status === 'lobby') return;
      barShown = false;
      // Without TV controls the bar goes back to the small Controls button.
      if (!data().hostOnTv) render(); else applyBar();
    }, 4000);
  }
  function applyBar() {
    const bar = document.getElementById('wai-bar');
    if (bar) bar.classList.toggle('is-hidden', !barShown);
  }
  document.addEventListener('keydown', (e) => {
    if (!active || e.target.closest('input,textarea,select') || Setup.isOpen()) return;
    if (e.key === 'h' || e.key === 'H') {
      barShown = !barShown;
      pinned = !barShown;
      clearTimeout(barTimer);
      if (barShown && !barOn()) render();
      applyBar();
    }
  });
  frame.addEventListener('pointermove', () => { if (active && barOn()) wake(); });
  frame.addEventListener('click', async (e) => {
    if (!active) return;
    if (e.target.closest('[data-tv-controls]')) { barShown = true; pinned = false; render(); wake(); return; }
    if (e.target.closest('[data-tv-settings]')) { Setup.show(); return; }
    if (e.target.closest('[data-tv-panel]')) { showPanelQr = !showPanelQr; render(); return; }
    if (e.target.closest('[data-tv-start]')) { if (socket) socket.emit('room:start'); return; }
    const b = e.target.closest('[data-host-act]');
    if (b) { await Host.run(b.dataset.hostAct, { state, socket, onShare: share }); wake(); return; }
    if (barOn()) wake();
  });
  function share() {
    UI.shareOrCopy(Host.resultsText(state), `${location.origin}/who-am-i.html`);
  }

  // --- Pieces ----------------------------------------------------------------
  const data = () => (state && state.data) || {};
  const players = () => (data().players || []).filter((p) => !p.removed);
  const memberOnline = (id) => { const m = room && room.members.find((x) => x.userId === id); return Boolean(m && m.connected); };
  const hostName = () => { const h = room && room.members.find((m) => m.isHost); return h ? h.displayName : ''; };
  const top = (eyebrow) => `<div class="w-tv__top"><span class="w-logo-row">${UI.emblem(28)}<span class="w-wordmark" style="font-size:17px">${esc(UI.t().title)}<span class="w-q">${UI.t().q}</span></span></span>
    <span class="w-eyebrow">${esc(eyebrow || '')}</span><span class="w-mono" style="font-size:16px;letter-spacing:.12em" dir="ltr">${esc(room ? room.code : '')}</span></div>`;

  function sLobby() {
    const t = UI.t();
    const ps = room.members.filter((m) => !m.isHost);
    const joinHost = location.host;
    return `<div class="w-tv__screen" style="padding-bottom:72px">
      <div class="w-tv__top"><span class="w-logo-row">${UI.emblem(28)}<span class="w-wordmark" style="font-size:17px">${esc(t.title)}<span class="w-q">${t.q}</span></span></span><span class="w-small">${esc(t.hostLabel(hostName()))}</span><span class="w-mono" style="font-size:16px;letter-spacing:.12em" dir="ltr">${esc(room.code)}</span></div>
      <div style="flex:1;display:grid;grid-template-columns:1fr 300px;gap:28px;min-height:0">
        <div style="display:flex;flex-direction:column;gap:14px;min-width:0;min-height:0">
          <h1 class="w-h1">${esc(t.howTo)}</h1>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
            <div class="w-glass w-card">${UI.icon('eye', 20)}<span class="w-h3" style="font-size:15px">${esc(t.how1)}</span></div>
            <div class="w-glass w-card">${UI.icon('phone', 20)}<span class="w-h3" style="font-size:15px">${esc(t.how2)}</span></div>
            <div class="w-glass w-card"><span style="color:var(--c-sun)">${UI.icon('star', 20)}</span><span class="w-h3" style="font-size:15px">${esc(t.how3)}</span><span class="w-small w-muted">${esc(t.how3sub)}</span></div>
          </div>
          <span class="w-label">${esc(t.players)} · ${UI.d(ps.length)}</span>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start;overflow:hidden;flex:1;min-height:0" data-tv-chips>${ps.slice(0, 11).map((m, i) => UI.chip(m.displayName, i, { offline: !m.connected })).join('')}${ps.length > 11 ? `<span class="w-chip" style="padding:0 14px">${UI.plusN(ps.length - 11)}</span>` : ''}</div>
        </div>
        <div class="w-glass w-card" style="align-items:center;justify-content:center;gap:12px;text-align:center">
          <span class="w-h3">${esc(t.joinPhone)}</span>
          <img src="/api/rooms/${encodeURIComponent(room.code)}/qr.svg" alt="QR" style="width:170px;height:170px;background:#fff;border-radius:16px;padding:8px;box-sizing:border-box">
          <span class="w-code" style="font-size:52px">${esc(room.code)}</span>
          <span class="w-small">${esc(t.goTo(`${joinHost}/j/${room.code}`))}</span>
        </div>
      </div>
      ${showPanelQr ? panelQrCard() : ''}
      ${lobbyBar(ps.length)}</div>`;
  }
  function panelQrCard() {
    const t = UI.t();
    return `<div class="w-glass w-glass--strong w-card" style="position:absolute;inset-inline-start:36px;bottom:72px;width:300px;align-items:center;text-align:center;z-index:6;box-shadow:var(--shadow-float)">
      <span class="w-h3">${esc(t.hostPanel)}</span><img src="/api/rooms/${encodeURIComponent(room.code)}/qr.svg?target=panel" alt="QR" style="width:150px;height:150px;background:#fff;border-radius:14px;padding:6px;box-sizing:border-box">
      <span class="w-small">${esc(t.hostPanelHow)}</span></div>`;
  }
  function lobbyBar(count) {
    const t = UI.t();
    return `<div class="w-tvbar" id="wai-bar"><span class="w-tvbar__tag">${esc(t.minPlayers)}</span><span style="display:inline-flex;gap:4px">${Setup.badges()}</span>
      ${UI.soundButton('w-btn w-btn--secondary w-btn--sm w-btn--icon')}
      <button type="button" class="w-btn w-btn--secondary w-btn--sm" data-tv-panel>${UI.icon('phone', 15)}${esc(t.hostPanel)}</button>
      <button type="button" class="w-btn w-btn--secondary w-btn--sm" data-tv-settings>${UI.icon('settings', 15)}${esc(t.settings)}</button>
      <button type="button" class="w-btn w-btn--sm start-btn" data-tv-start${count >= 2 ? '' : ' disabled'}>${UI.icon('play', 15)}${esc(t.start)}</button></div>`;
  }

  function sIntro(x) {
    const t = UI.t();
    return `<div class="w-tv__screen" style="flex-direction:row;align-items:center;justify-content:center;gap:56px">
      ${UI.portrait({ width: 240, ratio: 1.2, reveal: 0 })}
      <div style="display:flex;flex-direction:column;gap:12px"><span class="w-eyebrow">${esc(t.roundOf(x.round + 1, x.total))}</span>
        <h1 class="w-display" style="font-size:72px">${esc(t.title)}<span class="w-q">${t.q}</span></h1>
        <span class="w-body" style="font-size:20px">${esc(t.firstWorth)}</span></div></div>`;
  }

  // The newest clue rises in once, when it arrives -- not again on every
  // redraw while people are guessing.
  let animated = '';
  function cluesColumn(x, opts = {}) {
    const key = `${x.round}:${x.clue}`;
    const fresh = key !== animated;
    animated = key;
    const lang = UI.isAr() ? 'ar' : 'en';
    const list = (x.clues && x.clues[lang]) || [];
    const rows = [];
    for (let i = 1; i <= 6; i += 1) {
      if (i <= x.clue) rows.push(UI.clueCard(i, list[i - 1] || '', i === x.clue ? 'current' : 'revealed', { compact: true, noAnim: i !== x.clue || !fresh }));
      else rows.push(UI.clueCard(i, '', 'locked'));
    }
    return `<div style="display:flex;flex-direction:column;gap:8px;min-width:0${opts.blur ? ';filter:blur(8px);opacity:.6' : ''}">${rows.join('')}</div>`;
  }

  function whosGot(x) {
    const t = UI.t();
    const byId = Object.fromEntries(players().map((p) => [p.userId, p]));
    const order = { solved: 0, review: 1, guessing: 2, none: 3 };
    const list = (x.status || []).filter((s) => byId[s.userId]).sort((a, b) => order[a.state] - order[b.state] || (a.clue || 9) - (b.clue || 9));
    const shown = list.slice(0, 7);
    const row = (s) => {
      const p = byId[s.userId];
      const b = s.state === 'solved' ? UI.badge(t.stClue(s.clue, s.points), 'correct') : s.state === 'review' ? UI.badge(t.stReview, 'review') : s.state === 'guessing' ? UI.badge(t.stGuessing(s.tries)) : `<span class="w-small w-muted">${esc(t.stNone)}</span>`;
      return `<div class="w-row-item" style="min-height:38px;${memberOnline(s.userId) ? '' : 'opacity:.5'}"><span dir="auto">${esc(p.name)}</span>${b}</div>`;
    };
    return `<div style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="w-h3" style="font-size:16px">${esc(t.whosGot)}</span>${shown.map(row).join('')}${list.length > shown.length ? `<span class="w-small w-muted">${UI.plusN(list.length - shown.length)}</span>` : ''}</div>`;
  }
  function topFive(x) {
    const rows = UI.ranked(players(), x.scores).slice(0, 5);
    return `<div style="display:flex;flex-direction:column;gap:6px">${rows.map((p, i) => UI.scoreRow(p, { rank: p.rank, score: p.score, lead: i === 0 && p.score > 0, crown: true, dot: 24 })).join('')}</div>`;
  }

  function sClue(x) {
    const t = UI.t();
    const anyGuess = (x.status || []).some((s) => s.state !== 'none');
    const reviewing = !x.hostOnTv && (x.status || []).some((s) => s.state === 'review');
    const ring = x.reveal === 'timed' && !x.closing
      ? UI.ring(x.phaseEndsAt, x.seconds, { size: 84, paused: x.paused, remainingMs: x.remainingMs })
      : '';
    return `<div class="w-tv__screen">${top(t.roundClue(x.round + 1, x.total, x.clue))}
      ${reviewing ? `<div class="w-banner">${UI.badge(t.reviewing, 'cobalt')}</div>` : ''}
      ${x.closing ? `<div class="w-banner">${UI.badge(t.allSolved, 'correct')}</div>` : ''}
      <div style="flex:1;display:grid;grid-template-columns:150px 1fr 240px;gap:18px;min-height:0">
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px">${UI.portrait({ width: 150, ratio: 1.25, reveal: x.clue / 6, image: x.answer && x.answer.image })}${ring}</div>
        ${cluesColumn(x)}
        ${anyGuess ? whosGot(x) : topFive(x)}
      </div></div>`;
  }

  function sReveal(x) {
    const t = UI.t();
    const byId = Object.fromEntries((x.players || []).map((p) => [p.userId, p]));
    const name = UI.pick(x.answer);
    const solvers = (x.solvers || []).slice(0, 6);
    return `<div class="w-tv__screen" style="flex-direction:row;align-items:center;gap:44px;padding-inline:52px">
      ${UI.portrait({ width: 220, ratio: 1.25, revealed: true, name, image: x.answer && x.answer.image })}
      <div style="flex:1;display:flex;flex-direction:column;gap:12px;min-width:0"><span class="w-eyebrow">${esc(t.iAm)}</span>
        <h1 class="w-display" style="font-size:52px" dir="auto">${esc(t.iAmName(name))}</h1>
        ${solvers.length ? `<div class="w-list">${solvers.map((s) => `<div class="w-row-item" style="min-height:40px"><span dir="auto">${esc((byId[s.userId] || {}).name || '')}</span><span class="w-small w-muted">${esc(t.clueShort(s.clue))}</span>${UI.badge(`${UI.plus(s.points)}`, 'sun')}</div>`).join('')}</div>` : `<p class="w-body" style="font-size:20px">${esc(t.nobodySolved)}</p>`}
        ${(x.solvers || []).length > solvers.length ? `<span class="w-small w-muted">${UI.plusN(x.solvers.length - solvers.length)}</span>` : ''}
      </div></div>`;
  }

  function sBoard(x) {
    const t = UI.t();
    const rows = UI.ranked(players(), x.scores);
    const shown = rows.slice(0, 6);
    const delta = x.delta || {};
    return `<div class="w-tv__screen" style="align-items:center">
      <span class="w-eyebrow">${esc(t.afterRound(x.round + 1, x.total))}</span><h1 class="w-h1" style="font-size:40px">${esc(t.leaderboard)}</h1>
      <div style="width:560px;display:flex;flex-direction:column;gap:7px">${shown.map((p, i) => `<div style="display:flex;align-items:center;gap:12px">${UI.scoreRow(p, { rank: p.rank, score: p.score, lead: i === 0 && p.score > 0, crown: true }).replace('class="w-score', 'style="flex:1" class="w-score')}<span class="w-small" style="width:52px;color:var(--c-sun);font-weight:600">${delta[p.userId] ? `${UI.plus(delta[p.userId])}` : '—'}</span></div>`).join('')}</div>
      ${rows.length > shown.length ? `<span class="w-small w-muted">${UI.plusN(rows.length - shown.length)}</span>` : ''}</div>`;
  }

  function sFinished(x) {
    const t = UI.t();
    const rows = UI.ranked(players(), x.scores);
    const winners = rows.filter((p) => p.rank === 1 && p.score > 0);
    const rest = rows.filter((p) => !winners.includes(p)).slice(0, 5);
    const top1 = winners[0];
    return `<div class="w-tv__screen" style="align-items:center;justify-content:center;text-align:center;gap:10px;background:radial-gradient(60% 55% at 50% 30%, rgba(255,201,60,.22), transparent 70%)">
      ${winners.length ? `<span style="color:var(--sun-400)">${UI.icon('crown', 44)}</span><span class="w-eyebrow" style="color:var(--c-sun)">${esc(winners.length > 1 ? t.winners : t.winner)}</span>
      <h1 class="w-display" style="font-size:${winners.length > 1 ? 56 : 88}px" dir="auto">${esc(winners.map((w) => w.name).join(UI.isAr() ? ' و' : ' & '))}</h1>`
        : `${UI.emblem(96)}<span class="w-eyebrow">${esc(t.gameOver)}</span><h1 class="w-display" style="font-size:56px">${esc(t.noWinner)}</h1><p class="w-body">${esc(t.noWinnerSub)}</p>`}
      ${top1 ? `<span class="w-h2" style="color:var(--c-sun)">${esc(t.winnerPts(top1.score))}</span>` : ''}
      <div style="display:flex;gap:10px;margin-top:14px">${rest.map((p) => `<div class="w-glass" style="width:120px;padding:10px;display:flex;flex-direction:column;gap:2px"><span class="w-small w-muted">${UI.d(p.rank)}</span><span class="w-h3" style="font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" dir="auto">${esc(p.name)}</span><span class="w-small">${UI.pts(p.score)}</span></div>`).join('')}</div>
    </div>`;
  }

  function sEnded() {
    const t = UI.t();
    return `<div class="w-tv__screen" style="align-items:center;justify-content:center;text-align:center">${UI.emblem(120)}<h1 class="w-h1">${esc(t.ended)}</h1><a class="w-btn w-btn--lg" href="who-am-i.html">${esc(t.home)}</a></div>`;
  }
  function sReconnecting() {
    const t = UI.t();
    const x = data();
    return `<div class="w-tv__screen" style="align-items:center;justify-content:center;text-align:center;gap:14px">${UI.ring(0, 1, { size: 96, paused: true, remainingMs: x.remainingMs || 0 })}
      <h1 class="w-h1">${esc(t.reconnecting)}</h1><p class="w-body">${esc(t.pausedNothing)}</p>${state ? UI.badge(t.roundClueShort((x.round || 0) + 1, x.clue || 0)) : ''}</div>`;
  }

  function gameBar() {
    const t = UI.t();
    const x = data();
    if (!state || (room && room.status === 'ended')) return '';
    if (!x.hostOnTv && !barShown) return `<button type="button" class="w-btn w-btn--ghost w-btn--sm w-tvhint" data-tv-controls>${UI.icon('settings', 14)}${esc(t.controls)}</button>`;
    const buttons = Host.controls(state);
    return `<div class="w-tvbar${barShown ? '' : ' is-hidden'}" id="wai-bar"><span class="w-tvbar__tag">${esc(t.tvMode)}</span>
      ${buttons.map((b) => `<button type="button" class="w-btn w-btn--sm${b.variant ? ` w-btn--${b.variant}` : ''}" data-host-act="${esc(b.act)}" title="${esc(b.label)}">${b.icon ? UI.icon(b.icon, 15) : ''}${esc(b.label)}</button>`).join('')}
      ${UI.soundButton('w-btn w-btn--ghost w-btn--sm w-btn--icon')}</div>`;
  }

  function render() {
    if (!active || !room) return;
    let body;
    if (room.status === 'ended') body = sEnded();
    else if (room.status === 'lobby') body = sLobby();
    else if (offline) body = sReconnecting();
    else if (!state) body = `<div class="w-tv__screen" style="align-items:center;justify-content:center">${UI.emblem(120)}<span class="w-h3">${esc(UI.t().connecting)}</span></div>`;
    else {
      const x = data();
      body = state.phase === 'intro' ? sIntro(x)
        : state.phase === 'clue' ? sClue(x)
          : state.phase === 'reveal' ? sReveal(x)
            : state.phase === 'board' ? sBoard(x)
              : state.phase === 'finished' ? sFinished(x) : '';
    }
    stage.innerHTML = body + (room.status === 'lobby' || offline ? '' : gameBar());
    if (room.status === 'lobby') { barShown = true; }
    applyBar();
    UI.fitStage(stage);
    UI.tickTimers();
  }
})();
