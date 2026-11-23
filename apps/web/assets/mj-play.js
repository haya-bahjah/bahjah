// مجلسك -- the guest's phone during the game (wireframes 10-18): the question
// in the event's theme, the answer for its format, locked in, the reveal
// (green / red, never before), and the final screen with sharing and a note
// for the honoree. Also drawn into the host's panel when the host plays too
// (MjPlay.renderInto).
window.MjPlay = (function () {
  const UI = window.MjUI;
  const S = window.MjScreens;
  const esc = UI.esc;

  // Sends the draft answer for the current question.
  async function send(state, socket, code, rerender) {
    const x = state.data;
    const q = x.question;
    const v = S.value(q);
    if (!v || !socket) return;
    socket.emit('game:action', { action: { type: 'answer', value: v } });
    S.draft(q).sending = true;
    rerender();
  }

  // A chosen photo: shrunk on the phone, uploaded, then held as the draft.
  async function choosePhoto(file, state, code, rerender) {
    const q = state.data.question;
    const dr = S.draft(q);
    dr.uploading = true;
    dr.preview = URL.createObjectURL(file);
    rerender();
    try {
      const blob = await UI.shrinkImage(file);
      const res = await UI.api('POST', `/rooms/${encodeURIComponent(code)}/photos`, undefined, blob);
      dr.photoId = res.id;
    } catch (e) {
      dr.preview = null;
      dr.photoId = null;
      UI.toast(UI.errorText(e), 'no');
    } finally {
      dr.uploading = false;
      rerender();
    }
  }

  // Wires taps and inputs on an element that shows a question.
  function wire(root, get) {
    root.addEventListener('click', (e) => {
      const { state, socket, code, rerender } = get();
      if (!state || state.phase !== 'question') return;
      const q = state.data.question;
      if (e.target.closest('[data-mj-send]')) { send(state, socket, code, rerender); return; }
      if (state.data.myAnswer) return;
      if (S.onTap(q, e.target)) rerender();
    });
    root.addEventListener('input', (e) => {
      const { state } = get();
      if (!state || state.phase !== 'question') return;
      const ta = e.target.closest('[data-mj-text]');
      if (ta) {
        const q = state.data.question;
        S.draft(q).text = ta.value;
        const c = root.querySelector('[data-mj-count]');
        if (c) c.textContent = `${UI.d(ta.value.length)} / ${UI.d(q.maxLength)}`;
        const b = root.querySelector('[data-mj-send]');
        if (b) b.disabled = !ta.value.trim();
      }
    });
    root.addEventListener('change', (e) => {
      const { state, code, rerender } = get();
      const f = e.target.closest('[data-mj-file]');
      if (f && f.files[0] && state && state.phase === 'question') choosePhoto(f.files[0], state, code, rerender);
    });
  }

  // The screens --------------------------------------------------------------
  function locked(x) {
    const t = UI.t();
    return `${UI.art('banner', x)}<div class="mj-phone__body mj-phone__body--center" style="padding-top:22px"><span class="mj-label" style="align-self:flex-start">${esc(t.qOf(x.index + 1, x.total))}</span><div style="flex:1"></div>
      <span style="width:84px;height:84px;border-radius:50%;background:var(--accent);border:2px solid var(--ink);display:inline-flex;align-items:center;justify-content:center">${UI.icon('lock', 34)}</span>
      <h1 class="mj-title" style="font-size:22px">${esc(x.myAnswer ? t.locked : t.noAnswer)}</h1><p class="mj-body">${esc(t.watchScreen)}</p><div style="flex:1"></div></div>`;
  }
  function rankLine(x, myId) {
    const list = UI.ranked(Object.entries(x.scores || {}).filter(([id]) => (x.players || []).some((p) => p.userId === id && !p.isHost)).map(([userId, score]) => ({ userId, score })).sort((a, b) => b.score - a.score));
    const me = list.find((r) => r.userId === myId);
    return me ? UI.t().youreRank(me.rank, me.score) : '';
  }
  function reveal(x, myId) {
    const t = UI.t();
    const q = x.question;
    const r = x.reveal || {};
    const mine = x.myResult;
    const scored = q.scored;
    let area = '';
    if (q.format === 'mc' || q.format === 'checklist') area = S.answerArea(q, { sent: x.myAnswer || { choices: [] }, reveal: { correct: r.correct || [] } });
    else if (q.format === 'match') {
      const rightFor = (r.pairs || []).map((p) => q.rights.indexOf(p.right));
      area = S.answerArea(q, { sent: x.myAnswer || { pairs: q.lefts.map(() => null) }, reveal: { rightFor } });
    } else if (q.format === 'text' && x.myAnswer) area = `<div class="mj-opt${scored ? (mine && mine.correct ? ' is-ok' : ' is-no') : ' is-sel'}" style="cursor:default" dir="auto">${esc(x.myAnswer.text)}</div>${scored && !(mine && mine.correct) && (r.accepted || []).length ? `<div class="mj-opt is-ok" style="cursor:default" dir="auto">${esc(r.accepted[0])}</div>` : ''}`;
    let verdict = '';
    if (!x.myAnswer) verdict = t.noAnswer;
    else if (!scored) verdict = t.answerSaved;
    else verdict = mine && mine.points ? t.nice(mine.points) : t.notQuite;
    const line = x.scoredGame ? rankLine(x, myId) : '';
    return `${UI.art('banner', x)}<div class="mj-phone__body" style="padding-top:22px"><span class="mj-label">${esc(t.qOf(x.index + 1, x.total))}</span><h1 class="mj-q" dir="auto">${esc(q.prompt)}</h1>${area}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:6px;min-height:120px"><h2 class="mj-title" style="font-size:26px">${esc(verdict)}</h2>${line ? `<span class="mj-small">${esc(line)}</span>` : ''}</div></div>`;
  }

  return { wire, locked, reveal, rankLine };
})();

// The guest's own page (majlisak-play.html).
(function () {
  const app = document.getElementById('app');
  if (!app || !document.body.classList.contains('mj-play')) return;
  const UI = window.MjUI;
  const S = window.MjScreens;
  const P = window.MjPlay;
  const esc = UI.esc;
  const code = (new URLSearchParams(location.search).get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();
  const myId = me ? me.id : '';
  let room = null;
  let state = null;
  let ended = false;
  let offline = false;
  let noteOpen = false;
  let noteSent = false;
  let bound = false;

  const socket = () => window.BahjahRoom && window.BahjahRoom.socket;
  P.wire(app, () => ({ state, socket: socket(), code, rerender: render }));

  document.addEventListener('bahjah:room-update', (e) => {
    room = e.detail;
    if (room.status === 'lobby') { location.href = `majlisak-lobby.html?code=${encodeURIComponent(code)}`; return; }
    if (room.status === 'ended') ended = true;
    render();
  });
  document.addEventListener('bahjah:game-state', (e) => {
    if (!e.detail || e.detail.gameType !== 'majlisak') return;
    const before = state;
    state = e.detail;
    document.body.classList.add('is-live');
    const x = state.data || {};
    UI.applyTheme(x.themeId);
    if (!bound && socket()) {
      bound = true;
      socket().on('room:error', (err) => { if (state && state.data && state.data.question) S.draft(state.data.question).sending = false; if (err.code !== 'INVALID_PHASE') UI.toast(UI.errorText(err), 'no'); render(); });
      socket().on('room:removed', () => { location.href = 'majlisak.html'; });
    }
    if (before && (before.phase !== state.phase || (before.data || {}).index !== x.index)) {
      window.scrollTo(0, 0);
      if (state.phase === 'question' && navigator.vibrate) navigator.vibrate(40);
      if (state.phase === 'reveal' && x.myResult && x.myResult.points && window.BahjahSoundFx) { try { window.BahjahSoundFx.correct(); } catch (_) { /* needs a tap first */ } }
    }
    render();
  });
  document.addEventListener('bahjah:connection', (e) => { const s = e.detail && e.detail.state; offline = s === 'offline' || s === 'expired'; render(); });
  document.addEventListener('bahjah:lang-change', render);

  app.addEventListener('click', async (e) => {
    const t = UI.t();
    if (e.target.closest('[data-note-open]')) { noteOpen = true; render(); const ta = app.querySelector('[data-note]'); if (ta) ta.focus(); return; }
    if (e.target.closest('[data-note-send]')) {
      const ta = app.querySelector('[data-note]');
      const text = ta ? ta.value.trim() : '';
      if (!text) return;
      try { await UI.api('POST', `/rooms/${encodeURIComponent(code)}/notes`, { text }); noteSent = true; noteOpen = false; UI.toast(t.noteSent); } catch (err) { UI.toast(UI.errorText(err), 'no'); }
      render(); return;
    }
    if (e.target.closest('[data-share-mine]')) {
      const x = state.data;
      const mine = (x.ranking || []).find((r) => r.userId === myId);
      UI.shareOrCopy(mine && x.scoredGame ? `${t.thanks(x.honoree)} ${t.finished(mine.rank, mine.score)}` : t.thanks(x.honoree), `${location.origin}/majlisak.html`);
      return;
    }
    if (e.target.closest('[data-leave]')) { const s = socket(); if (s) s.emit('room:leave'); setTimeout(() => { location.href = 'majlisak.html'; }, 250); }
  });

  function frame(inner) {
    app.innerHTML = `<div class="mj-phone" style="padding:0">${inner}</div>`;
    UI.tick();
  }
  function notice(title, sub, opts = {}) {
    const t = UI.t();
    app.innerHTML = `<div class="mj-phone"><div class="mj-phone__body mj-phone__body--center">${UI.logo(true)}<h1 class="mj-title" style="font-size:22px">${esc(title)}</h1>${sub ? `<p class="mj-body">${esc(sub)}</p>` : ''}
      ${opts.home ? `<a class="mj-btn" href="majlisak.html">${esc(t.home)}</a>` : ''}${opts.leave ? `<button type="button" class="mj-btn mj-btn--secondary" data-leave>${esc(t.leave)}</button>` : ''}</div></div>`;
  }

  function final(x) {
    const t = UI.t();
    const mine = (x.ranking || []).find((r) => r.userId === myId);
    const line = mine && x.scoredGame ? t.finished(mine.rank, mine.score) : t.thanksPlaying;
    const note = noteOpen
      ? `<textarea class="mj-input" data-note maxlength="300" placeholder="${esc(t.notePh)}" dir="auto" style="min-height:90px"></textarea><button type="button" class="mj-btn mj-btn--block" data-note-send>${esc(t.sendNote)}</button>`
      : noteSent ? `<span class="mj-small" style="text-align:center">${esc(t.noteSent)}</span>` : `<button type="button" class="mj-btn mj-btn--secondary mj-btn--block" data-note-open>${UI.icon('heart', 16)}${esc(t.leaveNote(x.honoree))}</button>`;
    frame(`${UI.art('full', x)}<div class="mj-phone__body mj-phone__body--center"><h1 class="mj-title" style="font-size:24px" dir="auto">${esc(t.thanks(x.honoree))}</h1><p class="mj-body">${esc(line)}</p></div>
      <div class="mj-phone__foot"><button type="button" class="mj-btn mj-btn--block" data-share-mine>${UI.icon('share', 16)}${esc(t.share)}</button>${note}
        ${ended ? `<span class="mj-small" style="text-align:center">${esc(t.ended)}</span>` : ''}<button type="button" class="mj-btn mj-btn--ghost mj-btn--block" data-leave>${esc(t.leave)}</button></div>`);
  }

  function render() {
    const t = UI.t();
    if (ended && !(state && state.phase === 'final')) return notice(t.ended, '', { home: true });
    if (offline) return notice(t.reconnecting, t.keepOpen);
    if (!state) return undefined;
    const x = state.data || {};
    if (x.removed) return notice(t.removedH, '', { leave: true });
    switch (state.phase) {
      case 'question': {
        const q = x.question;
        if (x.myAnswer) { S.draft(q).sending = false; return frame(P.locked(x)); }
        // Someone else answering must not pull the keyboard away mid-word.
        const typing = document.activeElement && document.activeElement.matches('[data-mj-text]');
        if (typing && app.dataset.q === q.id) { UI.tick(); return undefined; }
        app.dataset.q = q.id;
        return frame(S.guestQuestion(x, x));
      }
      case 'locked': return frame(P.locked(x));
      case 'reveal': return frame(P.reveal(x, myId));
      case 'final': return final(x);
      default: return undefined;
    }
  }
})();
