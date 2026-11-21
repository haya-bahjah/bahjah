// مع أو ضد -- the player's phone (the wireframes' "Player phone" column),
// driven by the 'bahjah:game-state' events assets/lobby.js dispatches. When
// the host plays too, the host is here with everybody else and their
// controls (assets/foa-host.js) sit under their own screen.
(function () {
  const app = document.getElementById('app');
  if (!app) return;
  const UI = window.FoaUI;
  const Host = window.FoaHost;
  const esc = UI.esc;
  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();
  const myId = me ? me.id : '';

  let room = null;
  let state = null;
  let roomEnded = false;
  let offline = false;
  let pendingVote = null;
  let errorsBound = false;

  document.addEventListener('bahjah:room-update', (e) => {
    room = e.detail;
    if (room.status === 'lobby') { location.href = `for-or-against-lobby.html?code=${encodeURIComponent(code)}`; return; }
    if (room.status === 'ended') roomEnded = true;
    render();
  });
  document.addEventListener('bahjah:game-state', (e) => {
    if (!e.detail || e.detail.gameType !== 'for-or-against') return;
    const before = state;
    state = e.detail;
    pendingVote = null;
    document.body.classList.add('is-live');
    bind();
    if (before && before.phase !== state.phase) {
      if (state.phase === 'vote1' || state.phase === 'vote2') { UI.sfx('click'); if (navigator.vibrate) navigator.vibrate(60); }
      if (state.phase === 'result') UI.sfx((state.data.winners || []).includes(myId) ? 'correct' : 'reveal');
      if (state.phase === 'finished') UI.sfx('win');
    }
    render();
  });
  document.addEventListener('bahjah:connection', (e) => {
    const s = e.detail && e.detail.state;
    offline = s === 'offline' || s === 'expired';
    render();
  });
  document.addEventListener('bahjah:lang-change', render);

  function bind() {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (errorsBound || !socket) return;
    errorsBound = true;
    socket.on('room:error', (err) => {
      pendingVote = null;
      if (['INVALID_PHASE'].includes(err.code)) return;
      UI.toast(UI.errorText(err));
      render();
    });
    socket.on('room:removed', () => { location.href = 'for-or-against.html'; });
  }
  const socket = () => window.BahjahRoom && window.BahjahRoom.socket;
  const send = (action) => { const s = socket(); if (s) s.emit('game:action', { action }); };

  const d = () => (state && state.data) || {};
  const isHost = () => Boolean(room && room.members.some((m) => m.userId === myId && m.isHost));
  const hostRuns = () => isHost() && d().hostPlays;
  const myPlayer = () => (d().players || []).find((p) => p.userId === myId);
  const nameOf = (id) => ((d().players || []).find((p) => p.userId === id) || {}).name || '';

  app.addEventListener('click', async (e) => {
    const v = e.target.closest('[data-vote]');
    if (v && !v.disabled) {
      pendingVote = v.dataset.vote;
      send({ type: 'vote', side: v.dataset.vote });
      render();
      return;
    }
    const h = e.target.closest('[data-host-act]');
    if (h) {
      const r = await Host.run(h.dataset.hostAct, { state, room, socket: socket(), onShare: shareResults });
      if (r === 'repaint') render();
      return;
    }
    if (e.target.closest('[data-share-mine]')) shareMine();
    if (e.target.closest('[data-leave]')) { const s = socket(); if (s && !isHost()) s.emit('room:leave'); setTimeout(() => { location.href = 'for-or-against.html'; }, 250); }
    if (e.target.closest('[data-retry]')) location.reload();
  });

  function shareResults() {
    const text = Host.resultsText(state);
    if (navigator.share) navigator.share({ title: 'مع أو ضد', text }).catch(() => {});
    else UI.copyText(text).then(() => UI.toast(UI.t().copied)).catch(() => {});
  }
  function shareMine() {
    const t = UI.t();
    const r = rankOf();
    const text = `${t.shareText(UI.n2(r.rank), r.pts)}\n${location.origin}/for-or-against.html`;
    if (navigator.share) navigator.share({ title: 'مع أو ضد', text }).catch(() => {});
    else UI.copyText(text).then(() => UI.toast(t.copied)).catch(() => {});
  }
  function rankOf() {
    const ps = (d().players || []).filter((p) => !p.removed).map((p) => ({ id: p.userId, pts: (d().scores || {})[p.userId] || 0 })).sort((a, b) => b.pts - a.pts);
    const mine = ps.find((p) => p.id === myId) || { pts: 0 };
    return { rank: ps.filter((p) => p.pts > mine.pts).length + 1, pts: mine.pts };
  }

  // --- Frame ---------------------------------------------------------------
  function frame(body, opts = {}) {
    const p = myPlayer();
    const nm = (p && p.name) || (me && me.fullName) || '';
    let hostCard = '';
    if (hostRuns() && state) {
      const c = Host.controls(state, room);
      const waiting = (state.phase === 'vote1' || state.phase === 'vote2')
        ? (d().players || []).filter((x) => !x.removed && !(d().votedIds || []).includes(x.userId)).map((x) => x.name)
        : [];
      hostCard = `<div class="foa-hostcard"><div class="foa-hostcard__title"><span class="foa-hostbar__tag">${esc(UI.t().host)}</span><span>${c.status}</span></div>
        ${waiting.length ? `<span class="foa-small" style="color:var(--ink-3)">${esc(UI.t().waitingFor)}: <span dir="auto">${esc(waiting.join(UI.isAr() ? '، ' : ', '))}</span></span>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:8px">${c.buttons.map((b) => Host.buttonHtml(b, 'sm')).join('')}</div></div>`;
    }
    app.innerHTML = `<div class="foa-phone${opts.tone ? ` foa-phone--${opts.tone}` : ''}">
      <div class="foa-phone__head" style="${opts.tone ? 'background:var(--paper);color:var(--ink)' : ''}"><span class="foa-phone__name" dir="auto">${esc(nm)}</span><span style="display:flex;align-items:center;gap:8px">${UI.soundButton()}${UI.logo(80)}</span></div>
      ${opts.strip ? `<div style="height:14px;background:${opts.strip};border-bottom:3px solid var(--ink)"></div>` : ''}
      <div class="foa-phone__body${opts.center ? ' foa-phone__body--center' : ''}">${body}</div>
      ${hostCard || opts.foot ? `<div class="foa-phone__foot">${opts.foot || ''}${hostCard}</div>` : ''}</div>`;
    UI.tickTimers();
  }

  // --- Screens ---------------------------------------------------------------
  function sStatement() {
    const x = d();
    frame(`<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px">${UI.statementCard(x.statement, x.index, x.total, { size: 'sm' })}<p class="foa-sub" style="text-align:center">${esc(UI.t().thinkIt)}</p></div>`);
  }

  function sVote(round) {
    const t = UI.t();
    const x = d();
    const mine = pendingVote || x.myVote;
    const locked = round === 2 && x.myLocked;
    let note = '';
    if (round === 1) note = mine ? t.picked(UI.sideWord(mine)) : t.abstainNote;
    else if (locked) note = t.lockedNote;
    else if (mine && x.myFirst && mine !== x.myFirst) note = t.switchedTo(UI.sideWord(mine));
    const first = round === 2 && x.myFirst ? `<div style="display:flex;align-items:center;gap:8px"><span class="foa-small" style="color:var(--ink)">${esc(t.firstPicked)}</span><span class="foa-badge" style="background:${x.myFirst === 'for' ? 'var(--side-for)' : 'var(--side-against)'};color:var(--white)">${esc(UI.sideWord(x.myFirst))}</span></div>` : '';
    const top = round === 2 ? `<h1 class="foa-h1">${esc(t.voteAgain)}</h1>${first}` : UI.statementCard(x.statement, x.index, x.total, { size: 'sm', noCat: true });
    const closed = x.closing;
    frame(`${top}
      <div style="display:flex;flex-direction:column;gap:16px">
        ${UI.voteButton('for', { selected: mine === 'for', dimmed: Boolean(mine) && mine !== 'for', disabled: closed || (locked && mine !== 'for') })}
        ${UI.voteButton('against', { selected: mine === 'against', dimmed: Boolean(mine) && mine !== 'against', disabled: closed || (locked && mine !== 'against') })}
      </div>
      <p class="foa-small" style="text-align:center;color:var(--ink)">${esc(closed ? t.allIn : note)}</p>`);
  }

  function sTeams() {
    const t = UI.t();
    const x = d();
    const side = (x.teams || {})[myId];
    if (!side) {
      frame(`<h1 class="foa-h1">${esc(t.abstained)}</h1><p class="foa-sub">${esc(t.abstainedYou)}</p>`, { center: true });
      return;
    }
    const mates = (x.players || []).filter((p) => p.userId !== myId && (x.teams || {})[p.userId] === side).map((p) => p.name);
    const nFor = Object.values(x.teams || {}).filter((s) => s === 'for').length;
    const first = side === 'for' || nFor === 0;
    frame(`<div style="display:flex;flex-direction:column;gap:12px;flex:1;justify-content:center">
      <span class="foa-h2">${esc(t.onTeam)}</span>
      <span class="foa-big">${esc(UI.sideWord(side))}</span>
      ${mates.length ? `<span class="foa-sub" dir="auto">${esc(t.withYou)} ${esc(mates.join(UI.isAr() ? '، ' : ', '))}</span>` : ''}
      <strong class="foa-sub" style="font-weight:700">${esc(first ? t.goesFirst : t.goesSecond)}</strong></div>`, { tone: side });
  }

  function sDebate() {
    const t = UI.t();
    const x = d();
    const total = x.turnSeconds || x.sideSeconds;
    if (x.paused) {
      frame(`<div style="display:flex;gap:14px"><span style="width:26px;height:90px;background:var(--ink)"></span><span style="width:26px;height:90px;background:var(--ink)"></span></div>
        <h1 class="foa-h1">${esc(t.paused)}</h1><p class="foa-sub">${esc(t.pausedBody(UI.fmt((x.remainingMs || 0) / 1000)))}</p>`, { center: true });
      return;
    }
    const mySide = (x.teams || {})[myId];
    const timer = UI.timer(x.phaseEndsAt, total, { side: mySide === x.side ? 'neutral' : x.side, size: 'sm' });
    if (mySide && mySide === x.side) {
      frame(`<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px"><h1 class="foa-big" style="font-size:72px;font-family:var(--font-body)">${esc(t.yourTurn)}</h1>
        <p class="foa-sub">${esc(t.argue(UI.sideWord(x.side)))}</p></div>${timer}`, { tone: x.side });
      return;
    }
    frame(`<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px"><h1 class="foa-h1">${esc(t.theirTurn(UI.teamName(x.side)))}</h1>
      <p class="foa-sub">${esc(t.listen)}</p><p class="foa-small" dir="auto">${esc(UI.statementText(x.statement))}</p></div>${timer}`, { strip: x.side === 'for' ? 'var(--side-for)' : 'var(--side-against)' });
  }

  function sResult() {
    const t = UI.t();
    const x = d();
    const r = x.result || { outcome: 'none' };
    const won = r.outcome === 'for' || r.outcome === 'against';
    const mine = x.myFinal;
    let msg;
    if (!won) msg = r.outcome === 'tie' ? t.noWinnerRes : t.noResult;
    else if (!mine) msg = t.youAbstained;
    else msg = mine === r.outcome ? t.youWon(UI.sideWord(mine)) : t.youLost(UI.sideWord(mine));
    const head = won ? t.wins(UI.sideWord(r.outcome)) : r.outcome === 'tie' ? t.tie : t.noResult;
    const block = won ? (r.outcome === 'for' ? 'var(--side-for)' : 'var(--side-against)') : 'var(--yellow-500)';
    frame(`<div style="margin:-20px -20px 0;background:${block};color:${won ? 'var(--white)' : 'var(--ink)'};border-bottom:3px solid var(--ink);padding:56px 20px 20px"><span class="foa-h1" style="font-size:44px">${esc(head)}</span></div>
      <p class="foa-sub">${esc(msg)}</p>
      <div style="border-top:3px solid var(--ink);padding-top:14px;display:flex;align-items:center;justify-content:space-between"><span class="foa-h2" style="font-size:18px">${esc(t.yourPoints)}</span><span class="foa-count" style="font-size:44px">${UI.n2((x.scores || {})[myId] || 0)}</span></div>
      <div style="flex:1"></div><p class="foa-small" style="text-align:center">${esc(t.waitNext)}</p>`);
  }

  function sTie() {
    const t = UI.t();
    frame(`<span class="foa-big">${esc(t.tie)}</span><p class="foa-sub">${esc(t.tiePhone)}</p><span class="foa-count" style="font-size:40px">01:00</span>`, { tone: 'neutral', center: true });
  }

  function sFinished() {
    const t = UI.t();
    const x = d();
    const r = rankOf();
    frame(`<span class="foa-h2">${esc(t.yourRank)}</span><span class="foa-count" style="font-size:150px">${UI.n2(r.rank)}</span>
      <p class="foa-sub">${esc(t.pointsLine(UI.n2(r.pts), (x.switchedCount || {})[myId] || 0))}</p>`, {
      center: true,
      foot: `<button type="button" class="foa-btn foa-btn--accent foa-btn--lg foa-btn--block" data-share-mine>${esc(t.shareYours)}</button>${hostRuns() ? '' : `<button type="button" class="foa-btn foa-btn--ghost foa-btn--md foa-btn--block" data-leave>${esc(t.leave)}</button>`}`,
    });
  }

  function notice(title, sub, opts = {}) {
    const t = UI.t();
    app.innerHTML = `<div class="foa-phone"><div class="foa-phone__head"><span></span>${UI.logo(80)}</div>
      <div class="foa-phone__body foa-phone__body--center">${opts.shapes ? `<div style="display:flex;gap:10px">${UI.shape('square', 'var(--bone)', 36)}${UI.shape('square', 'var(--bone)', 36)}${UI.shape('circle', 'var(--side-for)', 36)}</div>` : UI.logo(220)}
      <h1 class="foa-h1">${esc(title)}</h1><p class="foa-sub">${esc(sub)}</p>
      ${opts.retry ? `<button type="button" class="foa-btn foa-btn--secondary foa-btn--md" data-retry>${esc(t.tryAgain)}</button>` : ''}
      ${opts.home ? `<a class="foa-btn foa-btn--accent foa-btn--lg" href="for-or-against.html">${esc(t.home)}</a>` : ''}
      ${opts.leave ? `<button type="button" class="foa-btn foa-btn--ghost foa-btn--md" data-leave>${esc(t.leave)}</button>` : ''}</div></div>`;
  }

  function render() {
    const t = UI.t();
    if (roomEnded && !(state && state.phase === 'finished')) return notice(t.ended, '', { home: true });
    if (offline) return notice(t.reconnecting, t.keepOpen, { shapes: true, retry: true });
    if (!state) return;
    const x = d();
    if (x.removed) return notice(t.removedH, t.removedSub, { leave: true });
    if (!x.seated && state.phase !== 'finished') return notice(t.lateH, t.lateSub, { leave: true });
    switch (state.phase) {
      case 'statement': return sStatement();
      case 'vote1': return sVote(1);
      case 'vote2': return sVote(2);
      case 'teams': return sTeams();
      case 'debate': return sDebate();
      case 'result': return sResult();
      case 'tie': return sTie();
      case 'finished': return sFinished();
      default: return undefined;
    }
  }
})();
