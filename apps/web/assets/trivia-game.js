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
      box.innerHTML = `
        <div class="demo-head">
          <span>${LANG === 'ar' ? 'الإجابة الصحيحة' : 'Correct answer'}</span>
          <span class="demo-score" id="trivia-countdown"></span>
        </div>
        <div class="q-text">${q ? q.prompt : ''}</div>
        <div class="options">
          ${(q ? q.choices : []).map((c, i) => `<button class="opt ${i === d.correctIndex ? 'correct' : ''}" disabled>${c}</button>`).join('')}
        </div>
        <div class="board" style="margin-top:16px;">
          ${rows
            .map(
              (m, i) => `
            <div class="board-row ${me && m.userId === me.id ? 'me' : ''}">
              <span class="board-rank">${i + 1}</span>
              <span class="board-name">${m.displayName}${deltas[m.userId] ? ` (+${deltas[m.userId]})` : ''}</span>
              <span class="board-pts">${scores[m.userId] || 0}</span>
            </div>`
            )
            .join('')}
        </div>
      `;
      startCountdown(d.phaseEndsAt);
      return;
    }

    if (state.phase === 'finished') {
      if (countdownTimer) clearInterval(countdownTimer);
      const scores = d.scores || {};
      const rows = (latestRoom ? latestRoom.members : [])
        .slice()
        .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));
      box.innerHTML = `
        <div class="demo-head"><span>${LANG === 'ar' ? 'انتهت اللعبة' : 'Game finished'}</span></div>
        <div class="board">
          ${rows
            .map(
              (m, i) => `
            <div class="board-row ${me && m.userId === me.id ? 'me' : ''}">
              <span class="board-rank">${i + 1}</span>
              <span class="board-name">${m.displayName}</span>
              <span class="board-pts">${scores[m.userId] || 0}</span>
            </div>`
            )
            .join('')}
        </div>
      `;
    }
  }
})();
