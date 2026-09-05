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
    // The tentative pick comes off the server rather than out of a local
    // variable, so the controller's own phone, the other phones and the
    // television are all reading the same one thing.
    const picked = d.pendingCategory;
    return choices
      .map((name, i) => {
        const meta = DIFFICULTIES[name];
        const state = !picked ? '' : name === picked ? ' is-picked' : ' is-dimmed';
        const pressed = picked ? ` aria-pressed="${name === picked ? 'true' : 'false'}"` : '';
        if (!meta) {
          return `<button type="button" class="kyb-diff${state}" data-difficulty="${name}"${pressed}>
              <span class="kyb-diff-name">${name}</span>
            </button>`;
        }
        const mark = name === picked
          ? `<span class="kyb-diff-mark">${lang === 'ar' ? '✓ مختار' : '✓ Picked'}</span>`
          : '';
        return `<button type="button" class="kyb-diff${state}" data-difficulty="${name}"${pressed}
            data-cat-color="${meta.color}" style="--diff-tilt:${['-1.8deg', '.9deg', '2.1deg'][i % 3]}">
            <span class="kyb-diff-tag"><i aria-hidden="true">${meta.glyph}</i>${meta.tag[lang]}${mark}</span>
            <span class="kyb-diff-name">${meta.name[lang]}</span>
            <span class="kyb-diff-desc">${meta.desc[lang]}</span>
          </button>`;
      })
      .join('');
  }

  // Tapping a card no longer starts the game. It puts that difficulty up on
  // the television and on everyone's phone and leaves it there, revisable, so
  // the room can say "not that one" before it becomes three rounds of
  // questions nobody wanted. Only Confirm commits.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.kyb-diff[data-difficulty]');
    if (!btn || btn.disabled) return;
    // Re-tapping the card already up changes nothing, so it does not need a
    // round trip -- and a controller drumming on one card while the room
    // argues should not be able to spend the socket's event budget.
    if (btn.classList.contains('is-picked')) return;
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    // Paint the tap immediately rather than waiting for the round trip -- the
    // next room update overwrites this with the server's version either way.
    const row = btn.closest('.kyb-diff-row');
    if (row) {
      row.querySelectorAll('.kyb-diff').forEach((el) => {
        const on = el === btn;
        el.classList.toggle('is-picked', on);
        el.classList.toggle('is-dimmed', !on);
      });
    }
    // The confirm button carries what it would commit, so it has to move with
    // the tap and not wait for the round trip: without this, confirming
    // between a second tap and the state coming back would start the game on
    // the card the controller had just moved off.
    const name = btn.dataset.difficulty;
    const confirm = document.getElementById('kyb-confirm-difficulty');
    if (confirm) {
      confirm.dataset.category = name;
      confirm.disabled = false;
      const meta = DIFFICULTIES[name];
      const lang = LANG_ATTR();
      const label = meta ? meta.name[lang] : name;
      confirm.textContent = lang === 'ar' ? `ابدأ بـ «${label}»` : `Start on ${label}`;
    }
    socket.emit('game:action', { action: { type: 'previewCategory', category: name } });
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#kyb-confirm-difficulty');
    if (!btn || btn.disabled) return;
    const marked = document.querySelector('.kyb-diff.is-picked[data-difficulty]');
    const picked = btn.dataset.category || (marked ? marked.dataset.difficulty : '');
    if (!picked) return;
    // The commit decides the whole playthrough, so everything locks the moment
    // it lands rather than letting a double tap race the server.
    btn.disabled = true;
    document.querySelectorAll('.kyb-diff').forEach((el) => { el.disabled = true; });
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (socket) socket.emit('game:action', { action: { type: 'pickCategory', category: picked } });
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
      const pending = d.pendingCategory;
      const pendingName = pending && DIFFICULTIES[pending] ? DIFFICULTIES[pending].name[lang] : pending;
      if (amController()) {
        // Two steps on purpose. Tapping a card only puts it up on the room's
        // screens; Confirm is what starts the game, so the table gets a window
        // to object to a difficulty before it is three rounds of questions.
        const sub = pending
          ? (lang === 'ar'
            ? `الغرفة ترى «${pendingName}». أكّد للبدء، أو اختر غيره.`
            : `The room can see ${pendingName}. Confirm to start, or pick another.`)
          : (lang === 'ar' ? 'أسئلة أصعب. جروح أعمق. جدال أكثر.' : 'Harder questions. Deeper cuts. More arguing.');
        box.innerHTML = `
          <div class="kyb-stage kyb-stage--center">
            <span class="kyb-status" data-tone="purple">${lang === 'ar' ? 'الخطوة ١ من ٣' : 'Step 1 of 3'}</span>
            <h2 class="kyb-verdict">${lang === 'ar' ? 'اختر مستوى الصعوبة.' : 'Pick your difficulty.'}</h2>
            <p class="kyb-final-sub">${sub}</p>
            <div class="kyb-diff-row">${difficultyCards(d, lang)}</div>
            <button type="button" id="kyb-confirm-difficulty"
              class="bh-btn bh-btn--primary bh-btn--md kyb-diff-confirm"
              data-category="${pending || ''}"${pending ? '' : ' disabled'}>${
              pending
                ? (lang === 'ar' ? `ابدأ بـ «${pendingName}»` : `Start on ${pendingName}`)
                : (lang === 'ar' ? 'اختر مستوى أولاً' : 'Pick a difficulty first')
            }</button>
          </div>`;
        return;
      }
      // Somebody else is choosing -- name them rather than saying "the host",
      // which is no longer who does this. Once they have put a card up, say
      // which one and that it is not final yet: that sentence is the whole
      // point of the confirm step.
      const who = controllerName();
      box.innerHTML = phoneWait(
        pending
          ? (who
            ? (lang === 'ar' ? `${who} يفكر في «${pendingName}».` : `${who} is leaning toward ${pendingName}.`)
            : (lang === 'ar' ? `«${pendingName}» مطروح الآن.` : `${pendingName} is on the table.`))
          : (who
            ? (lang === 'ar' ? `${who} يختار الفئة.` : `${who} is picking a category.`)
            : (lang === 'ar' ? 'يجري اختيار الفئة.' : 'A category is being picked.')),
        pending
          ? (lang === 'ar'
            ? 'لم يُؤكَّد بعد — تكلّم الآن إن كنت تريد غيره.'
            : "Not confirmed yet — say something now if you want a different one.")
          : (lang === 'ar'
            ? 'سهل، متوسط، أو الذي ينهي الصداقات.'
            : 'Easy, moderate, or the one that ends friendships.'),
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
        hintPick: 'اختر صاحب كل إجابة.',
        choose: 'اختر…',
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
    const players = playersForDisplay(d);
    const winners = players.filter((m) => winnerIds.has(m.userId));
    const winner = winners[0] || null;
    const myStats = me && d.finalStats ? d.finalStats[me.id] : null;

    if (me && winnerIds.has(me.id)) window.BahjahSoundFx.win();

    const winnerNames = winners.map((m) => m.displayName);
    const joined = winnerNames.length > 1
      ? (lang === 'ar' ? winnerNames.join('، ') : winnerNames.join(' & '))
      : (winnerNames[0] || '');
    const headline = joined
      ? (lang === 'ar'
          ? `${joined} الأعرف بكم.`
          : `${joined} know${winnerNames.length > 1 ? '' : 's'} you best.`)
      : (lang === 'ar' ? 'لا فائز.' : 'No winner.');

    // Every round, a player guesses everyone except themselves.
    const perRound = Math.max(0, players.length - 1);
    const outOf = perRound * (d.totalRounds || 0);
    const winnerStats = winner && d.finalStats ? d.finalStats[winner.userId] : null;

    // The handoff's crown rule, same on both surfaces: over the picture when
    // the winner has one, and when they do not the frame is dropped entirely
    // and the crown sits straight over the name.
    const hasPhoto = !!(winner && winner.avatar);
    const photo = hasPhoto && window.BahjahAvatars
      ? `<div class="kyb-final-photo" style="--win-accent:${accentForUser(d, winner.userId)}; --win-glow:${glowForUser(d, winner.userId)}">${
          window.BahjahAvatars.renderAvatarHtml(winner.avatar, winner.userId)
        }</div>`
      : '';

    // Deliberately no per-answer list and no ranking of other players: on the
    // phone the finale is the winner, then your own number, then sharing.
    box.innerHTML = `
      <div class="kyb-stage kyb-stage--final">
        <div class="kyb-shead">
          <span class="kyb-status" data-tone="pink">${
            lang === 'ar' ? `انتهت اللعبة · ${d.totalRounds} جولات` : `GAME OVER \u00B7 ${d.totalRounds} ROUNDS`
          }</span>
          ${me ? `<span class="kyb-round">${me.fullName || ''}</span>` : ''}
        </div>

        <div class="kyb-final-winner">
          <span class="kyb-winner-sprite" data-sprite="crown" data-size="${hasPhoto ? 'photo' : 'name'}"></span>
          ${photo}
          <h2 class="kyb-final-title">${headline}</h2>
          ${winnerStats
            ? `<span class="kyb-final-tag" style="--win-accent:${accentForUser(d, winner.userId)}">
                 <span class="kyb-final-num">${winnerStats.totalCorrect}</span>
                 <span class="kyb-final-of">${lang === 'ar' ? `من ${outOf}` : `OF ${outOf} RIGHT`}</span>
               </span>`
            : ''}
        </div>

        ${myStats
          ? `<div class="kyb-my-score">
               <span class="kyb-my-score-num">${myStats.totalCorrect}</span>
               <span class="kyb-my-score-of">/${outOf}</span>
               <span class="kyb-my-score-lbl">${lang === 'ar' ? 'نتيجتك' : 'Your score'}</span>
             </div>`
          : ''}

        <div class="kyb-sharerow">
          <span class="kyb-sharerow-lbl">${lang === 'ar' ? 'شارك بطاقتك' : 'SHARE YOUR CARD'}</span>
          <div class="kyb-sharetargets">
            <button type="button" class="kyb-sharetarget" data-share="instagram" aria-label="Instagram Stories">IG</button>
            <button type="button" class="kyb-sharetarget" data-share="whatsapp" aria-label="WhatsApp">WA</button>
            <button type="button" class="kyb-sharetarget" data-share="tiktok" aria-label="TikTok">TT</button>
            <button type="button" class="kyb-sharetarget" data-share="x" aria-label="X">X</button>
            <button type="button" class="kyb-sharetarget" data-share="copy" aria-label="${
              lang === 'ar' ? 'انسخ الرابط' : 'Copy link'
            }">${lang === 'ar' ? 'نسخ' : 'LINK'}</button>
          </div>
        </div>

        ${amRoomHost()
          // A phone room's creator is a player, so this screen is the only
          // place they ever see -- without this button their room could
          // finish but never play again, since the big screen that used to
          // carry Play again does not exist in that room at all.
          ? `<button class="bh-btn bh-btn--primary bh-btn--md" id="kyb-restart-btn" style="width:100%;">${
              lang === 'ar' ? 'العبوا مرة أخرى' : 'Play again'
            }</button>`
          : `<p class="waiting-note">${lang === 'ar' ? 'بانتظار أن يبدأ المضيف لعبة جديدة…' : 'Waiting for the host to start a new game…'}</p>`}
        <p style="text-align:center;"><a class="back-link" href="knows-you-best.html">${
          lang === 'ar' ? 'انضم إلى لعبة أخرى' : 'Join another game'
        }</a></p>
      </div>
    `;

    if (window.KybSprites) {
      box.querySelectorAll('[data-sprite="crown"]').forEach((slot) => {
        slot.appendChild(window.KybSprites.crown(
          slot.getAttribute('data-size') === 'photo'
            ? window.KybSprites.CROWN_OVER_PHOTO
            : window.KybSprites.CROWN_OVER_NAME
        ));
      });
    }

    box.querySelectorAll('[data-share]').forEach((btn) => {
      btn.addEventListener('click', () => shareTo(btn.getAttribute('data-share'), btn));
    });
    const restartBtn = document.getElementById('kyb-restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        restartBtn.disabled = true;
        const socket = window.BahjahRoom && window.BahjahRoom.socket;
        if (socket) socket.emit('room:restart');
      });
    }
  }

  // The handoff's five share targets. Instagram Stories and TikTok have no web
  // share URL that can carry an image, so they go through the platform sheet
  // (which is where a phone user picks them anyway); WhatsApp and X have real
  // intent URLs; Copy link is a clipboard write.
  function shareTo(target, btn) {
    const lang = LANG_ATTR();
    const d = (latestState && latestState.data) || {};
    const scores = d.scores || {};
    const myStats = me && d.finalStats ? d.finalStats[me.id] : null;
    const url = `${location.origin}/knows-you-best.html`;
    const score = myStats ? myStats.totalCorrect : (me ? scores[me.id] || 0 : 0);
    const text = lang === 'ar'
      ? `عرفت ${score} إجابة في عارفكم على بهجة. 🏆`
      : `I got ${score} right in Knows You Best on Bahjah. 🏆`;

    if (target === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
      return;
    }
    if (target === 'x') {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        '_blank', 'noopener'
      );
      return;
    }
    if (target === 'copy') {
      navigator.clipboard.writeText(`${text} ${url}`).then(() => {
        const original = btn.textContent;
        btn.textContent = lang === 'ar' ? 'تم' : 'OK';
        setTimeout(() => { btn.textContent = original; }, 1500);
      }).catch(() => {});
      return;
    }
    // instagram / tiktok
    if (window.BahjahShareCard) {
      window.BahjahShareCard.share({
        gameId: 'knows-you-best', lang,
        headline: text, subline: lang === 'ar' ? 'عارفكم' : 'Knows You Best',
        text, url, shareBtn: btn,
      });
      return;
    }
    if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
    }
  }

})();
