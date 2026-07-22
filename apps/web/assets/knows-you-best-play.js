// Player-only Knows You Best gameplay, driven entirely by 'bahjah:game-state'
// events dispatched by assets/lobby.js. Only active on
// knows-you-best-play.html (needs #kyb-live + #kyb-play-box). The host never
// lands here unless "I want to play too" was on -- and even then they play
// from the same console page via knows-you-best-host-console.js instead of
// this dedicated page, which is player-only.
(function () {
  const LANG_ATTR = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const wrap = document.getElementById('kyb-live');
  const box = document.getElementById('kyb-play-box');
  if (!wrap || !box) return;

  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();
  let latestRoom = null;
  let latestState = null;
  let matchBoard = null;
  // The player's own submitted matches for the current round, retained
  // across the guessing -> reveal transition so the reveal view can mark
  // each connection correct/incorrect.
  let mySubmittedMatches = null;

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
    // The host restarted the room ("Play again") -- follow everyone back
    // to the waiting room instead of sitting on a stale finished screen.
    if (e.detail.status === 'lobby') {
      window.location.href = `knows-you-best-lobby.html?code=${encodeURIComponent(code)}`;
    }
  });

  document.addEventListener('bahjah:game-state', (e) => {
    const state = e.detail;
    if (state.gameType !== 'knows-you-best') return;
    latestState = state;
    render(state);
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (latestState) render(latestState);
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

  function render(state) {
    wrap.style.display = 'block';
    if (matchBoard) {
      matchBoard.destroy();
      matchBoard = null;
    }
    const d = state.data || {};

    if (state.phase === 'answering') {
      mySubmittedMatches = null;
      renderAnswering(d);
      return;
    }
    if (state.phase === 'guessing') {
      renderGuessing(d);
      return;
    }
    if (state.phase === 'reveal') {
      renderReveal(d);
      return;
    }
    if (state.phase === 'finished') {
      renderFinished(d);
    }
  }

  function submitAnswer() {
    const input = document.getElementById('kyb-answer-input');
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!input || !socket || input.disabled) return;
    const text = input.value.trim();
    if (!text) return;
    input.disabled = true;
    const btn = document.getElementById('kyb-answer-submit');
    if (btn) btn.disabled = true;
    window.BahjahSoundFx.submit();
    socket.emit('game:action', { action: { type: 'answer', text } });
  }

  function renderAnswering(d) {
    const lang = LANG_ATTR();
    const totalPlayers = playersForDisplay(d).length;
    const answeredCount = d.answeredCount || 0;

    let bodyHtml;
    if (!d.myAnswered) {
      bodyHtml = `
        <input type="text" class="kyb-answer-input" id="kyb-answer-input" maxlength="280" placeholder="${lang === 'ar' ? 'اكتب إجابتك…' : 'Type your answer…'}">
        <div class="demo-footer"><button type="button" class="btn btn-primary" id="kyb-answer-submit">${lang === 'ar' ? 'إرسال الإجابة' : 'Submit answer'}</button></div>
      `;
    } else {
      bodyHtml = `<p class="kyb-waiting">${lang === 'ar' ? 'تم إرسال إجابتك — بانتظار البقية…' : 'Your answer is in — waiting for others…'}</p>`;
    }

    box.innerHTML = `
      <div class="demo-head"><span>${roundLabel(d)}</span></div>
      <div class="q-text">${questionPrompt(d.currentPrompt)}</div>
      ${bodyHtml}
      <p class="kyb-waiting">${lang === 'ar' ? `${answeredCount} من ${totalPlayers} أجابوا` : `${answeredCount} of ${totalPlayers} answered`}</p>
    `;

    const input = document.getElementById('kyb-answer-input');
    const submitBtn = document.getElementById('kyb-answer-submit');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAnswer(); });
    if (submitBtn) submitBtn.addEventListener('click', submitAnswer);
  }

  function renderGuessing(d) {
    const lang = LANG_ATTR();
    const totalPlayers = playersForDisplay(d).length;

    box.innerHTML = `
      <div class="demo-head"><span>${roundLabel(d)}</span></div>
      <div class="q-text">${questionPrompt(d.currentPrompt)}</div>
      <p class="kyb-waiting">${lang === 'ar' ? `${d.guessedCount || 0} من ${totalPlayers} أنهوا المطابقة` : `${d.guessedCount || 0} of ${totalPlayers} finished matching`}</p>
      <div id="kyb-match-mount" style="margin-top:16px;"></div>
    `;

    if (Array.isArray(d.answers) && me) {
      const mountEl = document.getElementById('kyb-match-mount');
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
          waiting: lang === 'ar' ? 'بانتظار بقية اللاعبين…' : 'Waiting for other players…',
        },
        onSubmit: (matches) => {
          mySubmittedMatches = matches;
          const socket = window.BahjahRoom && window.BahjahRoom.socket;
          if (!socket) return;
          window.BahjahSoundFx.submit();
          // One atomic batch action, not one action per connection -- see
          // the engine's KnowsYouBestAction comment for why.
          socket.emit('game:action', { action: { type: 'guessAll', guesses: matches } });
        },
      });
    }
  }

  function renderReveal(d) {
    const lang = LANG_ATTR();
    const reveal = d.lastRoundReveal || [];
    const names = nameById();

    const rows = reveal
      .map((r, i) => {
        const guessedUserId = mySubmittedMatches ? mySubmittedMatches[i] : undefined;
        let cls = '';
        let mark = '';
        if (guessedUserId !== undefined) {
          cls = guessedUserId === r.authorUserId ? 'correct' : 'incorrect';
          mark = guessedUserId === r.authorUserId ? ' <svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align:-2px;"><circle cx="12" cy="12" r="12" style="fill:var(--good)"/><path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ' ❌';
        }
        return `<div class="reveal-row ${cls}"><span class="rr-text">${r.text}</span><span class="rr-author">${names[r.authorUserId] || ''}${mark}</span></div>`;
      })
      .join('');

    const mine = me ? (d.lastRoundScores || {})[me.id] : null;
    if (mine) window.BahjahSoundFx[mine.total > 0 ? 'correct' : 'wrong']();

    const breakdownParts = [];
    if (mine && mine.total > 0) {
      breakdownParts.push(lang === 'ar' ? `+${mine.total} نقطة` : `+${mine.total} points`);
      if (mine.perfectBonus) breakdownParts.push(lang === 'ar' ? 'جولة مثالية!' : 'perfect round!');
      if (mine.fastBonus) breakdownParts.push(lang === 'ar' ? 'مكافأة سرعة' : 'fast bonus');
    } else if (mine) {
      breakdownParts.push(lang === 'ar' ? 'بدون نقاط هذه الجولة' : 'No points this round');
    }
    const myLine = breakdownParts.length ? `<div class="round-breakdown" style="text-align:center; margin-top:14px; font-weight:600; color:var(--accent);">${breakdownParts.join(' · ')}</div>` : '';

    box.innerHTML = `
      <div class="demo-head"><span>${lang === 'ar' ? 'الإجابات الصحيحة' : 'Correct answers'}</span></div>
      <div class="board">${rows}</div>
      ${myLine}
    `;
  }

  function renderFinished(d) {
    const lang = LANG_ATTR();
    const scores = d.scores || {};
    const winnerIds = new Set(d.winnerUserIds || []);
    const rows = playersForDisplay(d)
      .slice()
      .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));
    const myRank = me ? rows.findIndex((m) => m.userId === me.id) + 1 : 0;
    const myStats = me && d.finalStats ? d.finalStats[me.id] : null;
    const names = nameById();

    if (me && winnerIds.has(me.id)) window.BahjahSoundFx.win();

    const winnerNames = rows.filter((m) => winnerIds.has(m.userId)).map((m) => m.displayName);
    const winnerLine = winnerNames.length
      ? `<div class="winner-banner">${
          lang === 'ar'
            ? winnerNames.length > 1
              ? `${winnerNames.join('، ')} تعادلوا في الفوز!`
              : `${winnerNames[0]} يفوز!`
            : winnerNames.length > 1
              ? `${winnerNames.join(', ')} tie for the win!`
              : `${winnerNames[0]} wins!`
        }</div>`
      : '';

    const rankLabel = myRank > 0 ? (lang === 'ar' ? `أنهيت في المركز ${myRank}` : `You finished #${myRank}`) : '';

    const topGuesserLine =
      myStats && myStats.topGuesser
        ? `<p class="top-guesser-note">${
            lang === 'ar'
              ? `الأكثر تخمينًا لك: ${names[myStats.topGuesser.userId] || ''} (${myStats.topGuesser.count} مرات)`
              : `Guessed you correctly the most: ${names[myStats.topGuesser.userId] || ''} (${myStats.topGuesser.count}x)`
          }</p>`
        : '';

    const statsBlock = myStats
      ? `
        <div class="final-stats">
          <div class="final-stat"><div class="stat-value">${scores[me.id] || 0}</div><div class="stat-label">${lang === 'ar' ? 'النقاط' : 'Score'}</div></div>
          <div class="final-stat"><div class="stat-value">${myStats.totalCorrect}</div><div class="stat-label">${lang === 'ar' ? 'مطابقات صحيحة' : 'Correct'}</div></div>
          <div class="final-stat"><div class="stat-value">${myStats.perfectRounds}</div><div class="stat-label">${lang === 'ar' ? 'جولات مثالية' : 'Perfect'}</div></div>
          <div class="final-stat"><div class="stat-value">${myStats.accuracyPct}%</div><div class="stat-label">${lang === 'ar' ? 'الدقة' : 'Accuracy'}</div></div>
        </div>`
      : '';

    box.innerHTML = `
      <div class="demo-head"><span>${lang === 'ar' ? 'انتهت اللعبة' : 'Game finished'}</span></div>
      ${winnerLine}
      ${rankLabel ? `<p style="text-align:center; font-weight:700; margin-bottom:16px;">${rankLabel}</p>` : ''}
      ${statsBlock}
      ${topGuesserLine}
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
      <button class="btn btn-primary" id="kyb-share-btn" style="margin-top:14px; width:100%;">${lang === 'ar' ? 'شارك نتيجتك' : 'Share your result'}</button>
      <p class="waiting-note">${lang === 'ar' ? 'بانتظار أن يبدأ المضيف لعبة جديدة…' : 'Waiting for the host to start a new game…'}</p>
      <p style="text-align:center; margin-top:10px;"><a class="back-link" href="knows-you-best.html">${lang === 'ar' ? 'انضم إلى لعبة أخرى' : 'Join another game'}</a></p>
    `;
    const shareBtn = document.getElementById('kyb-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', () => shareResult(myRank));
  }

  function shareResult(myRank) {
    const lang = LANG_ATTR();
    const scores = (latestState && latestState.data && latestState.data.scores) || {};
    const myScore = me ? scores[me.id] || 0 : 0;
    const won = myRank === 1;
    const shareBtn = document.getElementById('kyb-share-btn');
    const url = `${location.origin}/bahjah-landing.html`;

    const headline = lang === 'ar'
      ? won ? 'لعبت للتو على بهجة وفزت!' : 'لعبت للتو على بهجة!'
      : won ? 'I just played on Bahjah and won!' : 'I just played on Bahjah!';
    const subline = lang === 'ar'
      ? `عارفكم · ${myScore} نقطة · المركز #${myRank}`
      : `Knows You Best · ${myScore} pts · Rank #${myRank}`;
    const text = lang === 'ar'
      ? `${headline} سجّلت ${myScore} نقطة وحللت في المركز #${myRank} في عارفكم. 🏆`
      : `${headline} Scored ${myScore} points and placed #${myRank} in Knows You Best. 🏆`;

    if (window.BahjahShareCard) {
      window.BahjahShareCard.share({ gameId: 'knows-you-best', lang, headline, subline, text, url, shareBtn });
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
