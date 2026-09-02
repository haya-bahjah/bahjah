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

  // The two handoff screens the phone now runs: MATCH while placing answers,
  // TRUTH for the reveal. Each owns its whole canvas -- a fixed layer over the
  // viewport rather than a card inside the page -- so they are mounted outside
  // #kyb-play-box and closed by hand when the phase moves on.
  let phoneScreen = null;
  let phoneScreenKind = null;
  let phoneTicker = null;

  function closePhoneScreen() {
    if (phoneTicker) {
      clearInterval(phoneTicker);
      phoneTicker = null;
    }
    if (phoneScreen) {
      phoneScreen.destroy();
      phoneScreen = null;
    }
    phoneScreenKind = null;
  }

  // Reuse a mounted screen while the phase still wants it. Remounting would
  // throw away a half-built matching board, and would restart the TRUTH reveal
  // every time another player pressed Next.
  function ensurePhoneScreen(kind, factory, props) {
    if (phoneScreenKind !== kind) {
      closePhoneScreen();
      phoneScreen = factory(props);
      phoneScreenKind = kind;
      return phoneScreen;
    }
    phoneScreen.update(props);
    return phoneScreen;
  }

  // How long this phase runs, remembered per endsAt so the draining bar keeps
  // its span across re-renders.
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
  // The player's own submitted matches for the current round, retained
  // across the guessing -> reveal transition so the reveal view can mark
  // each connection correct/incorrect.
  let mySubmittedMatches = null;
  // What this player typed this round. The server never sends an answer back
  // to its own author before the reveal, so the phone keeps it locally to go
  // on showing it under "Your answer" once the round is locked in.
  let myAnswerText = '';

  let roomEnded = false;
  // Whether this browser was running the room at the last room update, so a
  // change of hands can be spotted rather than guessed at.
  let wasController = false;

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
    // The host restarted the room ("Play again") -- follow everyone back
    // to the waiting room instead of sitting on a stale finished screen.
    if (e.detail.status === 'lobby') {
      window.location.href = `knows-you-best-lobby.html?code=${encodeURIComponent(code)}`;
      return;
    }
    if (e.detail.status === 'ended' && !roomEnded) {
      roomEnded = true;
      renderEnded();
      return;
    }
    // Only the category screen is redrawn on a room update, and only when who
    // runs the room actually changed -- that is the one screen whose contents
    // depend on it. Redrawing the others would tear down a half-finished
    // matching board every time somebody's connection blinked.
    const nowController = amController();
    if (latestState && latestState.phase === 'category' && nowController !== wasController) {
      render(latestState);
    }
    wasController = nowController;
  });

  document.addEventListener('bahjah:game-state', (e) => {
    if (roomEnded) return;
    const state = e.detail;
    if (state.gameType !== 'knows-you-best') return;
    latestState = state;
    render(state);
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (roomEnded) {
      renderEnded();
      return;
    }
    if (latestState) render(latestState);
  });

  function renderEnded() {
    closePhoneScreen();
    const lang = LANG_ATTR();
    box.innerHTML = `
      <div class="q-text">${lang === 'ar' ? `أنهى المضيف هذه اللعبة (الرمز: ${code})` : `Host has ended this game (code: ${code})`}</div>
      <a href="bahjah-landing.html" class="bh-btn bh-btn--hot bh-btn--md" style="display:block; width:fit-content; margin:20px auto 0; text-decoration:none;">${lang === 'ar' ? 'العودة إلى بهجة' : 'Back to Bahjah'}</a>
    `;
  }

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

  // The answers column is already reshuffled server-side every round, but
  // the names/players column was always rendered in stable room-join order
  // -- which read as "the matching board never changes" even though the
  // answers underneath it were moving. Shuffle it here too, cached per
  // round so it doesn't jitter across re-renders within the same round.
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
  function categoryBadge(prompt) {
    if (!prompt || !prompt.category) return '';
    return `<div class="demo-meta">${categoryLabel(prompt.category)}</div>`;
  }

  // The same ladder the host console draws on its big screen, because the pick
  // itself has moved here. Whoever is running the room chooses on their own
  // phone -- on a TV room nobody can tap the television, and in a phone-only
  // room there is no console at all, so leaving the only picker over there
  // left the game with no way out of the category phase.
  const DIFFICULTIES = {
    Easy: {
      color: 'green', glyph: '●',
      name: { en: 'Easy', ar: 'سهل' },
      tag: { en: 'Warm up', ar: 'تسخين' },
      desc: { en: 'Favourites and safe preferences. Nobody gets hurt.', ar: 'مفضلات وتفضيلات آمنة. لا أحد يتأذى.' },
    },
    Moderate: {
      color: 'yellow', glyph: '▲',
      name: { en: 'Moderate', ar: 'متوسط' },
      tag: { en: 'The sweet spot', ar: 'النقطة المثالية' },
      desc: { en: 'Hypotheticals and habits. Reveals more than you think.', ar: 'افتراضات وعادات. تكشف أكثر مما تظن.' },
    },
    Hard: {
      color: 'pink', glyph: '✕',
      name: { en: 'Hard', ar: 'صعب' },
      tag: { en: 'No mercy', ar: 'بلا رحمة' },
      desc: { en: 'Confessions, fears, petty grudges. Friendships end here.', ar: 'اعترافات ومخاوف وضغائن صغيرة. الصداقات تنتهي هنا.' },
    },
  };
  const DIFFICULTY_ORDER = ['Easy', 'Moderate', 'Hard'];

  // Whoever runs the room. The server settles it and sends it on every room
  // update; on a phone room that is the person who made it, on a TV room the
  // first player to scan the code.
  function amController() {
    if (!latestRoom || !me) return false;
    if (latestRoom.controllerId === undefined) {
      return latestRoom.members.some((m) => m.userId === me.id && m.isHost);
    }
    return latestRoom.controllerId === me.id;
  }

  // The room's creator, which is who the server lets restart it -- a
  // different question from who runs the round, and only the same person in a
  // phone room.
  function amRoomHost() {
    return Boolean(latestRoom && me && latestRoom.members.some((m) => m.userId === me.id && m.isHost));
  }

  function controllerName() {
    if (!latestRoom || !latestRoom.controllerId) return '';
    const m = latestRoom.members.find((x) => x.userId === latestRoom.controllerId);
    return m ? m.displayName : '';
  }

  function difficultyCards(d, lang) {
    const choices = Array.isArray(d.categoryChoices) && d.categoryChoices.length
      ? DIFFICULTY_ORDER.filter((name) => d.categoryChoices.includes(name))
      : DIFFICULTY_ORDER;
    return choices
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
          </button>`;
      })
      .join('');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.kyb-diff[data-difficulty]');
    if (!btn) return;
    // The pick decides the whole playthrough, so the row locks the moment one
    // lands rather than letting a double tap race the server.
    document.querySelectorAll('.kyb-diff').forEach((el) => { el.disabled = true; });
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (socket) socket.emit('game:action', { action: { type: 'pickCategory', category: btn.dataset.difficulty } });
  });

  function roundLabel(d) {
    const lang = LANG_ATTR();
    return lang === 'ar' ? `السؤال ${d.roundIndex + 1} من ${d.totalRounds}` : `Question ${d.roundIndex + 1} of ${d.totalRounds}`;
  }


  // Per-player chip colour, from the handoff's eight-colour palette. Keyed on
  // the player's position in the room so a given player keeps one colour for
  // the whole game rather than changing between rounds.
  const CHIP_ACCENTS = ['--kyb-pink', '--kyb-cyan', '--kyb-green', '--kyb-purple', '--kyb-yellow'];
  function chipAccent(index) {
    return `var(${CHIP_ACCENTS[index % CHIP_ACCENTS.length]})`;
  }
  function initialOf(name) {
    return String(name || '?').trim().charAt(0) || '?';
  }
  // A player's colour by identity rather than by loop position, so the name on
  // a revealed answer matches that player's colour everywhere else.
  function accentForUser(d, userId) {
    const idx = playersForDisplay(d).findIndex((m) => m.userId === userId);
    return chipAccent(idx < 0 ? 0 : idx);
  }

  // "ROUND n OF m" badge + category meta on one side, the phase status pill on
  // the other. Matches the handoff's header row on every in-game screen.
  function stageHead(d, status, tone) {
    const lang = LANG_ATTR();
    const round = lang === 'ar'
      ? `جولة ${d.roundIndex + 1} من ${d.totalRounds}`
      : `Round ${d.roundIndex + 1} of ${d.totalRounds}`;
    const cat = d.currentPrompt && d.currentPrompt.category ? categoryLabel(d.currentPrompt.category) : '';
    return `
      <div class="kyb-shead">
        <div class="kyb-shead-l">
          <span class="kyb-round">${round}</span>
          ${cat ? `<span class="kyb-smeta">${cat}</span>` : ''}
        </div>
        ${status ? `<span class="kyb-status"${tone ? ` data-tone="${tone}"` : ''}>${status}</span>` : ''}
      </div>`;
  }

  // The prompt in its drawn card. The two doodle marks are decorative only.
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
        <div class="kyb-timer-track"><div class="kyb-timer-fill" id="kyb-timer-fill"></div></div>
        <span class="kyb-timer-count" id="kyb-countdown"></span>
      </div>`;
  }

  // The phone's own header, per the handoff: a label on the left, the seconds
  // left on the right, and a slim bar under both. No category, no room code --
  // the TV is carrying all of that, and the phone is a controller.
  function phoneHead(label, tone) {
    return `
      <div class="kyb-ph-head">
        <span class="kyb-ph-label"${tone ? ` data-tone="${tone}"` : ''}>${label}</span>
        <span class="kyb-ph-count" id="kyb-countdown"></span>
      </div>
      <div class="kyb-ph-track"><div class="kyb-ph-fill" id="kyb-timer-fill"></div></div>`;
  }

  // Every screen where the phone has nothing to do: a big dashed ring, a line
  // telling the player where to look, and their own ready badge.
  function phoneWait(title, note, badge) {
    return `
      <div class="kyb-stage kyb-ph-wait">
        <span class="kyb-ph-ring" aria-hidden="true"></span>
        <h2 class="kyb-ph-wait-title">${title}</h2>
        <p class="kyb-ph-wait-note">${note}</p>
        ${badge ? `<span class="kyb-status">${badge}</span>` : ''}
      </div>`;
  }

  // One chip per player, filled once they have answered and hollow until then,
  // so the row doubles as the "n of m answered" meter.
  function answeredRow(d, doneIds, label) {
    const players = playersForDisplay(d);
    const done = doneIds instanceof Set ? doneIds : null;
    const chips = players
      .map((m, i) => {
        const answered = done ? done.has(m.userId) : false;
        return `<span class="kyb-chip" data-answered="${answered ? 1 : 0}" style="--chip-accent:${chipAccent(i)}" title="${m.displayName}">${initialOf(m.displayName)}</span>`;
      })
      .join('');
    return `
      <div class="kyb-answered">
        <span class="kyb-timer-label">${label}</span>
        <div class="kyb-answered-list">${chips}</div>
      </div>`;
  }

  // What this player's current screen is actually drawn from. A game:state
  // arrives every time *anybody* submits, and render() rebuilds box.innerHTML
  // from scratch -- so one player sending their answer wiped the half-typed
  // answer out of everyone else's input, and one player submitting their
  // matches tore down everyone else's part-built board. Neither screen shows
  // anything about the other players, so those rebuilds changed nothing on
  // screen and cost the room its work.
  //
  // Returning null means "always rebuild": the screens with no input to lose,
  // whose contents do move as others act.
  function renderKey(state, d) {
    const lang = LANG_ATTR();
    if (state.phase === 'answering') {
      return `answering|${lang}|${d.roundIndex}|${d.myAnswered ? 1 : 0}`;
    }
    if (state.phase === 'guessing') {
      if (!d.matchingOpen) return null;
      const iHaveMatched =
        mySubmittedMatches !== null ||
        Boolean(me && Array.isArray(d.guessedUserIds) && d.guessedUserIds.includes(me.id));
      // The locked-in screen counts other players in, so it keeps rebuilding.
      if (iHaveMatched) return null;
      const answerIds = Array.isArray(d.answers) ? d.answers.map((a) => a.index).join(',') : '';
      return `guessing|${lang}|${d.roundIndex}|${d.myAnswerIndex}|${answerIds}`;
    }
    return null;
  }

  let lastRenderKey = null;

  function render(state) {
    // The splash covers the gap between Start and the first prompt; the first
    // rendered phase retires it.
    const splash = document.getElementById('kyb-splash');
    if (splash) splash.style.display = 'none';
    wrap.style.display = 'block';
    const d = state.data || {};

    const key = renderKey(state, d);
    if (key !== null && key === lastRenderKey) return;
    lastRenderKey = key;

    // Anything that is not MATCH or TRUTH takes the phone back: those screens
    // draw into #kyb-play-box as they always did.
    if (state.phase !== 'guessing' && state.phase !== 'reveal') closePhoneScreen();

    if (state.phase === 'category') {
      const lang = LANG_ATTR();
      if (amController()) {
        box.innerHTML = `
          <div class="kyb-stage kyb-stage--center">
            <span class="kyb-status" data-tone="purple">${lang === 'ar' ? 'الخطوة ١ من ٣' : 'Step 1 of 3'}</span>
            <h2 class="kyb-verdict">${lang === 'ar' ? 'اختر مستوى الصعوبة.' : 'Pick your difficulty.'}</h2>
            <p class="kyb-final-sub">${lang === 'ar' ? 'أسئلة أصعب. جروح أعمق. جدال أكثر.' : 'Harder questions. Deeper cuts. More arguing.'}</p>
            <div class="kyb-diff-row">${difficultyCards(d, lang)}</div>
          </div>`;
        return;
      }
      // Somebody else is choosing -- name them rather than saying "the host",
      // which is no longer who does this.
      const who = controllerName();
      box.innerHTML = phoneWait(
        who
          ? (lang === 'ar' ? `${who} يختار الفئة.` : `${who} is picking a category.`)
          : (lang === 'ar' ? 'يجري اختيار الفئة.' : 'A category is being picked.'),
        lang === 'ar'
          ? 'سهل، متوسط، أو الذي ينهي الصداقات.'
          : 'Easy, moderate, or the one that ends friendships.',
        ''
      );
      return;
    }

    if (state.phase === 'answering') {
      mySubmittedMatches = null;
      if (!d.myAnswered) myAnswerText = '';
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
    myAnswerText = text;
    const btn = document.getElementById('kyb-answer-submit');
    if (btn) btn.disabled = true;
    window.BahjahSoundFx.submit();
    socket.emit('game:action', { action: { type: 'answer', text } });
  }

  function renderAnswering(d) {
    const lang = LANG_ATTR();

    // Locked in, the field stays on screen holding what they wrote -- the
    // handoff keeps the answer visible and just turns the button into a
    // confirmation, rather than blanking the screen.
    const entryHtml = d.myAnswered
      ? `<div class="kyb-ph-field is-locked">
           <span class="kyb-ph-field-label">${lang === 'ar' ? 'إجابتك' : 'Your answer'}</span>
           <p class="kyb-ph-field-text">${myAnswerText || (lang === 'ar' ? 'تم الإرسال' : 'Sent')}</p>
         </div>
         <p class="kyb-ph-hint">${lang === 'ar' ? 'انظر إلى الشاشة الآن.' : 'Look up at the TV now.'}</p>
         <button type="button" class="kyb-ph-btn kyb-ph-btn--done" disabled>${
           lang === 'ar' ? 'تم الإرسال &#10003;' : 'Locked in &#10003;'
         }</button>`
      : `<div class="kyb-ph-field">
           <span class="kyb-ph-field-label">${lang === 'ar' ? 'إجابتك' : 'Your answer'}</span>
           <input type="text" id="kyb-answer-input" maxlength="280" autocomplete="off"
             placeholder="${lang === 'ar' ? 'اكتب إجابتك…' : 'Type your answer…'}">
         </div>
         <p class="kyb-ph-hint">${lang === 'ar' ? 'اجعلها قصيرة. على الجميع تخمين صاحبها.' : "Keep it short. Everyone has to guess it's yours."}</p>
         <button type="button" class="kyb-ph-btn kyb-ph-btn--send" id="kyb-answer-submit">${
           lang === 'ar' ? 'إرسال الإجابة' : 'Send answer'
         }</button>`;

    box.innerHTML = `
      <div class="kyb-stage kyb-ph">
        ${phoneHead(lang === 'ar' ? `جولة ${d.roundIndex + 1}` : `Round ${d.roundIndex + 1}`, 'cyan')}
        <h2 class="kyb-ph-prompt">${questionPrompt(d.currentPrompt)}</h2>
        ${entryHtml}
      </div>
    `;

    const input = document.getElementById('kyb-answer-input');
    const submitBtn = document.getElementById('kyb-answer-submit');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAnswer(); });
    if (submitBtn) submitBtn.addEventListener('click', submitAnswer);
    if (input) input.focus();

    window.BahjahTimerBar.start('kyb-answering', document.getElementById('kyb-timer-fill'), document.getElementById('kyb-countdown'), d.phaseEndsAt);
  }

  function renderGuessing(d) {
    const lang = LANG_ATTR();
    const answerCount = Array.isArray(d.answers) ? d.answers.length : 0;

    // While the room is still reading the answers on the TV there is nothing
    // to do here, so the phone says so rather than showing a board the host
    // has not opened yet.
    if (!d.matchingOpen) {
      closePhoneScreen();
      box.innerHTML = phoneWait(
        lang === 'ar' ? 'انظر إلى الشاشة.' : 'Look up at the TV.',
        lang === 'ar'
          ? `كل الإجابات (${answerCount}) هناك. اقرأها بسرعة — ستخمّن أصحابها بعد قليل.`
          : `All ${answerCount} answers are up there. Read fast — you're about to guess who's who.`,
        lang === 'ar' ? '· جاهز' : '&middot; Ready'
      );
      window.BahjahTimerBar.stop('kyb-guessing');
      return;
    }

    // Matching is once per round. render() runs on every game:state, and one
    // arrives each time anybody else submits -- so without this the board was
    // rebuilt empty under a player who had already matched, over and over,
    // letting them submit again and overwrite what they had sent.
    const iHaveMatched =
      mySubmittedMatches !== null ||
      Boolean(me && Array.isArray(d.guessedUserIds) && d.guessedUserIds.includes(me.id));
    if (iHaveMatched) {
      closePhoneScreen();
      const done = d.guessedCount || 0;
      const total = playersForDisplay(d).length;
      box.innerHTML = phoneWait(
        lang === 'ar' ? 'تم إرسال مطابقاتك.' : 'Matches locked in.',
        lang === 'ar'
          ? `${done} من ${total} أنهوا المطابقة. سنكشف النتائج بعد قليل.`
          : `${done} of ${total} have matched. The results are up next.`,
        lang === 'ar' ? '· تم' : '&middot; Sent'
      );
      window.BahjahTimerBar.stop('kyb-guessing');
      return;
    }

    // Phone · MATCH, from the handoff. The screen owns the whole canvas, so
    // #kyb-play-box stays empty behind it.
    box.innerHTML = '';
    window.BahjahTimerBar.stop('kyb-guessing');

    const answers = (Array.isArray(d.answers) ? d.answers : []).filter((a) => a.index !== d.myAnswerIndex);
    if (!answers.length || !me) {
      closePhoneScreen();
      return;
    }
    // The names column is already shuffled per round; the viewer is not in it,
    // since nobody guesses their own answer.
    const names = shuffledPlayersForDisplay(d).filter((m) => m.userId !== me.id);
    window.KybData.setRound({
      key: `match|${d.roundIndex}`,
      players: names.map((m) => ({
        id: m.userId,
        name: m.displayName,
        initial: initialOf(m.displayName),
        color: accentForUser(d, m.userId),
      })),
      // Matching is anonymous: the cards carry no author until the reveal.
      answers: answers.map((a) => ({ id: `a${a.index}`, owner: 0, text: a.text, matchers: [] })),
    });

    const total = phaseSpan(d.phaseEndsAt);
    const paint = () => ensurePhoneScreen('phone-match', window.KybPhoneMatchScreen.mount, {
      players: Math.max(answers.length, names.length),
      seconds: secondsLeft(d.phaseEndsAt),
      total,
      onSubmit: (assignMap) => {
        // The screen speaks in {answerId: playerId}; the server wants
        // {answerIndex: userId}.
        const matches = {};
        Object.keys(assignMap).forEach((answerId) => {
          matches[Number(answerId.slice(1))] = assignMap[answerId];
        });
        mySubmittedMatches = matches;
        const socket = window.BahjahRoom && window.BahjahRoom.socket;
        if (!socket) return;
        window.BahjahSoundFx.submit();
        // One atomic batch action, not one action per connection -- see
        // the engine's KnowsYouBestAction comment for why.
        socket.emit('game:action', { action: { type: 'guessAll', guesses: matches } });
      },
      labels: lang === 'ar' ? {
        status: 'طابقهم',
        answers: 'الإجابات',
        players: 'اللاعبون',
        hint: 'اسحب إجابة إلى لاعب، أو اضغط ثم اضغط.',
        hintArmed: 'الآن اضغط من قالها.',
        dropHere: 'أفلتها هنا',
        submit: 'أرسل المطابقات',
        submitDone: 'ثبّت مطابقاتي',
      } : {},
    });

    paint();
    if (phoneTicker) clearInterval(phoneTicker);
    phoneTicker = setInterval(paint, 200);
  }

  // Phone · TRUTH, from the handoff: every answer slides to whoever said it,
  // with a check/cross on the corner and the matcher pills opposite. PLAYERS is
  // ordered authors-first so an answer's owner is its own index, and the viewer
  // is left out of both columns -- nobody guesses their own answer, and the
  // pills are "who ELSE nailed it".
  function revealRound(d) {
    const reveal = (d.lastRoundReveal || [])
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !me || r.authorUserId !== me.id);
    const members = allMembers();
    const byId = new Map(members.map((m) => [m.userId, m]));
    const authors = [];
    const seen = new Set();
    reveal.forEach(({ r }) => {
      if (seen.has(r.authorUserId)) return;
      seen.add(r.authorUserId);
      const m = byId.get(r.authorUserId);
      authors.push({ userId: r.authorUserId, displayName: m ? m.displayName : '' });
    });
    const indexOf = new Map(authors.map((a, i) => [a.userId, i]));

    const guesses = {};
    reveal.forEach(({ i }) => {
      const guessed = mySubmittedMatches ? mySubmittedMatches[i] : undefined;
      if (guessed !== undefined) guesses[`r${i}`] = guessed;
    });

    window.KybData.setRound({
      key: `truth|${d.roundIndex}`,
      players: authors.map((a) => ({
        id: a.userId,
        name: a.displayName,
        initial: initialOf(a.displayName),
        color: accentForUser(d, a.userId),
      })),
      answers: reveal.map(({ r, i }) => ({
        id: `r${i}`,
        owner: indexOf.get(r.authorUserId),
        text: r.text,
        matchers: (r.correctGuesserIds || [])
          .map((id) => indexOf.get(id))
          .filter((j) => j !== undefined),
      })),
    });

    return { count: reveal.length, players: authors.length, guesses };
  }

  function renderReveal(d) {
    const lang = LANG_ATTR();
    box.innerHTML = '';

    const mine = me ? (d.lastRoundScores || {})[me.id] : null;
    if (mine && phoneScreenKind !== 'phone-truth') {
      window.BahjahSoundFx[mine.total > 0 ? 'correct' : 'wrong']();
    }

    const round = revealRound(d);
    if (!round.count) {
      closePhoneScreen();
      return;
    }

    const done = d.continuedCount || 0;
    const total = d.totalPlayers || playersForDisplay(d).length;
    const counter = lang === 'ar' ? `${done}/${total} جاهزون` : `${done}/${total} ready`;

    ensurePhoneScreen('phone-truth', window.KybPhoneTruthScreen.mount, {
      players: Math.max(round.count, round.players),
      guesses: round.guesses,
      // The handoff's TRUTH card ends on Replay alone, and the round has to
      // be able to move on -- so the continue gate sits under it in the same
      // footer rather than replacing it.
      continueLabel: d.iContinued
        ? `${lang === 'ar' ? 'بانتظار البقية…' : 'Waiting…'} ${counter}`
        : `${lang === 'ar' ? 'التالي' : 'Next'} · ${counter}`,
      onContinue: d.iContinued ? null : () => {
        const socket = window.BahjahRoom && window.BahjahRoom.socket;
        if (socket) socket.emit('game:action', { action: { type: 'continue' } });
      },
      labels: lang === 'ar' ? {
        status: 'الحقيقة',
        answers: 'الإجابات',
        players: 'اللاعبون',
        right: 'صحيحة',
        matchedIt: 'طابقوها',
        nobody: 'لم يعرفها أحد',
        hintIdle: 'الإجابات على وشك أن تجد أصحابها.',
        hintRevealing: 'كل إجابة تنزلق إلى من قالها.',
        hintDone: 'الشارات الخضراء = من عرفها أيضًا.',
        replay: 'إعادة الكشف',
      } : {},
    });
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

    // Podium: first centre, second and third flanking. Ordered 2-1-3 in the
    // DOM so the grid places them without needing explicit column indices.
    const podiumOrder = [rows[1], rows[0], rows[2]];
    const placeOf = (m) => rows.indexOf(m) + 1;
    const podium = podiumOrder
      .filter(Boolean)
      .map((m) => {
        const place = placeOf(m);
        return `<div class="kyb-plinth" data-place="${place}">
            <span class="kyb-plinth-place">${lang === 'ar' ? `#${place}` : `#${place}`}</span>
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
          `<span class="kyb-restchip"${me && m.userId === me.id ? ' data-me="1"' : ''}>
            <span>#${i + 4}</span><b>${m.displayName}</b><span>${scores[m.userId] || 0}</span>
          </span>`
      )
      .join('');

    box.innerHTML = `
      <div class="kyb-stage">
        <div class="kyb-shead">
          <div class="kyb-shead-l">
            <span class="kyb-round">${lang === 'ar' ? 'انتهت اللعبة' : 'Game over'}</span>
          </div>
          ${rankLabel ? `<span class="kyb-status" data-tone="yellow">${rankLabel}</span>` : ''}
        </div>
        ${winnerLine}
        <div class="kyb-podium">${podium}</div>
        ${rest ? `<div class="kyb-restrow">${rest}</div>` : ''}
        ${statsBlock}
        ${topGuesserLine}
        <button class="bh-btn bh-btn--hot bh-btn--md" id="kyb-share-btn" style="width:100%;">${lang === 'ar' ? 'شارك نتيجتك' : 'Share your result'}</button>
        ${amRoomHost()
          // A phone room's creator is a player, so this screen is the only
          // place they ever see -- without this button their room could
          // finish but never play again, since the big screen that used to
          // carry Play again does not exist in that room at all.
          ? `<button class="bh-btn bh-btn--md" id="kyb-restart-btn" style="width:100%; margin-top:10px;">${
              lang === 'ar' ? 'العبوا مرة أخرى' : 'Play again'
            }</button>`
          : `<p class="waiting-note">${lang === 'ar' ? 'بانتظار أن يبدأ المضيف لعبة جديدة…' : 'Waiting for the host to start a new game…'}</p>`}
        <p style="text-align:center;"><a class="back-link" href="knows-you-best.html">${lang === 'ar' ? 'انضم إلى لعبة أخرى' : 'Join another game'}</a></p>
      </div>
    `;
    const shareBtn = document.getElementById('kyb-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', () => shareResult(myRank));
    const restartBtn = document.getElementById('kyb-restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        restartBtn.disabled = true;
        const socket = window.BahjahRoom && window.BahjahRoom.socket;
        if (socket) socket.emit('room:restart');
      });
    }
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
