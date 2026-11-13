// تخاريف · Malarkey -- the big screen (the design's "Main screen" frames).
// Mounted into #host-console on malarkey-lobby.html, where the host's screen
// stays for the whole game when the host is not playing.
//
// Drawn on an 800 x 450 stage scaled to the display, so every size in the
// design stays where it is. The design has no buttons on the main screen --
// in its prototype the host also held a phone -- but here the host's screen
// IS the big screen, so the host's controls (Next story, Play again, End
// room, and moving a stuck round on) sit quietly in its corners.
(function () {
  const mount = document.getElementById('host-console');
  if (!mount) return;
  const UI = window.MkUI;
  const esc = UI.esc;

  const gate = document.getElementById('lobby-gate');
  const main = document.getElementById('lobby-main');

  let room = null;
  let state = null;
  let socket = null;
  let active = false;
  let confirming = null; // 'end' | 'advance'
  let confirmTimer = null;
  let ending = false;
  // The reveal line already drawn, so only a new bubble stamps itself in.
  let shownLine = '';

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    room = detail.room;
    socket = detail.socket;
    active = Boolean(room && room.status !== 'lobby' && detail.isHost && !room.hostPlays);
    if (!active) {
      mount.style.display = 'none';
      document.body.classList.remove('mk-tv-body');
      return;
    }
    if (gate) gate.style.display = 'none';
    if (main) main.style.display = 'none';
    mount.style.display = 'block';
    document.body.classList.add('mk-tv-body');
    render();
  });

  document.addEventListener('bahjah:game-state', (e) => {
    if (!e.detail || e.detail.gameType !== 'malarkey') return;
    state = e.detail;
    if (active) render();
  });
  document.addEventListener('bahjah:lang-change', () => { if (active) render(); });
  window.addEventListener('resize', () => { if (active) UI.fitTv(document.getElementById('hc-stage')); });

  function send(action) {
    if (socket) socket.emit('game:action', { action });
  }

  function arm(kind) {
    confirming = kind;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => { confirming = null; if (active) render(); }, 3500);
    render();
  }

  mount.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-hc]');
    if (!btn || btn.disabled) return;
    const what = btn.dataset.hc;
    if (what === 'next') send({ type: 'next' });
    if (what === 'again' && socket) socket.emit('room:restart');
    if (what === 'advance') {
      if (confirming !== 'advance') return arm('advance');
      confirming = null;
      send({ type: 'advance' });
    }
    if (what === 'end') {
      if (confirming !== 'end') return arm('end');
      confirming = null;
      ending = true;
      if (socket) socket.emit('room:end');
      render();
    }
  });

  // --- Helpers -----------------------------------------------------------
  const nameOf = (data, userId) => ((data.players || []).find((p) => p.userId === userId) || {}).name || '';
  const seatOf = (data, userId) => ((data.players || []).find((p) => p.userId === userId) || { seat: 0 }).seat;
  function connected(userId) {
    const m = room && room.members.find((x) => x.userId === userId);
    return !m || m.connected;
  }

  function controls(items) {
    return `<div class="mk-tv__controls">${items.join('')}</div>`;
  }
  function endBtn() {
    const t = UI.t();
    const label = ending ? t.ending : confirming === 'end' ? t.confirm : t.endRoom;
    return `<button type="button" class="mk-btn mk-btn--sm mk-btn--paper" data-hc="end"${ending ? ' disabled' : ''}><i class="ph-bold ph-sign-out" aria-hidden="true"></i>${esc(label)}</button>`;
  }
  function advanceBtn() {
    const t = UI.t();
    return `<button type="button" class="mk-btn mk-btn--sm mk-btn--paper" data-hc="advance"><i class="ph-bold ph-fast-forward" aria-hidden="true"></i>${esc(confirming === 'advance' ? t.confirm : t.moveOn)}</button>`;
  }

  // --- Screens -----------------------------------------------------------
  function screenRing(data) {
    const t = UI.t();
    const ps = data.players || [];
    const done = new Set(data.submittedUserIds || []);
    const n = ps.length;
    const size = n > 6 ? 48 : 58;
    const r = 122;
    // Around the logomark, starting top-right and going round, so four
    // players sit where the design puts them.
    const seats = ps.map((p, i) => {
      const a = -Math.PI / 4 + (2 * Math.PI * i) / n;
      const x = 150 + r * Math.cos(a) - size / 2;
      const y = 150 + r * Math.sin(a) - size / 2;
      const status = done.has(p.userId) ? 'done' : !connected(p.userId) ? 'away' : 'writing';
      return `<div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px">${UI.avatar(p.name, p.seat, size, { status })}</div>`;
    }).join('');
    return `<div class="mk-tv__screen" style="display:flex;align-items:center;padding:26px 40px;gap:30px">
      ${UI.shape('rings', 'var(--tint-aqua)', 420, { className: 'mk-deco', style: 'position:absolute;left:190px;top:15px' })}
      <div style="position:relative;width:220px;flex:none;display:flex;flex-direction:column;gap:10px">
        <span style="font:700 15px var(--font-body);color:var(--ink-500)">${esc(t.round(UI.d(1), UI.d(data.totalRounds)))}</span>
        <span style="font:400 40px/1.15 var(--font-display);color:var(--ink-blue)">${esc(t.tvWriting0)}</span>
        <span style="font:500 17px/1.45 var(--font-body);color:var(--ink-700)">${esc(t.tvWritingSub)}</span>
      </div>
      <div dir="ltr" style="position:relative;width:300px;height:300px;flex:none;display:flex;align-items:center;justify-content:center">
        ${UI.logo(190)}${seats}
      </div>
      <div style="position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:12px">
        ${UI.timer(data.phaseEndsAt, data.roundSeconds || 45, 130)}
        <span style="font:400 22px var(--font-display);color:var(--ink-blue)">${esc(t.doneOf(UI.d(done.size), UI.d(n)))}</span>
      </div>
    </div>${controls([advanceBtn(), endBtn()])}`;
  }

  function screenGrow(data) {
    const t = UI.t();
    const n = data.totalRounds;
    const done = (data.submittedUserIds || []).length;
    const counts = data.storyLineCounts || [];
    const cols = n <= 4 ? n : n <= 6 ? 3 : n <= 8 ? 4 : 5;
    const vertical = n <= 5;
    const cards = counts.map((c, i) => {
      const slots = Array.from({ length: n }, (_, k) => {
        const kind = k < c ? 'full' : k === c ? 'now' : 'empty';
        return vertical
          ? `<span class="mk-slot mk-slot--${kind}"></span>`
          : `<span class="mk-slot mk-slot--${kind}" style="flex:1;height:18px"></span>`;
      }).join('');
      return `<div style="background:var(--paper-0);border:2.5px solid var(--ink-black);border-radius:18px;box-shadow:5px 5px 0 var(--ink-aqua);padding:${vertical ? 14 : 10}px;display:flex;flex-direction:column;gap:${vertical ? 9 : 8}px;min-width:0">
        <span style="font:400 20px var(--font-display);color:var(--ink-blue)">${esc(t.story(UI.d(i + 1)))}</span>
        ${vertical ? slots : `<div style="display:flex;gap:4px">${slots}</div>`}
        <span style="margin-top:auto;font:600 13px var(--font-body);color:var(--ink-500)">${esc(t.lines(UI.d(Math.min(c, n)), UI.d(n)))}</span>
      </div>`;
    }).join('');
    return `<div class="mk-tv__screen" style="display:flex;flex-direction:column;padding:24px 32px 52px;gap:20px">
      <div style="display:flex;align-items:center;gap:18px">
        ${UI.logo(64, 'icon')}
        <div style="flex:1;display:flex;flex-direction:column;gap:2px">
          <span style="font:700 15px var(--font-body);color:var(--ink-500)">${esc(t.round(UI.d(data.round + 1), UI.d(n)))} · ${esc(t.doneOf(UI.d(done), UI.d(n)))}</span>
          <span style="font:400 34px/1.1 var(--font-display);color:var(--ink-blue)">${esc(t.tvGrow)}</span>
        </div>
        ${UI.timer(data.phaseEndsAt, data.roundSeconds || 60, 84)}
      </div>
      <div style="flex:1;min-height:0;display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${n > 5 ? 14 : 18}px;align-content:${vertical ? 'stretch' : 'start'}">${cards}</div>
    </div>${controls([advanceBtn(), endBtn()])}`;
  }

  function screenPass() {
    const t = UI.t();
    return `<div class="mk-tv__screen" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px">
      ${UI.shape('rings', 'var(--tint-aqua)', 440, { className: 'mk-deco', style: 'position:absolute;left:180px;top:5px' })}
      <div style="position:relative">${UI.logo(200)}</div>
      <span style="position:relative;font:400 36px var(--font-display);color:var(--ink-blue)">${esc(t.tvPass)}</span>
    </div>${controls([endBtn()])}`;
  }

  function bubbles(data, story, size, still) {
    const t = UI.t();
    return story.lines.map((l, k) => {
      const missing = l.text == null;
      const cls = `mk-chat${k === 0 ? ' is-first' : ''}${still(k) ? ' is-still' : ''}`;
      return `<div class="${cls}">
        ${UI.avatar(nameOf(data, l.authorId), l.seat, size)}
        <div class="mk-bubble" style="--bubble-ink:var(--player-${l.seat % 8})">
          <span class="mk-bubble__by">${esc(nameOf(data, l.authorId))}</span>
          <span class="mk-bubble__text${missing ? ' is-missing' : ''}">${esc(missing ? t.ink : l.text)}</span>
        </div>
      </div>`;
    }).join('');
  }

  function screenReveal(data) {
    const t = UI.t();
    const n = data.totalRounds;
    const story = (data.stories || [])[data.revealStory];
    if (!story) return screenPass();
    const complete = data.revealLine >= n - 1;
    const key = `${data.revealStory}`;
    const before = shownLine.startsWith(key + ':') ? Number(shownLine.split(':')[1]) : -1;
    shownLine = `${key}:${data.revealLine}`;
    const last = data.revealStory >= n - 1;
    return `<div class="mk-tv__screen" style="background:var(--ink-blue);display:flex;align-items:center;padding:20px 32px;gap:24px">
      <div style="width:150px;flex:none;align-self:stretch;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center">
        ${UI.logo(120, 'icon')}
        <span style="font:400 24px var(--font-display);color:var(--paper-0)">${esc(t.storyOf(UI.d(data.revealStory + 1), UI.d(n)))}</span>
        <span style="font:600 14px var(--font-body);color:var(--tint-aqua)">${esc(t.lineOf(UI.d(data.revealLine + 1), UI.d(n)))}</span>
        <button type="button" class="mk-btn mk-btn--md mk-btn--wrap" data-hc="next" style="margin-top:8px;font-size:18px;padding:11px 14px 8px;min-height:44px;width:100%"${complete ? '' : ' disabled'}>${esc(complete ? (last ? t.theEnd : t.nextStory) : t.revealingNote)}</button>
      </div>
      <div style="position:relative;flex:1;min-width:0;overflow:hidden;background:var(--paper-0);border:2.5px solid var(--ink-black);border-radius:20px;box-shadow:7px 7px 0 var(--ink-orange);padding:52px 18px 14px;display:flex;flex-direction:column;justify-content:flex-end;gap:8px;height:404px">
        ${bubbles(data, story, 30, (k) => k <= before)}
        ${complete ? `<span class="mk-theend" style="font-size:20px;padding:6px 14px 2px;top:10px">${esc(t.storyEnd)}</span>` : '<div class="mk-dots"><span></span><span></span><span></span></div>'}
      </div>
    </div>`;
  }

  function screenEnd(data) {
    const t = UI.t();
    const stories = data.stories || [];
    const n = stories.length;
    const cols = n <= 4 ? 2 : 3;
    const compact = n > 4;
    const cards = stories.map((s) => {
      const first = s.lines[0];
      const text = first && first.text != null ? first.text : t.ink;
      const starter = nameOf(data, s.starterId);
      return `<div style="background:var(--paper-0);border:2.5px solid var(--ink-black);border-radius:16px;box-shadow:4px 4px 0 var(--ink-blue);padding:${compact ? '9px 11px' : '12px 14px'};display:flex;flex-direction:column;gap:${compact ? 6 : 10}px;min-height:0;min-width:0">
        <span class="mk-clamp2" style="font:700 ${compact ? 14 : 17}px/1.45 var(--font-story)">${esc(text)}</span>
        <div style="margin-top:auto;display:flex;align-items:center;gap:8px">${UI.avatar(starter, s.seat, compact ? 22 : 26)}<span style="font:600 12px var(--font-body);color:var(--ink-500);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.by(starter))}</span></div>
      </div>`;
    }).join('');
    return `<div class="mk-tv__screen" style="display:flex;align-items:center;padding:26px 36px 52px;gap:30px">
      ${UI.shape('burst', 'var(--tint-yellow)', 420, { rotate: 8, className: 'mk-deco', style: 'position:absolute;right:-50px;top:15px' })}
      <div style="position:relative;width:${compact ? 230 : 290}px;flex:none;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">
        ${UI.logo(compact ? 190 : 220)}
        <span style="font:400 28px/1.2 var(--font-display);color:var(--ink-blue);text-shadow:2px 2px 0 var(--ink-orange)">${esc(t.closer)}</span>
      </div>
      <div style="position:relative;flex:1;min-width:0;align-self:stretch;display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));grid-auto-rows:1fr;gap:${compact ? 10 : 16}px;align-content:center">${cards}</div>
    </div>${controls([
      `<button type="button" class="mk-btn mk-btn--sm" data-hc="again"><i class="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i>${esc(t.again)}</button>`,
      endBtn(),
    ])}`;
  }

  function screenEnded() {
    const t = UI.t();
    return `<div class="mk-tv__screen" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center">
      ${UI.shape('burst', 'var(--tint-aqua)', 320, { rotate: 8, className: 'mk-deco', style: 'position:absolute;left:-110px;bottom:-140px' })}
      ${UI.shape('circle', 'var(--tint-yellow)', 240, { className: 'mk-deco', style: 'position:absolute;right:-80px;top:-100px' })}
      <div style="position:relative">${UI.logo(220)}</div>
      <span style="position:relative;font:400 30px var(--font-display);color:var(--ink-blue)">${esc(t.ended)}</span>
      <a class="mk-btn mk-btn--md mk-btn--paper" style="position:relative" href="malarkey.html">${esc(t.home)}</a>
    </div>`;
  }

  function screenConnecting() {
    const t = UI.t();
    return `<div class="mk-tv__screen" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
      ${UI.logo(200)}<span style="font:400 24px var(--font-display);color:var(--ink-blue)">${esc(t.connecting)}</span></div>`;
  }

  function render() {
    let body;
    if (room && room.status === 'ended') body = screenEnded();
    else if (!state) body = screenConnecting();
    else {
      const data = state.data || {};
      if (state.phase === 'write') body = data.round === 0 ? screenRing(data) : screenGrow(data);
      else if (state.phase === 'pass') body = screenPass();
      else if (state.phase === 'reveal') body = screenReveal(data);
      else if (state.phase === 'finished') body = screenEnd(data);
      else body = screenConnecting();
    }
    if (state && state.phase !== 'write' && confirming === 'advance') confirming = null;
    const ink = state && state.phase === 'reveal' && !(room && room.status === 'ended');
    mount.innerHTML = `<div class="mk-tv-frame${ink ? ' is-ink' : ''}"><div class="mk-tv" id="hc-stage">${body}</div></div>`;
    UI.fitTv(document.getElementById('hc-stage'));
    UI.tickTimers();
  }
})();
