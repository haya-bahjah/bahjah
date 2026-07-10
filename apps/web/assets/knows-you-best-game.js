// Renders the live knows-you-best round into #kyb-live-box, driven by
// 'bahjah:game-state' events dispatched by assets/lobby.js. Only active
// when the page has a #kyb-live container (knows-you-best.html). Reuses
// the existing demo-* / name-chips / answer-cards / result-row CSS
// already defined on this page for the marketing walkthrough.
(function () {
  const LANG = document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  const wrap = document.getElementById('kyb-live');
  const box = document.getElementById('kyb-live-box');
  if (!wrap || !box) return;

  const me = BahjahSession.getUser();
  let latestRoom = null;
  let countdownTimer = null;

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
  });

  document.addEventListener('bahjah:game-state', (e) => {
    const state = e.detail;
    if (state.gameType !== 'knows-you-best') return;
    render(state);
  });

  function nameFor(userId) {
    const m = latestRoom && latestRoom.members.find((x) => x.userId === userId);
    return m ? m.displayName : userId;
  }

  function act(action) {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    socket.emit('game:action', { action });
  }

  function fmtCountdown(endsAt) {
    if (!endsAt) return '';
    const secs = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    return `${secs}s`;
  }

  function startCountdown(endsAt) {
    if (countdownTimer) clearInterval(countdownTimer);
    const el = document.getElementById('kyb-countdown');
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

    if (state.phase === 'answering') {
      if (d.myAnswered) {
        box.innerHTML = `
          <div class="demo-title">${LANG === 'ar' ? `السؤال ${d.roundIndex + 1} من ${d.totalRounds}` : `Prompt ${d.roundIndex + 1} of ${d.totalRounds}`} <span id="kyb-countdown" style="float:inline-end; color:var(--accent);"></span></div>
          <div class="demo-sub">${d.currentPrompt ? d.currentPrompt.text : ''}</div>
          <div class="your-answer-note">${LANG === 'ar' ? 'إجابتك' : 'Your answer'}: “${d.myAnswerText || ''}”</div>
          <div class="demo-sub">${LANG === 'ar' ? `بانتظار البقية (${d.answeredCount || 0} أجابوا)...` : `Waiting on the rest of the group (${d.answeredCount || 0} answered)...`}</div>
        `;
      } else {
        box.innerHTML = `
          <div class="demo-title">${LANG === 'ar' ? `السؤال ${d.roundIndex + 1} من ${d.totalRounds}` : `Prompt ${d.roundIndex + 1} of ${d.totalRounds}`} <span id="kyb-countdown" style="float:inline-end; color:var(--accent);"></span></div>
          <div class="demo-sub">${d.currentPrompt ? d.currentPrompt.text : ''}</div>
          <input class="demo-input" id="kyb-answer-input" type="text" maxlength="280" placeholder="${LANG === 'ar' ? 'اكتب إجابتك...' : 'Type your answer...'}">
          <div class="demo-footer"><button class="btn btn-primary btn-sm" id="kyb-submit-answer">${LANG === 'ar' ? 'أرسل' : 'Submit'}</button></div>
        `;
        const input = document.getElementById('kyb-answer-input');
        const submit = () => {
          const text = input.value.trim();
          if (!text) return;
          act({ type: 'answer', text });
        };
        document.getElementById('kyb-submit-answer').addEventListener('click', submit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') submit();
        });
      }
      startCountdown(d.phaseEndsAt);
      return;
    }

    if (state.phase === 'guessing') {
      const answers = d.answers || [];
      const myGuesses = d.myGuesses || {};
      const totalGuessers = latestRoom ? latestRoom.members.length : 0;
      const cards = answers
        .map((a) => {
          if (a.index === d.myAnswerIndex) {
            return `
            <div class="answer-card">
              <span>“${a.text}” <em>(${LANG === 'ar' ? 'إجابتك' : 'yours'})</em></span>
            </div>`;
          }
          const guessed = myGuesses[String(a.index)];
          const chips = (latestRoom ? latestRoom.members : [])
            .filter((m) => !me || m.userId !== me.id)
            .map(
              (m) => `<button class="chip" style="${guessed === m.userId ? 'border-color:var(--accent);' : ''}" data-index="${a.index}" data-guess="${m.userId}">${m.displayName}</button>`
            )
            .join('');
          return `
            <div class="answer-card" style="flex-direction:column; align-items:flex-start; gap:10px;">
              <span>“${a.text}”</span>
              <div class="name-chips" style="margin-bottom:0;">${chips}</div>
            </div>`;
        })
        .join('');

      box.innerHTML = `
        <div class="demo-title">${LANG === 'ar' ? 'خمّن من كتب كل إجابة' : 'Guess who wrote each answer'} <span id="kyb-countdown" style="float:inline-end; color:var(--accent);"></span></div>
        <div class="demo-sub">${LANG === 'ar' ? `${d.guessedCount || 0} من ${totalGuessers} انتهوا من التخمين` : `${d.guessedCount || 0} of ${totalGuessers} finished guessing`}</div>
        <div class="answer-cards">${cards}</div>
      `;
      box.querySelectorAll('button[data-guess]').forEach((btn) => {
        btn.addEventListener('click', () => {
          act({ type: 'guess', answerIndex: Number(btn.dataset.index), guessedUserId: btn.dataset.guess });
        });
      });
      startCountdown(d.phaseEndsAt);
      return;
    }

    if (state.phase === 'reveal') {
      const reveal = d.lastRoundReveal || [];
      const deltas = d.lastRoundScores || {};
      const rows = reveal
        .map((r) => `<div class="result-row"><span>“${r.text}”</span><span>${nameFor(r.authorUserId)}</span></div>`)
        .join('');
      const scoreLines = Object.keys(deltas)
        .map((userId) => `${nameFor(userId)} +${deltas[userId]}`)
        .join(' · ');
      box.innerHTML = `
        <div class="demo-title">${LANG === 'ar' ? 'من كتب ماذا' : 'Who wrote what'} <span id="kyb-countdown" style="float:inline-end; color:var(--accent);"></span></div>
        ${rows}
        ${scoreLines ? `<div class="score-banner">${scoreLines}</div>` : `<div class="score-banner">${LANG === 'ar' ? 'لا تخمينات صحيحة هذه الجولة' : 'No correct guesses this round'}</div>`}
      `;
      startCountdown(d.phaseEndsAt);
      return;
    }

    if (state.phase === 'finished') {
      if (countdownTimer) clearInterval(countdownTimer);
      const scores = d.scores || {};
      const rows = (latestRoom ? latestRoom.members : [])
        .slice()
        .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0))
        .map((m) => `<div class="result-row"><span>${m.displayName}</span><span>${scores[m.userId] || 0}</span></div>`)
        .join('');
      box.innerHTML = `
        <div class="demo-title">${LANG === 'ar' ? 'انتهت اللعبة' : 'Game finished'}</div>
        ${rows}
      `;
    }
  }
})();
