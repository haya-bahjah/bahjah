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

  // Ending a room throws every player out of a game in progress, so it asks
  // first -- and then says something. Both of those were missing: one tap
  // ended the match with no warning, and if the server refused (a room that
  // had already ended, a dropped socket) nothing at all appeared, because the
  // only 'room:error' listener is lobby-room.js's, which writes beside the
  // start button on a lobby that is hidden for the whole match. So the press
  // read as doing nothing whether it worked or not.
  let endPending = false;
  let confirmingEnd = false;

  // Remembered rather than only written to the DOM: render() rebuilds this
  // whole console on every game:state (once a second during a round), which
  // would otherwise wipe a confirmation prompt or an error the moment the
  // next tick arrived.
  let endNote = { text: '', tone: 'info' };

  function endNotice(message, tone) {
    endNote = { text: message || '', tone: tone || 'info' };
    const el = document.getElementById('hc-end-note');
    if (!el) return;
    el.textContent = endNote.text;
    el.setAttribute('data-tone', endNote.tone);
  }

  // Re-applies the end control's state to freshly rendered markup.
  function restoreEndUi() {
    paintEndButton();
    const el = document.getElementById('hc-end-note');
    if (!el) return;
    el.textContent = endNote.text;
    el.setAttribute('data-tone', endNote.tone);
  }

  function paintEndButton() {
    const btn = document.getElementById('hc-end-btn');
    if (!btn) return;
    const lang = LANG_ATTR();
    btn.disabled = endPending;
    btn.classList.toggle('is-confirming', confirmingEnd);
    btn.textContent = endPending
      ? (lang === 'ar' ? 'جارٍ الإنهاء…' : 'Ending…')
      : confirmingEnd
        ? (lang === 'ar' ? 'اضغط للتأكيد' : 'Tap to confirm')
        : (lang === 'ar' ? 'أنهِ الغرفة' : 'End room');
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#hc-restart-btn')) {
      if (socket) socket.emit('room:restart');
      return;
    }
    if (e.target.closest('#hc-end-btn')) {
      const lang = LANG_ATTR();
      if (endPending) return;
      if (!confirmingEnd) {
        confirmingEnd = true;
        paintEndButton();
        endNotice(
          lang === 'ar'
            ? 'سيؤدي هذا إلى إنهاء اللعبة لجميع اللاعبين.'
            : 'This ends the game for everyone.',
          'warn'
        );
        // Reverts on its own so a stray tap does not leave the room one
        // accidental press from over.
        setTimeout(() => {
          if (!confirmingEnd || endPending) return;
          confirmingEnd = false;
          paintEndButton();
          endNotice('');
        }, 5000);
        return;
      }
      confirmingEnd = false;
      if (!socket) {
        endNotice(lang === 'ar' ? 'لا يوجد اتصال — أعد تحميل الصفحة.' : 'Not connected — reload the page.', 'error');
        paintEndButton();
        return;
      }
      endPending = true;
      paintEndButton();
      endNotice(lang === 'ar' ? 'جارٍ إنهاء الغرفة…' : 'Ending the room…', 'info');
      socket.emit('room:end');
      // If the room really ended, render() replaces this whole console via
      // the room:update that follows. Reaching this timeout means neither an
      // update nor an error came back.
      setTimeout(() => {
        if (!endPending) return;
        endPending = false;
        paintEndButton();
        endNotice(lang === 'ar' ? 'لا استجابة — حاول مرة أخرى.' : 'No response — try again.', 'error');
      }, 6000);
      return;
    }
    // Any other click cancels a pending confirmation.
    if (confirmingEnd && !endPending) {
      confirmingEnd = false;
      paintEndButton();
      endNotice('');
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

  // roundLabel is omitted on the screens whose stage already names the round
  // in its own header -- otherwise the TV says "Question 1 of 10" twice, once
  // in this bar and again a few pixels below it.
  function headerRow(roundLabel) {
    const lang = LANG_ATTR();
    return `
      <div class="hc-topbar">
        <span class="hc-round-label">${roundLabel || ''}</span>
        <div class="hc-end-wrap">
          <button type="button" id="hc-end-btn" class="hc-btn-secondary hc-end-btn">${lang === 'ar' ? 'أنهِ الغرفة' : 'End room'}</button>
          <span id="hc-end-note" class="hc-end-note" role="status"></span>
        </div>
      </div>
    `;
  }

  // The letters that label the answers, in both languages -- the design uses
  // Latin letters throughout, and they double as the shortcut a player would
  // call out loud. Same list as trivia-play.js.
  const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

  // The big screen is built from the same .tv-* pieces as the phone (both
  // pages carry class="tv" and load trivia-theme.css) so the two read as one
  // game rather than as a styled phone beside a plain monitor. The stage is
  // shared verbatim; only what belongs on a TV differs -- the header carries
  // the room's progress instead of one player's score, and the answers are
  // divs rather than buttons because the host never answers.
  function stageHead(d, lang, rightHtml) {
    return `
      <div class="tv-qhead">
        <div class="tv-qhead-l">
          <img src="assets/logos/trivia-logo.png" alt="">
          <span class="tv-qcount">${
            lang === 'ar'
              ? `السؤال ${d.roundIndex + 1} من ${d.totalRounds}`
              : `Question ${d.roundIndex + 1} of ${d.totalRounds}`
          }</span>
        </div>
        <div class="tv-qhead-r">
          ${d.currentQuestion && d.currentQuestion.category
            ? `<span class="tv-qmeta">${d.currentQuestion.category}</span>`
            : ''}
          ${rightHtml || ''}
        </div>
      </div>
    `;
  }

  function timerRow() {
    return `
      <div class="tv-timer">
        <div class="tv-timer-track"><div class="tv-timer-fill" id="hc-timer-fill"></div></div>
        <div class="tv-ring" id="hc-ring"><span id="hc-timer-text"></span></div>
      </div>
    `;
  }

  function questionCard(d, lang) {
    return `
      <div class="tv-card tv-qcard">
        <span class="tv-qcard-mark" aria-hidden="true">${lang === 'ar' ? '؟' : '?'}</span>
        <h2 class="tv-qtext">${d.currentQuestion ? questionPrompt(d.currentQuestion) : ''}</h2>
      </div>
    `;
  }

  // Every path below rewrites mount.innerHTML, so the end control's live
  // state (confirming / ending / an error it just reported) is re-applied
  // afterwards rather than lost to the next round tick.
  function render() {
    renderPhase();
    restoreEndUi();
  }

  function renderPhase() {
    if (!latestRoom) return;
    const lang = LANG_ATTR();

    if (latestRoom.status === 'ended') {
      window.BahjahTimerBar.stop('hc');
      // The room is gone; a lingering "Ending…" or error is now noise.
      endPending = false;
      confirmingEnd = false;
      endNote = { text: '', tone: 'info' };
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
      window.BahjahRankedBoard.reset('trivia-host');
      mount.innerHTML = `
        ${headerRow(lang === 'ar' ? 'استعدّوا' : 'Get ready')}
        <div class="tv-stage tv-stage--host">
          <div class="countdown-screen">
            <div class="countdown-number" id="hc-timer-text">3</div>
            <div class="countdown-label">${lang === 'ar' ? 'استعدّوا!' : 'Get Ready!'}</div>
          </div>
        </div>
      `;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (latestState.phase === 'question') {
      const players = nonHostMembers();
      const answeredCount = d.answeredCount || 0;
      mount.innerHTML = `
        ${headerRow('')}
        <div class="tv-stage tv-stage--host">
          ${stageHead(d, lang, `<span class="tv-qscore">${answeredCount}/${players.length}</span>`)}
          ${timerRow()}
          ${questionCard(d, lang)}
          <div class="tv-answers">
            ${d.currentQuestion
              ? questionChoices(d.currentQuestion).map((c, i) => `
                <div class="tv-tile tv-answer is-static">
                  <span class="tv-answer-key">${KEYS[i] || i + 1}</span>
                  <span>${c}</span>
                </div>`).join('')
              : ''}
          </div>
          <div class="demo-footer">${
            lang === 'ar'
              ? `${answeredCount} من ${players.length} أجابوا`
              : `${answeredCount} of ${players.length} answered`
          }</div>
        </div>
      `;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (latestState.phase === 'reveal') {
      window.BahjahTimerBar.stop('hc');
      const q = d.currentQuestion;
      // Same grid as the question screen with the right answer lit, so the
      // room reads the answer in the shape it just saw the options in --
      // rather than a bare line of text with no context.
      const answers = q
        ? questionChoices(q).map((c, i) => `
            <div class="tv-result ${i === d.correctIndex ? 'is-correct' : ''}">
              <span class="tv-result-key">${KEYS[i] || i + 1}</span>
              <span class="tv-result-text">${c}</span>
              ${i === d.correctIndex ? '<span class="tv-result-mark">&#10003;</span>' : ''}
            </div>`).join('')
        : '';
      renderBoard(
        headerRow(''),
        `<div class="tv-stage tv-stage--host" style="padding-bottom:8px;">
          ${stageHead(d, lang, '')}
          ${questionCard(d, lang)}
          <div class="tv-answers">${answers}</div>
        </div>`,
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
    const ringEl = document.getElementById('hc-ring');
    window.BahjahTimerBar.start('hc', document.getElementById('hc-timer-fill'), null, endsAt, {
      onTick: (secs) => {
        if (textEl) textEl.textContent = String(secs);
        // The phone turns its ring and bar pink in the last five seconds;
        // the TV does the same so both surfaces panic together.
        const danger = secs <= 5;
        if (ringEl) ringEl.classList.toggle('is-danger', danger);
        const fill = document.getElementById('hc-timer-fill');
        if (fill) fill.classList.toggle('is-danger', danger);
      },
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
