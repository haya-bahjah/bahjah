// مين أنا؟ -- the player's phone (the wireframes' "Player phone" column),
// driven by the 'bahjah:game-state' events assets/lobby.js dispatches. Clues
// newest first, the guess box, the player's own tries, and their result.
(function () {
  const app = document.getElementById('app');
  if (!app) return;
  const UI = window.WaiUI;
  const esc = UI.esc;
  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();
  const myId = me ? me.id : '';

  let room = null;
  let state = null;
  let roomEnded = false;
  let offline = false;
  let wasOffline = false;
  let draft = '';
  let sending = false;
  let lastError = '';
  let errorsBound = false;

  document.addEventListener('bahjah:room-update', (e) => {
    room = e.detail;
    if (room.status === 'lobby') { location.href = `who-am-i-lobby.html?code=${encodeURIComponent(code)}`; return; }
    if (room.status === 'ended') roomEnded = true;
    render();
  });
  document.addEventListener('bahjah:game-state', (e) => {
    if (!e.detail || e.detail.gameType !== 'who-am-i') return;
    const before = state;
    state = e.detail;
    sending = false;
    document.body.classList.add('is-live');
    bind();
    const b = (before && before.data) || {};
    const n = state.data || {};
    if (before && (before.phase !== state.phase || b.round !== n.round)) { draft = ''; lastError = ''; window.scrollTo(0, 0); }
    if (before && state.phase === 'clue' && b.clue !== n.clue) { UI.sfx('click'); if (navigator.vibrate) navigator.vibrate(40); lastError = ''; }
    if (!b.mySolve && n.mySolve) { UI.sfx('correct'); if (navigator.vibrate) navigator.vibrate([60, 40, 90]); draft = ''; }
    const triesB = (b.myGuesses || []).length;
    const triesN = (n.myGuesses || []).length;
    if (triesN > triesB) {
      const g = n.myGuesses[triesN - 1];
      if (g.verdict === 'wrong') { lastError = UI.t().notIt; UI.sfx('wrong'); }
      else lastError = '';
      if (g.verdict !== 'correct') draft = '';
    }
    if (before && state.phase === 'reveal' && before.phase !== 'reveal') UI.sfx('reveal');
    if (state.phase === 'finished' && before && before.phase !== 'finished') UI.sfx('win');
    render();
  });
  document.addEventListener('bahjah:connection', (e) => {
    const s = e.detail && e.detail.state;
    const was = offline;
    offline = s === 'offline' || s === 'expired';
    if (offline) wasOffline = true;
    if (was && !offline && wasOffline && s === 'connected') { UI.toast(UI.t().reconnected, 'correct'); wasOffline = false; }
    render();
  });
  document.addEventListener('bahjah:lang-change', render);

  function bind() {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (errorsBound || !socket) return;
    errorsBound = true;
    socket.on('room:error', (err) => {
      sending = false;
      if (err && err.code === 'ROUND_LOCKED') { UI.toast(`${UI.t().roundLocked} — ${UI.t().lateGuess}`, 'wrong'); if (state && state.phase === 'clue') lastError = 'locked'; render(); return; }
      if (err && err.code === 'INVALID_PHASE') return;
      lastError = UI.errorText(err);
      render();
    });
    socket.on('room:removed', () => { location.href = 'who-am-i.html'; });
  }
  const socket = () => window.BahjahRoom && window.BahjahRoom.socket;
  const d = () => (state && state.data) || {};

  function submit() {
    const input = document.getElementById('w-guess');
    const text = ((input && input.value) || draft).trim();
    if (!text || sending) return;
    const s = socket();
    if (!s) return;
    sending = true;
    draft = text;
    s.emit('game:action', { action: { type: 'guess', text } });
    render();
  }
  app.addEventListener('submit', (e) => { if (e.target.id === 'w-form') { e.preventDefault(); submit(); } });
  app.addEventListener('input', (e) => { if (e.target.id === 'w-guess') { draft = e.target.value; if (lastError && lastError !== 'locked') { lastError = ''; const er = document.getElementById('w-guess-err'); if (er) er.textContent = ''; e.target.classList.remove('is-error'); } } });
  app.addEventListener('click', (e) => {
    if (e.target.closest('[data-share-mine]')) shareMine();
    if (e.target.closest('[data-leave]')) { const s = socket(); if (s) s.emit('room:leave'); setTimeout(() => { location.href = 'who-am-i.html'; }, 250); }
    if (e.target.closest('[data-retry]')) location.reload();
    if (e.target.closest('[data-try-another]')) { const i = document.getElementById('w-guess'); if (i) i.focus(); }
  });

  function rank() {
    const rows = UI.ranked(d().players || [], d().scores);
    const mine = rows.find((p) => p.userId === myId) || { rank: rows.length, score: 0 };
    return { rank: mine.rank, score: mine.score, tied: rows.filter((p) => p.score === mine.score).length > 1 };
  }
  function shareMine() {
    const t = UI.t();
    const r = rank();
    UI.shareOrCopy(t.shareText(UI.d((d().solvedCount || {})[myId] || 0), UI.d(d().total || 0), UI.d(r.rank), UI.pts(r.score)), `${location.origin}/who-am-i.html`);
  }

  // --- Frame ------------------------------------------------------------------
  function frame(body, opts = {}) {
    const p = (d().players || []).find((x) => x.userId === myId);
    const nm = (p && p.name) || (me && me.fullName) || '';
    const focused = document.activeElement && document.activeElement.id === 'w-guess';
    app.innerHTML = `<div class="w-phone"><div class="w-phone__head"><span class="w-label" dir="auto">${esc(nm)}</span><span style="display:flex;align-items:center;gap:8px">${opts.right || ''}${UI.soundButton()}${UI.emblem(32)}</span></div>
      <div class="w-phone__body${opts.center ? ' w-phone__body--center' : ''}">${body}</div>${opts.foot ? `<div class="w-phone__foot">${opts.foot}</div>` : ''}</div>`;
    const input = document.getElementById('w-guess');
    if (input) { input.value = draft; if (focused) { input.focus(); input.setSelectionRange(draft.length, draft.length); } }
    UI.tickTimers();
  }

  // --- Screens ----------------------------------------------------------------
  function sIntro(x) {
    const t = UI.t();
    frame(`<span class="w-eyebrow">${esc(t.roundOf(x.round + 1, x.total))}</span><span class="w-portrait__q" style="font-size:120px;color:var(--text-primary)">${t.q}</span>
      <h1 class="w-h1">${esc(t.getReady)}</h1><p class="w-body">${esc(t.clue1Worth)}</p>`, { center: true });
  }

  // The newest clue rises in once, not on every redraw.
  let animated = '';
  function cluesNewestFirst(x) {
    const key = `${x.round}:${x.clue}`;
    const fresh = key !== animated;
    animated = key;
    const list = (x.clues && x.clues[UI.isAr() ? 'ar' : 'en']) || [];
    const rows = [];
    for (let i = Math.min(x.clue, list.length); i >= 1; i -= 1) rows.push(UI.clueCard(i, list[i - 1], i === x.clue ? 'current' : 'revealed', { compact: i !== x.clue, noAnim: i !== x.clue || !fresh }));
    return `<div style="display:flex;flex-direction:column;gap:8px">${rows.join('')}</div>`;
  }

  function sClue(x) {
    const t = UI.t();
    const timer = x.reveal === 'timed' && !x.closing
      ? (x.paused ? UI.badge(t.pause) : `<span class="w-small" data-wai-clock="${x.phaseEndsAt || 0}">${esc(t.sShort(Math.max(0, ((x.phaseEndsAt || 0) - UI.now()) / 1000)))}</span>`)
      : '';
    const head = `<div class="w-row"><span class="w-eyebrow">${esc(t.clueOf(x.clue))}</span>${timer}</div>`;
    if (x.mySolve) {
      frame(`${head}<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center">
        <span style="width:76px;height:76px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:rgba(63,214,166,.16);border:1px solid rgba(63,214,166,.45);color:var(--c-mint)">${UI.icon('check', 36)}</span>
        <h1 class="w-h1">${esc(t.gotIt)}</h1><span class="w-display" style="color:var(--c-hot);font-size:60px">${UI.plus(x.mySolve.points)}</span>
        <span class="w-body">${esc(t.lockedAt(x.mySolve.clue))}</span><span class="w-small w-muted">${esc(t.keepIt)}</span></div>`);
      return;
    }
    const mine = x.myGuesses || [];
    const review = mine.filter((g) => g.verdict === 'review').pop();
    const tries = mine.filter((g) => g.verdict === 'wrong' || g.verdict === 'rejected');
    const reviewCard = review ? `<div class="w-glass w-card" style="align-items:center;text-align:center">
        <span style="width:52px;height:52px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,201,60,.16);color:var(--c-sun)">${UI.icon('hourglass', 24)}</span>
        <span class="w-h3">${esc(t.underReview)}</span><span style="font:600 16px var(--font-body)" dir="auto">«${esc(review.text)}»</span>
        <span class="w-small">${esc(t.heldPts(review.clue))}</span><button type="button" class="w-btn w-btn--ghost w-btn--sm" data-try-another>${esc(t.tryAnother)}</button></div>` : '';
    const triesRow = tries.length ? `<div class="w-field"><span class="w-label">${esc(t.yourTries)}</span><div style="display:flex;flex-wrap:wrap;gap:6px">${tries.slice(-6).map((g) => `<span class="w-badge w-badge--wrong" style="text-decoration:line-through" dir="auto">${esc(g.text)}</span>`).join('')}</div></div>` : '';
    const err = lastError && lastError !== 'locked' ? lastError : '';
    const locked = lastError === 'locked' ? `<div class="w-glass w-card" style="align-items:center;text-align:center">${UI.icon('lock', 22)}<span class="w-h3">${esc(t.roundLocked)}</span><span class="w-small">${esc(t.lateGuess)}</span></div>` : '';
    frame(`${head}<span class="w-h2" style="color:var(--c-hot)">${esc(t.ptsNow(UI.POINTS[x.clue - 1]))}</span>
      ${x.closing ? UI.badge(t.allSolved, 'correct') : ''}
      ${cluesNewestFirst(x)}${reviewCard}${triesRow}${locked}`, {
      foot: `<form id="w-form" class="w-field" autocomplete="off"><label class="w-label" for="w-guess">${esc(tries.length ? t.tryAgain : t.whoAmI)}</label>
        <input id="w-guess" class="w-input${err ? ' is-error' : ''}" maxlength="60" placeholder="${esc(t.typeName)}" dir="auto" enterkeyhint="send" autocapitalize="words" spellcheck="false">
        <span class="w-error" id="w-guess-err" role="status">${esc(err)}</span>
        <button type="submit" class="w-btn w-btn--lg w-btn--block"${sending ? ' disabled' : ''}>${UI.icon('send', 18)}${esc(t.submit)}</button></form>`,
    });
  }

  function sReveal(x) {
    const t = UI.t();
    const s = (x.solvers || []).find((p) => p.userId === myId);
    const total = (x.scores || {})[myId] || 0;
    frame(`<span class="w-eyebrow">${esc(t.iAm)}</span><h1 class="w-h1" dir="auto">${esc(UI.pick(x.answer))}</h1>
      ${s ? `<span class="w-display" style="color:var(--c-hot)">${UI.plus(s.points)}</span><span class="w-body">${esc(t.atClueLow(s.clue))}</span>`
        : `<span class="w-display" style="color:var(--text-muted)">${UI.d(0)}</span><span class="w-body">${esc(t.notThisTime)}</span>`}
      ${UI.badge(t.total(total))}`, { center: true });
  }

  function sBoard(x) {
    const t = UI.t();
    const r = rank();
    const delta = (x.delta || {})[myId];
    frame(`<span class="w-label">${esc(t.yourRank)}</span><span class="w-display" style="font-size:96px">${UI.d(r.rank)}</span>
      <span class="w-h3">${esc(t.ptsUnit(r.score))}</span>${delta ? UI.badge(t.thisRound(delta), 'sun') : ''}
      <span class="w-small w-muted">${esc(x.round + 1 >= x.total ? t.waitHost : t.nextSoon)}</span>`, { center: true });
  }

  function sFinished(x) {
    const t = UI.t();
    const r = rank();
    const solved = (x.solvedCount || {})[myId] || 0;
    frame(`<span class="w-label">${esc(t.finalPlace)}</span><span class="w-display" style="font-size:96px">${UI.d(r.rank)}</span>
      ${r.tied ? `<span class="w-small">${esc(t.tiedPlace)}</span>` : ''}<span class="w-h3">${esc(t.ptsUnit(r.score))}</span><span class="w-small w-muted">${esc(t.solvedOf(solved, x.total))}</span>
      <div class="w-card" style="width:100%;box-sizing:border-box;margin-top:8px;align-items:center;text-align:center;border-radius:24px;background:linear-gradient(160deg,#5E86FF,#2F5BFF 55%,#18288A);color:#fff;box-shadow:var(--shadow-glow)">
        ${UI.emblem(48)}<span class="w-h2" style="color:#fff">${esc(t.iSolved(solved, x.total))}</span><span class="w-small" style="color:rgba(255,255,255,.85)">${esc(t.placePts(r.rank, r.score))}</span><span class="w-small" style="color:rgba(255,255,255,.7)" dir="ltr">${esc(location.host)}</span></div>`, {
      center: true,
      foot: `<button type="button" class="w-btn w-btn--lg w-btn--block" data-share-mine>${UI.icon('share', 18)}${esc(t.shareBtn)}</button>
        ${roomEnded ? `<span class="w-small w-muted" style="text-align:center">${esc(t.ended)}</span>` : `<span class="w-small w-muted" style="text-align:center">${esc(t.waitDecision)}</span>`}
        <button type="button" class="w-btn w-btn--ghost w-btn--block" data-leave>${esc(t.leave)}</button>`,
    });
  }

  function notice(title, sub, opts = {}) {
    const t = UI.t();
    app.innerHTML = `<div class="w-phone"><div class="w-phone__body w-phone__body--center">${opts.ring ? UI.ring(0, 1, { size: 88, paused: true }) : UI.emblem(96)}
      <h1 class="w-h1">${esc(title)}</h1>${sub ? `<p class="w-body">${esc(sub)}</p>` : ''}
      ${opts.retry ? `<button type="button" class="w-btn w-btn--secondary" data-retry>${esc(t.tryAgain)}</button>` : ''}
      ${opts.home ? `<a class="w-btn w-btn--lg" href="who-am-i.html">${esc(t.home)}</a>` : ''}
      ${opts.leave ? `<button type="button" class="w-btn w-btn--ghost" data-leave>${esc(t.leave)}</button>` : ''}</div></div>`;
  }

  function render() {
    const t = UI.t();
    if (roomEnded && !(state && state.phase === 'finished')) return notice(t.ended, '', { home: true });
    if (offline) return notice(t.reconnecting, t.pausedNothing, { ring: true, retry: true });
    if (!state) return undefined;
    const x = d();
    if (x.removed) return notice(t.removedH, t.removedSub, { leave: true });
    if (!x.seated && state.phase !== 'finished') return notice(t.lateH, t.lateSub, { leave: true });
    if (state.phase === 'clue' && x.paused && x.autoPaused) return notice(t.reconnecting, t.pausedNothing, { ring: true });
    switch (state.phase) {
      case 'intro': return sIntro(x);
      case 'clue': return sClue(x);
      case 'reveal': return sReveal(x);
      case 'board': return sBoard(x);
      case 'finished': return sFinished(x);
      default: return undefined;
    }
  }
})();
