// مجلسك -- the host control panel on the host's phone (H1-H4): the lobby
// with its players, live control during play (and, when the host plays too,
// their own answer above the controls), and the results with Leaderboard and
// Answers tabs and sharing. Opened from the shared screen's "Host panel"
// code (?panel=1), or whenever the host's screen is phone-sized.
(function () {
  const mount = document.getElementById('mj-panel');
  if (!mount) return;
  const UI = window.MjUI;
  const S = window.MjScreens;
  const Host = window.MjHost;
  const P = window.MjPlay;
  const esc = UI.esc;
  const params = new URLSearchParams(location.search);
  const panelMode = () => params.get('panel') === '1' || window.innerWidth < 700;

  let room = null;
  let state = null;
  let socket = null;
  let session = null;
  let active = false;
  let offline = false;
  let tab = 'board';
  let album = null;
  let lastConnected = null;

  P.wire(mount, () => ({ state, socket, code: room && room.code, rerender: render }));

  document.addEventListener('bahjah:lobby-update', async (e) => {
    const lobby = e.detail || {};
    room = lobby.room;
    socket = lobby.socket;
    active = Boolean(room && lobby.isHost && panelMode());
    mount.style.display = active ? 'block' : 'none';
    if (!active) return;
    ['lobby-gate', 'lobby-main'].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    noticeDrops();
    if (!session && room.code) {
      try { session = (await UI.api('GET', `/rooms/${encodeURIComponent(room.code)}/session`)).session; UI.applyTheme(session.themeId); } catch (_) { /* drawn without it */ }
    }
    render();
  });
  document.addEventListener('bahjah:game-state', async (e) => {
    if (!e.detail || e.detail.gameType !== 'majlisak') return;
    const before = state;
    state = e.detail;
    if (!active) return;
    if (before && before.phase !== state.phase) window.scrollTo(0, 0);
    if (state.phase === 'final' && !album && state.data.gameId) {
      try { album = (await UI.api('GET', `/games/${state.data.gameId}/album`)).album; } catch (_) { album = { token: null }; }
    }
    render();
  });
  document.addEventListener('bahjah:connection', (e) => { const s = e.detail && e.detail.state; offline = s === 'offline' || s === 'expired'; if (active) render(); });
  document.addEventListener('bahjah:lang-change', () => { if (active) render(); });

  // "Omar disconnected" -- only once they have stayed away a few seconds.
  let drops = [];
  function noticeDrops() {
    if (!room) return;
    const now = new Map(room.members.filter((m) => !m.isHost).map((m) => [m.userId, m]));
    if (lastConnected && room.status !== 'lobby') {
      for (const [id, m] of now) {
        if (!lastConnected.get(id) || m.connected) continue;
        setTimeout(() => {
          const still = room && room.members.find((x) => x.userId === id);
          if (still && !still.connected && !drops.includes(still.displayName)) { drops = [...drops, still.displayName].slice(-2); render(); }
        }, 5000);
      }
      drops = drops.filter((n) => { const m = room.members.find((x) => x.displayName === n); return m && !m.connected; });
    }
    lastConnected = new Map([...now].map(([id, m]) => [id, m.connected]));
  }

  mount.addEventListener('click', async (e) => {
    const t = UI.t();
    if (e.target.closest('[data-p-start]')) { if (socket) socket.emit('room:start'); return; }
    const kick = e.target.closest('[data-p-kick]');
    if (kick) {
      if (!(await UI.confirmSheet({ title: t.removeQ(kick.dataset.name), body: t.removeBody, yes: t.remove }))) return;
      if (room.status === 'lobby') socket && socket.emit('room:remove-player', { userId: kick.dataset.pKick });
      else socket && socket.emit('game:action', { action: { type: 'remove', userId: kick.dataset.pKick } });
      return;
    }
    if (e.target.closest('[data-p-hostplays]')) {
      try { const r = await UI.api('PATCH', `/rooms/${encodeURIComponent(room.code)}/session`, { hostPlays: !(session && session.hostPlays) }); session = { ...session, hostPlays: r.session.hostPlays }; } catch (err) { UI.toast(UI.errorText(err), 'no'); }
      render(); return;
    }
    const tb = e.target.closest('[data-p-tab]');
    if (tb) { tab = tb.dataset.pTab; render(); return; }
    const b = e.target.closest('[data-host-act]');
    if (b) await Host.run(b.dataset.hostAct, { state, socket, onShare: openShare });
  });

  function openShare() {
    const t = UI.t();
    const x = state.data;
    const wrap = document.createElement('div');
    wrap.className = 'mj-sheet';
    const text = Host.resultsText(state);
    const url = `${location.origin}/majlisak.html`;
    const winner = (x.ranking || [])[0];
    wrap.innerHTML = `<div role="dialog" aria-modal="true"><h2 class="mj-title" style="font-size:22px">${esc(t.shareResults)}</h2>
      <div class="mj-card" style="padding:0;overflow:hidden"><div class="mj-art" style="height:120px;background-image:url('${UI.themeUrl(x.themeId, x.themeImageId)}')"></div><div style="padding:12px;text-align:center"><span class="mj-h2" dir="auto">${esc(t.mabrouk(x.honoree))}</span><br><span class="mj-small" dir="auto">${esc(x.title)}${winner && x.scoredGame ? ` · ${esc(t.winners)}: ${esc(winner.name)}` : ''}</span></div></div>
      <button type="button" class="mj-item" style="border:0;cursor:pointer;color:var(--ink)" data-s="copy">${UI.icon('link', 16)}<span class="grow mj-label">${esc(t.copyLink)}</span></button>
      <a class="mj-item" style="text-decoration:none;color:var(--ink)" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}">${UI.icon('share', 16)}<span class="grow mj-label">${esc(t.whatsapp)}</span></a>
      <button type="button" class="mj-item" style="border:0;cursor:pointer;color:var(--ink)" data-s="native">${UI.icon('share', 16)}<span class="grow mj-label">${esc(t.share)}</span></button>
      <p class="mj-small">${esc(t.privateNote)}</p><button type="button" class="mj-btn mj-btn--secondary mj-btn--block" data-s="close">${esc(t.cancel)}</button></div>`;
    wrap.addEventListener('click', (ev) => {
      const s = ev.target.closest('[data-s]');
      if (ev.target === wrap || (s && s.dataset.s === 'close')) { wrap.remove(); return; }
      if (s && s.dataset.s === 'copy') { UI.shareOrCopy(text, url); wrap.remove(); }
      if (s && s.dataset.s === 'native') { UI.shareOrCopy(text, url); wrap.remove(); }
    });
    document.body.appendChild(wrap);
  }

  // --- Screens -----------------------------------------------------------------------
  function head(x, label, right) {
    return `${UI.art('banner', x)}<div class="mj-phone__body" style="padding-top:22px"><div class="mj-row"><span class="mj-label">${esc(label)}</span>${right || ''}</div>`;
  }
  function pLobby() {
    const t = UI.t();
    const s = session || { title: '', themeId: 'bridal' };
    const guests = room.members.filter((m) => !m.isHost);
    const playing = guests.length + (s.hostPlays ? 1 : 0);
    mount.innerHTML = `<div class="mj-phone" style="padding:0">${head(s, t.lobby, `<span class="mj-label" dir="ltr">${esc(room.code)}</span>`)}
      <h1 class="mj-title" style="font-size:22px">${esc(guests.length ? t.guestsJoined(guests.length) : t.waitingGuests)}</h1>
      <div class="mj-list">${guests.map((m) => `<div class="mj-item" style="background:transparent;min-height:40px;padding:4px 0${m.connected ? '' : ';opacity:.5'}">${UI.dot({ name: m.displayName, avatar: m.avatar, userId: m.userId }, 26)}<span class="grow" dir="auto">${esc(m.displayName)}</span><button type="button" class="mj-btn mj-btn--danger mj-btn--sm" data-p-kick="${esc(m.userId)}" data-name="${esc(m.displayName)}">${esc(t.remove)}</button></div>`).join('')}</div>
      <button type="button" class="mj-switchrow" data-p-hostplays role="switch" aria-checked="${Boolean(s.hostPlays)}"><span><span class="mj-label">${esc(t.hostPlays)}</span><br><span class="mj-small">${esc(t.hostPlaysSub)}</span></span><span class="mj-box" style="border-radius:999px;width:26px;height:26px">${s.hostPlays ? UI.icon('check', 14) : ''}</span></button>
      <p class="mj-small">${esc(t.tvLobbyHint)}</p></div>
      <div class="mj-phone__foot"><span class="mj-small">${esc(t.needTwo)}</span><button type="button" class="mj-btn mj-btn--block start-btn" data-p-start${playing >= 2 ? '' : ' disabled'}>${esc(t.start)}</button></div></div>`;
  }

  function pLive() {
    const t = UI.t();
    const x = state.data;
    const q = x.question;
    const progress = x.total ? Math.round(((x.index + 1) / x.total) * 100) : 0;
    const bs = Host.controls(state);
    const primary = state.phase === 'reveal' ? bs[0] : null;
    const rest = primary ? bs.slice(1) : bs;
    const alerts = drops.map((n) => `<div class="mj-alert">${esc(t.disconnected(n))}</div>`).join('');
    // The host's own answer, when they play too.
    let mine = '';
    if (x.hostPlays && state.phase === 'question' && !x.myAnswer) {
      mine = `<div class="mj-card" style="border:2px solid var(--ink)"><span class="mj-label">${esc(t.yourTurnToo)}</span>${S.answerArea(q, { honoree: x.honoree })}<button type="button" class="mj-btn mj-btn--block" data-mj-send${S.value(q) && !S.draft(q).sending ? '' : ' disabled'}>${esc(q.format === 'text' || q.format === 'photo' ? t.submit : t.lockIn)}</button></div>`;
    }
    let reveal = '';
    if (state.phase === 'reveal' && x.reveal) {
      reveal = q.format === 'mc' || q.format === 'checklist'
        ? `<div class="mj-opts">${q.options.map((o, i) => `<div class="mj-opt${(x.reveal.correct || []).includes(i) ? ' is-ok' : ''}" style="cursor:default;justify-content:space-between"><span dir="auto">${esc(o)}</span><span class="mj-label">${UI.d((x.reveal.counts || [])[i] || 0)}</span></div>`).join('')}</div>`
        : `<p class="mj-body">${esc(t.answersIn(x.reveal.answered || 0))}</p>`;
    }
    const body = `${head(x, state.phase === 'reveal' ? t.reveal : t.live, UI.timer(x))}
      <h1 class="mj-title" style="font-size:20px">${esc(t.qOf(x.index + 1, x.total))}</h1><p class="mj-q" style="font-size:17px" dir="auto">${esc(q.prompt)}</p>
      <div class="mj-progress"><i style="width:${progress}%"></i></div>
      <span class="mj-label">${esc(t.answered(x.answeredCount || 0, x.playerCount || 0))}</span>${alerts}${mine}${reveal}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${rest.map((b) => Host.buttonHtml(b)).join('')}</div></div>`;
    mount.innerHTML = `<div class="mj-phone" style="padding:0">${body}<div class="mj-phone__foot">${primary ? Host.buttonHtml({ ...primary }, '').replace('mj-btn"', 'mj-btn mj-btn--block"') : ''}${state.phase !== 'reveal' ? `<button type="button" class="mj-btn mj-btn--danger mj-btn--block" data-host-act="endGame">${esc(t.endGame)}</button>` : ''}</div></div>`;
    UI.tick();
  }

  function answerText(row, a) {
    const v = a.value || {};
    if ('choice' in v) return row.options[v.choice] || '';
    if ('choices' in v) return v.choices.map((c) => row.options[c]).join('، ');
    if ('text' in v) return v.text;
    if ('pairs' in v) return v.pairs.map((r, i) => `${row.pairs[i] ? row.pairs[i].left : ''} → ${row.pairs[r] ? row.pairs[r].right : ''}`).join(' · ');
    return '';
  }
  function pResults() {
    const t = UI.t();
    const x = state.data;
    const totals = (x.summary || []).reduce((acc, s) => ({ submitted: acc.submitted + (s.scored ? s.submitted : 0), unanswered: acc.unanswered + s.unanswered, unscored: acc.unscored + (s.scored ? 0 : s.submitted) }), { submitted: 0, unanswered: 0, unscored: 0 });
    let content = '';
    if (tab === 'board' && x.scoredGame) {
      content = `<div class="mj-list">${(x.ranking || []).map((r) => `<div class="mj-item" style="${r.rank === 1 ? 'background:var(--accent)' : ''}"><span class="mj-label" style="width:18px">${UI.d(r.rank)}</span><span class="grow" dir="auto">${esc(r.name)}</span><span class="mj-label">${UI.pts(r.score)}</span></div>`).join('')}</div>
        <div class="mj-chips"><span class="mj-badge mj-badge--pub">${esc(t.submitted(totals.submitted))}</span><span class="mj-badge">${esc(t.unanswered(totals.unanswered))}</span><span class="mj-badge mj-badge--warn">${esc(t.unscoredN(totals.unscored))}</span></div>`;
    } else {
      content = (x.answersTable || []).map((row) => `<div class="mj-card"><span class="mj-label" dir="auto">${esc(row.prompt)}</span>${row.skipped ? `<span class="mj-badge">${esc(t.skippedTag)}</span>` : ''}
        ${row.format === 'photo' ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${row.answers.map((a) => (album && album.token && a.value.photoId ? `<a href="/api/games/majlisak/album/${album.token}/photos/${esc(a.value.photoId)}" target="_blank" rel="noopener" title="${esc(a.name)}" style="aspect-ratio:1;border-radius:10px;background:url('/api/games/majlisak/album/${album.token}/photos/${esc(a.value.photoId)}') center/cover"></a>` : '')).join('')}</div>`
          : row.answers.map((a) => `<div class="mj-row" style="font:500 14px/1.4 var(--font-content)"><span><b dir="auto">${esc(a.name)}</b> · <span dir="auto">${esc(answerText(row, a))}</span></span>${a.points ? `<span class="mj-badge mj-badge--pub">${UI.plus(a.points)}</span>` : ''}</div>`).join('')}</div>`).join('');
    }
    mount.innerHTML = `<div class="mj-phone" style="padding:0">${UI.art('banner', x)}<div class="mj-phone__body" style="padding-top:22px"><h1 class="mj-title" style="font-size:22px">${esc(t.results)}</h1>
      ${x.scoredGame ? `<div class="mj-seg"><button type="button" class="${tab === 'board' ? 'is-on' : ''}" data-p-tab="board">${esc(t.leaderboard)}</button><button type="button" class="${tab === 'answers' ? 'is-on' : ''}" data-p-tab="answers">${esc(t.answers)}</button></div>` : ''}
      ${content}</div><div class="mj-phone__foot">${Host.controls(state).map((b, i) => Host.buttonHtml(b).replace('class="mj-btn', `class="mj-btn mj-btn--block${i ? '' : ''}`)).join('')}</div></div>`;
  }

  function render() {
    if (!active || !room) return;
    const t = UI.t();
    if (room.status === 'ended') { mount.innerHTML = `<div class="mj-phone"><div class="mj-phone__body mj-phone__body--center">${UI.logo(true)}<h1 class="mj-title">${esc(t.ended)}</h1><a class="mj-btn" href="majlisak.html">${esc(t.home)}</a></div></div>`; return; }
    if (room.status === 'lobby') { pLobby(); return; }
    if (offline) { mount.innerHTML = `<div class="mj-phone"><div class="mj-phone__body mj-phone__body--center">${UI.logo(true)}<h1 class="mj-title">${esc(t.reconnecting)}</h1></div></div>`; return; }
    if (!state) return;
    UI.applyTheme(state.data.themeId);
    if (state.phase === 'final') pResults();
    else {
      const typing = document.activeElement && document.activeElement.matches('[data-mj-text]');
      if (typing && state.phase === 'question') { UI.tick(); return; }
      pLive();
    }
  }
})();
