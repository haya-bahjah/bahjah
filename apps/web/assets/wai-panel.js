// مين أنا؟ -- the host panel (the wireframes' "Host panel" column), on the
// host's own phone: opened from the TV's "Host panel" code (?panel=1), or
// whenever the host's screen is phone-sized. It holds what the shared screen
// must never show -- the answer and the guesses -- and the review.
(function () {
  const mount = document.getElementById('wai-panel');
  if (!mount) return;
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
  let view = 'main'; // main | review | players | next
  let reviewIndex = 0;
  let lastConnected = null;

  document.addEventListener('bahjah:lobby-update', (e) => {
    lobby = e.detail || {};
    room = lobby.room;
    socket = lobby.socket;
    active = Boolean(room && lobby.isHost && panelMode());
    mount.style.display = active ? 'block' : 'none';
    if (!active) return;
    ['lobby-gate', 'lobby-main'].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    noticeDrops();
    if (room.code) Setup.init(room.code).then(render);
    if (room.status === 'lobby') { view = 'main'; try { if (sessionStorage.getItem('wai_open_setup')) { sessionStorage.removeItem('wai_open_setup'); Setup.show(); } } catch (_) { /* private mode */ } }
    render();
  });
  document.addEventListener('bahjah:game-state', (e) => {
    if (!e.detail || e.detail.gameType !== 'who-am-i') return;
    const before = state;
    state = e.detail;
    if (!active) return;
    if (before && before.phase !== state.phase) {
      window.scrollTo(0, 0);
      if (view === 'review' && state.phase !== 'clue' && state.phase !== 'reveal') view = 'main';
      if (view === 'next' && state.phase !== 'finished') view = 'main';
      if (state.phase === 'clue' || state.phase === 'reveal') UI.sfx('click');
    }
    const pendBefore = before ? pending(before).length : 0;
    if (pending(state).length > pendBefore) { UI.sfx('reveal'); if (navigator.vibrate) navigator.vibrate(40); }
    if (view === 'review' && !pending(state).length) view = 'main';
    render();
  });
  document.addEventListener('bahjah:connection', (e) => {
    const s = e.detail && e.detail.state;
    offline = s === 'offline' || s === 'expired';
    if (active) render();
  });
  document.addEventListener('bahjah:lang-change', () => { if (active) render(); });
  Setup.onChange(() => { if (active) render(); });

  // "Fahad disconnected" when a player's phone drops -- and stays dropped
  // for a few seconds, so a page change or a blip says nothing.
  function noticeDrops() {
    if (!room) return;
    const now = new Map(room.members.filter((m) => !m.isHost).map((m) => [m.userId, m]));
    if (lastConnected && room.status !== 'lobby') {
      for (const [id, m] of now) {
        if (!lastConnected.get(id) || m.connected) continue;
        setTimeout(() => {
          const still = room && room.members.find((x) => x.userId === id);
          if (still && !still.connected && room.status !== 'lobby') UI.toast(UI.t().disconnected(still.displayName), 'wrong');
        }, 5000);
      }
    }
    lastConnected = new Map([...now].map(([id, m]) => [id, m.connected]));
  }

  const data = () => (state && state.data) || {};
  const pending = (s) => (((s && s.data) || {}).guesses || []).filter((g) => g.verdict === 'review');
  const players = () => (data().players || []).filter((p) => !p.removed);
  const nameOf = (id) => ((data().players || []).find((p) => p.userId === id) || {}).name || '';
  const isOnline = (id) => { const m = room && room.members.find((x) => x.userId === id); return Boolean(m && m.connected); };

  mount.addEventListener('click', async (e) => {
    if (!active) return;
    const t = UI.t();
    if (e.target.closest('[data-p-settings]')) { Setup.show(); return; }
    if (e.target.closest('[data-p-start]')) { if (socket) socket.emit('room:start'); return; }
    if (e.target.closest('[data-p-cast]')) { UI.shareOrCopy(t.castHow, `${location.origin}/who-am-i-lobby.html?code=${room.code}`); return; }
    if (e.target.closest('[data-p-invite]')) { UI.shareOrCopy(t.joinPhone, `${location.origin}/j/${room.code}`); return; }
    const kick = e.target.closest('[data-p-kick]');
    if (kick) {
      const id = kick.dataset.pKick;
      const nm = kick.dataset.name;
      if (!(await UI.confirmSheet({ title: t.removeQ(nm), body: t.removeBody, yes: t.remove(nm) }))) return;
      if (room.status === 'lobby') socket && socket.emit('room:remove-player', { userId: id });
      else socket && socket.emit('game:action', { action: { type: 'remove', userId: id } });
      return;
    }
    const v = e.target.closest('[data-p-view]');
    if (v) { view = v.dataset.pView; reviewIndex = 0; render(); window.scrollTo(0, 0); return; }
    const rv = e.target.closest('[data-p-review]');
    if (rv) { socket && socket.emit('game:action', { action: { type: rv.dataset.pReview, guessId: rv.dataset.id } }); return; }
    if (e.target.closest('[data-p-tv]')) { socket && socket.emit('game:action', { action: { type: 'hostOnTv', on: !data().hostOnTv } }); return; }
    if (e.target.closest('[data-p-continue]')) { view = 'next'; render(); return; }
    const b = e.target.closest('[data-host-act]');
    if (b) await Host.run(b.dataset.hostAct, { state, socket, onShare: () => UI.shareOrCopy(Host.resultsText(state), `${location.origin}/who-am-i.html`) });
  });

  // --- Frame -------------------------------------------------------------------
  function frame(title, body, foot, opts = {}) {
    const t = UI.t();
    const reviews = pending(state).length;
    const head = `<div class="w-phone__head"><span class="w-h2" style="font-size:22px">${esc(title)}</span><span style="display:flex;align-items:center;gap:8px">${opts.right || ''}
      ${state && room.status !== 'lobby' ? `<button type="button" class="w-btn w-btn--secondary w-btn--sm w-btn--icon" data-p-view="${view === 'players' ? 'main' : 'players'}" aria-label="${esc(t.players)}" title="${esc(t.players)}">${UI.icon(view === 'players' ? 'x' : 'user', 16)}</button>` : ''}${UI.soundButton()}</span></div>`;
    const banner = reviews && view !== 'review' && state && (state.phase === 'clue' || state.phase === 'reveal')
      ? `<button type="button" class="w-btn w-btn--sun w-btn--block" data-p-view="review">${UI.icon('list', 18)}${esc(t.reviewN(reviews))}</button>` : '';
    mount.innerHTML = `<div class="w-phone">${head}<div class="w-phone__body">${body}</div><div class="w-phone__foot">${banner}${foot || ''}</div></div>`;
    UI.tickTimers();
  }
  const actBtn = (b, opts = {}) => `<button type="button" class="w-btn${b.variant ? ` w-btn--${b.variant}` : ''}${opts.size ? ` w-btn--${opts.size}` : ''}${opts.block ? ' w-btn--block' : ''}" data-host-act="${esc(b.act)}">${b.icon ? UI.icon(b.icon, 18) : ''}${esc(b.label)}</button>`;

  // --- Lobby (02 invite + 03 lobby) ----------------------------------------------
  function pLobby() {
    const t = UI.t();
    const ps = room.members.filter((m) => !m.isHost);
    const body = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">${Setup.badges()}<button type="button" class="w-btn w-btn--ghost w-btn--sm" data-p-settings>${UI.icon('settings', 14)}${esc(t.edit)}</button></div>
      <div class="w-glass w-card" style="align-items:center;text-align:center"><span class="w-label">${esc(t.code)}</span><span class="w-code">${esc(room.code)}</span>
        <img src="/api/rooms/${encodeURIComponent(room.code)}/qr.svg" alt="QR" style="width:132px;height:132px;background:#fff;border-radius:14px;padding:6px;box-sizing:border-box">
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button type="button" class="w-btn w-btn--secondary w-btn--sm" data-p-invite>${UI.icon('share', 15)}${esc(t.shareInvite)}</button>
        <button type="button" class="w-btn w-btn--secondary w-btn--sm" data-p-cast>${UI.icon('tv', 15)}${esc(t.castTv)}</button></div></div>
      <span class="w-label">${esc(t.players)} · ${UI.d(ps.length)}</span>
      <div class="w-list">${ps.map((m, i) => `<div class="w-row-item"${m.connected ? '' : ' style="opacity:.55"'}>${UI.dot(m.displayName, i, 24)}<span class="grow" dir="auto">${esc(m.displayName)}</span><button type="button" class="w-x" data-p-kick="${esc(m.userId)}" data-name="${esc(m.displayName)}" aria-label="${esc(t.remove(m.displayName))}">${UI.icon('x', 16)}</button></div>`).join('') || `<p class="w-small w-muted">${esc(t.waitStart)}</p>`}</div>`;
    const foot = `<span class="w-small w-muted" style="text-align:center">${esc(t.minPlayers)}</span><button type="button" class="w-btn w-btn--lg w-btn--block start-btn" data-p-start${ps.length >= 2 ? '' : ' disabled'}>${UI.icon('play', 18)}${esc(t.start)}</button>`;
    frame(t.lobby, body, foot, { right: `<span class="w-mono" dir="ltr">${esc(room.code)}</span>` });
  }

  // --- Game -------------------------------------------------------------------
  function answerCard(x) {
    const t = UI.t();
    const a = x.answer || {};
    const name = UI.pick(a);
    const also = (a.aliases || []).filter((s) => s.toLowerCase() !== String(name).toLowerCase()).slice(0, 6);
    return `<div class="w-glass w-glass--light w-card"><span class="w-small" style="color:var(--mist-600);display:flex;gap:6px;align-items:center">${UI.icon('lock', 13)}${esc(t.hostOnly)}</span>
      <span class="w-h2" style="color:var(--night-900)" dir="auto">${esc(name)}</span>
      ${also.length ? `<span class="w-small" style="color:var(--mist-600)">${esc(t.alsoAccepted)}</span><div style="display:flex;flex-wrap:wrap;gap:6px">${also.map((s) => `<span class="w-badge" style="background:#fff;color:var(--night-900);border-color:var(--mist-200)" dir="auto">${esc(s)}</span>`).join('')}</div>` : ''}</div>`;
  }
  function allClues(x) {
    const t = UI.t();
    const list = (x.clues && x.clues[UI.isAr() ? 'ar' : 'en']) || [];
    return `<span class="w-label">${esc(t.clues)}</span><div style="display:flex;flex-direction:column;gap:6px">${list.map((c, i) => `<div style="display:flex;gap:10px;font:500 14px/1.4 var(--font-body);${i + 1 <= x.clue ? 'opacity:.55' : ''}"><span style="color:${UI.PT_COLORS[i]};font-weight:700;width:34px;flex:none">${UI.pts(UI.POINTS[i])}</span><span dir="auto">${esc(c)}</span></div>`).join('')}</div>`;
  }
  function feed(x) {
    const t = UI.t();
    const list = (x.guesses || []).slice().reverse().slice(0, 30);
    if (!list.length) return `<p class="w-small w-muted">${esc(t.noGuesses)}</p>`;
    const b = (g) => g.verdict === 'correct' ? UI.badge(t.correctPts(UI.POINTS[g.clue - 1]), 'correct') : g.verdict === 'review' ? UI.badge(t.review, 'review') : g.verdict === 'accepted' ? UI.badge(t.accepted, 'correct') : g.verdict === 'rejected' ? UI.badge(t.rejected, 'wrong') : UI.badge(t.wrong, 'wrong');
    return `<div class="w-list">${list.map((g) => `<div class="w-glass" style="padding:10px 12px;display:flex;flex-direction:column;gap:4px"><div class="w-row"><span class="w-small">${esc(t.atClue(g.name, g.clue))}</span>${b(g)}</div><span style="font:600 16px var(--font-body)" dir="auto">«${esc(g.text)}»</span></div>`).join('')}</div>`;
  }

  function pIntro(x) {
    const t = UI.t();
    const ctl = Host.controls(state);
    frame(t.roundOf(x.round + 1, x.total), `${answerCard(x)}${allClues(x)}`,
      `<button type="button" class="w-btn w-btn--lg w-btn--block" data-host-act="startClues">${UI.icon('eye', 18)}${esc(t.revealClue1)}</button>${ctl.filter((b) => b.act !== 'startClues').map((b) => actBtn(b, { block: true })).join('')}`);
  }

  function pClue(x) {
    const t = UI.t();
    const lang = UI.isAr() ? 'ar' : 'en';
    const current = ((x.clues && x.clues[lang]) || [])[x.clue - 1] || '';
    const solved = (x.status || []).filter((s) => s.state === 'solved').length;
    const timed = x.reveal === 'timed' && !x.closing;
    const ctl = Host.controls(state);
    const primary = ctl.find((b) => b.act === 'nextClue') || ctl.find((b) => b.act === 'revealAnswer');
    const others = ctl.filter((b) => b !== primary);
    const body = `${UI.clueCard(x.clue, current, 'current', { noAnim: true })}
      ${timed ? `<div class="w-row" style="justify-content:flex-start;gap:14px">${UI.ring(x.phaseEndsAt, x.seconds, { size: 56, paused: x.paused, remainingMs: x.remainingMs })}<span class="w-body">${x.paused ? esc(t.pause) : `<span data-wai-clock="${x.phaseEndsAt || 0}" data-fmt="next">${esc(t.nextIn(Math.max(0, ((x.phaseEndsAt || 0) - UI.now()) / 1000)))}</span>`}</span></div>` : ''}
      ${x.closing ? UI.badge(t.allSolved, 'correct') : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${others.map((b) => actBtn(b, { size: 'sm' })).join('')}</div>
      <div class="w-glass w-row" style="padding:10px 14px"><span class="w-label">${esc(t.solvedLbl)}</span><span style="font:700 18px var(--font-body);color:var(--c-mint)">${UI.d(solved)} / ${UI.d(players().length)}</span></div>
      <span class="w-label">${esc(t.guesses)}</span>${feed(x)}
      <details class="w-glass" style="padding:10px 12px"><summary class="w-label" style="cursor:pointer">${esc(t.answer)}</summary><div style="margin-top:10px;display:flex;flex-direction:column;gap:10px">${answerCard(x)}${allClues(x)}</div></details>`;
    frame(t.clueOf(x.clue), body, primary ? actBtn(primary, { size: 'lg', block: true }) : '', { right: UI.badge(t.ptsLbl(UI.POINTS[x.clue - 1]), 'sun') });
  }

  function pReview() {
    const t = UI.t();
    const x = data();
    const list = pending(state);
    if (!list.length) { view = 'main'; return render(); }
    const i = Math.min(reviewIndex, list.length - 1);
    const g = list[i];
    const body = `<div class="w-glass w-card"><span class="w-small">${esc(t.wroteAt(g.name, g.clue))}</span><span class="w-h1" style="font-size:28px" dir="auto">«${esc(g.text)}»</span>
        <div style="border-top:1px solid var(--border-glass);padding-top:10px;display:flex;flex-direction:column;gap:6px"><span class="w-small w-muted">${esc(t.answer)}</span><span class="w-h3" dir="auto">${esc(UI.pick(x.answer))}</span>${UI.badge(t.closeMatch, 'review')}</div></div>
      <p class="w-small">${esc(t.acceptGives(g.name, UI.POINTS[g.clue - 1]))}</p>`;
    const foot = `<button type="button" class="w-btn w-btn--lg w-btn--block" data-p-review="accept" data-id="${esc(g.id)}">${UI.icon('check', 18)}${esc(t.accept)}</button>
      <button type="button" class="w-btn w-btn--secondary w-btn--lg w-btn--block" data-p-review="reject" data-id="${esc(g.id)}">${UI.icon('x', 18)}${esc(t.reject)}</button>
      <button type="button" class="w-btn w-btn--ghost w-btn--block" data-p-view="main">${esc(t.back)}</button>`;
    frame(t.reviewTitle, body, foot, { right: `<span class="w-small">${esc(t.reviewOf(i + 1, list.length))}</span>` });
  }

  function pReveal(x) {
    const t = UI.t();
    const solvers = x.solvers || [];
    const missed = Math.max(0, players().length - solvers.length);
    const body = `<span class="w-h2" dir="auto">${esc(UI.pick(x.answer))}</span>
      <div class="w-list">${solvers.map((s) => `<div class="w-row-item"><span dir="auto">${esc(nameOf(s.userId))}</span><span class="w-small w-muted">${esc(t.clueShort(s.clue))}</span><span style="color:var(--c-sun);font-weight:700">${UI.plus(s.points)}</span></div>`).join('') || `<p class="w-small">${esc(t.nobodySolved)}</p>`}</div>
      ${missed ? `<span class="w-small w-muted">${esc(t.missed(missed))}</span>` : ''}`;
    frame(t.roundOver(x.round + 1), body, Host.controls(state).map((b) => actBtn(b, { size: 'lg', block: true })).join(''));
  }

  function pBoard(x) {
    const t = UI.t();
    const rows = UI.ranked(players(), x.scores);
    const body = `<div class="w-list">${rows.map((p) => `<div class="w-row-item"><span class="w-small w-muted" style="width:18px;flex:none">${UI.d(p.rank)}</span><span class="grow" dir="auto">${esc(p.name)}</span><span style="font-weight:700">${UI.pts(p.score)}</span></div>`).join('')}</div>`;
    const ctl = Host.controls(state);
    frame(t.leaderboard, body, ctl.map((b, i) => actBtn(b, { size: i ? undefined : 'lg', block: true })).join(''), { right: `<span class="w-small">${esc(t.doneOf(x.round + 1, x.total))}</span>` });
  }

  function pFinished(x) {
    const t = UI.t();
    if (view === 'next') {
      frame(t.whatNext, `<p class="w-body">${esc(t.samePlayers)}</p>`, Host.controls(state).map((b, i) => actBtn(b, { size: i ? undefined : 'lg', block: true })).join(''));
      return;
    }
    const rows = UI.ranked(players(), x.scores);
    const winners = rows.filter((p) => p.rank === 1 && p.score > 0);
    const guesses = (x.history || []).length;
    const body = `${winners.length ? `<div class="w-glass w-card" style="flex-direction:row;align-items:center;background:rgba(255,201,60,.14);border-color:rgba(255,201,60,.45)"><span style="color:var(--sun-400)">${UI.icon('crown', 22)}</span><span class="w-h3 grow" style="flex:1" dir="auto">${esc(winners.map((w) => w.name).join(UI.isAr() ? ' و' : ' & '))}</span><span style="font-weight:700;color:var(--c-sun)">${UI.pts(winners[0].score)}</span></div>` : ''}
      <span class="w-small w-muted">${esc(t.identitiesN(guesses))}</span>
      <div class="w-list">${rows.map((p) => `<div class="w-row-item"><span class="w-small w-muted" style="width:18px;flex:none">${UI.d(p.rank)}</span><span class="grow" dir="auto">${esc(p.name)}</span><span style="font-weight:700">${UI.pts(p.score)}</span></div>`).join('')}</div>`;
    frame(t.gameOver, body, `<button type="button" class="w-btn w-btn--lg w-btn--block" data-p-continue>${esc(t.cont)}</button>`);
  }

  function pPlayers() {
    const t = UI.t();
    const x = data();
    const off = players().filter((p) => !isOnline(p.userId));
    const body = `<div class="w-list">${players().map((p) => `<div class="w-row-item">${UI.dot(p.name, p.seat, 24)}<span class="grow" dir="auto">${esc(p.name)}</span><span class="w-small" style="color:${isOnline(p.userId) ? 'var(--c-mint)' : 'var(--c-hot)'}">${esc(isOnline(p.userId) ? t.online : t.offline)}</span><span class="w-small w-muted">${UI.pts((x.scores || {})[p.userId] || 0)}</span><button type="button" class="w-x" data-p-kick="${esc(p.userId)}" data-name="${esc(p.name)}" aria-label="${esc(t.remove(p.name))}">${UI.icon('userMinus', 16)}</button></div>`).join('')}</div>
      ${off.length ? `<p class="w-small">${esc(t.ptsKept(off[0].name))}</p>` : ''}
      <button type="button" class="w-switchrow" role="switch" aria-checked="${Boolean(x.hostOnTv)}" data-p-tv><span>${esc(t.hostOnTv)}<br><span class="w-small w-muted">${esc(t.hostOnTvSub)}</span></span><span class="w-switch${x.hostOnTv ? ' is-on' : ''}"></span></button>`;
    frame(t.players, body, off.length ? `<button type="button" class="w-btn w-btn--secondary w-btn--block" data-p-kick="${esc(off[0].userId)}" data-name="${esc(off[0].name)}">${UI.icon('userMinus', 16)}${esc(t.remove(off[0].name))}</button>` : '');
  }

  function notice(title, sub) {
    mount.innerHTML = `<div class="w-phone"><div class="w-phone__body w-phone__body--center">${UI.emblem(96)}<h1 class="w-h1">${esc(title)}</h1>${sub ? `<p class="w-body">${esc(sub)}</p>` : ''}</div></div>`;
  }

  function render() {
    if (!active || !room) return;
    const t = UI.t();
    if (room.status === 'ended') {
      mount.innerHTML = `<div class="w-phone"><div class="w-phone__body w-phone__body--center">${UI.emblem(96)}<h1 class="w-h1">${esc(t.ended)}</h1><a class="w-btn w-btn--lg" href="who-am-i.html">${esc(t.home)}</a></div></div>`;
      return;
    }
    if (room.status === 'lobby') return pLobby();
    if (offline) return notice(t.reconnecting, t.pausedNothing);
    if (!state) return notice(t.connecting, '');
    if (view === 'players') return pPlayers();
    if (view === 'review') return pReview();
    const x = data();
    switch (state.phase) {
      case 'intro': return pIntro(x);
      case 'clue': return pClue(x);
      case 'reveal': return pReveal(x);
      case 'board': return pBoard(x);
      case 'finished': return pFinished(x);
      default: return undefined;
    }
  }
})();
