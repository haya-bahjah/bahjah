// مع أو ضد -- the big screen (the wireframes' "Host screen" column), mounted
// into #host-console on for-or-against-lobby.html, where the host's screen
// stays for the whole game when the host is not playing.
//
// 1280 x 720 stage, scaled to fit. The host's controls are the host bar along
// the bottom edge (assets/foa-host.js): it hides itself 4 seconds after the
// last touch, H toggles it, and any tap or mouse move brings it back.
(function () {
  const mount = document.getElementById('host-console');
  if (!mount) return;
  const UI = window.FoaUI;
  const Host = window.FoaHost;
  const esc = UI.esc;

  const gate = document.getElementById('lobby-gate');
  const main = document.getElementById('lobby-main');
  let room = null;
  let state = null;
  let socket = null;
  let active = false;
  let barHidden = false;
  let barTimer = null;
  let pinned = false; // H pressed: stays as set until H again

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    room = detail.room;
    socket = detail.socket;
    active = Boolean(room && room.status !== 'lobby' && detail.isHost && !room.hostPlays);
    if (!active) {
      mount.style.display = 'none';
      document.body.classList.remove('foa-tv-body');
      return;
    }
    if (gate) gate.style.display = 'none';
    if (main) main.style.display = 'none';
    mount.style.display = 'block';
    document.body.classList.add('foa-tv-body');
    render();
  });
  document.addEventListener('bahjah:game-state', (e) => {
    if (!e.detail || e.detail.gameType !== 'for-or-against') return;
    const before = state;
    state = e.detail;
    if (!active) return;
    cue(before, state);
    if (!before || before.phase !== state.phase) showBar();
    render();
  });
  document.addEventListener('bahjah:lang-change', () => { if (active) render(); });
  window.addEventListener('resize', () => { if (active) UI.fitStage(document.getElementById('hc-stage')); });

  function cue(before, next) {
    if (!before || before.phase === next.phase) return;
    if (next.phase === 'vote1' || next.phase === 'vote2') UI.sfx('click');
    else if (next.phase === 'debate') UI.sfx('riser');
    else if (next.phase === 'result' || next.phase === 'tie') UI.sfx('reveal');
    else if (next.phase === 'finished') UI.sfx('win');
  }

  // --- Host bar visibility ---------------------------------------------------
  function showBar() {
    if (pinned && barHidden) return;
    barHidden = false;
    applyBar();
    clearTimeout(barTimer);
    barTimer = setTimeout(() => { if (!pinned) { barHidden = true; applyBar(); } }, 4000);
  }
  function applyBar() {
    const bar = document.getElementById('hc-bar');
    if (bar) bar.classList.toggle('is-hidden', barHidden);
    const hint = document.getElementById('hc-hint');
    if (hint) hint.textContent = barHidden ? UI.t().show : UI.t().hide;
  }
  document.addEventListener('keydown', (e) => {
    if (!active || e.target.closest('input,textarea')) return;
    if (e.key === 'h' || e.key === 'H') {
      barHidden = !barHidden;
      pinned = barHidden;
      clearTimeout(barTimer);
      applyBar();
    }
  });
  mount.addEventListener('pointermove', () => { if (active && !pinned) showBar(); });
  mount.addEventListener('click', async (e) => {
    if (!active) return;
    if (e.target.closest('#hc-hint')) { barHidden = !barHidden; pinned = barHidden; applyBar(); return; }
    const b = e.target.closest('[data-host-act]');
    if (!b) { showBar(); return; }
    const r = await Host.run(b.dataset.hostAct, { state, room, socket, onShare: share });
    if (r === 'repaint') render();
    showBar();
  });

  function share() {
    const text = Host.resultsText(state);
    if (navigator.share) navigator.share({ title: 'مع أو ضد', text }).catch(() => {});
    else UI.copyText(text).then(() => UI.toast(UI.t().copied)).catch(() => {});
  }

  // --- Helpers -----------------------------------------------------------
  const data = () => (state && state.data) || {};
  const players = () => (data().players || []).filter((p) => !p.removed);
  const online = (id) => { const m = room && room.members.find((x) => x.userId === id); return Boolean(m && m.connected); };
  const teamMembers = (side) => players().filter((p) => (data().teams || {})[p.userId] === side).map((p) => ({ ...p, offline: !online(p.userId) }));
  const top = (phase) => `<div class="foa-tv__top">${UI.logo(96)}${UI.stepper(phase)}</div>`;
  const tokensRow = (voted) => `<div class="foa-tokens" style="gap:14px">${players().map((p) => UI.token(p.name, p.seat, { size: 56, voted: voted && voted.includes(p.userId), offline: !online(p.userId) })).join('')}</div>`;

  // --- Screens -------------------------------------------------------------
  function sStatement(d) {
    return `<div class="foa-tv__screen">${top(0)}
      <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:0 80px">${UI.statementCard(d.statement, d.index, d.total)}</div>
      <span class="foa-tv__deco" style="left:-60px;bottom:-60px;width:180px;height:180px;border-radius:50%;background:var(--blue-500)"></span>
      <span class="foa-tv__deco" style="left:120px;bottom:0;width:70px;height:40px;background:var(--red-500)"></span></div>`;
  }

  function sVote(d, round) {
    const t = UI.t();
    const voted = d.votedIds || [];
    return `<div class="foa-tv__screen">${top(round === 1 ? 1 : 4)}
      ${round === 2 ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:24px"><h1 class="foa-h1" style="font-size:72px">${esc(t.changed)}</h1><span class="foa-count">${UI.n2(voted.length)} / ${UI.n2(players().length)}</span></div>` : ''}
      ${UI.statementCard(d.statement, d.index, d.total, { size: 'md', noCat: true, sudden: d.sudden })}
      ${round === 1 ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:24px"><div><h2 class="foa-h1" style="font-size:44px">${esc(t.voteOnPhone)}</h2><p class="foa-sub">${esc(t.hiddenVotes)}</p></div><span class="foa-count">${UI.n2(voted.length)} / ${UI.n2(players().length)}</span></div>` : ''}
      ${tokensRow(voted)}</div>`;
  }

  function sTeams(d) {
    const t = UI.t();
    const f = teamMembers('for');
    const a = teamMembers('against');
    const abst = players().filter((p) => !(d.teams || {})[p.userId]).map((p) => p.name);
    const abstLine = abst.length ? `<span class="foa-sub" dir="auto">${esc(t.abstained)} ${esc(abst.join(UI.isAr() ? '، ' : ', '))}</span>` : '';
    const time = UI.fmt(d.sudden ? 60 : d.sideSeconds);
    if (!f.length && !a.length) {
      return `<div class="foa-tv__screen">${top(2)}<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px"><h1 class="foa-h1" style="font-size:72px">${esc(t.noVotes)}</h1><p class="foa-sub" style="font-size:24px">${esc(t.nobodyVoted)}</p></div></div>`;
    }
    if (!f.length || !a.length) {
      const side = f.length ? 'for' : 'against';
      const other = side === 'for' ? 'against' : 'for';
      return `<div class="foa-tv__screen">${top(2)}
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:24px"><h1 class="foa-h1" style="font-size:64px">${esc(t.everyoneIs(UI.sideWord(side)))}</h1>${abstLine}</div>
        <div style="flex:1;display:flex;gap:28px;min-height:0">${UI.teamPanel(side, side === 'for' ? f : a, { active: true })}
          <div class="foa-team is-dashed" style="align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px">${UI.shape(other === 'for' ? 'circle' : 'square', other === 'for' ? 'var(--side-for)' : 'var(--side-against)', 56)}<span class="foa-h2">${esc(t.nobodyIs(UI.sideWord(other)))}</span><span class="foa-sub">${esc(t.willSkip(UI.teamName(other)))}</span></div></div></div>`;
    }
    return `<div class="foa-tv__screen">${top(2)}
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:24px"><h1 class="foa-h1" style="font-size:64px">${esc(t.split)}</h1>${abstLine}</div>
      <div style="flex:1;display:flex;gap:28px;min-height:0">${UI.teamPanel('for', f)}${UI.teamPanel('against', a)}</div>
      <span class="foa-h2" style="font-size:24px">${esc(t.startsFirst(UI.teamName('for'), time))}</span></div>`;
  }

  function sDebate(d) {
    const t = UI.t();
    const f = teamMembers('for');
    const a = teamMembers('against');
    const total = d.turnSeconds || d.sideSeconds;
    const timer = UI.timer(d.phaseEndsAt, total, { side: d.side, size: 'lg', label: t.arguing(UI.teamName(d.side)), paused: d.paused, remainingMs: d.remainingMs });
    const nextCap = d.nextSide ? `NEXT · ${d.nextSide === 'against' ? 'AGAINST' : 'FOR'} ${UI.fmt(total)}` : 'NEXT · FINAL VOTE';
    const panels = `<div style="flex:1;display:flex;flex-direction:column;gap:20px;min-width:0">${UI.teamPanel('for', f, { active: d.side === 'for', muted: d.side !== 'for' })}${UI.teamPanel('against', a, { active: d.side === 'against', muted: d.side !== 'against' })}</div>`;
    const timerCol = `<div style="width:460px;flex:none;display:flex;flex-direction:column;gap:12px">${timer}<span class="foa-mono" style="font-size:13px;text-align:end">${esc(nextCap)}</span></div>`;
    // The speaking side's clock sits on its own side: For leads, Against trails.
    const row = d.side === 'for' ? timerCol + panels : panels + timerCol;
    const slab = d.paused ? `<div class="foa-paused-slab"><div><span class="foa-h1" style="font-size:80px">${esc(t.paused)}</span><span class="foa-count" style="font-size:40px">${UI.fmt((d.remainingMs || 0) / 1000)}</span></div></div>` : '';
    return `<div class="foa-tv__screen">${top(3)}
      <h2 class="foa-h2" style="font-size:30px" dir="auto">${d.sudden ? `${UI.badge(esc(t.suddenTag), 'ink')} ` : ''}${esc(UI.statementText(d.statement))}</h2>
      <div style="flex:1;display:flex;gap:28px;min-height:0">${row}</div></div>${slab}`;
  }

  function sResult(d) {
    const t = UI.t();
    const r = d.result || { outcome: 'none', before: { for: 0, against: 0 }, after: { for: 0, against: 0 }, switched: 0 };
    const won = r.outcome === 'for' || r.outcome === 'against';
    const field = won ? (r.outcome === 'for' ? 'var(--side-for)' : 'var(--side-against)') : 'var(--yellow-500)';
    const ink = won ? 'var(--paper)' : 'var(--ink)';
    const head = won ? t.wins(UI.sideWord(r.outcome)) : r.outcome === 'tie' ? t.noWinnerRes : t.noResult;
    return `<div class="foa-tv__screen" style="padding:0;flex-direction:row;gap:0">
      <div style="width:400px;flex:none;padding:40px 36px;display:flex;flex-direction:column;gap:18px;border-inline-end:6px solid var(--ink);background:var(--paper)">
        <h2 class="foa-h2" style="font-size:30px">${esc(t.whatChanged)}</h2>
        <div style="border-top:3px solid var(--ink);padding-top:14px;display:flex;flex-direction:column;gap:12px;font:600 20px var(--font-body)">
          <div style="display:flex;justify-content:space-between"><span>${esc(t.before)}</span><span class="foa-mono" dir="ltr">${r.before.for} : ${r.before.against}</span></div>
          <div style="display:flex;justify-content:space-between"><span>${esc(t.after)}</span><span class="foa-mono" dir="ltr">${r.after.for} : ${r.after.against}</span></div>
          <div style="display:flex;justify-content:space-between"><span>${esc(t.changedMind)}</span><span class="foa-mono" dir="ltr">${UI.n2(r.switched)}</span></div>
        </div>
        <div style="flex:1"></div>
        ${won ? `<div style="background:var(--yellow-500);border:3px solid var(--ink);padding:14px 16px;font:700 20px var(--font-body)">${esc(t.pointFor(UI.sideWord(r.outcome)))}</div>` : ''}
      </div>
      <div style="flex:1;position:relative;overflow:hidden;background:${field};color:${ink};padding:40px 48px;display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;justify-content:flex-end">${UI.logo(120)}</div>
        <span class="foa-h2" style="font-size:28px">${esc(t.verdict)}${r.suddenDeath ? ` · ${esc(t.suddenTag)}` : ''}</span>
        <span class="foa-big" style="font-size:120px">${esc(head)}</span>
        <span class="foa-sub" style="font-size:24px" dir="auto">${esc(UI.statementText(d.statement))}</span>
        <div style="flex:1"></div>
        <div style="width:420px;align-self:flex-end;position:relative;z-index:1">${UI.meter(r.after.for, r.after.against, 56)}</div>
        <span class="foa-tv__deco" style="left:-100px;bottom:-140px;width:360px;height:360px;border-radius:50%;background:var(--paper);opacity:${won ? 1 : 0}"></span>
      </div></div>`;
  }

  function sTie(d) {
    const t = UI.t();
    const c = d.tie || { for: 0, against: 0 };
    return `<div class="foa-tv__screen" style="background:var(--yellow-500)">${top(5)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px">
        <span class="foa-big" style="font-size:150px">${esc(t.tie)}</span>
        <div style="max-width:720px">${UI.meter(c.for, c.against, 64)}</div>
        <p class="foa-sub" style="font-size:26px;font-weight:600">${esc(t.tieBody)}</p>
        <span class="foa-count" style="font-size:56px">01:00</span>
      </div></div>`;
  }

  function sFinished(d) {
    const t = UI.t();
    const ps = players().map((p) => ({ ...p, pts: (d.scores || {})[p.userId] || 0 })).sort((a, b) => b.pts - a.pts);
    const max = Math.max(1, ...ps.map((p) => p.pts));
    let rank = 0, last = null;
    const rows = ps.slice(0, 8).map((p, i) => {
      if (p.pts !== last) { rank = i + 1; last = p.pts; }
      return `<div style="display:flex;align-items:center;gap:16px;border-bottom:3px solid var(--ink);padding:8px 0">
        <span class="foa-mono" style="font-size:22px;width:44px" dir="ltr">${UI.n2(rank)}</span>
        ${UI.token(p.name, p.seat, { size: 40, showName: false })}
        <span style="font:700 22px var(--font-body);width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" dir="auto">${esc(p.name)}</span>
        <span style="flex:1;height:22px;border:3px solid var(--ink);background:var(--white);display:flex"><span style="width:${(p.pts / max) * 100}%;background:var(--ink)"></span></span>
        <span class="foa-mono" style="font-size:22px;width:44px;text-align:end" dir="ltr">${UI.n2(p.pts)}</span></div>`;
    }).join('');
    const mark = (o) => o === 'for' ? UI.shape('circle', 'var(--side-for)', 18) : o === 'against' ? UI.shape('square', 'var(--side-against)', 18) : o === 'tie' ? UI.shape('triangle', 'var(--yellow-500)', 16) : `<span style="width:18px;height:18px;border:2px solid var(--paper);flex:none"></span>`;
    const list = (d.results || []).map((r) => {
      const tag = r.outcome === 'tie' ? ` ${t.tieTag}` : r.outcome === 'skipped' ? ` ${t.skipped}` : r.outcome === 'none' ? ` ${t.noneTag}` : '';
      const text = (d.statement && d.statement.mine) || !UI.isAr() ? (UI.isAr() ? r.ar : r.en) : r.ar;
      return `<div style="display:flex;align-items:center;gap:12px;font:500 17px/1.4 var(--font-body)">${mark(r.outcome)}<span dir="auto">${esc((UI.isAr() ? r.ar : r.en) || text)}${esc(tag)}</span></div>`;
    }).join('');
    return `<div class="foa-tv__screen" style="padding:0;flex-direction:row;gap:0">
      <div style="flex:1;padding:40px 48px 90px;display:flex;flex-direction:column;gap:18px;min-width:0">
        <div style="display:flex;align-items:center;gap:20px">${UI.logo(110)}<h1 class="foa-h1" style="font-size:72px">${esc(t.gameOver)}</h1></div>
        <div style="border-top:3px solid var(--ink)">${rows}</div></div>
      <div style="width:440px;flex:none;background:var(--ink);color:var(--paper);padding:40px 32px 90px;display:flex;flex-direction:column;gap:14px;overflow:hidden">
        <h2 class="foa-h2" style="font-size:28px">${esc(t.statements)}</h2>${list}
        ${d.unplayed ? `<div style="display:flex;align-items:center;gap:12px;font:500 17px var(--font-body);opacity:.6">${mark('none')}<span>${esc(t.notPlayed(d.unplayed))}</span></div>` : ''}
      </div></div>`;
  }

  function sEnded() {
    const t = UI.t();
    return `<div class="foa-tv__screen" style="align-items:center;justify-content:center">${UI.logo(420)}<h1 class="foa-h1" style="font-size:44px">${esc(t.ended)}</h1><a class="foa-btn foa-btn--accent foa-btn--lg" href="for-or-against.html">${esc(t.home)}</a></div>`;
  }

  function render() {
    const d = data();
    let body;
    if (room && room.status === 'ended') body = sEnded();
    else if (!state) body = `<div class="foa-tv__screen" style="align-items:center;justify-content:center">${UI.logo(420)}<span class="foa-h2">${esc(UI.t().connecting)}</span></div>`;
    else if (state.phase === 'statement') body = sStatement(d);
    else if (state.phase === 'vote1') body = sVote(d, 1);
    else if (state.phase === 'vote2') body = sVote(d, 2);
    else if (state.phase === 'teams') body = sTeams(d);
    else if (state.phase === 'debate') body = sDebate(d);
    else if (state.phase === 'result') body = sResult(d);
    else if (state.phase === 'tie') body = sTie(d);
    else if (state.phase === 'finished') body = sFinished(d);
    else body = '';

    let bar = '';
    let banner = '';
    if (state && !(room && room.status === 'ended')) {
      const c = Host.controls(state, room);
      bar = `<div class="foa-hostbar${barHidden ? ' is-hidden' : ''}" id="hc-bar"><span class="foa-hostbar__tag">${esc(UI.t().host)}</span><span class="foa-hostbar__status">${c.status}</span>
        <span class="foa-hostbar__actions">${UI.soundButton()}${c.buttons.map((b) => Host.buttonHtml(b)).join('')}<button type="button" class="foa-hostbar__hint" id="hc-hint">${esc(barHidden ? UI.t().show : UI.t().hide)}</button></span></div>`;
      if (c.offline) banner = `<div class="foa-banner" style="bottom:${barHidden ? 0 : 66}px"><span dir="auto">${esc(UI.t().offlineBanner(c.offline.name))}</span><span class="foa-mono">RECONNECTING</span></div>`;
    }
    mount.innerHTML = `<div class="foa-tv-frame"><div class="foa-tv" id="hc-stage">${body}${banner}${bar}</div></div>`;
    UI.fitStage(document.getElementById('hc-stage'));
    UI.tickTimers();
  }
})();
