// تخاريف · Malarkey -- the big screen (the design's "Main screen" frames).
// Mounted into #host-console on malarkey-lobby.html, where the host's screen
// stays for the whole game when the host is not playing.
//
// Drawn on an 800 x 450 stage scaled to the display, so every size in the
// design stays where it is. The design has no buttons on the main screen --
// in its prototype the host also held a phone -- but here the host's screen
// IS the big screen, so the host's controls sit quietly in its corners:
// Next story, Pause, hiding a line, taking out a player who has left, Play
// again, End room, moving a stuck round on, and the sound.
(function () {
  const mount = document.getElementById('host-console');
  if (!mount) return;
  const UI = window.MkUI;
  const esc = UI.esc;
  const iso = UI.iso;

  const gate = document.getElementById('lobby-gate');
  const main = document.getElementById('lobby-main');

  let room = null;
  let state = null;
  let socket = null;
  let active = false;
  let confirming = null; // 'end' | 'advance' | 'take:<userId>'
  let confirmTimer = null;
  let ending = false;
  // The reveal line already drawn, so only a new bubble stamps itself in.
  let shownLine = '';
  let initials = {};

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
    const before = state;
    state = e.detail;
    if (active) { cue(before, state); render(); }
  });
  document.addEventListener('bahjah:lang-change', () => { if (active) render(); });
  window.addEventListener('resize', () => { if (active) { UI.fitTv(document.getElementById('hc-stage')); fitStory(); } });

  function cue(before, next) {
    if (!before) return;
    const a = before.data || {};
    const b = next.data || {};
    if (next.phase === 'write' && (before.phase !== 'write' || a.round !== b.round)) UI.sfx('reveal');
    else if (next.phase === 'reveal' && before.phase === 'reveal' && (a.revealLine !== b.revealLine || a.revealStory !== b.revealStory)) UI.sfx('pick');
    else if (next.phase === 'reveal' && before.phase !== 'reveal') UI.sfx('riser');
    else if (next.phase === 'finished' && before.phase !== 'finished') UI.sfx('win');
  }
  let lastTick = null;
  setInterval(() => {
    if (!active || !state || state.phase !== 'write') return;
    const left = UI.secsLeft(state.data && state.data.phaseEndsAt);
    if (left > 0 && left <= 5 && left !== lastTick) { lastTick = left; UI.sfx('tick'); }
  }, 200);

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
    if (what === 'pause') send({ type: 'pause' });
    if (what === 'hide') send({ type: 'hide', story: Number(btn.dataset.story), line: Number(btn.dataset.line) });
    if (what === 'again' && socket) socket.emit('room:restart');
    if (what === 'take') {
      const key = `take:${btn.dataset.user}`;
      if (confirming !== key) return arm(key);
      confirming = null;
      send({ type: 'remove', userId: btn.dataset.user });
    }
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
  const players = (data) => (data.players || []);
  const nameOf = (data, userId) => (players(data).find((p) => p.userId === userId) || {}).name || '';
  const av = (data, userId, seat, size, opts = {}) => UI.avatar(nameOf(data, userId), seat, size, { ...opts, initials: initials[userId] });
  function connected(userId) {
    const m = room && room.members.find((x) => x.userId === userId);
    return Boolean(m && m.connected);
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
  function soundBtn() {
    return UI.soundButton('mk-btn mk-btn--sm mk-btn--paper mk-iconbtn');
  }
  // Players who have dropped off while the stories are being written: the
  // host can take them out so the round stops waiting and their empty turns
  // stay out of the reveal.
  function takeOutChips(data) {
    const t = UI.t();
    const done = new Set(data.submittedUserIds || []);
    return players(data)
      .filter((p) => !p.removed && !done.has(p.userId) && !connected(p.userId))
      .slice(0, 3)
      .map((p) => {
        const key = `take:${p.userId}`;
        const label = confirming === key ? t.takeOutConfirm(iso(p.name)) : t.takeOut(iso(p.name));
        return `<button type="button" class="mk-takeout${confirming === key ? ' is-confirming' : ''}" data-hc="take" data-user="${esc(p.userId)}"><i class="ph-bold ph-user-minus" aria-hidden="true"></i>${esc(label)}</button>`;
      }).join('');
  }
  function writeControls(data) {
    const chips = takeOutChips(data);
    return `${chips ? `<div style="position:absolute;bottom:14px;inset-inline-start:16px;z-index:25;display:flex;gap:6px;flex-wrap:wrap;max-width:440px">${chips}</div>` : ''}${controls([soundBtn(), advanceBtn(), endBtn()])}`;
  }
  const activeCount = (data) => players(data).filter((p) => !p.removed).length;

  // --- Screens -----------------------------------------------------------
  function screenRing(data) {
    const t = UI.t();
    const ps = players(data);
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
      const status = done.has(p.userId) ? 'done' : (!connected(p.userId) || p.removed) ? 'away' : 'writing';
      return `<div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;${p.removed ? 'opacity:.35' : ''}">${av(data, p.userId, p.seat, size, { status })}</div>`;
    }).join('');
    return `<div class="mk-tv__screen" style="display:flex;align-items:center;padding:26px 40px;gap:30px">
      ${UI.shape('rings', 'var(--tint-aqua)', 420, { className: 'mk-deco', style: 'position:absolute;left:190px;top:15px' })}
      <div style="position:relative;width:220px;flex:none;display:flex;flex-direction:column;gap:10px">
        <span style="font:700 15px var(--font-body);color:var(--ink-500)">${esc(t.round(UI.d(1), UI.d(data.totalRounds)))}</span>
        <span style="font:400 40px/1.15 var(--font-display);color:var(--ink-blue)">${esc(t.tvWriting0)}</span>
        <span style="font:500 17px/1.45 var(--font-body);color:var(--ink-700)">${esc(t.tvWritingSub)}</span>
      </div>
      <div dir="ltr" style="position:relative;width:300px;height:300px;flex:none;display:flex;align-items:center;justify-content:center">
        ${UI.logo(n > 6 ? 170 : 190)}${seats}
      </div>
      <div style="position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:12px">
        ${UI.timer(data.phaseEndsAt, data.roundSeconds || 45, 130)}
        <span style="font:400 22px var(--font-display);color:var(--ink-blue)">${esc(t.doneOf(UI.d(done.size), UI.d(activeCount(data))))}</span>
      </div>
    </div>${writeControls(data)}`;
  }

  function screenGrow(data) {
    const t = UI.t();
    const n = data.totalRounds;
    const done = (data.submittedUserIds || []).length;
    const counts = data.storyLineCounts || [];
    const cols = n <= 4 ? n : n <= 6 ? 3 : n <= 8 ? 4 : 5;
    const vertical = n <= 5;
    const cards = counts.map((c, i) => {
      let slots;
      if (vertical) {
        slots = Array.from({ length: n }, (_, k) => `<span class="mk-slot mk-slot--${k < c ? 'full' : k === c ? 'now' : 'empty'}"></span>`).join('');
      } else {
        // Past five stories the per-line slots got too small to read from
        // the sofa: one continuous bar instead.
        slots = `<div class="mk-bar" dir="ltr">${Array.from({ length: n }, (_, k) => `<span class="${k < c ? 'is-full' : k === c ? 'is-now' : ''}"></span>`).join('')}</div>`;
      }
      return `<div style="background:var(--paper-0);border:2.5px solid var(--ink-black);border-radius:18px;box-shadow:5px 5px 0 var(--ink-aqua);padding:${vertical ? 14 : 12}px;display:flex;flex-direction:column;gap:${vertical ? 9 : 10}px;min-width:0">
        <span style="font:400 20px var(--font-display);color:var(--ink-blue)">${esc(t.story(UI.d(i + 1)))}</span>
        ${slots}
        <span style="margin-top:auto;font:600 13px var(--font-body);color:var(--ink-500)">${esc(t.lines(UI.d(Math.min(c, n)), UI.d(n)))}</span>
      </div>`;
    }).join('');
    // Two facts in one line: each in its own isolate, so Arabic digits from
    // both halves do not run together ("٢ من ٥٠١٠").
    const status = `${iso(t.round(UI.d(data.round + 1), UI.d(n)))} · ${iso(t.doneOf(UI.d(done), UI.d(activeCount(data))))}`;
    return `<div class="mk-tv__screen" style="display:flex;flex-direction:column;padding:24px 32px 56px;gap:20px">
      <div style="display:flex;align-items:center;gap:18px">
        ${UI.logo(64, 'icon')}
        <div style="flex:1;display:flex;flex-direction:column;gap:2px">
          <span style="font:700 15px var(--font-body);color:var(--ink-500)">${esc(status)}</span>
          <span style="font:400 34px/1.1 var(--font-display);color:var(--ink-blue)">${esc(t.tvGrow)}</span>
        </div>
        ${UI.timer(data.phaseEndsAt, data.roundSeconds || 60, 84)}
      </div>
      <div style="flex:1;min-height:0;display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${n > 5 ? 14 : 18}px;align-content:${vertical ? 'stretch' : 'center'}">${cards}</div>
    </div>${writeControls(data)}`;
  }

  function screenPass() {
    const t = UI.t();
    return `<div class="mk-tv__screen" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px">
      ${UI.shape('rings', 'var(--tint-aqua)', 440, { className: 'mk-deco', style: 'position:absolute;left:180px;top:5px' })}
      <div style="position:relative">${UI.logo(200)}</div>
      <span style="position:relative;font:400 36px var(--font-display);color:var(--ink-blue)">${esc(t.tvPass)}</span>
    </div>${controls([soundBtn(), endBtn()])}`;
  }

  function bubbles(data, story, size, still) {
    const t = UI.t();
    return story.lines.map((l, k) => {
      const missing = l.text == null;
      const cls = `mk-chat${k === 0 ? ' is-first' : ''}${still(k) ? ' is-still' : ''}`;
      const body = l.hidden ? t.hidden : missing ? t.ink : l.text;
      const hide = !l.hidden && !missing
        ? `<button type="button" class="mk-hidebtn" data-hc="hide" data-story="${data.revealStory}" data-line="${k}" aria-label="${esc(t.hide)}" title="${esc(t.hide)}"><i class="ph-bold ph-eye-slash" aria-hidden="true"></i></button>`
        : '';
      return `<div class="${cls}">
        ${av(data, l.authorId, l.seat, size)}
        <div class="mk-bubble" style="--bubble-ink:var(--player-${l.seat % 8})">
          <span class="mk-bubble__by" dir="auto">${esc(nameOf(data, l.authorId))}</span>
          <span class="mk-bubble__text${l.hidden ? ' is-missing is-hidden' : missing ? ' is-missing' : ''}" dir="auto">${esc(body)}</span>
        </div>
        ${hide}
      </div>`;
    }).join('');
  }

  // The story card shrinks its text until the whole story fits (a long
  // story of 250-character lines at ten players does not, at 16px), and
  // past the smallest readable size it scrolls with the first line pinned
  // at the top and the newest at the bottom.
  function fitStory() {
    const card = document.getElementById('hc-story');
    if (!card) return;
    let size = 16;
    card.style.setProperty('--mk-tv-text', `${size}px`);
    while (card.scrollHeight > card.clientHeight + 1 && size > 11) {
      size -= 1;
      card.style.setProperty('--mk-tv-text', `${size}px`);
    }
    card.scrollTop = card.scrollHeight;
  }

  function screenReveal(data) {
    const t = UI.t();
    const story = (data.stories || [])[data.revealStory];
    if (!story) return screenPass();
    const total = story.total || story.lines.length;
    const complete = data.revealLine >= total - 1;
    const key = `${data.revealStory}`;
    const before = shownLine.startsWith(key + ':') ? Number(shownLine.split(':')[1]) : -1;
    shownLine = `${key}:${data.revealLine}`;
    const nextLabel = complete ? (data.revealLast ? t.theEnd : t.nextStory) : data.revealPaused ? t.paused : t.revealingNote;
    const pause = complete ? '' : `<button type="button" class="mk-btn mk-btn--sm mk-btn--paper" data-hc="pause" style="width:100%"><i class="ph-bold ${data.revealPaused ? 'ph-play' : 'ph-pause'}" aria-hidden="true"></i>${esc(data.revealPaused ? t.resume : t.pause)}</button>`;
    return `<div class="mk-tv__screen" style="background:var(--ink-blue);display:flex;align-items:center;padding:20px 32px;gap:24px">
      <div style="width:150px;flex:none;align-self:stretch;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center">
        ${UI.logo(110, 'icon')}
        <span style="font:400 24px var(--font-display);color:var(--paper-0)">${esc(t.storyOf(UI.d(data.revealStory + 1), UI.d(data.totalRounds)))}</span>
        <span style="font:600 14px var(--font-body);color:var(--tint-aqua)">${esc(t.lineOf(UI.d(data.revealLine + 1), UI.d(total)))}</span>
        <button type="button" class="mk-btn mk-btn--md mk-btn--wrap" data-hc="next" style="margin-top:6px;font-size:18px;padding:11px 14px 8px;min-height:44px;width:100%"${complete ? '' : ' disabled'}>${esc(nextLabel)}</button>
        ${pause}
        ${soundBtn()}
      </div>
      <div class="mk-tv-story" id="hc-story" style="position:relative;flex:1;min-width:0;background:var(--paper-0);border:2.5px solid var(--ink-black);border-radius:20px;box-shadow:7px 7px 0 var(--ink-orange);padding:52px 18px 14px;display:flex;flex-direction:column;gap:8px;height:404px">
        <div style="flex:1 0 0"></div>
        ${bubbles(data, story, 30, (k) => k <= before)}
        ${complete ? `<span class="mk-theend" style="position:absolute;font-size:20px;padding:6px 14px 2px;top:10px">${esc(t.storyEnd)}</span>` : '<div class="mk-dots"><span></span><span></span><span></span></div>'}
      </div>
    </div>`;
  }

  function screenEnd(data) {
    const t = UI.t();
    const stories = (data.stories || []).filter((s) => s.lines.length > 0);
    const n = stories.length;
    const cols = n <= 4 ? 2 : 3;
    const compact = n > 4;
    const cards = stories.map((s) => {
      const first = s.lines[0];
      const text = !first ? t.ink : first.hidden ? t.hidden : first.text != null ? first.text : t.ink;
      const starter = nameOf(data, s.starterId);
      return `<div style="background:var(--paper-0);border:2.5px solid var(--ink-black);border-radius:16px;box-shadow:4px 4px 0 var(--ink-blue);padding:${compact ? '9px 11px' : '12px 14px'};display:flex;flex-direction:column;gap:${compact ? 6 : 10}px;min-height:0;min-width:0">
        <span class="mk-clamp2" dir="auto" style="font:700 ${compact ? 14 : 17}px/1.45 var(--font-story)">${esc(text)}</span>
        <div style="margin-top:auto;display:flex;align-items:center;gap:8px">${av(data, s.starterId, s.seat, compact ? 22 : 26)}<span style="font:600 12px var(--font-body);color:var(--ink-500);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.by(iso(starter)))}</span></div>
      </div>`;
    }).join('');
    return `<div class="mk-tv__screen" style="display:flex;align-items:center;padding:26px 36px 56px;gap:30px">
      ${UI.shape('burst', 'var(--tint-yellow)', 420, { rotate: 8, className: 'mk-deco', style: 'position:absolute;right:-50px;top:15px' })}
      <div style="position:relative;width:${compact ? 230 : 290}px;flex:none;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">
        ${UI.logo(compact ? 190 : 220)}
        <span style="font:400 28px/1.2 var(--font-display);color:var(--ink-blue);text-shadow:2px 2px 0 var(--ink-orange)">${esc(t.closer)}</span>
      </div>
      <div style="position:relative;flex:1;min-width:0;align-self:stretch;display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));grid-auto-rows:1fr;gap:${compact ? 10 : 16}px;align-content:center">${cards}</div>
    </div>${controls([
      soundBtn(),
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
    const data = (state && state.data) || {};
    initials = UI.initialsFor(players(data));
    if (room && room.status === 'ended') body = screenEnded();
    else if (!state) body = screenConnecting();
    else if (state.phase === 'write') body = data.round === 0 ? screenRing(data) : screenGrow(data);
    else if (state.phase === 'pass') body = screenPass();
    else if (state.phase === 'reveal') body = screenReveal(data);
    else if (state.phase === 'finished') body = screenEnd(data);
    else body = screenConnecting();
    if (state && state.phase !== 'write' && confirming && confirming !== 'end') confirming = null;
    const ink = state && state.phase === 'reveal' && !(room && room.status === 'ended');
    mount.innerHTML = `<div class="mk-tv-frame${ink ? ' is-ink' : ''}"><div class="mk-tv" id="hc-stage">${body}</div></div>`;
    UI.fitTv(document.getElementById('hc-stage'));
    UI.tickTimers();
    fitStory();
  }
})();
