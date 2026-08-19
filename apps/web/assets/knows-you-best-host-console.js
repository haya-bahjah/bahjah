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

  // Same fix as knows-you-best-play.js: shuffle the names column too
  // (answers already get a fresh server-side shuffle each round), cached
  // per round so it stays stable across re-renders within that round.
  let shuffledNamesRound = -1;
  let shuffledNameOrder = null;

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function shuffledPlayersForDisplay(d) {
    // Only players who actually answered this round are guessable -- anyone
    // who stayed silent has no answer in d.answers, so including them here
    // would leave an orphaned name chip with nothing to match it to.
    const authorIds = Array.isArray(d.authorIds) ? new Set(d.authorIds) : null;
    const players = authorIds ? playersForDisplay(d).filter((m) => authorIds.has(m.userId)) : playersForDisplay(d);
    if (shuffledNamesRound !== d.roundIndex) {
      shuffledNamesRound = d.roundIndex;
      shuffledNameOrder = shuffle(players.map((m) => m.userId));
    }
    const byId = new Map(players.map((m) => [m.userId, m]));
    return shuffledNameOrder.map((userId) => byId.get(userId)).filter(Boolean);
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

  const CATEGORY_LABELS_AR = {
    'Break the Ice': 'اكسروا الجليد',
    'Imagine If': 'تخيل لو',
    'Close Friends Only': 'للمقربين فقط',
  };
  function categoryLabel(name) {
    return LANG_ATTR() === 'ar' && CATEGORY_LABELS_AR[name] ? CATEGORY_LABELS_AR[name] : name;
  }
  function categoryBadge(prompt) {
    if (!prompt || !prompt.category) return '';
    return `<p class="hc-stat" style="text-align:center;">${categoryLabel(prompt.category)}</p>`;
  }

  function startTimer(endsAt) {
    const textEl = document.getElementById('hc-timer-text');
    window.BahjahTimerBar.start('hc-kyb', document.getElementById('hc-timer-fill'), null, endsAt, {
      onTick: (secs) => { if (textEl) textEl.textContent = String(secs); },
    });
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

    if (latestRoom.status === 'ended') {
      mount.innerHTML = `
        <div style="text-align:center; padding-block:60px;">
          <p class="hc-stat">${lang === 'ar' ? `أنهيت هذه اللعبة (الرمز: ${code}).` : `You ended this game (code: ${code}).`}</p>
        </div>
      `;
      return;
    }

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
      window.BahjahTimerBar.stop('hc-kyb');
      renderReveal(d, lang);
      return;
    }
    if (latestState.phase === 'finished') {
      window.BahjahTimerBar.stop('hc-kyb');
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
        <button type="button" class="bh-btn bh-btn--hot bh-btn--md hc-answer-submit" id="hc-answer-submit">${lang === 'ar' ? 'إرسال' : 'Submit'}</button>
      `;
    } else if (d.hostPlays && d.myAnswered) {
      bodyHtml = `<p class="hc-stat" style="text-align:center; margin-bottom:14px;">${lang === 'ar' ? 'تم إرسال إجابتك ✓' : 'Your answer is in ✓'}</p>`;
    }

    mount.innerHTML = `
      ${headerRow(roundLabel(d))}
      ${categoryBadge(d.currentPrompt)}
      <div class="hc-timer" id="hc-timer-text"></div>
      <div class="timer-bar"><div class="timer-bar-fill" id="hc-timer-fill"></div></div>
      <div class="hc-question">${questionPrompt(d.currentPrompt)}</div>
      ${bodyHtml}
      <p class="hc-answered">${lang === 'ar' ? `${answeredCount} من ${totalPlayers} أجابوا` : `${answeredCount} of ${totalPlayers} answered`}</p>
    `;

    const submitBtn = document.getElementById('hc-answer-submit');
    const input = document.getElementById('hc-answer-input');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitHostAnswer(); });
    if (submitBtn) submitBtn.addEventListener('click', submitHostAnswer);
    startTimer(d.phaseEndsAt);
  }

  function renderGuessing(d, lang) {
    const totalPlayers = playersForDisplay(d).length;
    mount.innerHTML = `
      ${headerRow(roundLabel(d))}
      ${categoryBadge(d.currentPrompt)}
      <div class="hc-timer" id="hc-timer-text"></div>
      <div class="timer-bar"><div class="timer-bar-fill" id="hc-timer-fill"></div></div>
      <div class="hc-question">${questionPrompt(d.currentPrompt)}</div>
      <p class="hc-answered">${lang === 'ar' ? `${d.guessedCount || 0} من ${totalPlayers} أنهوا المطابقة` : `${d.guessedCount || 0} of ${totalPlayers} finished matching`}</p>
      ${d.hostPlays ? '<div id="hc-match-mount" style="margin-top:20px;"></div>' : ''}
    `;
    startTimer(d.phaseEndsAt);

    if (d.hostPlays && Array.isArray(d.answers) && me) {
      const mountEl = document.getElementById('hc-match-mount');
      const names = shuffledPlayersForDisplay(d)
        .filter((m) => m.userId !== me.id)
        .map((m) => ({ userId: m.userId, displayName: m.displayName }));
      const guessableAnswers = d.answers.filter((a) => a.index !== d.myAnswerIndex);
      matchBoard = window.BahjahKybMatchBoard.mount(mountEl, {
        names,
        answers: guessableAnswers,
        labels: {
          submitBtn: lang === 'ar' ? 'أرسل المطابقات' : 'Submit Matches',
          hint: lang === 'ar' ? 'اسحب اسمًا إلى الإجابة، أو اضغط اسمًا ثم إجابة لمطابقتهما.' : 'Drag a name onto the answer you think they wrote, or tap one then the other to match them.',
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
        const mark = guessedUserId === undefined ? '' : guessedUserId === r.authorUserId ? ' <svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align:-2px;"><circle cx="12" cy="12" r="12" style="fill:var(--pixel-green)"/><path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="var(--text-on-accent)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ' ❌';
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
      <button type="button" id="hc-restart-btn" class="bh-btn bh-btn--hot bh-btn--md">${lang === 'ar' ? 'العب مجددًا' : 'Play again'}</button>
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
    return `<div class="hc-board" style="margin-bottom:20px; font-size:12px; color:var(--text-muted);">${rows}</div>`;
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
