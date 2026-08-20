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

  // The winner card's confetti. Positions, sizes and delays are spread evenly
  // rather than randomised so the card looks the same on every render (and in
  // screenshots) instead of reshuffling on each state update.
  const CONFETTI_COLORS = ['var(--arcade-yellow)', 'var(--soft-white)', 'var(--tv-card)', 'var(--ink)'];
  function confettiPieces() {
    const pieces = [];
    for (let i = 0; i < 24; i += 1) {
      const tall = i % 3 === 0;
      pieces.push(
        `<i style="--x:${(i * 4.1 + 2).toFixed(1)}%;` +
        `--c:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};` +
        `--w:${tall ? 5 : 8}px;--h:${tall ? 14 : 8}px;` +
        `--r:${i % 4 === 1 ? '50%' : '1px'};` +
        `--d:${(2.6 + (i % 5) * 0.35).toFixed(2)}s;` +
        `--delay:${((i % 7) * 0.28).toFixed(2)}s"></i>`
      );
    }
    return pieces.join('');
  }

  // A stable per-player colour for the small avatar squares on the final
  // standings, taken from the game's accent set so every row stays on palette.
  const AVATAR_TINTS = ['var(--neon-pink)', 'var(--cyber-cyan)', 'var(--pixel-green)', 'var(--arcade-yellow)', 'var(--electric-purple)'];
  function avatarTint(userId) {
    let hash = 0;
    for (let i = 0; i < String(userId).length; i += 1) hash = (hash * 31 + String(userId).charCodeAt(i)) >>> 0;
    return AVATAR_TINTS[hash % AVATAR_TINTS.length];
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
    const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

    if (mine) window.BahjahSoundFx[mine.correct ? 'correct' : 'wrong']();

    // Three outcomes share one banner: answered right, answered wrong, and
    // never answered. Only the first carries a points column.
    let tone, headline, detail;
    if (!mine) {
      tone = 'is-idle';
      headline = lang === 'ar' ? 'لم تُجب' : 'No answer.';
      detail = `${lang === 'ar' ? 'الإجابة الصحيحة:' : 'Correct answer:'} ${correctText}`;
    } else if (mine.correct) {
      tone = 'is-correct';
      headline = lang === 'ar' ? 'إجابة صحيحة.' : 'Correct.';
      detail = lang === 'ar'
        ? `${mine.base} أساس${mine.speedBonus ? ` + ${mine.speedBonus} سرعة` : ''}${mine.streakBonus ? ` + ${mine.streakBonus} تتابع (×${mine.streak})` : ''}`
        : `${mine.base} base${mine.speedBonus ? ` + ${mine.speedBonus} speed` : ''}${mine.streakBonus ? ` + ${mine.streakBonus} streak (×${mine.streak})` : ''}`;
    } else {
      tone = 'is-wrong';
      headline = lang === 'ar' ? 'إجابة خاطئة.' : 'Not quite.';
      detail = `${lang === 'ar' ? 'الإجابة الصحيحة:' : 'Correct answer:'} ${correctText}`;
    }

    const badge = !mine ? '—' : mine.correct ? '✓' : '✕';
    const meta = [
      lang === 'ar' ? `السؤال ${d.roundIndex + 1} من ${d.totalRounds}` : `Question ${d.roundIndex + 1} of ${d.totalRounds}`,
      q && q.category ? categoryLabel(q.category) : null,
    ].filter(Boolean).join(' · ');

    box.innerHTML = `
      <div class="tv-stage">
        <div class="tv-rhead">
          <span class="tv-qcount">${meta}</span>
          <span class="tv-rhead-r">${sndMark()}<span class="tv-rscore">${formatScore(myScore(d))}</span></span>
        </div>

        <div class="tv-card tv-verdict ${tone}">
          <span class="tv-verdict-badge" aria-hidden="true">${badge}</span>
          <div class="tv-verdict-copy">
            <h2>${headline}</h2>
            <p>${detail}</p>
          </div>
          ${mine && mine.correct ? `
            <div class="tv-verdict-pts">
              <div class="tv-verdict-num">+${mine.total}</div>
              <div class="tv-verdict-lbl">${lang === 'ar' ? 'نقطة' : 'Points'}</div>
            </div>` : ''}
        </div>

        <div class="tv-answers">
          ${q ? questionChoices(q).map((c, i) => {
            const isCorrect = i === d.correctIndex;
            // RoundScore carries no choice index, so which option this player
            // picked comes from the local tracker set in submitAnswer().
            const isMineWrong = !isCorrect && myAnswer === i;
            const cls = isCorrect ? 'is-correct' : isMineWrong ? 'is-mine-wrong' : '';
            const mark = isCorrect ? '✓' : isMineWrong ? '✕' : '';
            return `
              <div class="tv-result ${cls}">
                <span class="tv-result-key">${KEYS[i] || i + 1}</span>
                <span class="tv-result-text">${c}</span>
                ${mark ? `<span class="tv-result-mark" aria-hidden="true">${mark}</span>` : ''}
              </div>`;
          }).join('') : ''}
        </div>

        <div class="snd-pack-strip">${sndMark()}<span>${lang === 'ar' ? 'حزمة اليوم الوطني السعودي' : 'Saudi National Day pack'}</span></div>
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

    // Bars are drawn relative to the leader, so first place always fills the
    // row and everyone else reads as a share of it.
    const topScore = rows.reduce((max, r) => Math.max(max, r.score), 0) || 1;

    box.innerHTML = `
      <div class="tv-stage">
        <div class="tv-rhead">
          <h2 class="tv-screen-title">${lang === 'ar' ? 'الترتيب.' : 'Standings.'}</h2>
          <span class="tv-rhead-r">${sndMark()}<span class="tv-rscore" id="trivia-countdown"></span></span>
        </div>
        <div class="tv-timer">
          <div class="tv-timer-track"><div class="tv-timer-fill" id="trivia-timer-fill"></div></div>
        </div>
        <div class="tv-ranks" id="trivia-board"></div>
        <div class="tv-rank-foot">${lang === 'ar' ? 'جارٍ تحميل السؤال التالي…' : 'Next question loading…'}</div>
      </div>
    `;
    window.BahjahRankedBoard.render('trivia-player', document.getElementById('trivia-board'), rows, (row, i) => {
      const isMe = Boolean(me && row.userId === me.id);
      const delta = deltas[row.userId];
      const name = isMe ? (lang === 'ar' ? 'أنت' : 'You') : row.displayName;
      const initial = (row.displayName || '?').trim().charAt(0).toUpperCase();
      const streakTag = delta && delta.streak >= 2 ? `<span class="streak-tag">×${delta.streak}</span>` : '';
      const pct = Math.max(4, Math.round((row.score / topScore) * 100));
      return `
        <div class="tv-rank-row ${isMe ? 'is-me' : ''}">
          <div class="tv-rank-line">
            <span class="tv-rank-no">${i + 1}</span>
            <span class="tv-rank-av">${initial}</span>
            <span class="tv-rank-name">${name}${streakTag}</span>
            ${delta && delta.total ? `<span class="tv-rank-delta">+${delta.total}</span>` : ''}
            <span class="tv-rank-total">${formatScore(row.score)}</span>
          </div>
          <div class="tv-rank-bar"><span style="width:${pct}%"></span></div>
        </div>`;
    });
    // The countdown label here is the plain "12s" form the helper writes, not
    // the question screen's ring, so let it format the text itself.
    window.BahjahTimerBar.start(
      'trivia',
      document.getElementById('trivia-timer-fill'),
      document.getElementById('trivia-countdown'),
      d.phaseEndsAt
    );
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

    const top = rows[0];
    const topStats = top && d.finalStats ? d.finalStats[top.userId] : null;
    const winnerSub = top
      ? [
          lang === 'ar' ? `${formatScore(scores[top.userId] || 0)} نقطة` : `${formatScore(scores[top.userId] || 0)} points`,
          topStats ? (lang === 'ar' ? `${topStats.correctCount} من ${d.totalRounds} صحيحة` : `${topStats.correctCount} of ${d.totalRounds} correct`) : null,
        ].filter(Boolean).join(' · ')
      : '';

    const statsBlock = myStats
      ? `
        <div class="tv-final-stats">
          <div class="tv-final-stat">
            <b>${formatScore(scores[me.id] || 0)}</b>
            <span>${lang === 'ar' ? 'نقاطك' : 'Your score'}</span>
          </div>
          <div class="tv-final-stat">
            <b>${myStats.correctCount}/${d.totalRounds}</b>
            <span>${lang === 'ar' ? 'إجابات صحيحة' : 'Correct'}</span>
          </div>
          <div class="tv-final-stat is-gold">
            <b>${myStats.speedPct}%</b>
            <span>${lang === 'ar' ? 'السرعة' : 'Speed'}</span>
          </div>
        </div>`
      : '';

    box.innerHTML = `
      <div class="tv-stage">
        <div class="snd-final-row"><img class="tv-final-logo" src="assets/logos/trivia-logo.png" alt="">${sndMark()}</div>

        <div class="tv-card tv-winner">
          <div class="tv-confetti" aria-hidden="true">${confettiPieces()}</div>
          <div class="tv-winner-crown" aria-hidden="true">👑</div>
          <div class="tv-winner-label">${lang === 'ar' ? 'الفائز' : 'Winner'}</div>
          <h2 class="tv-winner-name">${winnerNames.length ? winnerNames.join(lang === 'ar' ? '، ' : ', ') : (lang === 'ar' ? 'لا فائز' : 'No winner')}</h2>
          ${winnerSub ? `<p class="tv-winner-sub">${winnerSub}</p>` : ''}
        </div>

        ${statsBlock}

        <div class="tv-final-list">
          ${rows.map((m, i) => {
            const isMe = Boolean(me && m.userId === me.id);
            const delta = (d.lastRoundScores || {})[m.userId];
            return `
              <div class="tv-final-row ${isMe ? 'is-me' : ''} ${winnerIds.has(m.userId) ? 'is-winner' : ''}">
                <span class="tv-final-no">${String(i + 1).padStart(2, '0')}</span>
                <span class="tv-final-av" style="background:${avatarTint(m.userId)}">${(m.displayName || '?').trim().charAt(0).toUpperCase()}</span>
                <span class="tv-final-name">${isMe ? (lang === 'ar' ? 'أنت' : 'You') : m.displayName}</span>
                ${isMe && delta && delta.total ? `<span class="tv-final-delta">+${delta.total}</span>` : ''}
                <span class="tv-final-pts">${formatScore(scores[m.userId] || 0)}</span>
              </div>`;
          }).join('')}
        </div>

        <div class="tv-final-actions">
          <a class="is-primary" href="trivia.html">${lang === 'ar' ? 'العب مرة أخرى' : 'Play again'}</a>
          <button type="button" id="trivia-share-btn">${lang === 'ar' ? 'شارك النتيجة' : 'Share result'}</button>
        </div>
        <p class="tv-final-note">${lang === 'ar' ? 'بانتظار أن يبدأ المضيف لعبة جديدة…' : 'Waiting for the host to start a new game…'}</p>
      </div>
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
