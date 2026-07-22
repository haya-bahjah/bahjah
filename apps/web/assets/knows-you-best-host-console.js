// Live-match monitor for the host, mounted into #host-console on
// knows-you-best-lobby.html. The host never leaves this page for the whole
// match -- lobby-room.js keeps them here (host-plays="false" on <body>)
// instead of redirecting them to knows-you-best-play.html like everyone
// else. Unlike trivia, the host MAY also be a real player here (per-room
// "I want to play too" choice, see knows-you-best-lobby-config.js) -- when
// data.hostPlays is true, this console additionally embeds the same
// private-answer input and rope-matching board the play page uses, driven
// by the same per-viewer game:state the host's own socket connection
// already receives.
(function () {
  const LANG_ATTR = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const mount = document.getElementById('host-console');
  if (!mount) return; // not the knows-you-best lobby

  const gate = document.getElementById('lobby-gate');
  const main = document.getElementById('lobby-main');

  let latestRoom = null;
  let latestState = null;
  let code = null;
  let socket = null;
  let me = null;
  let active = false;
  let matchBoard = null;
  // The host's own submitted matches for the current round, retained
  // across the guessing -> reveal transition so the reveal view can mark
  // each of the host's own connections correct/incorrect (mirrors the
  // play page's own local-draft retention).
  let mySubmittedMatches = null;

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    latestRoom = detail.room;
    me = detail.me;
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
    if (state.gameType !== 'knows-you-best') return;
    latestState = state;
    if (active) render();
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (active) render();
  });

  // hc-restart-btn/hc-end-btn are handled here via delegation since they're
  // simple fire-once actions. hc-answer-submit is deliberately NOT handled
  // here -- renderAnswering() attaches its own direct listener (matching
  // play.js's pattern), and adding a second delegated one here would fire
  // submitHostAnswer() twice per click, double-emitting the 'answer'
  // action. If the host is the last player to answer, the first emit
  // resolves the round into 'guessing' before the second lands, and that
  // second (now-stale) action gets rejected by the engine -- which the
  // generic room:error handler then surfaces by hiding the whole console.
  document.addEventListener('click', (e) => {
    if (e.target.closest('#hc-restart-btn')) {
      if (socket) socket.emit('room:restart');
    }
    if (e.target.closest('#hc-end-btn')) {
      if (socket) socket.emit('room:end');
    }
  });

  function allMembers() {
    return latestRoom ? latestRoom.members : [];
  }

  function nonHostMembers() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }

  function playersForDisplay(d) {
    return d.hostPlays ? allMembers() : nonHostMembers();
  }

  function nameById() {
    const map = {};
    allMembers().forEach((m) => {
      map[m.userId] = m.displayName;
    });
    return map;
  }

  function questionPrompt(prompt) {
    if (!prompt) return '';
    return LANG_ATTR() === 'ar' && prompt.textAr ? prompt.textAr : prompt.text;
  }

  function roundLabel(d) {
    const lang = LANG_ATTR();
    return lang === 'ar' ? `السؤال ${d.roundIndex + 1} من ${d.totalRounds}` : `Question ${d.roundIndex + 1} of ${d.totalRounds}`;
  }

  function headerRow(label) {
    const lang = LANG_ATTR();
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
        <span class="hc-round-label">${label}</span>
        <button type="button" id="hc-end-btn" class="hc-btn-secondary" style="border-radius:8px; padding:6px 14px; font-size:12px; font-weight:700;">${lang === 'ar' ? 'أنهِ الغرفة' : 'End room'}</button>
      </div>
    `;
  }

  function countdownSeconds(endsAt) {
    if (!endsAt) return '';
    return String(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  }

  function submitHostAnswer() {
    const input = document.getElementById('hc-answer-input');
    if (!input || !socket || input.disabled) return;
    const text = input.value.trim();
    if (!text) return;
    input.disabled = true;
    const btn = document.getElementById('hc-answer-submit');
    if (btn) btn.disabled = true;
    socket.emit('game:action', { action: { type: 'answer', text } });
  }

  function render() {
    if (!latestRoom) return;
    if (matchBoard) {
      matchBoard.destroy();
      matchBoard = null;
    }
    const lang = LANG_ATTR();

    if (!latestState) {
      mount.innerHTML = headerRow(lang === 'ar' ? 'جارٍ بدء اللعبة…' : 'Starting the game…');
      return;
    }

    const d = latestState.data || {};

    if (latestState.phase === 'answering') {
      mySubmittedMatches = null;
      renderAnswering(d, lang);
      return;
    }
    if (latestState.phase === 'guessing') {
      renderGuessing(d, lang);
      return;
    }
    if (latestState.phase === 'reveal') {
      renderReveal(d, lang);
      return;
    }
    if (latestState.phase === 'finished') {
      renderFinished(d, lang);
    }
  }

  function renderAnswering(d, lang) {
    const totalPlayers = playersForDisplay(d).length;
    const answeredCount = d.answeredCount || 0;

    let bodyHtml = '';
    if (d.hostPlays && !d.myAnswered) {
      bodyHtml = `
        <input type="text" class="hc-answer-input" id="hc-answer-input" maxlength="280" placeholder="${lang === 'ar' ? 'اكتب إجابتك…' : 'Type your answer…'}">
        <button type="button" class="btn btn-primary hc-answer-submit" id="hc-answer-submit">${lang === 'ar' ? 'إرسال' : 'Submit'}</button>
      `;
    } else if (d.hostPlays && d.myAnswered) {
      bodyHtml = `<p class="hc-stat" style="text-align:center; margin-bottom:14px;">${lang === 'ar' ? 'تم إرسال إجابتك ✓' : 'Your answer is in ✓'}</p>`;
    }

    mount.innerHTML = `
      ${headerRow(roundLabel(d))}
      <div class="hc-question">${questionPrompt(d.currentPrompt)}</div>
      ${bodyHtml}
      <p class="hc-answered">${lang === 'ar' ? `${answeredCount} من ${totalPlayers} أجابوا` : `${answeredCount} of ${totalPlayers} answered`}</p>
    `;

    const submitBtn = document.getElementById('hc-answer-submit');
    const input = document.getElementById('hc-answer-input');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitHostAnswer(); });
    if (submitBtn) submitBtn.addEventListener('click', submitHostAnswer);
  }

  function renderGuessing(d, lang) {
    const totalPlayers = playersForDisplay(d).length;
    mount.innerHTML = `
      ${headerRow(roundLabel(d))}
      <div class="hc-question">${questionPrompt(d.currentPrompt)}</div>
      <p class="hc-answered">${lang === 'ar' ? `${d.guessedCount || 0} من ${totalPlayers} أنهوا المطابقة` : `${d.guessedCount || 0} of ${totalPlayers} finished matching`}</p>
      ${d.hostPlays ? '<div id="hc-match-mount" style="margin-top:20px;"></div>' : ''}
    `;

    if (d.hostPlays && Array.isArray(d.answers) && me) {
      const mountEl = document.getElementById('hc-match-mount');
      const names = playersForDisplay(d)
        .filter((m) => m.userId !== me.id)
        .map((m) => ({ userId: m.userId, displayName: m.displayName }));
      const guessableAnswers = d.answers.filter((a) => a.index !== d.myAnswerIndex);
      matchBoard = window.BahjahKybMatchBoard.mount(mountEl, {
        names,
        answers: guessableAnswers,
        labels: {
          submitBtn: lang === 'ar' ? 'أرسل المطابقات' : 'Submit Matches',
          hint: lang === 'ar' ? 'اسحب اسمًا إلى الإجابة التي تظن أنه كتبها.' : 'Drag a name onto the answer you think they wrote.',
        },
        onSubmit: (matches) => {
          mySubmittedMatches = matches;
          if (!socket) return;
          // One atomic batch action, not one action per connection -- see
          // the engine's KnowsYouBestAction comment for why.
          socket.emit('game:action', { action: { type: 'guessAll', guesses: matches } });
        },
      });
    }
  }

  function renderReveal(d, lang) {
    const reveal = d.lastRoundReveal || [];
    const names = nameById();
    const revealRows = reveal
      .map((r, i) => {
        const guessedUserId = d.hostPlays && mySubmittedMatches ? mySubmittedMatches[i] : undefined;
        const mark = guessedUserId === undefined ? '' : guessedUserId === r.authorUserId ? ' <svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align:-2px;"><circle cx="12" cy="12" r="12" style="fill:var(--good)"/><path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ' ❌';
        return `<div class="hc-board-row"><span class="hc-board-name">${r.text}</span><span class="hc-board-pts">${names[r.authorUserId] || ''}${mark}</span></div>`;
      })
      .join('');

    renderBoard(
      headerRow(lang === 'ar' ? 'الإجابات الصحيحة' : 'Correct answers'),
      `<div class="hc-board" style="margin-bottom:20px;">${revealRows}</div>`,
      d,
      null
    );
  }

  function renderFinished(d, lang) {
    const winnerIds = new Set(d.winnerUserIds || []);
    renderBoard(headerRow(lang === 'ar' ? 'انتهت اللعبة' : 'Game finished'), statsTable(d), d, winnerIds);
    const actions = document.createElement('div');
    actions.className = 'hc-actions';
    actions.innerHTML = `
      <button type="button" id="hc-restart-btn" class="btn btn-primary">${lang === 'ar' ? 'العب مجددًا' : 'Play again'}</button>
    `;
    mount.appendChild(actions);
  }

  function statsTable(d) {
    const lang = LANG_ATTR();
    if (!d.finalStats) return '';
    const names = nameById();
    const rows = playersForDisplay(d)
      .map((m) => {
        const s = d.finalStats[m.userId];
        if (!s) return '';
        const topGuesserLine = s.topGuesser
          ? lang === 'ar'
            ? ` · أكثر من خمّنك: ${names[s.topGuesser.userId] || ''} (${s.topGuesser.count})`
            : ` · guessed you most: ${names[s.topGuesser.userId] || ''} (${s.topGuesser.count})`
          : '';
        return `<div style="display:flex; justify-content:space-between; padding:4px 0; flex-wrap:wrap;"><span>${m.displayName}</span><span>${
          lang === 'ar'
            ? `${s.totalCorrect} صحيحة · ${s.perfectRounds} جولة مثالية · دقة ${s.accuracyPct}%${topGuesserLine}`
            : `${s.totalCorrect} correct · ${s.perfectRounds} perfect · ${s.accuracyPct}% accuracy${topGuesserLine}`
        }</span></div>`;
      })
      .join('');
    return `<div class="hc-board" style="margin-bottom:20px; font-size:12px; color:var(--muted);">${rows}</div>`;
  }

  function renderBoard(header, extraHtml, d, winnerIds) {
    const scores = d.scores || {};
    const rows = playersForDisplay(d)
      .slice()
      .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));
    mount.innerHTML = `
      ${header}
      ${extraHtml}
      <div class="hc-board">
        ${rows
          .map(
            (m, i) => `
          <div class="hc-board-row ${winnerIds && winnerIds.has(m.userId) ? 'winner' : ''}">
            <span class="hc-board-rank">${winnerIds && winnerIds.has(m.userId) ? '★' : i + 1}</span>
            <span class="hc-board-name">${m.displayName}</span>
            <span class="hc-board-pts">${scores[m.userId] || 0}</span>
          </div>`
          )
          .join('')}
      </div>
    `;
  }
})();
