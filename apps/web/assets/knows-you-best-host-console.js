// The big screen, mounted into #host-console on knows-you-best-lobby.html.
// It runs only for a room made on a TV, where the creator's browser is the
// display and nothing else: lobby-room.js keeps that browser on this page for
// the whole match instead of sending it to knows-you-best-play.html like every
// player. (A room made on a phone has no big screen at all -- its creator is a
// player and this console never activates.)
//
// So this is a monitor and nothing more. It carries no controls that move the
// game on: the difficulty is picked on the phone of whoever is running the
// room, matching resolves when every player has matched, and the round turns
// over when every player has pressed Next. Nobody can tap a television.
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

  // The two handoff screens the big display now runs: TV MATCH while the room
  // is matching, TV TRUTH for the reveal. Both own their whole canvas (a fixed
  // layer over the viewport), so they live outside #host-console and are torn
  // down by hand when the phase moves on.
  let tvScreen = null;
  let tvScreenKind = null;
  let tvTicker = null;
  let tvTruthKey = null;

  function closeTvScreen() {
    if (tvTicker) {
      clearInterval(tvTicker);
      tvTicker = null;
    }
    if (tvScreen) {
      tvScreen.destroy();
      tvScreen = null;
    }
    tvScreenKind = null;
    tvTruthKey = null;
  }

  // Reuse the mounted screen while the phase still wants it: remounting would
  // replay TV MATCH's entrance stagger on every tick and restart TV TRUTH's
  // reveal every time another player pressed Next.
  function ensureTvScreen(kind, factory, props) {
    if (tvScreenKind !== kind) {
      closeTvScreen();
      tvScreen = factory(props);
      tvScreenKind = kind;
      return tvScreen;
    }
    tvScreen.update(props);
    return tvScreen;
  }

  // How long this phase runs, remembered per endsAt so the draining bar keeps
  // its span across the re-renders a game:state storm causes.
  const phaseSpans = new Map();
  function phaseSpan(endsAt) {
    if (!endsAt) return 20;
    if (!phaseSpans.has(endsAt)) {
      phaseSpans.set(endsAt, Math.max(1, Math.ceil((endsAt - Date.now()) / 1000)));
    }
    return phaseSpans.get(endsAt);
  }
  function secondsLeft(endsAt) {
    if (!endsAt) return 0;
    return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  }

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    latestRoom = detail.room;
    me = detail.me;
    code = detail.code;
    socket = detail.socket;
    // Only the creator who is *just* a screen watches from here. A creator
    // who is playing was sent to the play page and never reaches this.
    active = Boolean(
      latestRoom && latestRoom.status !== 'lobby' &&
      (detail.isPassiveScreen !== undefined ? detail.isPassiveScreen : detail.isHost)
    );

    // A television has no use for the site's nav or its back link, and on a
    // 1280x720 canvas that chrome is about 130px the game needs: without this
    // the final screen's buttons fall below the fold, on a screen nobody can
    // scroll.
    document.body.classList.toggle('kyb-tv-active', active);

    if (!active) {
      mount.style.display = 'none';
      return;
    }
    if (gate) gate.style.display = 'none';
    if (main) main.style.display = 'none';
    // flex, not block: the console is the thing that fills the television's
    // canvas so each phase can centre inside it (see .kyb-tv-active in
    // kyb-theme.css). This is an inline style, so it beats the stylesheet --
    // setting it to 'block' here silently cancelled that layout.
    mount.style.display = 'flex';
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
    if (e.target.closest('#hc-share-btn')) {
      shareFinalResult();
    }
    if (e.target.closest('#hc-end-btn')) {
      if (socket) socket.emit('room:end');
    }
    // The difficulty cards are shown here but are not pressed here -- this
    // screen is a television, and the pick happens on the phone of whoever is
    // running the room (knows-you-best-play.js). The server would reject an
    // emit from here anyway, since a display is not the controller.
    //
    // (The step from TRUTH to the round's winner is the TV TRUTH screen's own
    // Scoreboard control, wired through its onScoreboard prop -- there is no
    // #hc-scoreboard element in this console, and a delegated handler for one
    // sat here dead.)
  });

  function allMembers() {
    return latestRoom ? latestRoom.members : [];
  }

  // Who is at the table. The creator counts as a player when they made the
  // room on their own phone, and is only the screen when they set it up on a
  // TV -- the server settles it per room and sends the answer.
  function playerMembers() {
    if (!latestRoom) return [];
    if (latestRoom.hostPlays) return latestRoom.members;
    return latestRoom.members.filter((m) => !m.isHost);
  }

  function playersForDisplay(d) {
    return playerMembers();
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

  // The difficulty ladder, Arabic side. This used to carry the bank's old
  // category names (Break the Ice / Imagine If / Close Friends Only), which
  // no longer exist -- so every Arabic screen showed the raw English key
  // ("MODERATE") next to otherwise-translated copy. Anything not on the
  // ladder still falls through to its own name.
  const CATEGORY_LABELS_AR = {
    Easy: 'سهل',
    Moderate: 'متوسط',
    Hard: 'صعب',
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
  // The glow token that belongs to the same accent. The winner card's halo has
  // to be the winner's colour, not a fixed yellow -- there is no way to derive
  // a glow from an arbitrary accent value, so the pair is looked up together.
  const CHIP_GLOWS = ['--kyb-glow-p', '--kyb-glow-c', '--kyb-glow-g', '--kyb-glow-pu', '--kyb-glow-y'];
  function chipGlow(index) {
    return `var(${CHIP_GLOWS[index % CHIP_GLOWS.length]})`;
  }
  function glowForUser(d, userId) {
    const idx = playersForDisplay(d).findIndex((m) => m.userId === userId);
    return chipGlow(idx < 0 ? 0 : idx);
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
  // The two halves of 'reveal' are local, because the truth and the
  // scoreboard are both TV-only -- the phones show the same result list
  // either way. ('guessing' used to be split the same way, gated on
  // data.matchingOpen, until matching stopped being something the host
  // opens and started following the last answer automatically.)
  let revealStep = 'truth';
  let revealStepRound = null;

  function setRevealStep(step) {
    revealStep = step;
    render();
  }

  // How many players have pressed Next on their phones, and what happens when
  // the last one does. The round no longer moves on because somebody pressed a
  // button on the television -- every player has to agree.
  function nextGateLabel(d, lang, left) {
    const done = typeof d.continuedCount === 'number' ? d.continuedCount : 0;
    const total = typeof d.totalPlayers === 'number' ? d.totalPlayers : playersForDisplay(d).length;
    const whatsNext = left > 0
      ? (lang === 'ar' ? `الجولة ${d.roundIndex + 2}` : `Round ${d.roundIndex + 2}`)
      : (lang === 'ar' ? 'النتيجة النهائية' : 'the final result');
    return lang === 'ar'
      ? `${done} / ${total} ضغطوا التالي — ${whatsNext} تبدأ عندما يجهز الجميع.`
      : `${done} / ${total} pressed Next — ${whatsNext} starts when everybody has.`;
  }

  function render() {
    if (!latestRoom) return;
    if (matchBoard) {
      matchBoard.destroy();
      matchBoard = null;
    }
    const lang = LANG_ATTR();

    // Anything that is not one of the two handoff screens takes the display
    // back: the console's own stages draw into #host-console as they always did.
    const wantsTv = latestRoom.status !== 'ended' && latestState &&
      (latestState.phase === 'guessing' || latestState.phase === 'reveal');
    if (!wantsTv) closeTvScreen();

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
      renderGuessing(d, lang);
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

  // Screen 03: the difficulty, before round 1. The pick decides which prompts
  // the whole game draws from, so nothing starts until it lands -- but it is
  // made on the running player's phone, not here. The TV shows the same three
  // cards so the room can read them together, as flat panels rather than
  // buttons nobody can press.
  function renderCategory(d, lang) {
    const choices = Array.isArray(d.categoryChoices) && d.categoryChoices.length
      ? DIFFICULTY_ORDER.filter((name) => d.categoryChoices.includes(name))
      : DIFFICULTY_ORDER;

    const cards = choices
      .map((name, i) => {
        const meta = DIFFICULTIES[name];
        if (!meta) {
          return `<div class="kyb-diff" data-difficulty="${name}">
              <span class="kyb-diff-name">${name}</span>
            </div>`;
        }
        return `<div class="kyb-diff is-static" data-difficulty="${name}"
            data-cat-color="${meta.color}" style="--diff-tilt:${['-1.8deg', '.9deg', '2.1deg'][i % 3]}">
            <span class="kyb-diff-tag"><i aria-hidden="true">${meta.glyph}</i>${meta.tag[lang]}</span>
            <span class="kyb-diff-name">${meta.name[lang]}</span>
            <span class="kyb-diff-desc">${meta.desc[lang]}</span>
            <span class="kyb-diff-sample">${meta.sample[lang]}</span>
          </div>`;
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

  // TV · MATCH, from the handoff. The screen owns the whole display: its own
  // header line, the two-row card grid, and the draining bar in the foot. The
  // clock is a prop, so a local ticker feeds it off the server's phaseEndsAt
  // rather than the screen keeping a clock of its own.
  function tvMatchRound(d) {
    const display = playersForDisplay(d);
    const answers = Array.isArray(d.answers) ? d.answers : [];
    window.KybData.setRound({
      key: `match|${d.roundIndex}`,
      players: display.map((m, i) => ({
        id: m.userId,
        name: m.displayName,
        initial: initialOf(m.displayName),
        color: chipAccent(i),
      })),
      // Matching is anonymous, so the cards carry no author -- owner is only
      // filled in on the reveal.
      answers: answers.map((a) => ({ id: `a${a.index}`, owner: 0, text: a.text, matchers: [] })),
    });
    return { display, answers };
  }

  function renderGuessing(d, lang) {
    window.BahjahTimerBar.stop('hc-kyb');
    mount.innerHTML = '';

    const round = tvMatchRound(d);
    const total = phaseSpan(d.phaseEndsAt);

    const paint = () => ensureTvScreen('tv-match', window.KybTvMatchScreen.mount, {
      players: Math.max(round.answers.length, round.display.length),
      question: questionPrompt(d.currentPrompt),
      seconds: secondsLeft(d.phaseEndsAt),
      total,
      matched: d.guessedCount || 0,
      matchedTotal: round.display.length,
      wobble: 1,
      // Nobody taps a television: this display is never the controller, so the
      // server would reject an advance from here. The CTA stays out of the way
      // until a game loop hands the screen something to do with it.
      onShowTruth: null,
      labels: lang === 'ar' ? {
        round: `الجولة ${d.roundIndex + 1} من ${d.totalRounds}`,
        status: 'المطابقة',
        headline: 'الآن — من قال ماذا؟',
        matched: 'طابقوا',
        whose: 'لِمَن؟',
        cta: 'اكشف الحقيقة ◀',
      } : {
        round: `ROUND ${d.roundIndex + 1} OF ${d.totalRounds}`,
      },
    });

    paint();
    if (tvTicker) clearInterval(tvTicker);
    tvTicker = setInterval(paint, 200);
  }

  // TV · TRUTH, from the handoff. PLAYERS is ordered authors-first, in reveal
  // order, so an answer's owner is simply its own index and every correct
  // guesser lands inside the timeline's matcher window.
  function tvTruthRound(d) {
    const reveal = d.lastRoundReveal || [];
    const display = playersForDisplay(d);
    const byId = new Map(display.map((m) => [m.userId, m]));
    const ordered = [];
    const seen = new Set();
    reveal.forEach((r) => {
      const m = byId.get(r.authorUserId);
      if (m && !seen.has(m.userId)) { seen.add(m.userId); ordered.push(m); }
    });
    display.forEach((m) => { if (!seen.has(m.userId)) { seen.add(m.userId); ordered.push(m); } });
    const indexOf = new Map(ordered.map((m, i) => [m.userId, i]));

    window.KybData.setRound({
      key: `truth|${d.roundIndex}`,
      players: ordered.map((m) => ({
        id: m.userId,
        name: m.displayName,
        initial: initialOf(m.displayName),
        color: accentForUser(d, m.userId),
      })),
      answers: reveal.map((r, i) => ({
        id: `r${i}`,
        owner: indexOf.has(r.authorUserId) ? indexOf.get(r.authorUserId) : i,
        text: r.text,
        matchers: (r.correctGuesserIds || [])
          .map((id) => indexOf.get(id))
          .filter((j) => j !== undefined),
      })),
    });
    return { reveal, players: ordered };
  }

  function renderReveal(d, lang) {
    mount.innerHTML = '';

    // The reveal is one run of choreography. Re-running it because somebody
    // pressed Next would snap every card back to face-down, so it is rebuilt
    // only when the round -- or the language it is written in -- changes.
    const key = `${d.roundIndex}|${lang}`;
    if (tvScreenKind === 'tv-truth' && tvTruthKey === key) return;
    tvTruthKey = key;

    const round = tvTruthRound(d);
    ensureTvScreen('tv-truth', window.KybTvTruthScreen.mount, {
      players: Math.max(round.reveal.length, round.players.length),
      question: questionPrompt(d.currentPrompt),
      onScoreboard: () => setRevealStep('scores'),
      labels: lang === 'ar' ? {
        status: 'الحقيقة',
        answers: 'إجابات',
        players: 'لاعبون',
        headline: 'وهذا من قال ماذا.',
        replay: 'إعادة الكشف',
        scoreboard: 'النتائج ◀',
        whose: 'لِمَن؟',
      } : {},
    });
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





  // The handoff's screen 08: a yellow KNOWS THEM BEST badge inline with the
  // round's title and how many rounds are left, then the podium. The round
  // advances on the server's own clock, so this screen has no controls.
  // Who won THIS round -- the per-round totals, not the running ones. The
  // screen is headed "ROUND WINNER", so it has to read lastRoundScores;
  // sorting by the cumulative table would crown whoever is ahead overall.
  function roundWinners(d) {
    const last = d.lastRoundScores || {};
    const players = playersForDisplay(d);
    let best = -1;
    players.forEach((m) => {
      const t = (last[m.userId] || {}).total || 0;
      if (t > best) best = t;
    });
    if (best <= 0) return [];
    return players.filter((m) => ((last[m.userId] || {}).total || 0) === best);
  }

  function overallWinners(d) {
    const ids = new Set(d.winnerUserIds || []);
    return playersForDisplay(d).filter((m) => ids.has(m.userId));
  }

  function joinNames(list, lang) {
    const names = list.map((m) => m.displayName);
    if (names.length <= 1) return names[0] || '';
    return lang === 'ar' ? names.join('، ') : names.join(' & ');
  }

  // Screen 08: the round winner, and deliberately nothing else.
  //
  // No figures and no other players appear here -- the handoff keeps every
  // number for the final screen so the room cannot start playing the
  // leaderboard between rounds. This replaced a podium plus an "also playing"
  // chip row plus a running standings table.
  function renderScoreboard(d, lang) {
    closeTvScreen();
    const winners = roundWinners(d);
    const accent = winners.length ? accentForUser(d, winners[0].userId) : 'var(--kyb-yellow)';
    const glow = winners.length ? glowForUser(d, winners[0].userId) : 'var(--kyb-glow-y)';
    const left = d.totalRounds - (d.roundIndex + 1);
    const leftLabel = left > 0
      ? (lang === 'ar' ? `${left} ${left === 1 ? 'جولة متبقية' : 'جولات متبقية'}` : `${left} ROUND${left === 1 ? '' : 'S'} LEFT`)
      : (lang === 'ar' ? 'الجولة الأخيرة' : 'FINAL ROUND');

    mount.innerHTML = `
      <div class="kyb-stage kyb-stage--center">
        ${headShell('', '', '')}
        <div class="kyb-round-head">
          <span class="kyb-status" data-tone="yellow">${lang === 'ar' ? 'فائز الجولة' : 'ROUND WINNER'}</span>
          <h2 class="kyb-round-title">${
            lang === 'ar' ? `انتهت الجولة ${d.roundIndex + 1}` : `Round ${d.roundIndex + 1} done`
          }</h2>
          <span class="kyb-round-left">${leftLabel}</span>
        </div>
        ${winners.length
          ? `<div class="kyb-winner-card" style="--win-accent:${accent}; --win-glow:${glow}">
               <span class="kyb-winner-sprite" data-sprite="star"></span>
               <span class="kyb-winner-copy">
                 <span class="kyb-winner-kicker">${lang === 'ar' ? 'فاز بهذه الجولة' : 'WON THIS ROUND'}</span>
                 <span class="kyb-winner-name">${joinNames(winners, lang)}</span>
               </span>
             </div>`
          : `<p class="kyb-scores-note">${
              lang === 'ar' ? 'لا أحد سجّل هذه الجولة.' : 'Nobody scored this round.'
            }</p>`}
        <p class="kyb-scores-note">${
          lang === 'ar'
            ? 'النقاط مخفية — المجاميع تظهر في الشاشة الأخيرة.'
            : 'Scores stay hidden \u2014 the totals land on the final screen.'
        }</p>
        <div class="kyb-tvfoot kyb-tvfoot--cta">
          <span class="kyb-tvwait">${nextGateLabel(d, lang, left)}</span>
        </div>
      </div>
    `;
    paintSprites(84);
  }

  // Screen 09: the only screen in the game that shows a score, and it shows
  // exactly one -- the overall winner's. No podium, no ranking of others.
  function renderFinished(d, lang) {
    const winners = overallWinners(d);
    const winner = winners[0] || null;
    const accent = winner ? accentForUser(d, winner.userId) : 'var(--kyb-yellow)';
    const glow = winner ? glowForUser(d, winner.userId) : 'var(--kyb-glow-y)';
    const stats = winner && d.finalStats ? d.finalStats[winner.userId] : null;
    // Every round, a player guesses everyone except themselves.
    const perRound = Math.max(0, playersForDisplay(d).length - 1);
    const outOf = perRound * (d.totalRounds || 0);

    // The handoff's crown rule: over the picture when there is one, and when
    // there is not, the frame goes entirely and the crown sits over the name.
    const hasPhoto = !!(winner && winner.avatar);
    const photo = hasPhoto && window.BahjahAvatars
      ? `<div class="kyb-final-photo" style="--win-accent:${accent}; --win-glow:${glow}">${
          window.BahjahAvatars.renderAvatarHtml(winner.avatar, winner.userId)
        }</div>`
      : '';

    const title = winner
      ? (lang === 'ar'
          ? `${joinNames(winners, lang)} ${winners.length > 1 ? 'الأعرف بكم.' : 'الأعرف بكم.'}`
          : `${joinNames(winners, lang)} know${winners.length > 1 ? '' : 's'} you best.`)
      : (lang === 'ar' ? 'لا فائز.' : 'No winner.');

    mount.innerHTML = `
      <div class="kyb-stage kyb-stage--center kyb-stage--final">
        ${headShell('', '', '')}
        <span class="kyb-status" data-tone="pink">${
          lang === 'ar' ? `انتهت اللعبة · ${d.totalRounds} جولات` : `GAME OVER \u00B7 ${d.totalRounds} ROUNDS`
        }</span>
        <div class="kyb-final-winner">
          <span class="kyb-winner-sprite" data-sprite="crown" data-size="${
            hasPhoto ? 'photo' : 'name'
          }"></span>
          ${photo}
          <h2 class="kyb-final-title">${title}</h2>
        </div>
        ${stats
          ? `<div class="kyb-final-score">
               <span class="kyb-final-tag" style="--win-accent:${accent}">
                 <span class="kyb-final-num">${stats.totalCorrect}</span>
                 <span class="kyb-final-of">${
                   lang === 'ar' ? `من ${outOf} صحيحة` : `OF ${outOf} RIGHT`
                 }</span>
               </span>
               <p class="kyb-final-sub">${
                 lang === 'ar' ? 'بدقة مريبة، بصراحة.' : 'Suspiciously well, actually.'
               }</p>
             </div>`
          : ''}
        <div class="kyb-stage-actions kyb-final-actions">
          <button type="button" id="hc-share-btn" class="bh-btn bh-btn--hot bh-btn--md">${
            lang === 'ar' ? 'شارك النتيجة' : 'Share result'
          }</button>
          <button type="button" id="hc-restart-btn" class="bh-btn bh-btn--go bh-btn--md">${
            lang === 'ar' ? 'العب مجددًا' : 'Play again'
          }</button>
          <a href="our-games.html" class="bh-btn bh-btn--ghost bh-btn--md">${
            lang === 'ar' ? 'العودة إلى الألعاب' : 'Back to games'
          }</a>
        </div>
      </div>
    `;
    paintSprites();
  }

  // "Share result" on the big screen. The TV is the one surface everybody is
  // looking at, so it shares the room's outcome rather than any one player's.
  function shareFinalResult() {
    const d = (latestState && latestState.data) || {};
    const lang = LANG_ATTR();
    const winners = overallWinners(d);
    const name = joinNames(winners, lang);
    const url = `${location.origin}/knows-you-best.html`;
    const headline = name
      ? (lang === 'ar' ? `${name} الأعرف بنا!` : `${name} knows us best!`)
      : (lang === 'ar' ? 'لعبنا عارفكم على بهجة!' : 'We played Knows You Best on Bahjah!');
    const subline = lang === 'ar' ? `عارفكم · ${d.totalRounds} جولات` : `Knows You Best · ${d.totalRounds} rounds`;
    const shareBtn = document.getElementById('hc-share-btn');
    if (window.BahjahShareCard) {
      window.BahjahShareCard.share({ gameId: 'knows-you-best', lang, headline, subline, text: headline, url, shareBtn });
      return;
    }
    if (navigator.share) {
      navigator.share({ text: headline, url }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(`${headline} ${url}`).then(() => {
      if (!shareBtn) return;
      const original = shareBtn.textContent;
      shareBtn.textContent = lang === 'ar' ? 'تم النسخ!' : 'Copied!';
      setTimeout(() => { shareBtn.textContent = original; }, 1500);
    }).catch(() => {});
  }

  // The pixel sprites are SVG built in JS, so they are injected after the
  // template rather than being stringified into it.
  function paintSprites(starSize) {
    if (!window.KybSprites) return;
    mount.querySelectorAll('[data-sprite]').forEach((slot) => {
      const kind = slot.getAttribute('data-sprite');
      if (kind === 'star') {
        slot.appendChild(window.KybSprites.star(starSize || 84));
        return;
      }
      const size = slot.getAttribute('data-size') === 'photo'
        ? window.KybSprites.CROWN_OVER_PHOTO
        : window.KybSprites.CROWN_OVER_NAME;
      slot.appendChild(window.KybSprites.crown(size));
    });
  }




})();
