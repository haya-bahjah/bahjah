// Live-match monitor for the host, mounted into #host-console on
// trivia-lobby.html. The host never leaves this page for the whole match --
// lobby-room.js keeps them here (host-plays="false") instead of redirecting
// them to trivia-play.html like everyone else. Driven by the same
// 'bahjah:lobby-update' (room/host state) and 'bahjah:game-state' (round
// state) events every other per-game companion script on this page uses.
(function () {
  const LANG_ATTR = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const mount = document.getElementById('host-console');
  if (!mount) return; // not the trivia lobby

  const gate = document.getElementById('lobby-gate');
  const main = document.getElementById('lobby-main');

  let latestRoom = null;
  let latestState = null;
  let code = null;
  let socket = null;
  let active = false;

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    latestRoom = detail.room;
    code = detail.code;
    socket = detail.socket;
    active = Boolean(latestRoom && latestRoom.status !== 'lobby' && detail.isHost);

    if (!active) {
      mount.style.display = 'none';
      return;
    }
    if (gate) gate.style.display = 'none';
    if (main) main.style.display = 'none';
    mount.style.display = 'block';
    render();
  });

  document.addEventListener('bahjah:game-state', (e) => {
    const state = e.detail;
    if (state.gameType !== 'trivia') return;
    latestState = state;
    if (active) render();
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (active) render();
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('#hc-restart-btn')) {
      if (socket) socket.emit('room:restart');
    }
    if (e.target.closest('#hc-end-btn')) {
      if (socket) socket.emit('room:end');
    }
  });

  function nonHostMembers() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }

  // Host-authored custom questions never get an Arabic translation, so
  // always fall back to the English prompt/choices when one is missing.
  function questionPrompt(q) {
    return LANG_ATTR() === 'ar' && q.promptAr ? q.promptAr : q.prompt;
  }

  function questionChoices(q) {
    return LANG_ATTR() === 'ar' && q.choicesAr && q.choicesAr.length === q.choices.length ? q.choicesAr : q.choices;
  }

  function headerRow(roundLabel) {
    const lang = LANG_ATTR();
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
        <span class="hc-round-label">${roundLabel}</span>
        <button type="button" id="hc-end-btn" class="hc-btn-secondary" style="border-radius:8px; padding:6px 14px; font-size:12px; font-weight:700;">${lang === 'ar' ? 'أنهِ الغرفة' : 'End room'}</button>
      </div>
    `;
  }

  function render() {
    if (!latestRoom) return;
    const lang = LANG_ATTR();

    if (latestRoom.status === 'ended') {
      window.BahjahTimerBar.stop('hc');
      mount.innerHTML = `
        <div style="text-align:center; padding-block:60px;">
          <p class="hc-stat">${lang === 'ar' ? `أنهيت هذه اللعبة (الرمز: ${code}).` : `You ended this game (code: ${code}).`}</p>
        </div>
      `;
      return;
    }

    if (!latestState) {
      mount.innerHTML = `${headerRow(lang === 'ar' ? 'جارٍ بدء اللعبة…' : 'Starting the game…')}`;
      return;
    }

    const d = latestState.data || {};

    if (latestState.phase === 'countdown') {
      mount.innerHTML = `
        ${headerRow(lang === 'ar' ? 'استعدّوا' : 'Get ready')}
        <div style="text-align:center; padding-block:40px;">
          <div class="hc-timer" id="hc-timer-text"></div>
          <div class="timer-bar"><div class="timer-bar-fill" id="hc-timer-fill"></div></div>
          <p class="hc-stat">${lang === 'ar' ? 'ستبدأ اللعبة قريبًا' : 'The game is about to start'}</p>
        </div>
      `;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (latestState.phase === 'question') {
      const players = nonHostMembers();
      const answeredCount = d.answeredCount || 0;
      mount.innerHTML = `
        ${headerRow(lang === 'ar' ? `السؤال ${d.roundIndex + 1} من ${d.totalRounds}` : `Question ${d.roundIndex + 1} of ${d.totalRounds}`)}
        <div class="hc-timer" id="hc-timer-text"></div>
        <div class="timer-bar"><div class="timer-bar-fill" id="hc-timer-fill"></div></div>
        <div class="hc-question">${d.currentQuestion ? questionPrompt(d.currentQuestion) : ''}</div>
        <p class="hc-answered">${lang === 'ar' ? `${answeredCount} من ${players.length} أجابوا` : `${answeredCount} of ${players.length} answered`}</p>
      `;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (latestState.phase === 'reveal') {
      window.BahjahTimerBar.stop('hc');
      const q = d.currentQuestion;
      renderBoard(
        headerRow(lang === 'ar' ? 'الإجابة الصحيحة' : 'Correct answer'),
        `<div class="hc-question" style="margin-bottom:24px;">${q ? questionChoices(q)[d.correctIndex] : ''}</div>`,
        d.scores,
        null
      );
      return;
    }

    if (latestState.phase === 'finished') {
      window.BahjahTimerBar.stop('hc');
      const winnerIds = new Set(d.winnerUserIds || []);
      renderBoard(headerRow(lang === 'ar' ? 'انتهت اللعبة' : 'Game finished'), statsTable(d), d.scores, winnerIds);
      const actions = document.createElement('div');
      actions.className = 'hc-actions';
      actions.innerHTML = `
        <button type="button" id="hc-restart-btn" class="btn btn-primary">${lang === 'ar' ? 'العب مجددًا' : 'Play again'}</button>
      `;
      mount.appendChild(actions);
    }
  }

  function startTimer(endsAt) {
    const textEl = document.getElementById('hc-timer-text');
    window.BahjahTimerBar.start('hc', document.getElementById('hc-timer-fill'), null, endsAt, {
      onTick: (secs) => { if (textEl) textEl.textContent = String(secs); },
    });
  }

  function statsTable(d) {
    const lang = LANG_ATTR();
    if (!d.finalStats) return '';
    const rows = nonHostMembers();
    return `
      <div class="hc-board" style="margin-bottom:20px; font-size:12px; color:var(--muted);">
        ${rows
          .map((m) => {
            const s = d.finalStats[m.userId];
            if (!s) return '';
            return `<div style="display:flex; justify-content:space-between; padding:4px 0;"><span>${m.displayName}</span><span>${s.correctCount}/${d.totalRounds} · ${s.speedPct}% ${lang === 'ar' ? 'سرعة' : 'speed'}</span></div>`;
          })
          .join('')}
      </div>
    `;
  }

  // Same fix/rationale as trivia-play.js's rankedRows: source rows from
  // scores (atomic with this game:state) rather than solely from
  // latestRoom.members, which can lag behind during a reconnect.
  function rankedRows(scores) {
    const members = nonHostMembers();
    const byId = new Map(members.map((m) => [m.userId, m]));
    const ids = new Set([...Object.keys(scores || {}), ...members.map((m) => m.userId)]);
    const lang = LANG_ATTR();
    return Array.from(ids)
      .map((userId) => ({
        userId,
        displayName: byId.has(userId) ? byId.get(userId).displayName : lang === 'ar' ? 'لاعب' : 'Player',
        score: (scores && scores[userId]) || 0,
      }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
  }

  function renderBoard(header, extraHtml, scores, winnerIds) {
    const rows = rankedRows(scores || {});
    mount.innerHTML = `
      ${header}
      ${extraHtml}
      <div class="hc-board" id="hc-board"></div>
    `;
    window.BahjahRankedBoard.render('trivia-host', document.getElementById('hc-board'), rows, (row, i) => {
      const isWinner = Boolean(winnerIds && winnerIds.has(row.userId));
      return `
        <div class="hc-board-row ${isWinner ? 'winner' : ''}">
          <span class="hc-board-rank">${isWinner ? '★' : i + 1}</span>
          <span class="hc-board-name">${row.displayName}</span>
          <span class="hc-board-pts">${row.score}</span>
        </div>`;
    });
  }
})();
