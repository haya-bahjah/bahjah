// تخاريف · Malarkey -- the player's phone (the design's phone screens 4-8:
// write, sent, pass, reveal, the end and a story in full). Driven by the
// 'bahjah:game-state' events assets/lobby.js dispatches.
//
// When the host plays too (a phones-only room) the host is on this page
// with everybody else, and runs the room from here: turning the pages,
// pausing the reading, hiding a line, taking out a player who has left, and
// ending the room.
(function () {
  const app = document.getElementById('app');
  if (!app) return;
  const UI = window.MkUI;
  const esc = UI.esc;
  const iso = UI.iso;

  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();
  const myId = me ? me.id : '';

  let room = null;
  let state = null;
  let roomEnded = false;
  let viewStory = null; // index of the story opened in full, at the end
  let lastKey = '';
  let shownLine = '';
  let lastPhaseKey = '';
  // Writing.
  let draftTimer = null;
  let lastSentDraft = null;
  let finalFlushKey = '';
  let sending = false;
  let errorsBound = false;
  // The host's two-tap confirmations.
  let confirming = null;
  let confirmTimer = null;

  document.addEventListener('bahjah:room-update', (e) => {
    room = e.detail;
    if (room.status === 'lobby') {
      location.href = `malarkey-lobby.html?code=${encodeURIComponent(code)}`;
      return;
    }
    if (room.status === 'ended' && !roomEnded) {
      roomEnded = true;
      render(true);
      return;
    }
    if (state) render(false);
  });

  document.addEventListener('bahjah:game-state', (e) => {
    const next = e.detail;
    if (!next || next.gameType !== 'malarkey') return;
    const before = state;
    state = next;
    document.body.classList.add('is-live');
    bindErrors();
    cue(before, next);
    render(false);
  });

  document.addEventListener('bahjah:lang-change', () => render(true));

  function bindErrors() {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (errorsBound || !socket) return;
    errorsBound = true;
    socket.on('room:error', (err) => {
      sending = false;
      if (['EMPTY_LINE', 'ALREADY_SUBMITTED', 'INVALID_PHASE', 'STORY_UNFOLDING'].includes(err.code)) return;
      if (state) UI.toast(UI.errorText(err));
      if (state && state.phase === 'write') render(true);
    });
  }

  function socket() {
    return window.BahjahRoom && window.BahjahRoom.socket;
  }
  function send(action) {
    const s = socket();
    if (s) s.emit('game:action', { action });
  }

  // --- Sound cues ----------------------------------------------------------
  function cue(before, next) {
    if (!before) return;
    const a = before.data || {};
    const b = next.data || {};
    if (next.phase === 'write' && (before.phase !== 'write' || a.round !== b.round)) UI.sfx('reveal');
    else if (next.phase === 'reveal' && before.phase === 'reveal' && (a.revealLine !== b.revealLine || a.revealStory !== b.revealStory)) UI.sfx('pick');
    else if (next.phase === 'reveal' && before.phase !== 'reveal') UI.sfx('riser');
    else if (next.phase === 'finished' && before.phase !== 'finished') UI.sfx('win');
  }
  let lastTickSecond = null;
  setInterval(() => {
    if (!state || state.phase !== 'write' || data().mySubmitted || !document.getElementById('mk-line')) return;
    const left = UI.secsLeft(data().phaseEndsAt);
    if (left > 0 && left <= 5 && left !== lastTickSecond) { lastTickSecond = left; UI.sfx('tick'); }
  }, 200);

  const data = () => (state && state.data) || {};
  const isHost = () => Boolean(room && room.members.some((m) => m.userId === myId && m.isHost));
  const hostRuns = () => isHost() && data().hostPlays;
  const players = () => data().players || [];
  const nameOf = (userId) => (players().find((p) => p.userId === userId) || {}).name || '';
  const hostName = () => {
    const h = room && room.members.find((m) => m.isHost);
    return h ? h.displayName : '';
  };
  const online = (userId) => {
    const m = room && room.members.find((x) => x.userId === userId);
    return Boolean(m && m.connected);
  };
  let initials = {};
  const av = (userId, seat, size, opts = {}) => UI.avatar(nameOf(userId), seat, size, { ...opts, initials: initials[userId] });

  // --- Host controls (phones-only rooms) -----------------------------------
  function arm(kind) {
    confirming = kind;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => { confirming = null; render(true); }, 3500);
    render(true);
  }
  function endRoomButton() {
    if (!hostRuns() || roomEnded) return '';
    const t = UI.t();
    return `<button type="button" class="mk-btn mk-btn--sm mk-btn--paper" data-act="end"><i class="ph-bold ph-sign-out" aria-hidden="true"></i>${esc(confirming === 'end' ? t.endRoomConfirm : t.endRoom)}</button>`;
  }
  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'end') {
      if (confirming !== 'end') return arm('end');
      confirming = null;
      const s = socket();
      if (s) s.emit('room:end');
    } else if (act === 'pause') {
      send({ type: 'pause' });
    } else if (act === 'hide') {
      send({ type: 'hide', story: Number(b.dataset.story), line: Number(b.dataset.line) });
    } else if (act === 'takeout') {
      const key = `take:${b.dataset.user}`;
      if (confirming !== key) return arm(key);
      confirming = null;
      send({ type: 'remove', userId: b.dataset.user });
    } else if (act === 'leave') {
      const s = socket();
      if (s) s.emit('room:leave');
      setTimeout(() => { location.href = 'malarkey.html'; }, 250);
    }
  });

  // --- Drafts --------------------------------------------------------------
  const draftKey = () => `mk-draft:${code}:${data().round}`;
  function loadDraft() {
    try { return localStorage.getItem(draftKey()); } catch (_) { return null; }
  }
  function saveDraft(text) {
    try { localStorage.setItem(draftKey(), text); } catch (_) { /* private mode */ }
  }
  function currentText() {
    const ta = document.getElementById('mk-line');
    return ta ? ta.value : '';
  }
  // The server keeps a copy of what is typed, so when the round closes it can
  // send it for anyone who did not press Send -- the design's "when time's
  // up, we send what you have". Sent a moment after typing stops, and once
  // more just before the deadline.
  function pushDraft(force) {
    const text = currentText();
    if (!force && text === lastSentDraft) return;
    lastSentDraft = text;
    send({ type: 'draft', text });
  }
  setInterval(() => {
    if (!state || state.phase !== 'write' || data().mySubmitted || data().closing) return;
    const key = `${data().round}`;
    const left = ((data().phaseEndsAt || 0) - UI.now()) / 1000;
    if (left <= 2 && left > -1 && finalFlushKey !== key && document.getElementById('mk-line')) {
      finalFlushKey = key;
      clearTimeout(draftTimer);
      pushDraft(true);
    }
  }, 250);

  // --- Screens -------------------------------------------------------------
  function header(d) {
    const t = UI.t();
    return `<div class="mk-row mk-row--between">
      <div class="mk-write-progress" style="display:flex;flex-direction:column;gap:6px">
        <span class="mk-label">${esc(t.round(UI.d(d.round + 1), UI.d(d.totalRounds)))}</span>
        ${UI.progress(d.round + 1, d.totalRounds)}
      </div>
      ${UI.timer(d.phaseEndsAt, d.roundSeconds || 45, 68)}
    </div>`;
  }

  function screenWrite(d) {
    const t = UI.t();
    const first = d.round === 0;
    // Nothing to continue from: every turn before this one ran out of ink.
    const blank = !first && d.prompt == null;
    const saved = loadDraft();
    const text = saved != null && saved.length >= (d.myDraft || '').length ? saved : (d.myDraft || '');
    lastSentDraft = d.myDraft || '';
    let top;
    if (first) top = `<div class="mk-heading"><h1 class="mk-h1">${esc(t.firstH)}</h1><p class="mk-sub">${esc(t.firstSub)}</p></div>`;
    else if (blank) top = `<div class="mk-heading"><h1 class="mk-h1">${esc(t.blankH)}</h1><p class="mk-sub">${esc(t.blankSub)}</p></div>`;
    else top = `
      <div class="mk-heading"><h1 class="mk-h1">${esc(t.contH)}</h1><p class="mk-sub">${esc(t.contSub)}</p></div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:4px;min-height:0">
        <div class="mk-prompt"><span class="mk-prompt__tail"></span><div class="mk-prompt__body" dir="auto">${esc(d.prompt)}</div></div>
        <div class="mk-prompt__by">${UI.avatar('', 0, 28, { empty: true })}<span class="mk-small">${esc(t.byOne)}</span></div>
      </div>`;
    app.innerHTML = `<div class="mk-screen mk-screen--fit" style="gap:16px">
      ${header(d)}
      ${top}
      <label class="mk-writebox" style="display:flex;flex-direction:column;gap:6px">
        <textarea class="mk-textarea" id="mk-line" dir="auto" maxlength="250" placeholder="${esc(t.ph)}" aria-label="${esc(t.ph)}" style="flex:1">${esc(text)}</textarea>
        <span class="mk-counter mk-ltr" id="mk-count">${text.length} / 250</span>
      </label>
      <div class="mk-info"><i class="ph-bold ph-info" aria-hidden="true"></i>${esc(t.autoSend)}</div>
      <button type="button" class="mk-btn mk-btn--lg mk-btn--block" id="mk-send"${text.trim() ? '' : ' disabled'}><i class="ph-bold ph-paper-plane-tilt" aria-hidden="true"></i>${esc(t.send)}</button>
    </div>`;
    const ta = document.getElementById('mk-line');
    const btn = document.getElementById('mk-send');
    ta.addEventListener('input', () => {
      if (ta.value.length > 250) ta.value = ta.value.slice(0, 250);
      document.getElementById('mk-count').textContent = `${ta.value.length} / 250`;
      btn.disabled = !ta.value.trim() || sending;
      saveDraft(ta.value);
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => pushDraft(false), 1200);
    });
    // With the keyboard up the window shrinks; keep Send in view.
    ta.addEventListener('focus', () => setTimeout(() => btn.scrollIntoView({ block: 'nearest' }), 300));
    btn.addEventListener('click', () => {
      const value = ta.value.trim();
      if (!value || sending) return;
      sending = true;
      btn.disabled = true;
      clearTimeout(draftTimer);
      UI.sfx('submit');
      send({ type: 'submit', text: value });
    });
    if (text && text !== lastSentDraft) pushDraft(false);
  }

  function takeOutChips(list) {
    if (!hostRuns()) return '';
    const t = UI.t();
    return list.filter((p) => p.userId !== myId && !online(p.userId)).map((p) => {
      const key = `take:${p.userId}`;
      const label = confirming === key ? t.takeOutConfirm(iso(p.name)) : t.takeOut(iso(p.name));
      return `<button type="button" class="mk-takeout${confirming === key ? ' is-confirming' : ''}" data-act="takeout" data-user="${esc(p.userId)}"><i class="ph-bold ph-user-minus" aria-hidden="true"></i>${esc(label)}</button>`;
    }).join('');
  }

  function screenSent(d) {
    const t = UI.t();
    const done = new Set(d.submittedUserIds || []);
    const still = d.closing ? [] : players().filter((p) => !p.removed && !done.has(p.userId));
    const chips = takeOutChips(still);
    app.innerHTML = `<div class="mk-screen" style="gap:18px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <span class="mk-label">${esc(t.round(UI.d(d.round + 1), UI.d(d.totalRounds)))}</span>
        ${UI.progress(d.round + 1, d.totalRounds)}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center">
        <div style="position:relative;width:180px;height:180px;display:flex;align-items:center;justify-content:center">
          ${UI.shape('burst', 'var(--ink-yellow)', 180, { misreg: 'var(--ink-orange)', rotate: 8, style: 'position:absolute;left:0;top:0' })}
          <i class="ph-bold ph-check" style="position:relative;font-size:72px;color:var(--ink-blue)" aria-hidden="true"></i>
        </div>
        <h1 class="mk-h1" style="font-size:36px;line-height:1.1">${esc(t.sentH)}</h1>
        <p class="mk-sub">${esc(t.sentSub)}</p>
        <div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;min-height:44px">
          ${still.slice(0, 6).map((p) => av(p.userId, p.seat, 40, { status: online(p.userId) ? 'writing' : 'away' })).join('')}
          <span style="font:600 14px var(--font-body);color:var(--ink-500)">${esc(still.length ? t.left(UI.d(still.length)) : t.allIn)}</span>
        </div>
        ${chips ? `<div class="mk-hostbar">${chips}</div>` : ''}
      </div>
      ${hostRuns() ? `<div class="mk-hostbar">${endRoomButton()}</div>` : ''}
    </div>`;
  }

  function screenPass() {
    const t = UI.t();
    app.innerHTML = `<div class="mk-screen mk-screen--center">
      ${UI.shape('rings', 'var(--tint-aqua)', 420, { className: 'mk-deco', style: 'position:absolute;left:-30px;top:160px' })}
      ${UI.logo(140, 'icon')}
      <h1 class="mk-h1" style="position:relative">${esc(t.passH)}</h1>
      <p class="mk-sub" style="position:relative">${esc(t.passSub)}</p>
    </div>`;
  }

  function screenNotice(title, sub, opts = {}) {
    const t = UI.t();
    app.innerHTML = `<div class="mk-screen mk-screen--center">
      ${UI.logo(160)}
      <h1 class="mk-h1">${esc(title)}</h1>
      <p class="mk-sub">${esc(sub)}</p>
      ${opts.leave ? `<button type="button" class="mk-btn mk-btn--md mk-btn--paper" data-act="leave">${esc(t.leave)}</button>` : ''}
      ${opts.home ? `<a class="mk-btn mk-btn--lg mk-btn--paper" href="malarkey.html">${esc(t.home)}</a>` : ''}
    </div>`;
  }

  function bubble(l, k, opts) {
    const t = UI.t();
    const missing = l.text == null;
    const mine = l.authorId === myId;
    const cls = `mk-chat${k === 0 ? ' is-first' : ''}${mine ? ' is-mine' : ''}${opts.still ? ' is-still' : ''}`;
    const textCls = l.hidden ? ' is-missing is-hidden' : missing ? ' is-missing' : '';
    const body = l.hidden ? t.hidden : missing ? t.ink : l.text;
    const hide = opts.canHide && !l.hidden && !missing
      ? `<button type="button" class="mk-hidebtn" data-act="hide" data-story="${opts.story}" data-line="${k}" aria-label="${esc(t.hide)}" title="${esc(t.hide)}"><i class="ph-bold ph-eye-slash" aria-hidden="true"></i></button>`
      : '';
    return `<div class="${cls}">
      ${av(l.authorId, l.seat, 32)}
      <div class="mk-bubble" style="--bubble-ink:var(--player-${l.seat % 8})">
        <span class="mk-bubble__by" dir="auto">${esc(nameOf(l.authorId))}</span>
        <span class="mk-bubble__text${textCls}" dir="auto">${esc(body)}</span>
      </div>
      ${hide}
    </div>`;
  }

  function screenReveal(d) {
    const t = UI.t();
    const story = (d.stories || [])[d.revealStory];
    if (!story) return screenPass();
    const total = story.total || story.lines.length;
    const complete = d.revealLine >= total - 1;
    const current = story.lines[d.revealLine];
    const speaker = !complete && current ? current.authorId : null;
    const before = shownLine.startsWith(`${d.revealStory}:`) ? Number(shownLine.split(':')[1]) : -1;
    shownLine = `${d.revealStory}:${d.revealLine}`;
    const ps = players().filter((p) => !p.removed);
    // Sized to fit one row on the phone, wrapping onto a second past that.
    const width = Math.min(window.innerWidth, 460) - 44 - 24;
    const size = Math.max(30, Math.min(46, Math.floor((width - (ps.length - 1) * 6) / ps.length)));
    const showNames = size >= 40;
    const speakers = ps.map((p) => {
      const on = complete || p.userId === speaker;
      const lift = !complete && p.userId === speaker;
      const status = room && room.members.some((m) => m.userId === p.userId && m.isHost) ? 'host' : null;
      return `<div style="opacity:${on ? 1 : 0.4};transform:${lift ? 'translateY(-3px) scale(1.08)' : 'none'}">${av(p.userId, p.seat, size, { status, showName: showNames })}</div>`;
    }).join('');
    // "The end!" sits beside the title once the story is all out: inside the
    // scrolling card it rode up over the first line.
    const progress = complete
      ? `<span class="mk-theend mk-theend--inline">${esc(t.storyEnd)}</span>`
      : total <= 6
        ? UI.progress(d.revealLine + 1, total)
        : `<span class="mk-linecount mk-ltr">${esc(t.lines2(UI.d(d.revealLine + 1), UI.d(total)))}</span>`;
    let controls;
    if (hostRuns()) {
      const next = `<button type="button" class="mk-btn mk-btn--lg mk-btn--block" id="mk-next"${complete ? '' : ' disabled'}>${esc(complete ? (d.revealLast ? t.theEnd : t.nextStory) : (d.revealPaused ? t.paused : t.revealingNote))}<i class="ph-bold ${UI.fwdIcon()}" aria-hidden="true"></i></button>`;
      const pause = complete ? '' : `<button type="button" class="mk-btn mk-btn--sm mk-btn--paper" data-act="pause"><i class="ph-bold ${d.revealPaused ? 'ph-play' : 'ph-pause'}" aria-hidden="true"></i>${esc(d.revealPaused ? t.resume : t.pause)}</button>`;
      controls = `${next}<div class="mk-hostbar">${pause}${endRoomButton()}</div>`;
    } else {
      controls = `<div class="mk-note"><i class="ph-bold ${d.revealPaused ? 'ph-pause' : 'ph-book-open'}" aria-hidden="true"></i>${esc(complete ? t.waitNext(iso(hostName())) : d.revealPaused ? t.paused : t.revealingNote)}</div>`;
    }
    app.innerHTML = `<div class="mk-screen" style="gap:14px">
      <div class="mk-speakers">${speakers}</div>
      <div class="mk-row mk-row--between" style="gap:8px">
        <span class="mk-h2 mk-reveal-title">${esc(t.storyOf(UI.d(d.revealStory + 1), UI.d(d.totalRounds)))}</span>
        ${progress}
      </div>
      <div class="mk-storycard" id="mk-card">
        ${story.lines.map((l, k) => bubble(l, k, { still: k <= before, canHide: hostRuns(), story: d.revealStory })).join('')}
        ${complete ? '' : '<div class="mk-dots"><span></span><span></span><span></span></div>'}
      </div>
      ${controls}
    </div>`;
    const card = document.getElementById('mk-card');
    if (card) card.scrollTop = card.scrollHeight;
    const next = document.getElementById('mk-next');
    if (next) next.addEventListener('click', () => { next.disabled = true; send({ type: 'next' }); });
  }

  function storyTitle(story) {
    const t = UI.t();
    const first = story.lines[0];
    if (!first) return t.ink;
    if (first.hidden) return t.hidden;
    return first.text != null ? first.text : t.ink;
  }

  function screenEnd(d) {
    const t = UI.t();
    const stories = (d.stories || []).map((s, i) => ({ s, i })).filter(({ s }) => s.lines.length > 0);
    const cards = stories.map(({ s, i }) => {
      const starter = nameOf(s.starterId);
      return `<button type="button" class="mk-endcard" data-open="${i}">
        ${av(s.starterId, s.seat, 34)}
        <span class="mk-endcard__text"><span class="mk-endcard__first mk-clamp2" dir="auto">${esc(storyTitle(s))}</span><span class="mk-small" style="font-size:12px">${esc(t.by(iso(starter)))}</span></span>
        <i class="ph-bold ${UI.fwdIcon()}" style="font-size:20px;color:var(--ink-blue)" aria-hidden="true"></i>
      </button>`;
    }).join('');
    let footer;
    if (roomEnded) footer = `<div class="mk-note" style="min-height:48px"><i class="ph-bold ph-info" aria-hidden="true"></i>${esc(t.endedSub)}</div>`;
    else if (hostRuns()) footer = `<button type="button" class="mk-btn mk-btn--lg mk-btn--block" id="mk-again"><i class="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i>${esc(t.again)}</button><div class="mk-hostbar">${endRoomButton()}</div>`;
    else footer = `<div class="mk-note" style="min-height:48px"><i class="ph-bold ph-hourglass-medium" aria-hidden="true"></i>${esc(t.waitHost)}</div>`;
    const leave = isHost()
      ? `<a class="mk-btn mk-btn--md mk-btn--ghost" href="malarkey.html" style="align-self:center">${esc(t.home)}</a>`
      : `<button type="button" class="mk-btn mk-btn--md mk-btn--ghost" data-act="leave" style="align-self:center">${esc(t.leave)}</button>`;
    app.innerHTML = `<div class="mk-screen">
      <div class="mk-row" style="gap:12px">${UI.logo(64)}
        <div style="display:flex;flex-direction:column;gap:2px"><h1 class="mk-h1" style="font-size:28px">${esc(t.endH(UI.d(stories.length)))}</h1><span style="font:500 14px var(--font-body);color:var(--ink-700)">${esc(t.endSub)}</span></div>
      </div>
      <div class="mk-endlist">${cards}</div>
      ${footer}
      ${leave}
    </div>`;
    app.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { viewStory = Number(b.dataset.open); render(true); }));
    const again = document.getElementById('mk-again');
    if (again) again.addEventListener('click', () => {
      again.disabled = true;
      const s = socket();
      if (s) s.emit('room:restart');
    });
  }

  function screenStory(d) {
    const t = UI.t();
    const story = (d.stories || [])[viewStory];
    if (!story) { viewStory = null; return screenEnd(d); }
    const lines = story.lines.map((l, k) => {
      const missing = l.text == null;
      const body = l.hidden ? t.hidden : missing ? t.ink : l.text;
      const hide = hostRuns() && !l.hidden && !missing
        ? `<button type="button" class="mk-hidebtn" data-act="hide" data-story="${viewStory}" data-line="${k}" aria-label="${esc(t.hide)}" title="${esc(t.hide)}"><i class="ph-bold ph-eye-slash" aria-hidden="true"></i></button>` : '';
      return `<div class="mk-detail__line">${av(l.authorId, l.seat, 34)}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><p class="${missing || l.hidden ? 'is-missing' : ''}" dir="auto">${esc(body)}</p><span class="mk-small" style="font-size:12px" dir="auto">${esc(nameOf(l.authorId))}</span></div>${hide}
      </div>`;
    }).join('');
    app.innerHTML = `<div class="mk-screen">
      <div class="mk-row mk-row--between">
        <button type="button" class="mk-square" id="mk-back" aria-label="${esc(t.back)}"><i class="ph-bold ${UI.backIcon()}" aria-hidden="true"></i></button>
        <span class="mk-h2">${esc(t.storyOf(UI.d(viewStory + 1), UI.d(d.stories.length)))}</span>
      </div>
      <div class="mk-detail">${lines}</div>
      <button type="button" class="mk-btn mk-btn--lg mk-btn--block mk-btn--paper" id="mk-share"><i class="ph-bold ph-share-fat" aria-hidden="true"></i>${esc(t.share)}</button>
    </div>`;
    document.getElementById('mk-back').addEventListener('click', () => { viewStory = null; render(true); });
    document.getElementById('mk-share').addEventListener('click', () => shareStory(story));
  }

  // Shares the story's text (with who wrote each line) and a link to the
  // game -- nothing that exposes the room or anybody's account, and never a
  // line the host hid.
  function shareStory(story) {
    const t = UI.t();
    const body = story.lines.map((l) => `${nameOf(l.authorId)}: ${l.hidden ? t.hidden : l.text == null ? t.ink : l.text}`).join('\n');
    const url = `${location.origin}/malarkey.html`;
    const text = `${t.shareText(storyTitle(story))}\n\n${body}\n\n${url}`;
    if (navigator.share) {
      navigator.share({ title: 'تخاريف · Malarkey', text }).catch(() => {});
      return;
    }
    UI.copyText(text).then(() => UI.toast(t.copied)).catch(() => {});
  }

  // Redraws only when what is on screen has actually changed: the writing
  // screen holds a textarea somebody is typing in, so another player sending
  // their line must not rebuild it.
  function render(force) {
    const t = UI.t();
    if (roomEnded && !(state && state.phase === 'finished')) return screenNotice(t.ended, t.endedSub, { home: true });
    if (!state) return;
    const d = data();
    initials = UI.initialsFor(players());
    const phase = state.phase;
    if (d.removed) {
      if (lastKey !== 'removed' || force) { lastKey = 'removed'; screenNotice(t.removedH, t.removedSub, { leave: true }); }
      return;
    }
    const onlineKey = room ? room.members.filter((m) => m.connected).map((m) => m.userId).sort().join(',') : '';
    let key;
    if (phase === 'write') {
      if (!d.seated) key = 'late';
      else key = d.mySubmitted || d.closing ? `sent:${d.round}:${(d.submittedUserIds || []).length}:${d.closing ? 1 : 0}:${onlineKey}:${(players().filter((p) => p.removed)).length}` : `write:${d.round}`;
    } else if (phase === 'pass') key = d.seated ? `pass:${d.round}` : 'late';
    else if (phase === 'reveal') key = `reveal:${d.revealStory}:${d.revealLine}:${d.revealPaused ? 1 : 0}:${JSON.stringify((d.stories || [])[d.revealStory] || {}).length}`;
    else if (phase === 'finished') key = viewStory != null ? `story:${viewStory}:${JSON.stringify(d.stories || []).length}` : `end:${roomEnded ? 1 : 0}`;
    else key = phase;
    key += `:${hostName()}:${confirming || ''}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    if (phase !== lastPhaseKey) { lastPhaseKey = phase; confirming = null; }

    if (phase !== 'write') sending = false;
    if (key.startsWith('late')) return screenNotice(t.lateH, t.lateSub, { leave: true });
    if (phase === 'write') {
      if (d.mySubmitted || d.closing) {
        sending = false;
        try { localStorage.removeItem(draftKey()); } catch (_) { /* ignore */ }
        return screenSent(d);
      }
      if (force && document.getElementById('mk-line')) {
        // A language switch mid-sentence keeps the sentence.
        saveDraft(currentText());
      }
      return screenWrite(d);
    }
    if (phase === 'pass') return screenPass();
    if (phase === 'reveal') return screenReveal(d);
    if (phase === 'finished') return viewStory != null ? screenStory(d) : screenEnd(d);
  }
})();
