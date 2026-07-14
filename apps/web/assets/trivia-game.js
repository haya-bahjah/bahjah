// Renders the live trivia round into #trivia-live-box, driven entirely by
// 'bahjah:game-state' events dispatched by assets/lobby.js. Only active
// when the page has a #trivia-live container (trivia.html).
(function () {
  const LANG = document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  const wrap = document.getElementById('trivia-live');
  const box = document.getElementById('trivia-live-box');
  if (!wrap || !box) return;

  const me = BahjahSession.getUser();
  let latestRoom = null;
  let myAnswer = null;
  let countdownTimer = null;
  let errorListenerAttached = false;

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
  });

  document.addEventListener('bahjah:game-state', (e) => {
    const state = e.detail;
    if (state.gameType !== 'trivia') return;
    attachErrorListenerOnce();
    render(state);
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

  function render(state) {
    wrap.style.display = 'block';
    const d = state.data || {};

    if (state.phase === 'question') {
      if (!d.currentQuestion) return;
      myAnswer = null;
      const answeredCount = Object.keys(d.pendingAnswers || {}).length;
      const totalMembers = latestRoom ? latestRoom.members.length : answeredCount;
      box.innerHTML = `
        <div class="demo-head">
          <span>${LANG === 'ar' ? `السؤال ${d.roundIndex + 1} من ${d.totalRounds}` : `Question ${d.roundIndex + 1} of ${d.totalRounds}`}</span>
          <span class="demo-score" id="trivia-countdown"></span>
        </div>
        <div class="q-text">${d.currentQuestion.prompt}</div>
        <div class="options">
          ${d.currentQuestion.choices.map((c, i) => `<button class="opt" data-i="${i}">${c}</button>`).join('')}
        </div>
        <div class="demo-footer">${LANG === 'ar' ? `${answeredCount} من ${totalMembers} أجابوا` : `${answeredCount} of ${totalMembers} answered`}</div>
      `;
      box.querySelectorAll('.opt').forEach((btn) => {
        btn.addEventListener('click', () => submitAnswer(Number(btn.dataset.i)));
      });
      startCountdown(d.phaseEndsAt);
      return;
    }

    if (state.phase === 'reveal') {
      const q = d.currentQuestion;
      const scores = d.scores || {};
      const deltas = d.lastRoundScores || {};
      const rows = (latestRoom ? latestRoom.members : [])
        .slice()
        .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));
      const mine = me ? deltas[me.id] : null;
      const myBreakdown =
        mine && mine.correct
          ? `<div class="round-breakdown">${
              LANG === 'ar'
                ? `+${mine.total} نقطة هذه الجولة: ${mine.base} أساس${mine.speedBonus ? ` + ${mine.speedBonus} سرعة` : ''}${mine.streakBonus ? ` + ${mine.streakBonus} تتابع (×${mine.streak})` : ''}`
                : `+${mine.total} this round: ${mine.base} base${mine.speedBonus ? ` + ${mine.speedBonus} speed` : ''}${mine.streakBonus ? ` + ${mine.streakBonus} streak (×${mine.streak})` : ''}`
            }</div>`
          : mine
          ? `<div class="round-breakdown muted">${LANG === 'ar' ? 'إجابة غير صحيحة -- بدون نقاط هذه الجولة' : 'Not correct -- no points this round'}</div>`
          : '';
      box.innerHTML = `
        <div class="demo-head">
          <span>${LANG === 'ar' ? 'الإجابة الصحيحة' : 'Correct answer'}</span>
          <span class="demo-score" id="trivia-countdown"></span>
        </div>
        <div class="q-text">${q ? q.prompt : ''}</div>
        <div class="options">
          ${(q ? q.choices : []).map((c, i) => `<button class="opt ${i === d.correctIndex ? 'correct' : ''}" disabled>${c}</button>`).join('')}
        </div>
        ${myBreakdown}
        <div class="board" style="margin-top:16px;">
          ${rows
            .map((m, i) => {
              const delta = deltas[m.userId];
              const badge = delta && delta.total ? ` (+${delta.total})` : '';
              const streakTag = delta && delta.streak >= 2 ? ` <span class="streak-tag">×${delta.streak}</span>` : '';
              return `
            <div class="board-row ${me && m.userId === me.id ? 'me' : ''}">
              <span class="board-rank">${i + 1}</span>
              <span class="board-name">${m.displayName}${badge}${streakTag}</span>
              <span class="board-pts">${scores[m.userId] || 0}</span>
            </div>`;
            })
            .join('')}
        </div>
      `;
      startCountdown(d.phaseEndsAt);
      return;
    }

    if (state.phase === 'finished') {
      if (countdownTimer) clearInterval(countdownTimer);
      const scores = d.scores || {};
      const winnerIds = new Set(d.winnerUserIds || []);
      const rows = (latestRoom ? latestRoom.members : [])
        .slice()
        .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));
      const winnerNames = rows.filter((m) => winnerIds.has(m.userId)).map((m) => m.displayName);
      const winnerLine = winnerNames.length
        ? `<div class="winner-banner">${
            LANG === 'ar'
              ? `${winnerNames.length > 1 ? `${winnerNames.join('، ')} تعادلوا في الفوز!` : `${winnerNames[0]} يفوز!`}`
              : `${winnerNames.length > 1 ? `${winnerNames.join(', ')} tie for the win!` : `${winnerNames[0]} wins!`}`
          }</div>`
        : '';
      box.innerHTML = `
        <div class="demo-head"><span>${LANG === 'ar' ? 'انتهت اللعبة' : 'Game finished'}</span></div>
        ${winnerLine}
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
        <button class="opt" id="trivia-share-btn" style="margin-top:14px; width:100%;">${LANG === 'ar' ? 'شارك نتيجتك' : 'Share your result'}</button>
      `;
      const shareBtn = document.getElementById('trivia-share-btn');
      if (shareBtn) shareBtn.addEventListener('click', () => shareResult(rows, scores));
    }
  }

  function shareResult(rows, scores) {
    const myRank = me ? rows.findIndex((m) => m.userId === me.id) + 1 : 0;
    const myScore = me ? scores[me.id] || 0 : 0;
    const text =
      LANG === 'ar'
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
        shareBtn.textContent = LANG === 'ar' ? 'تم النسخ!' : 'Copied!';
        setTimeout(() => (shareBtn.textContent = original), 1500);
      })
      .catch(() => {});
  }
})();
