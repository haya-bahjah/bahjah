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

  // The reveal window is split into two views the same way the phone splits
  // it (trivia-play.js renderRevealSplit): the answer on its own first, then
  // the standings on their own screen -- which is where the board lives now
  // rather than stacked underneath the question. Remembering when this
  // round's reveal started (instead of only holding a timer) keeps the flip
  // on schedule when a lobby update or a language switch re-renders the
  // console mid-reveal.
  const REVEAL_ANSWER_MS = 2500;
  let revealTimer = null;
  let revealRound = null;
  let revealStartedAt = 0;

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

    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }

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
      revealRound = null;
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
      renderRevealSplit(d, lang);
      return;
    }

    if (latestState.phase === 'finished') {
      window.BahjahTimerBar.stop('hc');
      renderFinal(d, lang);
      return;
    }
  }

  // Answer first, standings second -- the two halves of one reveal phase.
  // d.phaseEndsAt is untouched either way; this only decides what the TV
  // shows while the server's reveal window runs.
  function renderRevealSplit(d, lang) {
    window.BahjahTimerBar.stop('hc');
    if (revealRound !== d.roundIndex) {
      revealRound = d.roundIndex;
      revealStartedAt = Date.now();
    }
    const remaining = d.phaseEndsAt ? d.phaseEndsAt - Date.now() : 0;
    const answerLeft = REVEAL_ANSWER_MS - (Date.now() - revealStartedAt);
    // Too little of the window left to be worth a flip -- a reconnect landing
    // late in the reveal goes straight to the standings.
    if (answerLeft <= 0 || remaining <= answerLeft + 300) {
      renderStandings(d, lang);
      return;
    }
    renderRevealAnswer(d, lang);
    revealTimer = setTimeout(() => {
      revealTimer = null;
      if (active) render();
    }, answerLeft);
  }

  function renderRevealAnswer(d, lang) {
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
    mount.innerHTML = `
      ${headerRow('')}
      <div class="tv-stage tv-stage--host">
        ${stageHead(d, lang, '')}
        ${questionCard(d, lang)}
        <div class="tv-answers">${answers}</div>
      </div>
    `;
  }

  // The between-rounds standings, on a screen of their own. Same board the
  // phone draws for this moment (trivia-play.js renderRanking): bars are
  // measured against the leader, so the room can see how close the race is.
  function renderStandings(d, lang) {
    const rows = rankedRows(d.scores || {});
    const deltas = d.lastRoundScores || {};
    const topScore = rows.reduce((max, r) => Math.max(max, r.score), 0) || 1;
    mount.innerHTML = `
      ${headerRow('')}
      <div class="tv-stage tv-stage--host">
        <div class="tv-rhead">
          <h2 class="tv-screen-title">${lang === 'ar' ? 'الترتيب.' : 'Standings.'}</h2>
          <span class="tv-rhead-r"><span class="tv-rscore" id="hc-timer-text"></span></span>
        </div>
        <div class="tv-timer">
          <div class="tv-timer-track"><div class="tv-timer-fill" id="hc-timer-fill"></div></div>
        </div>
        <div class="tv-ranks" id="hc-standings"></div>
        <div class="tv-rank-foot">${lang === 'ar' ? 'جارٍ تحميل السؤال التالي…' : 'Next question loading…'}</div>
      </div>
    `;
    window.BahjahRankedBoard.render('trivia-host', document.getElementById('hc-standings'), rows, (row, i) => {
      const delta = deltas[row.userId];
      const initial = (row.displayName || '?').trim().charAt(0).toUpperCase();
      const pct = Math.max(4, Math.round((row.score / topScore) * 100));
      return `
        <div class="tv-rank-row">
          <div class="tv-rank-line">
            <span class="tv-rank-no">${i + 1}</span>
            <span class="tv-rank-av">${initial}</span>
            <span class="tv-rank-name">${row.displayName}</span>
            ${delta && delta.total ? `<span class="tv-rank-delta">+${delta.total}</span>` : ''}
            <span class="tv-rank-total" data-score="${row.score}">${row.score}</span>
          </div>
          <div class="tv-rank-bar"><span data-bar style="width:${pct}%"></span></div>
        </div>`;
    });
    // The plain "12s" form the helper writes itself, not the question
    // screen's ring, so no onTick formatting is needed here.
    window.BahjahTimerBar.start(
      'hc',
      document.getElementById('hc-timer-fill'),
      document.getElementById('hc-timer-text'),
      d.phaseEndsAt
    );
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

  // Scores read in the reader's own numerals, matching trivia-play.js. The
  // ranked-board helper detects the formatting from this final text and counts
  // up in the same shape, so Arabic never counts in Latin digits and snaps.
  function formatScore(n) {
    return Number(n || 0).toLocaleString(LANG_ATTR() === 'ar' ? 'ar-EG' : 'en-US');
  }

  // The winner card's confetti and crown, copied from trivia-play.js rather
  // than shared: the two scripts never load on the same page (the phone is on
  // trivia-play.html, the host stays here), and lifting them into a third file
  // would mean editing the phone's screen, which this change deliberately
  // leaves alone. Both are pure and take no state.
  //
  // Positions and delays are spread evenly rather than randomised so the card
  // looks the same on every render instead of reshuffling on each update.
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

  function crownMark() {
    return `
      <svg viewBox="0 0 24 18" shape-rendering="crispEdges" focusable="false" aria-hidden="true">
        <path d="M0 18V5h5v4h4V3h6v6h4V5h5v13Z" fill="currentColor"/>
        <rect x="1.5" y="10" width="2.5" height="2.5" fill="var(--tv-green)"/>
        <rect x="10.75" y="10" width="2.5" height="2.5" fill="var(--tv-green)"/>
        <rect x="20" y="10" width="2.5" height="2.5" fill="var(--tv-green)"/>
        <rect x="0" y="14" width="24" height="1.5" fill="var(--tv-green)"/>
      </svg>
    `;
  }

  // The finale. The room has been watching this screen all game, so the end of
  // it should look like an ending rather than the between-rounds board with the
  // timer removed: the winner is the hero, the podium is coloured, and the rest
  // of the field is still there in order.
  //
  // Every number on it comes from the state the server already sent --
  // d.scores, d.winnerUserIds, d.finalStats -- through the same rankedRows()
  // the standings use. Nothing here decides who won or how anyone is ranked.
  function renderFinal(d, lang) {
    const scores = d.scores || {};
    const stats = d.finalStats || {};
    const winnerIds = new Set(d.winnerUserIds || []);
    const rows = rankedRows(scores);

    // The card crowns exactly one player. The server can name more than one in
    // winnerUserIds when scores tie, but this screen is the moment the room
    // looks up at a single name -- two names shrink the type and blunt the
    // moment. So: the first player in the standings who is on the server's
    // winner list. That is a choice about what to show, not about who won --
    // the ranking is the same rankedRows() order the board itself uses, and
    // anybody tied with them is still on that board at their real score.
    const champion = rows.find((r) => winnerIds.has(r.userId)) || null;
    const winnerName = champion
      ? champion.displayName
      : lang === 'ar' ? 'لا فائز' : 'No winner';

    const championStats = champion ? stats[champion.userId] : null;
    const winnerSub = champion
      ? [
          lang === 'ar'
            ? `${formatScore(scores[champion.userId] || 0)} نقطة`
            : `${formatScore(scores[champion.userId] || 0)} points`,
          championStats
            ? lang === 'ar'
              ? `${formatScore(championStats.correctCount)} من ${formatScore(d.totalRounds)} صحيحة`
              : `${championStats.correctCount} of ${d.totalRounds} correct`
            : null,
          // A middot between two Arabic-Indic numbers is a misreading waiting
          // to happen: laid out right-to-left it sits hard against the digit
          // beside it, and "٩٩٧ نقطة · ٧ من ١٠" reads as seventy on a screen
          // people are looking at from across the room. The Arabic comma
          // separates the same two facts without ever looking like a digit.
        ].filter(Boolean).join(lang === 'ar' ? '، ' : ' · ')
      : '';

    mount.innerHTML = `
      ${headerRow('')}
      <div class="tv-stage tv-stage--host hc-final">
        <div class="hc-final-head">
          <img class="hc-final-logo" src="assets/logos/trivia-logo.png?v=20260823" alt="">
          <span class="hc-final-kicker">${lang === 'ar' ? 'انتهت اللعبة' : 'Game finished'}</span>
        </div>

        <div class="tv-card tv-winner hc-winner">
          <div class="tv-confetti" aria-hidden="true">${confettiPieces()}</div>
          <div class="tv-winner-crown" aria-hidden="true">${crownMark()}</div>
          <div class="tv-winner-label">${lang === 'ar' ? 'الفائز' : 'Winner'}</div>
          <h2 class="tv-winner-name">${winnerName}</h2>
          ${winnerSub ? `<p class="tv-winner-sub">${winnerSub}</p>` : ''}
        </div>

        <h3 class="tv-screen-title hc-final-title">${lang === 'ar' ? 'الترتيب النهائي.' : 'Final standings.'}</h3>
        <div class="hc-final-list" id="hc-board"></div>

        <div class="hc-actions">
          <button type="button" id="hc-restart-btn" class="btn btn-primary hc-play-again">${
            lang === 'ar' ? 'العب مجددًا' : 'Play again'
          }</button>
        </div>
      </div>
    `;

    window.BahjahRankedBoard.render('trivia-host', document.getElementById('hc-board'), rows, (row, i) => {
      const place = i + 1;
      const s = stats[row.userId];
      const initial = (row.displayName || '?').trim().charAt(0).toUpperCase();
      const statLine = s
        ? lang === 'ar'
          ? `${formatScore(s.correctCount)}/${formatScore(d.totalRounds)}، ${formatScore(s.speedPct)}٪ سرعة`
          : `${s.correctCount}/${d.totalRounds} · ${s.speedPct}% speed`
        : '';
      return `
        <div class="hc-final-row${place <= 3 ? ` is-p${place}` : ''}">
          <span class="hc-final-place">${formatScore(place)}</span>
          <span class="hc-final-av">${initial}</span>
          <span class="hc-final-id">
            <span class="hc-final-name">${row.displayName}</span>
            ${statLine ? `<span class="hc-final-stat">${statLine}</span>` : ''}
          </span>
          <span class="hc-final-pts" data-score="${row.score}">${formatScore(row.score)}</span>
        </div>`;
    });
  }
})();
