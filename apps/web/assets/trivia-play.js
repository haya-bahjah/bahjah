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
  let roomEnded = false;
  let roomDifficulty = null;

  // Saudi National Day seasonal theme (mirrors assets/trivia-lobby-config.js,
  // which does the same check for the lobby). This page never fetches room
  // config for any other reason, so it's a single one-shot call at load --
  // config doesn't change once a game has started.
  const CATEGORY_LABELS_AR = {
    'General Knowledge': 'معلومات عامة',
    Geography: 'جغرافيا',
    History: 'تاريخ',
    Movies: 'أفلام',
    Science: 'علوم',
    Sports: 'رياضة',
  };
  const DIFFICULTY_LABELS = { easy: { en: 'Easy', ar: 'سهل' }, medium: { en: 'Medium', ar: 'متوسط' }, hard: { en: 'Hard', ar: 'صعب' } };
  const SND_NAMES = new Set(['saudi national day', 'اليوم الوطني السعودي']);
  function isSndName(name) {
    return SND_NAMES.has(String(name || '').trim().toLowerCase());
  }
  function categoryLabel(name) {
    return LANG_ATTR() === 'ar' && CATEGORY_LABELS_AR[name] ? CATEGORY_LABELS_AR[name] : name;
  }
  // Always the white variant -- see the note in trivia-play.html's CSS: the
  // supplied dark variant erases the wordmark, which sits on a dark box baked
  // into the artwork.
  function sndMark() {
    return (
      '<span class="snd-mark">' +
      '<img src="assets/logos/snd-logo-horizontal.svg" alt="Saudi National Day">' +
      '</span>'
    );
  }

  function updateSndLockupSrc() {
    const el = document.getElementById('snd-lockup');
    if (!el) return;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    el.src = `assets/logos/snd-logo-horizontal${isLight ? '-dark' : ''}.svg`;
  }
  window.BahjahSndTheme = { refreshLockup: updateSndLockupSrc };

  (async function loadEventTheme() {
    if (!code) return;
    const token = BahjahSession.getActiveToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/games/trivia/rooms/${encodeURIComponent(code)}/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.config) return;
      roomDifficulty = data.config.difficulty;
      const isNational = (data.config.categories || []).some(isSndName) || (data.config.customCategories || []).some(isSndName);
      document.documentElement.setAttribute('data-event-theme', isNational ? 'national' : 'default');
      updateSndLockupSrc();
    } catch {
      // Network hiccup -- keep the default theme rather than blocking play.
    }
  })();

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
    // The host restarted the room ("Play again") -- follow everyone back
    // to the waiting room instead of sitting on a stale finished screen.
    if (e.detail.status === 'lobby') {
      window.location.href = `trivia-lobby.html?code=${encodeURIComponent(code)}`;
      return;
    }
    if (e.detail.status === 'ended' && !roomEnded) {
      roomEnded = true;
      renderEnded();
    }
  });

  document.addEventListener('bahjah:game-state', (e) => {
    if (roomEnded) return;
    const state = e.detail;
    if (state.gameType !== 'trivia') return;
    latestState = state;
    attachErrorListenerOnce();
    render(state);
  });

  // Language toggled mid-game -- re-render the current phase in the new
  // language rather than waiting for the next server-driven state change.
  document.addEventListener('bahjah:lang-change', () => {
    if (roomEnded) {
      renderEnded();
      return;
    }
    if (latestState) render(latestState);
  });

  function renderEnded() {
    if (countdownTimer) clearInterval(countdownTimer);
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    window.BahjahTimerBar.stop('trivia');
    const lang = LANG_ATTR();
    box.innerHTML = `
      <div class="personal-result">
        <div class="q-text" style="min-height:auto;">${lang === 'ar' ? `أنهى المضيف هذه اللعبة (الرمز: ${code})` : `Host has ended this game (code: ${code})`}</div>
        <a href="bahjah-landing.html" class="btn btn-primary" style="display:inline-block; margin-top:20px; text-decoration:none;">${lang === 'ar' ? 'العودة إلى بهجة' : 'Back to Bahjah'}</a>
      </div>
    `;
  }

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
    window.BahjahSoundFx.submit();
    socket.emit('game:action', { action: { type: 'answer', choiceIndex } });
    box.querySelectorAll('.opt').forEach((btn) => {
      btn.disabled = true;
    });
  }

  // The running score shown in the question header. The server sends the whole
  // scores map; the player's own row is the one the HUD wants.
  function myScore(d) {
    if (!d || !d.scores || !me) return 0;
    return d.scores[me.id] || 0;
  }

  // Thousands separators, in the digits of the active language.
  function formatScore(n) {
    return Number(n || 0).toLocaleString(LANG_ATTR() === 'ar' ? 'ar-EG' : 'en-US');
  }

  function startCountdown(endsAt) {
    // The countdown ring shares the fill's danger state, so the last seconds
    // read the same on both halves of the timer row.
    const ring = document.getElementById('trivia-ring');
    const label = document.getElementById('trivia-countdown');
    window.BahjahTimerBar.start(
      'trivia',
      document.getElementById('trivia-timer-fill'),
      // The ring shows bare digits, not the helper's "12s" form, so the text
      // is written from onTick instead of letting the helper format it.
      null,
      endsAt,
      {
        onTick: (secs) => {
          if (secs > 0 && secs <= 3) window.BahjahSoundFx.tick();
          if (label) label.textContent = Math.max(0, secs);
          if (ring) ring.classList.toggle('is-danger', secs > 0 && secs <= 5);
        },
      }
    );
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
      window.BahjahRankedBoard.reset('trivia-player');
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
    const answeredCount = d.answeredCount || 0;
    const totalPlayers = nonHostMembers().length || answeredCount;
    const category = d.currentQuestion.category;
    const difficultyLabel = roomDifficulty && DIFFICULTY_LABELS[roomDifficulty] ? DIFFICULTY_LABELS[roomDifficulty][lang] : null;
    // Answers are keyed A/B/C/D in both languages -- the design labels them
    // with Latin letters throughout, and they double as the shortcut a player
    // would call out loud.
    const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
    const meta = [categoryLabel(category), difficultyLabel].filter(Boolean).join(' · ');
    box.innerHTML = `
      <div class="tv-stage">
        <div class="tv-qhead">
          <div class="tv-qhead-l">
            <img src="assets/logos/trivia-logo.png" alt="">
            <span class="tv-qcount">${lang === 'ar' ? `السؤال ${d.roundIndex + 1} من ${d.totalRounds}` : `Question ${d.roundIndex + 1} of ${d.totalRounds}`}</span>
            ${sndMark()}
          </div>
          <div class="tv-qhead-r">
            ${meta ? `<span class="tv-qmeta">${meta}</span>` : ''}
            <span class="tv-qscore">${formatScore(myScore(d))}</span>
          </div>
        </div>

        <div class="tv-timer">
          <div class="tv-timer-track"><div class="tv-timer-fill" id="trivia-timer-fill"></div></div>
          <div class="tv-ring" id="trivia-ring"><span id="trivia-countdown"></span></div>
        </div>

        <div class="tv-card tv-qcard">
          <span class="tv-qcard-mark" aria-hidden="true">${lang === 'ar' ? '؟' : '?'}</span>
          <h2 class="tv-qtext">${questionPrompt(d.currentQuestion)}</h2>
        </div>

        <div class="tv-answers" id="opt-list">
          ${questionChoices(d.currentQuestion).map((c, i) => `
            <button class="tv-tile tv-answer" data-i="${i}">
              <span class="tv-answer-key">${KEYS[i] || i + 1}</span>
              <span>${c}</span>
            </button>`).join('')}
        </div>

        <div class="snd-pack-strip">${sndMark()}<span>${lang === 'ar' ? 'حزمة اليوم الوطني السعودي' : 'Saudi National Day pack'}</span></div>
        <div class="demo-footer">${lang === 'ar' ? `${answeredCount} من ${totalPlayers} أجابوا` : `${answeredCount} of ${totalPlayers} answered`}</div>
      </div>
    `;
    box.querySelectorAll('.tv-answer').forEach((btn) => {
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
      `;
      return;
    }

    window.BahjahSoundFx[mine.correct ? 'correct' : 'wrong']();

    const breakdown = mine.correct
      ? (lang === 'ar'
          ? `+${mine.total} نقطة: ${mine.base} أساس${mine.speedBonus ? ` + ${mine.speedBonus} سرعة` : ''}${mine.streakBonus ? ` + ${mine.streakBonus} تتابع (×${mine.streak})` : ''}`
          : `+${mine.total} points: ${mine.base} base${mine.speedBonus ? ` + ${mine.speedBonus} speed` : ''}${mine.streakBonus ? ` + ${mine.streakBonus} streak (×${mine.streak})` : ''}`)
      : (lang === 'ar' ? 'بدون نقاط هذه الجولة' : 'No points this round');

    box.innerHTML = `
      <div class="personal-result">
        <div class="result-icon">${mine.correct ? '<svg width="56" height="56" viewBox="0 0 24 24" style="display:block;margin:0 auto;"><circle cx="12" cy="12" r="12" style="fill:var(--good)"/><path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '❌'}</div>
        <div class="q-text" style="min-height:auto;">${mine.correct ? (lang === 'ar' ? 'إجابة صحيحة!' : 'Correct!') : (lang === 'ar' ? 'إجابة خاطئة' : 'Not quite')}</div>
        <div class="result-answer">${lang === 'ar' ? 'الإجابة الصحيحة:' : 'Correct answer:'} ${correctText}</div>
        <div class="snd-reveal-row" style="justify-content:center;">
          ${sndMark()}
          <div class="round-breakdown ${mine.correct ? '' : 'muted'}" style="margin-top:0;">${breakdown}</div>
        </div>
      </div>
    `;
  }

  // Builds the ranking rows from d.scores (atomic with the current
  // game:state broadcast) rather than solely from latestRoom.members (a
  // separate, unsynchronized event) -- a member that hasn't caught up yet
  // (e.g. mid-reconnect) still gets a row instead of silently vanishing
  // from the board, which was the source of the "intermittent" leaderboard.
  function rankedRows(scores) {
    const members = nonHostMembers();
    const byId = new Map(members.map((m) => [m.userId, m]));
    const ids = new Set([...Object.keys(scores), ...members.map((m) => m.userId)]);
    const lang = LANG_ATTR();
    return Array.from(ids)
      .map((userId) => ({
        userId,
        displayName: byId.has(userId) ? byId.get(userId).displayName : lang === 'ar' ? 'لاعب' : 'Player',
        score: scores[userId] || 0,
      }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
  }

  function renderRanking(d) {
    const lang = LANG_ATTR();
    const scores = d.scores || {};
    const deltas = d.lastRoundScores || {};
    const rows = rankedRows(scores);

    box.innerHTML = `
      <div class="demo-head">
        <span>${lang === 'ar' ? 'الترتيب الحالي' : 'Current ranking'}</span>
        ${sndMark()}
        <span class="demo-score" id="trivia-countdown"></span>
      </div>
      <div class="timer-bar"><div class="timer-bar-fill" id="trivia-timer-fill"></div></div>
      <div class="board" id="trivia-board" style="margin-top:4px;"></div>
      <div class="demo-footer" style="justify-content:center; color:var(--muted); font-size:13px;">${lang === 'ar' ? 'جارٍ تحميل السؤال التالي…' : 'Next question loading…'}</div>
    `;
    window.BahjahRankedBoard.render('trivia-player', document.getElementById('trivia-board'), rows, (row, i) => {
      const isMe = Boolean(me && row.userId === me.id);
      const delta = deltas[row.userId];
      const badge = delta && delta.total ? ` (+${delta.total})` : '';
      const streakTag = delta && delta.streak >= 2 ? ` <span class="streak-tag">×${delta.streak}</span>` : '';
      return `
        <div class="board-row ${isMe ? 'me' : ''}">
          <span class="board-rank">${i + 1}</span>
          <span class="board-name">${row.displayName}${isMe ? (lang === 'ar' ? ' (أنت)' : ' (you)') : ''}${badge}${streakTag}</span>
          <span class="board-pts">${row.score}</span>
        </div>`;
    });
    startCountdown(d.phaseEndsAt);
  }

  function renderFinished(d) {
    if (countdownTimer) clearInterval(countdownTimer);
    window.BahjahTimerBar.stop('trivia');
    const lang = LANG_ATTR();
    const scores = d.scores || {};
    const winnerIds = new Set(d.winnerUserIds || []);
    const rows = nonHostMembers()
      .slice()
      .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));
    const myRank = me ? rows.findIndex((m) => m.userId === me.id) + 1 : 0;
    const myStats = me && d.finalStats ? d.finalStats[me.id] : null;

    if (me && winnerIds.has(me.id)) window.BahjahSoundFx.win();

    const winnerNames = rows.filter((m) => winnerIds.has(m.userId)).map((m) => m.displayName);
    const winnerLine = winnerNames.length
      ? `<div class="snd-final-row"><img class="tv-final-logo" src="assets/logos/trivia-logo.png" alt="Trivia">${sndMark()}</div><div class="winner-banner">${
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
    const won = myRank === 1;
    const shareBtn = document.getElementById('trivia-share-btn');
    const url = `${location.origin}/bahjah-landing.html`;

    const headline = lang === 'ar'
      ? won ? 'لعبت للتو على بهجة وفزت!' : 'لعبت للتو على بهجة!'
      : won ? 'I just played on Bahjah and won!' : 'I just played on Bahjah!';
    const subline = lang === 'ar'
      ? `سؤال و جواب · ${myScore} نقطة · المركز #${myRank}`
      : `Trivia · ${myScore} pts · Rank #${myRank}`;
    const text = lang === 'ar'
      ? `${headline} سجّلت ${myScore} نقطة وحللت في المركز #${myRank} في سؤال و جواب. 🏆`
      : `${headline} Scored ${myScore} points and placed #${myRank} in Trivia. 🏆`;

    if (window.BahjahShareCard) {
      window.BahjahShareCard.share({ gameId: 'trivia', lang, headline, subline, text, url, shareBtn });
      return;
    }
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
