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
//
// Visually this is the shared-screen twin of knows-you-best-play.js: it
// reuses the same .kyb-stage shell (round badge, drawn prompt card, timer
// row, per-player chips) so the TV and the phones read as one game, and
// adds the two things that only exist on the big screen -- the numbered
// answer cards during matching, and those same cards flipped to show their
// author on the reveal.
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

  // Same per-player palette the play page uses, keyed on the player's
  // position in the room so a colour stays with them all game.
  const CHIP_ACCENTS = ['--kyb-pink', '--kyb-cyan', '--kyb-green', '--kyb-purple', '--kyb-yellow'];
  function chipAccent(index) {
    return `var(${CHIP_ACCENTS[index % CHIP_ACCENTS.length]})`;
  }
  function initialOf(name) {
    return String(name || '?').trim().charAt(0) || '?';
  }
  // A player's colour by identity rather than by loop position, so a name on
  // a flipped reveal card matches that player's chip from the answering row.
  function accentForUser(d, userId) {
    const idx = playersForDisplay(d).findIndex((m) => m.userId === userId);
    return chipAccent(idx < 0 ? 0 : idx);
  }

  function startTimer(endsAt) {
    window.BahjahTimerBar.start(
      'hc-kyb',
      document.getElementById('hc-timer-fill'),
      document.getElementById('hc-countdown'),
      endsAt
    );
  }

  // "ROUND n OF m" plus the category on one side; the phase pill and the
  // host-only End room control on the other. Every phase opens with this.
  function stageHead(d, status, tone) {
    const lang = LANG_ATTR();
    const round = lang === 'ar'
      ? `جولة ${d.roundIndex + 1} من ${d.totalRounds}`
      : `Round ${d.roundIndex + 1} of ${d.totalRounds}`;
    const cat = d.currentPrompt && d.currentPrompt.category ? categoryLabel(d.currentPrompt.category) : '';
    return headShell(
      `<span class="kyb-round">${round}</span>${cat ? `<span class="kyb-smeta">${cat}</span>` : ''}`,
      status,
      tone
    );
  }

  // The same header row for phases that have no round to name (reveal,
  // finished, and the pre-first-prompt gap).
  function headShell(leftHtml, status, tone) {
    const lang = LANG_ATTR();
    return `
      <div class="kyb-shead">
        <div class="kyb-shead-l">${leftHtml}</div>
        <div class="kyb-shead-l">
          ${status ? `<span class="kyb-status"${tone ? ` data-tone="${tone}"` : ''}>${status}</span>` : ''}
          <button type="button" id="hc-end-btn" class="kyb-endbtn">${lang === 'ar' ? 'أنهِ الغرفة' : 'End room'}</button>
        </div>
      </div>`;
  }

  function promptCard(d) {
    return `
      <div class="kyb-prompt">
        <span class="kyb-doodle kyb-doodle-x" aria-hidden="true">&#10005;</span>
        <p class="kyb-prompt-text">${questionPrompt(d.currentPrompt)}</p>
        <span class="kyb-doodle kyb-doodle-dot" aria-hidden="true"></span>
      </div>`;
  }

  function timerRow(lang) {
    return `
      <div class="kyb-timer">
        <span class="kyb-timer-label">${lang === 'ar' ? 'الوقت المتبقي' : 'Time left'}</span>
        <div class="kyb-timer-track"><div class="kyb-timer-fill" id="hc-timer-fill"></div></div>
        <span class="kyb-timer-count" id="hc-countdown"></span>
      </div>`;
  }

  // One chip per player, filled once they are done and hollow until then, so
  // the row doubles as the "n of m" meter.
  function progressRow(d, doneIds, label) {
    const chips = playersForDisplay(d)
      .map((m, i) => {
        const done = doneIds instanceof Set ? doneIds.has(m.userId) : false;
        return `<span class="kyb-chip" data-answered="${done ? 1 : 0}" style="--chip-accent:${chipAccent(i)}" title="${m.displayName}">${initialOf(m.displayName)}</span>`;
      })
      .join('');
    return `
      <div class="kyb-answered">
        <span class="kyb-timer-label">${label}</span>
        <div class="kyb-answered-list">${chips}</div>
      </div>`;
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
        <div class="kyb-stage">
          <h2 class="kyb-stage-title">${lang === 'ar' ? 'انتهت الغرفة' : 'Room ended'}</h2>
          <p class="kyb-quip">${lang === 'ar' ? `أنهيت هذه اللعبة (الرمز: ${code}).` : `You ended this game (code: ${code}).`}</p>
        </div>
      `;
      return;
    }

    if (!latestState) {
      mount.innerHTML = `
        <div class="kyb-stage">
          ${headShell(`<span class="kyb-round">${lang === 'ar' ? 'البدء' : 'Starting'}</span>`, '', '')}
          <h2 class="kyb-stage-title">${lang === 'ar' ? 'جارٍ بدء اللعبة…' : 'Starting the game…'}</h2>
        </div>
      `;
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
    const answered = new Set(Array.isArray(d.answeredUserIds) ? d.answeredUserIds : []);

    let entryHtml = '';
    if (d.hostPlays && !d.myAnswered) {
      entryHtml = `
        <div class="kyb-answer-field">
          <span class="kyb-answer-label">${lang === 'ar' ? 'إجابتك' : 'Your answer'}</span>
          <input type="text" id="hc-answer-input" maxlength="280" autocomplete="off"
            placeholder="${lang === 'ar' ? 'اكتب إجابتك…' : 'Type your answer…'}">
        </div>
        <div class="kyb-stage-actions">
          <button type="button" class="bh-btn bh-btn--hot bh-btn--md" id="hc-answer-submit">${lang === 'ar' ? 'إرسال الإجابة' : 'Submit answer'}</button>
        </div>`;
    } else if (d.hostPlays && d.myAnswered) {
      entryHtml = `<div class="kyb-locked">${lang === 'ar' ? 'تم الإرسال ✓' : 'Locked in ✓'}</div>`;
    }

    mount.innerHTML = `
      <div class="kyb-stage">
        ${stageHead(d, lang === 'ar' ? 'الإجابة' : 'Answering')}
        ${promptCard(d)}
        ${timerRow(lang)}
        ${progressRow(d, answered, lang === 'ar' ? 'أجابوا' : 'Answered')}
        ${entryHtml}
      </div>
    `;

    const input = document.getElementById('hc-answer-input');
    const submitBtn = document.getElementById('hc-answer-submit');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitHostAnswer(); });
    if (submitBtn) submitBtn.addEventListener('click', submitHostAnswer);
    startTimer(d.phaseEndsAt);
  }

  function renderGuessing(d, lang) {
    const guessed = new Set(Array.isArray(d.guessedUserIds) ? d.guessedUserIds : []);
    const totalPlayers = playersForDisplay(d).length;

    // When the host is only running the room, the big screen carries the
    // answers themselves as numbered cards -- that IS the host's view of the
    // round. When the host is also playing, the matching board below already
    // shows every answer, so repeating them above it would just duplicate
    // the round onto one screen.
    const answers = Array.isArray(d.answers) ? d.answers : [];
    const cards = !d.hostPlays && answers.length
      ? `<div class="kyb-tvgrid">${answers
          .map(
            (a, i) => `<div class="kyb-tvcard" style="--tv-accent:${chipAccent(i)}">
              <span class="kyb-tvcard-tag">${lang === 'ar' ? `إجابة ${i + 1}` : `Answer ${i + 1}`}</span>
              <p class="kyb-tvcard-text">${a.text}</p>
            </div>`
          )
          .join('')}</div>`
      : '';

    mount.innerHTML = `
      <div class="kyb-stage">
        ${stageHead(d, lang === 'ar' ? 'المطابقة' : 'Matching')}
        ${promptCard(d)}
        ${timerRow(lang)}
        <h2 class="kyb-stage-title">${lang === 'ar' ? 'الآن — من قال ماذا؟' : 'Now — who said what?'}</h2>
        ${cards}
        ${progressRow(d, guessed, lang === 'ar' ? 'أنهوا المطابقة' : 'Matched')}
        <p class="kyb-quip">${lang === 'ar' ? `${d.guessedCount || 0} من ${totalPlayers} أنهوا المطابقة` : `${d.guessedCount || 0} of ${totalPlayers} finished matching`}</p>
        ${d.hostPlays ? '<div id="hc-match-mount"></div>' : ''}
      </div>
    `;
    startTimer(d.phaseEndsAt);

    if (d.hostPlays && answers.length && me) {
      const mountEl = document.getElementById('hc-match-mount');
      const names = shuffledPlayersForDisplay(d)
        .filter((m) => m.userId !== me.id)
        .map((m) => ({ userId: m.userId, displayName: m.displayName, avatar: m.avatar }));
      const guessableAnswers = answers.filter((a) => a.index !== d.myAnswerIndex);
      matchBoard = window.BahjahKybMatchBoard.mount(mountEl, {
        names,
        answers: guessableAnswers,
        labels: {
          submitBtn: lang === 'ar' ? 'أرسل المطابقات' : 'Submit Matches',
          hint: lang === 'ar' ? 'اسحب اسمًا إلى الإجابة، أو اضغط اسمًا ثم إجابة لمطابقتهما.' : 'Drag a name onto the answer you think they wrote, or tap one then the other to match them.',
          waiting: lang === 'ar' ? 'بانتظار بقية اللاعبين…' : 'Waiting for other players…',
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

    // Same cards as the matching screen, now flipped: each keeps its answer
    // text and gains the author underneath.
    const cards = reveal
      .map((r, i) => {
        const author = names[r.authorUserId] || '';
        const guessedUserId = d.hostPlays && mySubmittedMatches ? mySubmittedMatches[i] : undefined;
        const got = guessedUserId === undefined ? '' : ` data-got="${guessedUserId === r.authorUserId ? 1 : 0}"`;
        return `<div class="kyb-tvcard kyb-anim-flip"${got} style="--tv-accent:${accentForUser(d, r.authorUserId)}; animation-delay:${i * 90}ms;">
            <span class="kyb-tvcard-tag">${lang === 'ar' ? `إجابة ${i + 1}` : `Answer ${i + 1}`}</span>
            <p class="kyb-tvcard-text">${r.text}</p>
            <div class="kyb-tvcard-author">
              <span class="kyb-tvcard-face">${initialOf(author)}</span>
              <span class="kyb-tvcard-name">${author}</span>
            </div>
          </div>`;
      })
      .join('');

    mount.innerHTML = `
      <div class="kyb-stage">
        ${headShell(
          `<span class="kyb-round">${lang === 'ar' ? `انتهت الجولة ${d.roundIndex + 1}` : `Round ${d.roundIndex + 1} done`}</span>`,
          lang === 'ar' ? 'الحقيقة' : 'The truth',
          'green'
        )}
        <h2 class="kyb-verdict">${lang === 'ar' ? 'من قال ماذا' : 'Who said what'}</h2>
        <div class="kyb-tvgrid">${cards}</div>
        ${standings(d, null, lang)}
      </div>
    `;
  }

  function renderFinished(d, lang) {
    const scores = d.scores || {};
    const winnerIds = new Set(d.winnerUserIds || []);
    const rows = playersForDisplay(d)
      .slice()
      .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));

    // Podium ordered 2-1-3 in the DOM so the grid seats them without
    // explicit column indices, matching the play page's final screen.
    const podium = [rows[1], rows[0], rows[2]]
      .filter(Boolean)
      .map((m) => {
        const place = rows.indexOf(m) + 1;
        return `<div class="kyb-plinth" data-place="${place}">
            <span class="kyb-plinth-place">#${place}</span>
            <span class="kyb-plinth-face">${initialOf(m.displayName)}</span>
            <span class="kyb-plinth-name">${m.displayName}</span>
            <span class="kyb-plinth-score">${scores[m.userId] || 0}</span>
          </div>`;
      })
      .join('');

    const rest = rows
      .slice(3)
      .map(
        (m, i) =>
          `<span class="kyb-restchip"><span>#${i + 4}</span><b>${m.displayName}</b><span>${scores[m.userId] || 0}</span></span>`
      )
      .join('');

    const winnerNames = rows.filter((m) => winnerIds.has(m.userId)).map((m) => m.displayName);
    const winnerLine = winnerNames.length
      ? lang === 'ar'
        ? winnerNames.length > 1
          ? `${winnerNames.join('، ')} تعادلوا في الفوز!`
          : `${winnerNames[0]} يفوز!`
        : winnerNames.length > 1
          ? `${winnerNames.join(', ')} tie for the win!`
          : `${winnerNames[0]} wins!`
      : '';

    mount.innerHTML = `
      <div class="kyb-stage">
        ${headShell(
          `<span class="kyb-round">${lang === 'ar' ? 'انتهت اللعبة' : 'Game over'}</span>`,
          '',
          ''
        )}
        ${winnerLine ? `<h2 class="kyb-verdict">${winnerLine}</h2>` : ''}
        <div class="kyb-podium">${podium}</div>
        ${rest ? `<div class="kyb-restrow">${rest}</div>` : ''}
        ${finalStatsTable(d, rows, lang)}
        <div class="kyb-stage-actions" style="justify-content:center;">
          <button type="button" id="hc-restart-btn" class="bh-btn bh-btn--hot bh-btn--md">${lang === 'ar' ? 'العب مجددًا' : 'Play again'}</button>
        </div>
      </div>
    `;
  }

  // Running scores between rounds -- the host's screen is the only place the
  // table is visible to everyone at once, so the reveal carries it.
  function standings(d, winnerIds, lang) {
    const scores = d.scores || {};
    const rows = playersForDisplay(d)
      .slice()
      .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));
    if (!rows.length) return '';
    const body = rows
      .map(
        (m, i) => `<div class="kyb-tvrow">
          <span class="kyb-tvcard-face" style="--tv-accent:${accentForUser(d, m.userId)}">${
            winnerIds && winnerIds.has(m.userId) ? '★' : i + 1
          }</span>
          <span class="kyb-tvrow-name">${m.displayName}</span>
          <span class="kyb-plinth-score" style="--plinth-accent:var(--kyb-yellow)">${scores[m.userId] || 0}</span>
        </div>`
      )
      .join('');
    return `
      <div>
        <p class="kyb-timer-label" style="margin-bottom:8px;">${lang === 'ar' ? 'النقاط' : 'Standings'}</p>
        <div class="kyb-tvtable">${body}</div>
      </div>`;
  }

  function finalStatsTable(d, rows, lang) {
    if (!d.finalStats) return '';
    const names = nameById();
    const body = rows
      .map((m) => {
        const s = d.finalStats[m.userId];
        if (!s) return '';
        const topGuesser = s.topGuesser
          ? lang === 'ar'
            ? ` · أكثر من خمّنك: ${names[s.topGuesser.userId] || ''} (${s.topGuesser.count})`
            : ` · guessed you most: ${names[s.topGuesser.userId] || ''} (${s.topGuesser.count})`
          : '';
        return `<div class="kyb-tvrow">
            <span class="kyb-tvrow-name">${m.displayName}</span>
            <span class="kyb-tvrow-stat">${
              lang === 'ar'
                ? `${s.totalCorrect} صحيحة · ${s.perfectRounds} جولة مثالية · دقة ${s.accuracyPct}%${topGuesser}`
                : `${s.totalCorrect} correct · ${s.perfectRounds} perfect · ${s.accuracyPct}% accuracy${topGuesser}`
            }</span>
          </div>`;
      })
      .join('');
    if (!body) return '';
    return `
      <div>
        <p class="kyb-timer-label" style="margin-bottom:8px;">${lang === 'ar' ? 'إحصاءات المباراة' : 'Match stats'}</p>
        <div class="kyb-tvtable">${body}</div>
      </div>`;
  }
})();
