// Player-only trivia gameplay, driven entirely by 'bahjah:game-state' events
// dispatched by assets/lobby.js. Only active on trivia-play.html (needs
// #trivia-live + #trivia-play-box). The host never lands here -- lobby-room.js
// keeps them on trivia-lobby.html's host console instead.
(function () {
  const LANG_ATTR = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const wrap = document.getElementById('trivia-live');
  const box = document.getElementById('trivia-play-box');
  if (!wrap || !box) return;

  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();
  let latestRoom = null;
  let latestState = null;
  let myAnswer = null;
  let countdownTimer = null;
  let revealTimer = null;
  let errorListenerAttached = false;

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
    // The host restarted the room ("Play again") -- follow everyone back
    // to the waiting room instead of sitting on a stale finished screen.
    if (e.detail.status === 'lobby') {
      window.location.href = `trivia-lobby.html?code=${encodeURIComponent(code)}`;
    }
  });

  document.addEventListener('bahjah:game-state', (e) => {
    const state = e.detail;
    if (state.gameType !== 'trivia') return;
    latestState = state;
    attachErrorListenerOnce();
    render(state);
  });

  // Language toggled mid-game -- re-render the current phase in the new
  // language rather than waiting for the next server-driven state change.
  document.addEventListener('bahjah:lang-change', () => {
    if (latestState) render(latestState);
  });

  function attachErrorListenerOnce() {
    if (errorListenerAttached) return;
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    errorListenerAttached = true;
    socket.on('room:error', (err) => {
      if (err.code === 'ALREADY_ANSWERED' || err.code === 'INVALID_ACTION') {
        const footer = box.querySelector('.demo-footer');
        if (footer) footer.textContent = err.message;
      }
    });
  }

  function submitAnswer(choiceIndex) {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket || myAnswer !== null) return;
    myAnswer = choiceIndex;
    socket.emit('game:action', { action: { type: 'answer', choiceIndex } });
    box.querySelectorAll('.opt').forEach((btn) => {
      btn.disabled = true;
    });
  }

  function fmtCountdown(endsAt) {
    if (!endsAt) return '';
    const secs = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    return `${secs}s`;
  }

  function startCountdown(endsAt) {
    if (countdownTimer) clearInterval(countdownTimer);
    const el = document.getElementById('trivia-countdown');
    if (!el) return;
    const tick = () => {
      el.textContent = fmtCountdown(endsAt);
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

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

  function render(state) {
    wrap.style.display = 'block';
    const d = state.data || {};

    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }

    if (state.phase === 'countdown') {
      if (countdownTimer) clearInterval(countdownTimer);
      renderCountdown(d.phaseEndsAt);
      return;
    }

    if (state.phase === 'question') {
      renderQuestion(d);
      return;
    }

    if (state.phase === 'reveal') {
      renderRevealSplit(d);
      return;
    }

    if (state.phase === 'finished') {
      renderFinished(d);
    }
  }

  function renderCountdown(endsAt) {
    const lang = LANG_ATTR();
    box.innerHTML = `
      <div class="countdown-screen">
        <div class="countdown-number" id="countdown-number">3</div>
        <div class="countdown-label">${lang === 'ar' ? 'استعدّوا!' : 'Get Ready!'}</div>
      </div>
    `;
    const numEl = document.getElementById('countdown-number');
    const tick = () => {
      const secs = Math.max(0, Math.ceil(((endsAt || Date.now()) - Date.now()) / 1000));
      if (numEl) numEl.textContent = secs > 0 ? String(secs) : (lang === 'ar' ? 'انطلقوا!' : 'Go!');
    };
    tick();
    countdownTimer = setInterval(tick, 250);
  }

  function renderQuestion(d) {
    const lang = LANG_ATTR();
    if (!d.currentQuestion) return;
    myAnswer = null;
    const answeredCount = Object.keys(d.pendingAnswers || {}).length;
    const totalPlayers = nonHostMembers().length || answeredCount;
    box.innerHTML = `
      <div class="demo-head">
        <span>${lang === 'ar' ? `السؤال ${d.roundIndex + 1} من ${d.totalRounds}` : `Question ${d.roundIndex + 1} of ${d.totalRounds}`}</span>
        <span class="demo-score" id="trivia-countdown"></span>
      </div>
      <div class="q-text">${questionPrompt(d.currentQuestion)}</div>
      <div class="options" id="opt-list">
        ${questionChoices(d.currentQuestion).map((c, i) => `<button class="opt" data-i="${i}">${c}</button>`).join('')}
      </div>
      <div class="demo-footer">${lang === 'ar' ? `${answeredCount} من ${totalPlayers} أجابوا` : `${answeredCount} of ${totalPlayers} answered`}</div>
    `;
    box.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => submitAnswer(Number(btn.dataset.i)));
    });
    startCountdown(d.phaseEndsAt);
  }

  // Splits the server's single reveal window into two sequential views:
  // your own result first, then the live ranking -- no server change
  // needed, d.phaseEndsAt is unchanged either way.
  function renderRevealSplit(d) {
    const PERSONAL_RESULT_MS = 2500;
    const remaining = d.phaseEndsAt ? d.phaseEndsAt - Date.now() : PERSONAL_RESULT_MS;
    const personalMs = Math.min(PERSONAL_RESULT_MS, Math.max(0, remaining));

    renderPersonalResult(d);
    if (personalMs > 0 && remaining > personalMs + 300) {
      revealTimer = setTimeout(() => renderRanking(d), personalMs);
    } else {
      renderRanking(d);
    }
    startCountdown(d.phaseEndsAt);
  }

  function renderPersonalResult(d) {
    const lang = LANG_ATTR();
    const q = d.currentQuestion;
    const mine = me ? (d.lastRoundScores || {})[me.id] : null;
    const correctText = q ? questionChoices(q)[d.correctIndex] : '';

    if (!mine) {
      box.innerHTML = `
        <div class="personal-result">
          <div class="result-icon">⏳</div>
          <div class="q-text" style="min-height:auto;">${lang === 'ar' ? 'لم تُجب على هذا السؤال' : "You didn't answer this one"}</div>
          <div class="result-answer">${lang === 'ar' ? 'الإجابة الصحيحة:' : 'Correct answer:'} ${correctText}</div>
        </div>
        <span class="demo-score" id="trivia-countdown" style="display:none;"></span>
      `;
      return;
    }

    const breakdown = mine.correct
      ? (lang === 'ar'
          ? `+${mine.total} نقطة: ${mine.base} أساس${mine.speedBonus ? ` + ${mine.speedBonus} سرعة` : ''}${mine.streakBonus ? ` + ${mine.streakBonus} تتابع (×${mine.streak})` : ''}`
          : `+${mine.total} points: ${mine.base} base${mine.speedBonus ? ` + ${mine.speedBonus} speed` : ''}${mine.streakBonus ? ` + ${mine.streakBonus} streak (×${mine.streak})` : ''}`)
      : (lang === 'ar' ? 'بدون نقاط هذه الجولة' : 'No points this round');

    box.innerHTML = `
      <div class="personal-result">
        <div class="result-icon">${mine.correct ? '✅' : '❌'}</div>
        <div class="q-text" style="min-height:auto;">${mine.correct ? (lang === 'ar' ? 'إجابة صحيحة!' : 'Correct!') : (lang === 'ar' ? 'إجابة خاطئة' : 'Not quite')}</div>
        <div class="result-answer">${lang === 'ar' ? 'الإجابة الصحيحة:' : 'Correct answer:'} ${correctText}</div>
        <div class="round-breakdown ${mine.correct ? '' : 'muted'}">${breakdown}</div>
      </div>
      <span class="demo-score" id="trivia-countdown" style="display:none;"></span>
    `;
  }

  function renderRanking(d) {
    const lang = LANG_ATTR();
    const scores = d.scores || {};
    const deltas = d.lastRoundScores || {};
    const rows = nonHostMembers()
      .slice()
      .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));

    box.innerHTML = `
      <div class="demo-head">
        <span>${lang === 'ar' ? 'الترتيب الحالي' : 'Current ranking'}</span>
        <span class="demo-score" id="trivia-countdown"></span>
      </div>
      <div class="board" style="margin-top:4px;">
        ${rows
          .map((m, i) => {
            const delta = deltas[m.userId];
            const badge = delta && delta.total ? ` (+${delta.total})` : '';
            const streakTag = delta && delta.streak >= 2 ? ` <span class="streak-tag">×${delta.streak}</span>` : '';
            return `
          <div class="board-row ${me && m.userId === me.id ? 'me' : ''}">
            <span class="board-rank">${i + 1}</span>
            <span class="board-name">${m.displayName}${me && m.userId === me.id ? (lang === 'ar' ? ' (أنت)' : ' (you)') : ''}${badge}${streakTag}</span>
            <span class="board-pts">${scores[m.userId] || 0}</span>
          </div>`;
          })
          .join('')}
      </div>
      <div class="demo-footer" style="justify-content:center; color:var(--muted); font-size:13px;">${lang === 'ar' ? 'جارٍ تحميل السؤال التالي…' : 'Next question loading…'}</div>
    `;
    startCountdown(d.phaseEndsAt);
  }

  function renderFinished(d) {
    if (countdownTimer) clearInterval(countdownTimer);
    const lang = LANG_ATTR();
    const scores = d.scores || {};
    const winnerIds = new Set(d.winnerUserIds || []);
    const rows = nonHostMembers()
      .slice()
      .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));
    const myRank = me ? rows.findIndex((m) => m.userId === me.id) + 1 : 0;
    const myStats = me && d.finalStats ? d.finalStats[me.id] : null;

    const winnerNames = rows.filter((m) => winnerIds.has(m.userId)).map((m) => m.displayName);
    const winnerLine = winnerNames.length
      ? `<div class="winner-banner">${
          lang === 'ar'
            ? `${winnerNames.length > 1 ? `${winnerNames.join('، ')} تعادلوا في الفوز!` : `${winnerNames[0]} يفوز!`}`
            : `${winnerNames.length > 1 ? `${winnerNames.join(', ')} tie for the win!` : `${winnerNames[0]} wins!`}`
        }</div>`
      : '';

    const rankLabel = myRank > 0
      ? (lang === 'ar' ? `أنهيت في المركز ${myRank}` : `You finished #${myRank}`)
      : '';

    const statsBlock = myStats
      ? `
        <div class="final-stats">
          <div class="final-stat">
            <div class="stat-value">${scores[me.id] || 0}</div>
            <div class="stat-label">${lang === 'ar' ? 'النقاط' : 'Score'}</div>
          </div>
          <div class="final-stat">
            <div class="stat-value">${myStats.correctCount}/${d.totalRounds}</div>
            <div class="stat-label">${lang === 'ar' ? 'إجابات صحيحة' : 'Correct'}</div>
          </div>
          <div class="final-stat">
            <div class="stat-value">${myStats.speedPct}%</div>
            <div class="stat-label">${lang === 'ar' ? 'السرعة' : 'Speed'}</div>
          </div>
        </div>`
      : '';

    box.innerHTML = `
      <div class="demo-head"><span>${lang === 'ar' ? 'انتهت اللعبة' : 'Game finished'}</span></div>
      ${winnerLine}
      ${rankLabel ? `<p style="text-align:center; font-weight:700; margin-bottom:16px;">${rankLabel}</p>` : ''}
      ${statsBlock}
      <div class="board">
        ${rows
          .map(
            (m, i) => `
          <div class="board-row ${me && m.userId === me.id ? 'me' : ''} ${winnerIds.has(m.userId) ? 'winner' : ''}">
            <span class="board-rank">${winnerIds.has(m.userId) ? '★' : i + 1}</span>
            <span class="board-name">${m.displayName}</span>
            <span class="board-pts">${scores[m.userId] || 0}</span>
          </div>`
          )
          .join('')}
      </div>
      <button class="opt" id="trivia-share-btn" style="margin-top:14px; width:100%;">${lang === 'ar' ? 'شارك نتيجتك' : 'Share your result'}</button>
      <p class="waiting-note">${lang === 'ar' ? 'بانتظار أن يبدأ المضيف لعبة جديدة…' : 'Waiting for the host to start a new game…'}</p>
      <p style="text-align:center; margin-top:10px;"><a class="back-link" href="trivia.html">${lang === 'ar' ? 'انضم إلى لعبة أخرى' : 'Join another game'}</a></p>
    `;
    const shareBtn = document.getElementById('trivia-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', () => shareResult(rows, scores, myRank));
  }

  function shareResult(rows, scores, myRank) {
    const lang = LANG_ATTR();
    const myScore = me ? scores[me.id] || 0 : 0;
    const text =
      lang === 'ar'
        ? `سجّلت ${myScore} نقطة وحللت في المركز #${myRank} في Trivia على Bahjah!`
        : `I scored ${myScore} points and placed #${myRank} in Trivia on Bahjah!`;
    const url = `${location.origin}/bahjah-landing.html`;
    const shareBtn = document.getElementById('trivia-share-btn');

    if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
      return;
    }
    navigator.clipboard
      .writeText(`${text} ${url}`)
      .then(() => {
        if (!shareBtn) return;
        const original = shareBtn.textContent;
        shareBtn.textContent = lang === 'ar' ? 'تم النسخ!' : 'Copied!';
        setTimeout(() => (shareBtn.textContent = original), 1500);
      })
      .catch(() => {});
  }
})();
