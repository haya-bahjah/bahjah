// تخاريف · Malarkey -- the player's phone (the design's phone screens 4-8:
// write, sent, pass, reveal, the end and a story in full). Driven by the
// 'bahjah:game-state' events assets/lobby.js dispatches.
//
// When the host plays too (a phones-only room) the host is on this page
// with everybody else, and turns the pages from here.
(function () {
  const app = document.getElementById('app');
  if (!app) return;
  const UI = window.MkUI;
  const esc = UI.esc;

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
  // Writing.
  let draftTimer = null;
  let lastSentDraft = null;
  let finalFlushKey = '';
  let sending = false;
  let errorsBound = false;

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
    state = next;
    document.body.classList.add('is-live');
    bindErrors();
    render(false);
  });

  document.addEventListener('bahjah:lang-change', () => render(true));

  function bindErrors() {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (errorsBound || !socket) return;
    errorsBound = true;
    socket.on('room:error', (err) => {
      sending = false;
      const t = UI.t();
      if (err.code === 'ROUND_LOCKED') UI.toast(t.locked);
      else if (err.code === 'EMPTY_LINE' || err.code === 'ALREADY_SUBMITTED' || err.code === 'INVALID_PHASE' || err.code === 'STORY_UNFOLDING') return;
      else if (err.message && state) UI.toast(err.message);
      if (state && state.phase === 'write') render(false);
    });
  }

  function send(action) {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (socket) socket.emit('game:action', { action });
  }

  const data = () => (state && state.data) || {};
  const isHost = () => Boolean(room && room.members.some((m) => m.userId === myId && m.isHost));
  const nameOf = (userId) => ((data().players || []).find((p) => p.userId === userId) || {}).name || '';
  const seatOf = (userId) => ((data().players || []).find((p) => p.userId === userId) || { seat: -1 }).seat;
  const hostName = () => {
    const h = room && room.members.find((m) => m.isHost);
    return h ? h.displayName : '';
  };

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
      <div style="display:flex;flex-direction:column;gap:6px">
        <span class="mk-label">${esc(t.round(UI.d(d.round + 1), UI.d(d.totalRounds)))}</span>
        ${UI.progress(d.round + 1, d.totalRounds)}
      </div>
      ${UI.timer(d.phaseEndsAt, d.roundSeconds || 45, 68)}
    </div>`;
  }

  function screenWrite(d) {
    const t = UI.t();
    const first = d.round === 0;
    const saved = loadDraft();
    const text = saved != null && saved.length >= (d.myDraft || '').length ? saved : (d.myDraft || '');
    lastSentDraft = d.myDraft || '';
    const prompt = first ? '' : `
      <div class="mk-heading"><h1 class="mk-h1">${esc(t.contH)}</h1><p class="mk-sub">${esc(t.contSub)}</p></div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:4px">
        <div class="mk-prompt"><span class="mk-prompt__tail"></span><div class="mk-prompt__body${d.prompt == null ? ' is-missing' : ''}">${esc(d.prompt == null ? t.ink : d.prompt)}</div></div>
        <div class="mk-prompt__by">${UI.avatar('', 0, 28, { empty: true })}<span class="mk-small">${esc(t.byOne)}</span></div>
      </div>`;
    app.innerHTML = `<div class="mk-screen" style="gap:16px">
      ${header(d)}
      ${first ? `<div class="mk-heading"><h1 class="mk-h1">${esc(t.firstH)}</h1><p class="mk-sub">${esc(t.firstSub)}</p></div>` : prompt}
      <label style="display:flex;flex-direction:column;gap:6px;flex:1;min-height:0">
        <textarea class="mk-textarea" id="mk-line" maxlength="250" placeholder="${esc(t.ph)}" aria-label="${esc(t.ph)}" style="flex:1;min-height:110px">${esc(text)}</textarea>
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
    btn.addEventListener('click', () => {
      const value = ta.value.trim();
      if (!value || sending) return;
      sending = true;
      btn.disabled = true;
      clearTimeout(draftTimer);
      send({ type: 'submit', text: value });
    });
    if (text && text !== lastSentDraft) pushDraft(false);
  }

  function screenSent(d) {
    const t = UI.t();
    const done = new Set(d.submittedUserIds || []);
    const still = d.closing ? [] : (d.players || []).filter((p) => !done.has(p.userId));
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
          ${still.slice(0, 6).map((p) => UI.avatar(p.name, p.seat, 40, { status: 'writing' })).join('')}
          <span style="font:600 14px var(--font-body);color:var(--ink-500)">${esc(still.length ? t.left(UI.d(still.length)) : t.allIn)}</span>
        </div>
      </div>
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

  function screenLate() {
    const t = UI.t();
    app.innerHTML = `<div class="mk-screen mk-screen--center">
      ${UI.logo(160)}
      <h1 class="mk-h1">${esc(t.lateH)}</h1>
      <p class="mk-sub">${esc(t.lateSub)}</p>
    </div>`;
  }

  function bubble(l, k, still) {
    const t = UI.t();
    const missing = l.text == null;
    const mine = l.authorId === myId;
    const cls = `mk-chat${k === 0 ? ' is-first' : ''}${mine ? ' is-mine' : ''}${still ? ' is-still' : ''}`;
    return `<div class="${cls}">
      ${UI.avatar(nameOf(l.authorId), l.seat, 32)}
      <div class="mk-bubble" style="--bubble-ink:var(--player-${l.seat % 8})">
        <span class="mk-bubble__by">${esc(nameOf(l.authorId))}</span>
        <span class="mk-bubble__text${missing ? ' is-missing' : ''}">${esc(missing ? t.ink : l.text)}</span>
      </div>
    </div>`;
  }

  function screenReveal(d) {
    const t = UI.t();
    const n = d.totalRounds;
    const story = (d.stories || [])[d.revealStory];
    if (!story) return screenPass();
    const complete = d.revealLine >= n - 1;
    const current = story.lines[d.revealLine];
    const speaker = !complete && current ? current.authorId : null;
    const before = shownLine.startsWith(`${d.revealStory}:`) ? Number(shownLine.split(':')[1]) : -1;
    shownLine = `${d.revealStory}:${d.revealLine}`;
    const ps = d.players || [];
    const size = ps.length <= 5 ? 46 : ps.length <= 7 ? 36 : 30;
    const speakers = ps.map((p) => {
      const on = complete || p.userId === speaker;
      const lift = !complete && p.userId === speaker;
      return `<div style="opacity:${on ? 1 : 0.4};transform:${lift ? 'translateY(-3px) scale(1.08)' : 'none'}">${UI.avatar(p.name, p.seat, size, { status: room && room.members.some((m) => m.userId === p.userId && m.isHost) ? 'host' : null, showName: ps.length <= 6 })}</div>`;
    }).join('');
    const last = d.revealStory >= n - 1;
    const controls = isHost() && d.hostPlays
      ? `<button type="button" class="mk-btn mk-btn--lg mk-btn--block" id="mk-next"${complete ? '' : ' disabled'}>${esc(complete ? (last ? t.theEnd : t.nextStory) : t.revealingNote)}<i class="ph-bold ${UI.fwdIcon()}" aria-hidden="true"></i></button>`
      : `<div class="mk-note"><i class="ph-bold ph-book-open" aria-hidden="true"></i>${esc(complete ? t.waitNext(hostName()) : t.revealingNote)}</div>`;
    app.innerHTML = `<div class="mk-screen" style="gap:16px">
      <div class="mk-speakers${ps.length > 6 ? ' mk-speakers--many' : ''}">${speakers}</div>
      <div class="mk-row mk-row--between" style="gap:8px">
        <span class="mk-h2">${esc(t.storyOf(UI.d(d.revealStory + 1), UI.d(n)))}</span>
        ${UI.progress(d.revealLine + 1, n, { tight: n > 6 })}
      </div>
      <div class="mk-storycard" id="mk-card">
        ${story.lines.map((l, k) => bubble(l, k, k <= before)).join('')}
        ${complete ? `<span class="mk-theend">${esc(t.storyEnd)}</span>` : '<div class="mk-dots"><span></span><span></span><span></span></div>'}
      </div>
      ${controls}
    </div>`;
    const card = document.getElementById('mk-card');
    if (card) card.scrollTop = card.scrollHeight;
    const next = document.getElementById('mk-next');
    if (next) next.addEventListener('click', () => { next.disabled = true; send({ type: 'next' }); });
  }

  function storyTitle(story) {
    const first = story.lines[0];
    return first && first.text != null ? first.text : UI.t().ink;
  }

  function screenEnd(d) {
    const t = UI.t();
    const stories = d.stories || [];
    const cards = stories.map((s, i) => {
      const starter = nameOf(s.starterId);
      return `<button type="button" class="mk-endcard" data-open="${i}">
        ${UI.avatar(starter, s.seat, 34)}
        <span class="mk-endcard__text"><span class="mk-endcard__first mk-clamp2">${esc(storyTitle(s))}</span><span class="mk-small" style="font-size:12px">${esc(t.by(starter))}</span></span>
        <i class="ph-bold ${UI.fwdIcon()}" style="font-size:20px;color:var(--ink-blue)" aria-hidden="true"></i>
      </button>`;
    }).join('');
    let footer;
    if (roomEnded) footer = `<div class="mk-note" style="min-height:48px"><i class="ph-bold ph-info" aria-hidden="true"></i>${esc(t.endedSub)}</div>`;
    else if (isHost() && d.hostPlays) footer = `<button type="button" class="mk-btn mk-btn--lg mk-btn--block" id="mk-again"><i class="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i>${esc(t.again)}</button>`;
    else footer = `<div class="mk-note" style="min-height:48px"><i class="ph-bold ph-hourglass-medium" aria-hidden="true"></i>${esc(t.waitHost)}</div>`;
    app.innerHTML = `<div class="mk-screen">
      <div class="mk-row" style="gap:12px">${UI.logo(64)}
        <div style="display:flex;flex-direction:column;gap:2px"><h1 class="mk-h1" style="font-size:28px">${esc(t.endH(UI.d(stories.length)))}</h1><span style="font:500 14px var(--font-body);color:var(--ink-700)">${esc(t.endSub)}</span></div>
      </div>
      <div class="mk-endlist">${cards}</div>
      ${footer}
      <a class="mk-btn mk-btn--md mk-btn--ghost" href="malarkey.html" style="align-self:center">${esc(t.leave)}</a>
    </div>`;
    app.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { viewStory = Number(b.dataset.open); render(true); }));
    const again = document.getElementById('mk-again');
    if (again) again.addEventListener('click', () => {
      again.disabled = true;
      const socket = window.BahjahRoom && window.BahjahRoom.socket;
      if (socket) socket.emit('room:restart');
    });
  }

  function screenStory(d) {
    const t = UI.t();
    const story = (d.stories || [])[viewStory];
    if (!story) { viewStory = null; return screenEnd(d); }
    const lines = story.lines.map((l) => {
      const missing = l.text == null;
      return `<div class="mk-detail__line">${UI.avatar(nameOf(l.authorId), l.seat, 34)}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><p class="${missing ? 'is-missing' : ''}">${esc(missing ? t.ink : l.text)}</p><span class="mk-small" style="font-size:12px">${esc(nameOf(l.authorId))}</span></div>
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
  // game -- nothing that exposes the room or anybody's account.
  function shareStory(story) {
    const t = UI.t();
    const body = story.lines.map((l) => `${nameOf(l.authorId)}: ${l.text == null ? t.ink : l.text}`).join('\n');
    const url = `${location.origin}/malarkey.html`;
    const text = `${t.shareText(storyTitle(story))}\n\n${body}\n\n${url}`;
    if (navigator.share) {
      navigator.share({ title: 'تخاريف · Malarkey', text }).catch(() => {});
      return;
    }
    UI.copyText(text).then(() => UI.toast(t.copied)).catch(() => {});
  }

  function screenEnded() {
    const t = UI.t();
    app.innerHTML = `<div class="mk-screen mk-screen--center">
      ${UI.logo(180)}
      <h1 class="mk-h1">${esc(t.ended)}</h1>
      <p class="mk-sub">${esc(t.endedSub)}</p>
      <a class="mk-btn mk-btn--lg mk-btn--paper" href="malarkey.html">${esc(t.home)}</a>
    </div>`;
  }

  // Redraws only when what is on screen has actually changed: the writing
  // screen holds a textarea somebody is typing in, so another player sending
  // their line must not rebuild it.
  function render(force) {
    if (roomEnded && !(state && state.phase === 'finished')) return screenEnded();
    if (!state) return;
    const d = data();
    const phase = state.phase;
    let key;
    if (phase === 'write') {
      if (!d.seated) key = 'late';
      else key = d.mySubmitted || d.closing ? `sent:${d.round}:${(d.submittedUserIds || []).length}:${d.closing ? 1 : 0}` : `write:${d.round}`;
    } else if (phase === 'pass') key = d.seated ? `pass:${d.round}` : 'late';
    else if (phase === 'reveal') key = `reveal:${d.revealStory}:${d.revealLine}`;
    else if (phase === 'finished') key = viewStory != null ? `story:${viewStory}` : `end:${roomEnded ? 1 : 0}`;
    else key = phase;
    key += `:${room && room.members.find((m) => m.isHost) ? hostName() : ''}`;
    if (!force && key === lastKey) return;
    lastKey = key;

    if (phase !== 'write') sending = false;
    if (key.startsWith('late')) return screenLate();
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
