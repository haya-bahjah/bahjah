// Live-match monitor for the host, mounted into #host-console on
// knows-you-best-lobby.html. The host never leaves this page for the whole
// match -- lobby-room.js keeps them here (host-plays="false" on <body>)
// instead of redirecting them to knows-you-best-play.html like everyone
// else. The host runs the room and never plays, so this console is purely the
// big screen: it shows the room what is happening and carries the controls
// that move the game on.
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

  // Every control on this screen is a fire-once host action, so they are all
  // handled here by delegation.
  document.addEventListener('click', (e) => {
    if (e.target.closest('#hc-restart-btn')) {
      if (socket) socket.emit('room:restart');
    }
    if (e.target.closest('#hc-end-btn')) {
      if (socket) socket.emit('room:end');
    }
    // The design's TV controls. The two that only change which screen the TV
    // is showing stay local; the two that actually move the game emit.
    const diff = e.target.closest('[data-difficulty]');
    if (diff && socket) {
      socket.emit('game:action', { action: { type: 'pickCategory', category: diff.dataset.difficulty } });
    }
    if (e.target.closest('#hc-start-matching')) hostOpenMatching();
    if (e.target.closest('#hc-scoreboard')) setRevealStep('scores');
    if (e.target.closest('#hc-show-truth')) hostAdvance();
    if (e.target.closest('#hc-next-round')) hostAdvance();
    if (e.target.closest('#hc-skip-finale')) hostSkipToFinale();
  });

  function allMembers() {
    return latestRoom ? latestRoom.members : [];
  }

  function nonHostMembers() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }

  function playersForDisplay(d) {
    return nonHostMembers();
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
  // The design's difficulty ladder: tag, glyph, accent, blurb and the sample
  // question each card quotes. Keyed by the server's category names.
  const DIFFICULTIES = {
    Easy: {
      color: 'green', glyph: '\u25CF',
      name: { en: 'Easy', ar: 'سهل' },
      tag: { en: 'Warm up', ar: 'تسخين' },
      desc: { en: 'Favourites and safe preferences. Nobody gets hurt.', ar: 'مفضلات وتفضيلات آمنة. لا أحد يتأذى.' },
      sample: { en: '"What is your favourite fruit?"', ar: '«ما هي فاكهتك المفضلة؟»' },
    },
    Moderate: {
      color: 'yellow', glyph: '\u25B2',
      name: { en: 'Moderate', ar: 'متوسط' },
      tag: { en: 'The sweet spot', ar: 'النقطة المثالية' },
      desc: { en: 'Hypotheticals and habits. Reveals more than you think.', ar: 'افتراضات وعادات. تكشف أكثر مما تظن.' },
      sample: { en: '"What would you do if it started raining meat?"', ar: '«ماذا ستفعل لو أمطرت لحمًا؟»' },
    },
    Hard: {
      color: 'pink', glyph: '\u2715',
      name: { en: 'Hard', ar: 'صعب' },
      tag: { en: 'No mercy', ar: 'بلا رحمة' },
      desc: { en: 'Confessions, fears, petty grudges. Friendships end here.', ar: 'اعترافات ومخاوف وضغائن صغيرة. الصداقات تنتهي هنا.' },
      sample: { en: '"What\'s the pettiest thing you\'ve held onto?"', ar: '«ما أتفه شيء ما زلت متمسكًا به؟»' },
    },
  };
  const DIFFICULTY_ORDER = ['Easy', 'Moderate', 'Hard'];

  // One doodle per answer card, cycling alongside CHIP_ACCENTS so a card's
  // glyph and its border always come from the same step of the pattern.
  const CARD_DOODLES = ['&#9679;', '&#9650;', '&#10005;', '&#9724;', '&#9679;'];
  function cardDoodle(index) {
    return CARD_DOODLES[index % CARD_DOODLES.length];
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
  // `meta` picks what rides alongside the round badge: the category on screens
  // that already show the prompt on a card of its own, or the prompt itself on
  // the answer screens, where the handoff demotes it to this one muted line.
  function stageHead(d, status, tone, meta) {
    const lang = LANG_ATTR();
    const round = lang === 'ar'
      ? `جولة ${d.roundIndex + 1} من ${d.totalRounds}`
      : `Round ${d.roundIndex + 1} of ${d.totalRounds}`;
    const sub = meta === 'prompt'
      ? (d.currentPrompt ? questionPrompt(d.currentPrompt) : '')
      : (d.currentPrompt && d.currentPrompt.category ? categoryLabel(d.currentPrompt.category) : '');
    return headShell(
      `<span class="kyb-round">${round}</span>${sub ? `<span class="kyb-smeta">${sub}</span>` : ''}`,
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

  // The design walks nine screens, the server has four phases: two of those
  // phases carry two screens each. 'guessing' opens on Answers (read them all,
  // no names) and moves to Match on the host's cue; 'reveal' opens on Truth and
  // moves to Scores the same way. Those are presentation steps within one
  // server phase, so they live here rather than on the server -- only the
  // steps that really do change the game (SHOW THE TRUTH, ROUND n, SKIP TO
  // FINALE) emit an action.
  //
  // The two halves of 'guessing' are shared state (data.matchingOpen), because
  // the phones have to move with the TV: while the room is reading the answers
  // every phone says "look up at the TV", and only once the host opens matching
  // do the boards appear. The two halves of 'reveal' are local, because the
  // truth and the scoreboard are both TV-only -- the phones show the same
  // result list either way.
  let revealStep = 'truth';
  let revealStepRound = null;

  function setRevealStep(step) {
    revealStep = step;
    render();
  }

  function hostAdvance() {
    if (socket) socket.emit('game:action', { action: { type: 'advance' } });
  }
  function hostOpenMatching() {
    if (socket) socket.emit('game:action', { action: { type: 'openMatching' } });
  }
  function hostSkipToFinale() {
    if (socket) socket.emit('game:action', { action: { type: 'skipToFinale' } });
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

    // Each round's reveal opens on the truth and stays wherever the host took
    // it, so a re-render inside the round (a player reconnecting, a language
    // switch) does not throw them back to the first screen.
    if (revealStepRound !== d.roundIndex) {
      revealStepRound = d.roundIndex;
      revealStep = 'truth';
    }

    if (latestState.phase === 'category') {
      window.BahjahTimerBar.stop('hc-kyb');
      renderCategory(d, lang);
      return;
    }
    if (latestState.phase === 'answering') {
      renderAnswering(d, lang);
      return;
    }
    if (latestState.phase === 'guessing') {
      if (d.matchingOpen) renderGuessing(d, lang);
      else renderAnswers(d, lang);
      return;
    }
    if (latestState.phase === 'reveal') {
      window.BahjahTimerBar.stop('hc-kyb');
      if (revealStep === 'scores') renderScoreboard(d, lang);
      else renderReveal(d, lang);
      return;
    }
    if (latestState.phase === 'finished') {
      window.BahjahTimerBar.stop('hc-kyb');
      renderFinished(d, lang);
    }
  }

  // Screen 03: the host picks the difficulty before round 1. The pick decides
  // which prompts the whole game draws from, so nothing starts until it lands.
  function renderCategory(d, lang) {
    const choices = Array.isArray(d.categoryChoices) && d.categoryChoices.length
      ? DIFFICULTY_ORDER.filter((name) => d.categoryChoices.includes(name))
      : DIFFICULTY_ORDER;

    const cards = choices
      .map((name, i) => {
        const meta = DIFFICULTIES[name];
        if (!meta) {
          return `<button type="button" class="kyb-diff" data-difficulty="${name}">
              <span class="kyb-diff-name">${name}</span>
            </button>`;
        }
        return `<button type="button" class="kyb-diff" data-difficulty="${name}"
            data-cat-color="${meta.color}" style="--diff-tilt:${['-1.8deg', '.9deg', '2.1deg'][i % 3]}">
            <span class="kyb-diff-tag"><i aria-hidden="true">${meta.glyph}</i>${meta.tag[lang]}</span>
            <span class="kyb-diff-name">${meta.name[lang]}</span>
            <span class="kyb-diff-desc">${meta.desc[lang]}</span>
            <span class="kyb-diff-sample">${meta.sample[lang]}</span>
          </button>`;
      })
      .join('');

    mount.innerHTML = `
      <div class="kyb-stage kyb-stage--center">
        ${headShell('', '', '')}
        <span class="kyb-status" data-tone="purple">${lang === 'ar' ? 'الخطوة ١ من ٣' : 'Step 1 of 3'}</span>
        <h2 class="kyb-verdict">${lang === 'ar' ? 'اختر مستوى الصعوبة.' : 'Pick your difficulty.'}</h2>
        <p class="kyb-final-sub">${lang === 'ar' ? 'أسئلة أصعب. جروح أعمق. جدال أكثر.' : 'Harder questions. Deeper cuts. More arguing.'}</p>
        <div class="kyb-diff-row">${cards}</div>
      </div>
    `;
  }

  function renderAnswering(d, lang) {
    const answered = new Set(Array.isArray(d.answeredUserIds) ? d.answeredUserIds : []);

    mount.innerHTML = `
      <div class="kyb-stage">
        ${stageHead(d, lang === 'ar' ? 'الإجابة' : 'Answering')}
        ${promptCard(d)}
        ${timerRow(lang)}
        ${progressRow(d, answered, lang === 'ar' ? 'أجابوا' : 'Answered')}
      </div>
    `;

    startTimer(d.phaseEndsAt);
  }

  // The row of answer cards, shared by the Answers and Match screens -- they
  // are the same cards, the second screen just asks the room to place them.
  function answerCards(d, lang) {
    const answers = Array.isArray(d.answers) ? d.answers : [];
    if (!answers.length) return '';
    return `<div class="kyb-tvgrid">${answers
      .map(
        (a, i) => `<div class="kyb-tvcard" style="--tv-accent:${chipAccent(i)}">
          <span class="kyb-tvcard-doodle" aria-hidden="true">${cardDoodle(i)}</span>
          <span class="kyb-tvcard-tag">${lang === 'ar' ? `إجابة ${i + 1}` : `Answer ${i + 1}`}</span>
          <p class="kyb-tvcard-text">${a.text}</p>
          <div class="kyb-tvcard-whose">${lang === 'ar' ? 'لِمَن؟' : 'Whose?'}</div>
        </div>`
      )
      .join('')}</div>`;
  }

  // Screen 05, the first half of the guessing phase: every answer on screen
  // with no names against them, held there until the host starts matching.
  function renderAnswers(d, lang) {
    mount.innerHTML = `
      <div class="kyb-stage">
        ${stageHead(d, lang === 'ar' ? 'ظهرت' : 'Revealed', 'green', 'prompt')}
        <h2 class="kyb-stage-title">${
          lang === 'ar'
            ? `${(d.answers || []).length} إجابات. بلا أسماء.`
            : `${(d.answers || []).length} answers. No names.`
        }</h2>
        ${answerCards(d, lang)}
        <div class="kyb-tvfoot kyb-tvfoot--cta">
          ${timerRow(lang)}
          <button type="button" id="hc-start-matching" class="kyb-tvbtn kyb-tvbtn--go">${
            lang === 'ar' ? 'ابدأ المطابقة &#9654;' : 'Start matching &#9654;'
          }</button>
        </div>
      </div>
    `;
    startTimer(d.phaseEndsAt);
  }

  function renderGuessing(d, lang) {
    const totalPlayers = playersForDisplay(d).length;

    // When the host is only running the room, the big screen carries the
    // answers themselves as numbered cards -- that IS the host's view of the
    // round. When the host is also playing, the matching board below already
    // shows every answer, so repeating them above it would just duplicate
    // the round onto one screen.
    const answers = Array.isArray(d.answers) ? d.answers : [];
    const cards = answerCards(d, lang);

    // The handoff keeps this screen almost entirely answers: the prompt drops
    // into the header as a muted line rather than taking a card of its own,
    // and the foot carries one bar for how many players are done.
    const done = d.guessedCount || 0;
    const pct = totalPlayers ? Math.round((done / totalPlayers) * 100) : 0;

    mount.innerHTML = `
      <div class="kyb-stage">
        ${stageHead(d, lang === 'ar' ? 'المطابقة' : 'Matching', '', 'prompt')}
        <h2 class="kyb-stage-title">${lang === 'ar' ? 'الآن — من قال ماذا؟' : 'Now — who said what?'}</h2>
        ${cards}
        <div class="kyb-tvfoot">
          <div class="kyb-tvfoot-track"><div class="kyb-tvfoot-fill" style="width:${pct}%"></div></div>
          <span class="kyb-tvfoot-count">${lang === 'ar' ? `${done} / ${totalPlayers} طابقوا` : `${done} / ${totalPlayers} matched`}</span>
          ${timerRow(lang)}
          <button type="button" id="hc-show-truth" class="kyb-tvbtn kyb-tvbtn--go">${
            lang === 'ar' ? 'اكشف الحقيقة &#9654;' : 'Show the truth &#9654;'
          }</button>
        </div>
      </div>
    `;
    startTimer(d.phaseEndsAt);
  }

  function renderReveal(d, lang) {
    const reveal = d.lastRoundReveal || [];
    const names = nameById();

    // Same cards as the matching screen, now flipped: each keeps its answer
    // text and gains the author underneath.
    const cards = reveal
      .map((r, i) => {
        const author = names[r.authorUserId] || '';
        // The host does not play, so no card carries a right/wrong verdict --
        // the corner keeps its doodle.
        return `<div class="kyb-tvcard kyb-anim-flip" style="--tv-accent:${accentForUser(d, r.authorUserId)}; animation-delay:${i * 90}ms;">
            <span class="kyb-tvcard-doodle" aria-hidden="true">${cardDoodle(i)}</span>
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
          `<span class="kyb-status">${lang === 'ar' ? 'الحقيقة' : 'The truth'}</span>${
            d.currentPrompt ? `<span class="kyb-smeta">${questionPrompt(d.currentPrompt)}</span>` : ''
          }`,
          '',
          ''
        )}
        <h2 class="kyb-verdict">${lang === 'ar' ? 'وهذا من قال ماذا.' : "Here's who said what."}</h2>
        <div class="kyb-tvgrid">${cards}</div>
        <div class="kyb-tvfoot kyb-tvfoot--cta">
          <button type="button" id="hc-scoreboard" class="kyb-tvbtn kyb-tvbtn--score">${
            lang === 'ar' ? 'النتائج &#9654;' : 'Scoreboard &#9654;'
          }</button>
        </div>
      </div>
    `;
  }

  const PLACE_LABELS = {
    en: ['1st', '2nd', '3rd'],
    ar: ['الأول', 'الثاني', 'الثالث'],
  };

  function podiumFace(m) {
    if (m.avatar && window.BahjahAvatars) {
      return window.BahjahAvatars.renderAvatarHtml(m.avatar, m.userId);
    }
    return initialOf(m.displayName);
  }

  // Top three as a podium: the portrait sits above a coloured block whose
  // height is the ranking. Ordered 2-1-3 in the DOM so the leader lands in
  // the middle without the markup having to know about columns.
  function podiumHtml(d, rows, scores, lang, opts) {
    const crown = (opts && opts.crown) || '';
    return [rows[1], rows[0], rows[2]]
      .filter(Boolean)
      .map((m) => {
        const place = rows.indexOf(m) + 1;
        return `<div class="kyb-plinth" data-place="${place}">
            ${place === 1 && crown ? `<span class="kyb-plinth-crown">${crown}</span>` : ''}
            <span class="kyb-plinth-face">${podiumFace(m)}</span>
            <span class="kyb-plinth-name">${m.displayName}</span>
            <span class="kyb-plinth-block">
              <span class="kyb-plinth-score">${scores[m.userId] || 0}</span>
              <span class="kyb-plinth-place">${PLACE_LABELS[lang === 'ar' ? 'ar' : 'en'][place - 1]}</span>
            </span>
          </div>`;
      })
      .join('');
  }

  // Fourth place down, as a chip row under the podium.
  function alsoPlayingHtml(d, rows, scores, lang) {
    const rest = rows.slice(3);
    if (!rest.length) return '';
    const chips = rest
      .map((m, i) => `<span class="kyb-restchip" style="--chip-accent:${accentForUser(d, m.userId)}">
          <span class="kyb-restchip-face">${initialOf(m.displayName)}</span>
          <b>${m.displayName}</b>
          <span>${lang === 'ar' ? `#${i + 4}` : `${i + 4}th`}</span>
          <i>${scores[m.userId] || 0}</i>
        </span>`)
      .join('');
    return `<div class="kyb-restrow">
        <span class="kyb-restrow-label">${lang === 'ar' ? 'يلعب أيضًا' : 'Also playing'}</span>
        ${chips}
      </div>`;
  }

  // The handoff's screen 08: a yellow KNOWS THEM BEST badge inline with the
  // round's title and how many rounds are left, then the podium. The round
  // advances on the server's own clock, so this screen has no controls.
  function renderScoreboard(d, lang) {
    const scores = d.scores || {};
    const rows = playersForDisplay(d)
      .slice()
      .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));

    const left = d.totalRounds - (d.roundIndex + 1);
    const leftLabel = left > 0
      ? (lang === 'ar' ? `${left} جولة متبقية` : `${left} round${left === 1 ? '' : 's'} left`)
      : (lang === 'ar' ? 'الجولة الأخيرة' : 'Final round');

    mount.innerHTML = `
      <div class="kyb-stage kyb-stage--center">
        ${headShell('', '', '')}
        <div class="kyb-score-head">
          <span class="kyb-status" data-tone="yellow">${lang === 'ar' ? 'الأعرف بهم' : 'Knows them best'}</span>
          <h2 class="kyb-verdict">${lang === 'ar' ? `نقاط الجولة ${d.roundIndex + 1}` : `Round ${d.roundIndex + 1} scores`}</h2>
          <span class="kyb-smeta">${leftLabel}</span>
        </div>
        <div class="kyb-podium">${podiumHtml(d, rows, scores, lang, { crown: lang === 'ar' ? '★ الأعرف بك' : '&#9733; Knows you best' })}</div>
        ${alsoPlayingHtml(d, rows, scores, lang)}
        <div class="kyb-tvfoot kyb-tvfoot--cta">
          <button type="button" id="hc-next-round" class="kyb-tvbtn kyb-tvbtn--go">${
            left > 0
              ? (lang === 'ar' ? `الجولة ${d.roundIndex + 2} &#9654;` : `Round ${d.roundIndex + 2} &#9654;`)
              : (lang === 'ar' ? 'النتيجة النهائية &#9654;' : 'Final result &#9654;')
          }</button>
          ${left > 0 ? `<button type="button" id="hc-skip-finale" class="kyb-tvbtn kyb-tvbtn--ghost">${
            lang === 'ar' ? 'تخطَّ إلى النهاية' : 'Skip to finale'
          }</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderFinished(d, lang) {
    const scores = d.scores || {};
    const winnerIds = new Set(d.winnerUserIds || []);
    const rows = playersForDisplay(d)
      .slice()
      .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));

    const winnerNames = rows.filter((m) => winnerIds.has(m.userId)).map((m) => m.displayName);
    // The handoff closes on the winner's name as the headline itself --
    // "Rita knows you best." -- rather than a generic "wins!".
    const winnerLine = winnerNames.length
      ? lang === 'ar'
        ? winnerNames.length > 1
          ? `${winnerNames.join('، ')} تعادلوا في معرفتكم.`
          : `${winnerNames[0]} الأعرف بكم.`
        : winnerNames.length > 1
          ? `${winnerNames.join(' and ')} know you best.`
          : `${winnerNames[0]} knows you best.`
      : '';

    mount.innerHTML = `
      <div class="kyb-stage kyb-stage--center kyb-stage--final">
        ${headShell('', '', '')}
        <span class="kyb-status">${
          lang === 'ar' ? `انتهت اللعبة · ${d.totalRounds} جولات` : `Game over &middot; ${d.totalRounds} rounds`
        }</span>
        <div class="kyb-podium">${podiumHtml(d, rows, scores, lang)}</div>
        ${winnerLine ? `<h2 class="kyb-final-title">${winnerLine}</h2>` : ''}
        <p class="kyb-final-sub">${lang === 'ar' ? 'بدقة مريبة، بصراحة.' : 'Suspiciously well, actually.'}</p>
        ${alsoPlayingHtml(d, rows, scores, lang)}
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
