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

  // No phase in this game is timed: a round moves on when the room has
  // finished with it, not when a clock does. Everything that used to draw a
  // countdown now draws the room's progress instead -- how many people are
  // still to go -- so a screen that is waiting can say what it is waiting
  // for. See the engine's header comment for the whole rule.

  // How many players are still to act, as the server counts it: it has
  // already dropped anyone who left the room, so this never counts a phone
  // that is gone.
  function waitingCount(d) {
    return Array.isArray(d.waitingOnUserIds) ? d.waitingOnUserIds.length : 0;
  }

  // "Waiting for Omar" / "Waiting for 3 players" -- a name while it is one
  // person, a count once it is a crowd, because a list of five names is not
  // something anybody reads off a phone.
  function waitingLabel(d, lang) {
    const ids = Array.isArray(d.waitingOnUserIds) ? d.waitingOnUserIds : [];
    if (!ids.length) return '';
    if (ids.length === 1) {
      const who = playersForDisplay(d).find((m) => m.userId === ids[0]);
      const name = who ? who.displayName : (lang === 'ar' ? 'لاعب' : 'a player');
      return lang === 'ar' ? `في انتظار ${name}` : `Waiting for ${name}`;
    }
    return lang === 'ar' ? `في انتظار ${ids.length} لاعبين` : `Waiting for ${ids.length} players`;
  }

  // The room's way out when somebody is present but has walked away from
  // their phone. Only the player running the room sees it, and only while
  // the room is genuinely waiting on someone -- there is nothing to skip
  // when everyone has acted.
  function moveOnButton(d, lang) {
    const iRun = d.iControlRoom === undefined ? amController() : d.iControlRoom;
    if (!iRun || waitingCount(d) === 0) return '';
    return `<button type="button" class="kyb-moveon" id="kyb-move-on">${
      lang === 'ar' ? 'تخطَّ المنتظرين' : 'Move on without them'
    }</button>`;
  }

  // Updates the header's progress in place, for a screen that is deliberately
  // not being rebuilt.
  function paintWaitingHead(d) {
    const countEl = document.querySelector('.kyb-ph-count');
    const fillEl = document.querySelector('.kyb-ph-fill');
    if (!countEl && !fillEl) return;
    const total = d.totalPlayers || playersForDisplay(d).length || 0;
    const done = Math.max(0, total - waitingCount(d));
    if (countEl) countEl.textContent = total > 0 ? `${done}/${total}` : '';
    if (fillEl) fillEl.style.width = `${total > 0 ? Math.round((done / total) * 100) : 0}%`;
  }

  function wireMoveOn() {
    const btn = document.getElementById('kyb-move-on');
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.disabled = true;
      const socket = window.BahjahRoom && window.BahjahRoom.socket;
      if (socket) socket.emit('game:action', { action: { type: 'advance' } });
    });
  }
  // The player's own submitted matches for the current round, retained
  // across the guessing -> reveal transition so the reveal view can mark
  // each connection correct/incorrect.
  let mySubmittedMatches = null;
  // True while a player who has already sent their matches has reopened the
  // board to change them. Matching stays open until the last player's board
  // is in, and until then a change of mind is allowed.
  let editingMatches = false;
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

  // This phone's own order for the round's answers -- see renderGuessing.
  // Cached per round like the names column above, so the board does not
  // reorder itself under the player as other people's matches come in.
  let shuffledAnswersRound = -1;
  let shuffledAnswerOrder = [];

  function shuffledAnswersForRound(d, answers) {
    const known = new Set(shuffledAnswerOrder);
    if (shuffledAnswersRound !== d.roundIndex || answers.some((a) => !known.has(a.index))) {
      shuffledAnswersRound = d.roundIndex;
      shuffledAnswerOrder = shuffle(answers.map((a) => a.index));
    }
    const byIndex = new Map(answers.map((a) => [a.index, a]));
    return shuffledAnswerOrder.map((i) => byIndex.get(i)).filter(Boolean);
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

  // The three banks, Arabic side. Anything not one of them still falls through
  // to its own name -- the legacy placeholder categories among them.
  const CATEGORY_LABELS_AR = {
    'Break the Ice': 'اكسروا الجليد',
    'Imagine If': 'تخيل لو …',
    'For Close Ones Only': 'للمقربين فقط',
    // A room configured before the rename still names them the old way.
    Easy: 'اكسروا الجليد',
    Moderate: 'تخيل لو …',
    Hard: 'للمقربين فقط',
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
  // phone: nobody can tap the television. (Rooms made phone-only, before that
  // option was removed, have no console at all -- there the picker being here
  // is the only thing that gets them out of the category phase.)
  const DIFFICULTIES = {
    'Break the Ice': {
      color: 'green', glyph: '\u25CF',
      name: { en: 'Break the ice', ar: 'اكسروا الجليد' },
      desc: { en: 'Favourites and safe preferences. Nobody gets hurt.', ar: 'مفضلات وتفضيلات آمنة. لا أحد يتأذى.' },
    },
    'Imagine If': {
      color: 'yellow', glyph: '\u25B2',
      name: { en: 'Imagine if', ar: 'تخيل لو …' },
      desc: { en: 'Hypotheticals and what-ifs. Reveals more than you think.', ar: 'افتراضات و«ماذا لو». تكشف أكثر مما تظن.' },
    },
    'For Close Ones Only': {
      color: 'pink', glyph: '\u2715',
      name: { en: 'For close ones only', ar: 'للمقربين فقط' },
      desc: { en: 'Confessions, fears, petty grudges. Friendships end here.', ar: 'اعترافات ومخاوف وضغائن صغيرة. الصداقات تنتهي هنا.' },
    },
  };
  const DIFFICULTY_ORDER = ['Break the Ice', 'Imagine If', 'For Close Ones Only'];

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
            <span class="kyb-diff-tag"><i aria-hidden="true">${meta.glyph}</i>${mark}</span>
            <span class="kyb-diff-name">${meta.name[lang]}</span>
            <span class="kyb-diff-desc">${meta.desc[lang]}</span>
          </button>`;
      })
      .join('');
  }

  // Tapping a card no longer starts the game. It puts that category up on
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

  // The phone's own header: a label on the left and, where the seconds left
  // used to be, how much of the room is still to act. The slim bar under
  // both fills as people finish instead of draining as time runs out. No
  // category, no room code -- the TV is carrying all of that, and the phone
  // is a controller.
  function phoneHead(label, tone, d) {
    const total = (d && d.totalPlayers) || playersForDisplay(d || {}).length || 0;
    const left = d ? waitingCount(d) : 0;
    const done = Math.max(0, total - left);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return `
      <div class="kyb-ph-head">
        <span class="kyb-ph-label"${tone ? ` data-tone="${tone}"` : ''}>${label}</span>
        <span class="kyb-ph-count">${total > 0 ? `${done}/${total}` : ''}</span>
      </div>
      <div class="kyb-ph-track"><div class="kyb-ph-fill" style="width:${pct}%"></div></div>`;
  }

  // Every screen where the phone has nothing to do: a big dashed ring, a line
  // telling the player where to look, and their own ready badge.
  function phoneWait(title, note, badge, footer) {
    return `
      <div class="kyb-stage kyb-ph-wait">
        <span class="kyb-ph-ring" aria-hidden="true"></span>
        <h2 class="kyb-ph-wait-title">${title}</h2>
        ${note ? `<p class="kyb-ph-wait-note">${note}</p>` : ''}
        ${badge ? `<span class="kyb-status">${badge}</span>` : ''}
        ${footer || ''}
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
      // Only while there is still a half-typed answer to protect. Once it is
      // sent there is no input to lose, and the screen has to keep rebuilding
      // to follow the room -- who is still to answer, and whether the
      // controller now has somebody to skip. The same rule the locked-in
      // matching screen below already follows.
      if (d.myAnswered) return null;
      return `answering|${lang}|${d.roundIndex}|${d.myAnswered ? 1 : 0}`;
    }
    if (state.phase === 'guessing') {
      if (!d.matchingOpen) return null;
      const iHaveMatched =
        mySubmittedMatches !== null ||
        Boolean(me && Array.isArray(d.guessedUserIds) && d.guessedUserIds.includes(me.id));
      // The locked-in screen counts other players in, so it keeps rebuilding.
      if (iHaveMatched && !editingMatches) return null;
      const answerIds = Array.isArray(d.answers) ? d.answers.map((a) => a.index).join(',') : '';
      return `guessing|${lang}|${d.roundIndex}|${d.myAnswerIndex}|${answerIds}|${editingMatches ? 'edit' : ''}`;
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
    if (key !== null && key === lastRenderKey) {
      // The screen is being held still to protect what is being typed into
      // it, but the room behind it is still moving. Patch the parts that
      // report the room -- the progress head and the bar -- without touching
      // the field the player has their thumbs in.
      paintWaitingHead(d);
      return;
    }
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
        // to object to a category before it is three rounds of questions.
        const sub = pending
          ? (lang === 'ar'
            ? `الغرفة ترى «${pendingName}». أكّد للبدء، أو اختر غيره.`
            : `The room can see ${pendingName}. Confirm to start, or pick another.`)
          : (lang === 'ar' ? 'ثلاثة أنواع مختلفة من الأسئلة.' : 'Three different kinds of question.');
        box.innerHTML = `
          <div class="kyb-stage kyb-stage--center">
            <span class="kyb-status" data-tone="purple">${lang === 'ar' ? 'الخطوة ١ من ٣' : 'Step 1 of 3'}</span>
            <h2 class="kyb-verdict">${lang === 'ar' ? 'اختر فئة.' : 'Pick a category.'}</h2>
            <p class="kyb-final-sub">${sub}</p>
            <div class="kyb-diff-row">${difficultyCards(d, lang)}</div>
            <button type="button" id="kyb-confirm-difficulty"
              class="bh-btn bh-btn--primary bh-btn--md kyb-diff-confirm"
              data-category="${pending || ''}"${pending ? '' : ' disabled'}>${
              pending
                ? (lang === 'ar' ? `ابدأ بـ «${pendingName}»` : `Start on ${pendingName}`)
                : (lang === 'ar' ? 'اختر فئة أولاً' : 'Pick a category first')
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
      editingMatches = false;
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
         <p class="kyb-ph-hint">${
           waitingCount(d) > 0
             ? waitingLabel(d, lang)
             : (lang === 'ar' ? 'انظر إلى الشاشة الآن.' : 'Look up at the TV now.')
         }</p>
         <button type="button" class="kyb-ph-btn kyb-ph-btn--done" disabled>${
           lang === 'ar' ? 'تم الإرسال &#10003;' : 'Locked in &#10003;'
         }</button>
         ${moveOnButton(d, lang)}`
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
        ${phoneHead(lang === 'ar' ? `جولة ${d.roundIndex + 1}` : `Round ${d.roundIndex + 1}`, 'cyan', d)}
        <h2 class="kyb-ph-prompt">${questionPrompt(d.currentPrompt)}</h2>
        ${entryHtml}
      </div>
    `;

    const input = document.getElementById('kyb-answer-input');
    const submitBtn = document.getElementById('kyb-answer-submit');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAnswer(); });
    if (submitBtn) submitBtn.addEventListener('click', submitAnswer);
    if (input) input.focus();
    wireMoveOn();
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
      return;
    }

    // Matching is once per round. render() runs on every game:state, and one
    // arrives each time anybody else submits -- so without this the board was
    // rebuilt empty under a player who had already matched, over and over,
    // letting them submit again and overwrite what they had sent.
    const iHaveMatched =
      mySubmittedMatches !== null ||
      Boolean(me && Array.isArray(d.guessedUserIds) && d.guessedUserIds.includes(me.id));
    if (iHaveMatched && !editingMatches) {
      closePhoneScreen();
      const total = d.totalPlayers || playersForDisplay(d).length;
      const done = Math.max(0, total - waitingCount(d));
      // Until the last board is in, the player can still change their mind.
      const editBtn = waitingCount(d) > 0
        ? `<button type="button" class="bh-btn bh-btn--ghost bh-btn--md" id="kyb-edit-matches">${
            lang === 'ar' ? 'غيّر مطابقاتي' : 'Change my matches'
          }</button>`
        : '';
      box.innerHTML = phoneWait(
        lang === 'ar' ? 'تم إرسال مطابقاتك.' : 'Matches locked in.',
        waitingCount(d) > 0
          ? (lang === 'ar'
              ? `${done} من ${total} أنهوا المطابقة. ${waitingLabel(d, lang)}.`
              : `${done} of ${total} have matched. ${waitingLabel(d, lang)}.`)
          : (lang === 'ar' ? 'الجميع أنهوا. سنكشف النتائج الآن.' : 'Everyone is done. The results are up next.'),
        lang === 'ar' ? '· تم' : '&middot; Sent',
        editBtn + moveOnButton(d, lang)
      );
      const edit = document.getElementById('kyb-edit-matches');
      if (edit) {
        edit.addEventListener('click', () => {
          editingMatches = true;
          renderGuessing(d);
        });
      }
      wireMoveOn();
      return;
    }

    // Phone · MATCH, from the handoff. The screen owns the whole canvas, so
    // #kyb-play-box stays empty behind it.
    box.innerHTML = '';

    // Each phone gets the answers in its own random order, drawn once per
    // round, so no two players -- and not the TV -- read them in the same
    // order, and the order says nothing about who sits where in the names
    // column. The ids still carry the server's index, so the match a player
    // sends is unaffected.
    const answers = shuffledAnswersForRound(
      d,
      (Array.isArray(d.answers) ? d.answers : []).filter((a) => a.index !== d.myAnswerIndex)
    );
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

    const roomSize = d.totalPlayers || playersForDisplay(d).length;
    const paint = () => ensurePhoneScreen('phone-match', window.KybPhoneMatchScreen.mount, {
      players: Math.max(answers.length, names.length),
      doneCount: Math.max(0, roomSize - waitingCount(d)),
      roomSize,
      // Reopened to change matches: start from what was sent ({answerIndex:
      // userId} from this phone, or the server's copy after a refresh).
      initial: (() => {
        const sent = mySubmittedMatches || d.myGuesses || null;
        if (!sent) return null;
        const init = {};
        Object.keys(sent).forEach((idx) => { init[`a${idx}`] = sent[idx]; });
        return init;
      })(),
      onSubmit: (assignMap) => {
        // The screen speaks in {answerId: playerId}; the server wants
        // {answerIndex: userId}.
        const matches = {};
        Object.keys(assignMap).forEach((answerId) => {
          matches[Number(answerId.slice(1))] = assignMap[answerId];
        });
        mySubmittedMatches = matches;
        editingMatches = false;
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
        hint: 'اسحب الإجابة إلى من قالها — أو اسحب اللاعب إلى إجابته.',
        dropHere: 'أفلتها هنا',
        submit: 'أرسل المطابقات',
        submitDone: 'ثبّت مطابقاتي',
        hintPick: 'اختر صاحب كل إجابة.',
        choose: 'اختر…',
      } : {},
    });

    // Painted once here and again on every game:state. The five-times-a-second
    // interval that used to live here existed only to move a countdown; with
    // the clock gone it was redrawing an unchanged board under the player's
    // finger for no reason.
    paint();
  }

  // The reveal belongs to the big screen. The phone does not repeat it -- it
  // just points the player up at the TV, where the host moves the room on.
  let revealSoundRound = -1;
  function renderReveal(d) {
    const lang = LANG_ATTR();
    const mine = me ? (d.lastRoundScores || {})[me.id] : null;
    if (mine && revealSoundRound !== d.roundIndex) {
      revealSoundRound = d.roundIndex;
      window.BahjahSoundFx[mine.total > 0 ? 'correct' : 'wrong']();
    }
    closePhoneScreen();
    box.innerHTML = phoneWait(lang === 'ar' ? 'انظر إلى الشاشة' : 'Look at the screen', '', '');
  }

  function renderFinished(d) {
    const lang = LANG_ATTR();
    const winnerIds = new Set(d.winnerUserIds || []);
    const players = playersForDisplay(d);
    const winners = players.filter((m) => winnerIds.has(m.userId));
    const winner = winners[0] || null;

    if (me && winnerIds.has(me.id)) window.BahjahSoundFx.win();

    // Direction-isolated, so mixed Arabic and English names stay in order.
    const winnerNames = winners.map((m) => `\u2068${m.displayName}\u2069`);
    const joined = winnerNames.length > 1
      ? (lang === 'ar' ? winnerNames.join('، ') : winnerNames.join(' & '))
      : (winnerNames[0] || '');
    // The question, then who answers it. No scores anywhere on this screen --
    // the finale is the winner, not a count of who got how many right.
    const question = lang === 'ar' ? 'مين عارفكم؟' : 'Who knows you best?';
    const winnerLine = joined || (lang === 'ar' ? 'لا فائز هذه المرة' : 'No winner this time');

    // The handoff's crown rule, same on both surfaces: over the picture when
    // the winner has one, and when they do not the frame is dropped entirely
    // and the crown sits straight over the name.
    const hasPhoto = !!(winner && winner.avatar);
    const photo = hasPhoto && window.BahjahAvatars
      ? `<div class="kyb-final-photo" style="--win-accent:${accentForUser(d, winner.userId)}; --win-glow:${glowForUser(d, winner.userId)}">${
          window.BahjahAvatars.renderAvatarHtml(winner.avatar, winner.userId)
        }</div>`
      : '';

    // Deliberately no per-answer list, no scores and no ranking of other
    // players: the finale is the winner, then one button to share it.
    box.innerHTML = `
      <div class="kyb-stage kyb-stage--final">
        <div class="kyb-shead">
          <span class="kyb-status" data-tone="pink">${
            lang === 'ar' ? `انتهت اللعبة · ${d.totalRounds} جولات` : `GAME OVER \u00B7 ${d.totalRounds} ROUNDS`
          }</span>
          ${me ? `<span class="kyb-round">${me.fullName || ''}</span>` : ''}
        </div>

        <h2 class="kyb-final-title">${question}</h2>
        <div class="kyb-final-winner">
          <span class="kyb-winner-sprite" data-sprite="crown" data-size="${hasPhoto ? 'photo' : 'name'}"></span>
          ${photo}
          <p class="kyb-final-name"${winner ? ` style="--win-accent:${accentForUser(d, winner.userId)}"` : ''}>${winnerLine}</p>
        </div>

        <button type="button" class="bh-btn bh-btn--hot bh-btn--md" id="kyb-share-btn" style="width:100%;">${
          lang === 'ar' ? 'شارك النتيجة' : 'Share the result'
        }</button>

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

    const shareBtn = document.getElementById('kyb-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', () => shareResult(shareBtn, question, joined));
    const restartBtn = document.getElementById('kyb-restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        restartBtn.disabled = true;
        const socket = window.BahjahRoom && window.BahjahRoom.socket;
        if (socket) socket.emit('room:restart');
      });
    }
  }

  // One button, one share: the phone's own share sheet gets a picture of the
  // result (the winner card), a sentence saying who won, and a link to
  // bahjah.com -- the player picks WhatsApp, Instagram or anything else there,
  // rather than from a row of separate buttons. Where a phone cannot share a
  // picture, BahjahShareCard saves it and copies the sentence and link.
  function shareResult(btn, question, winnerNames) {
    const lang = LANG_ATTR();
    const url = `${location.origin}/`;
    const text = winnerNames
      ? (lang === 'ar'
          ? `${question} ${winnerNames} 🏆 العبوا عارفكم على بهجة:`
          : `${question} ${winnerNames} 🏆 Play Knows You Best on Bahjah:`)
      : (lang === 'ar' ? 'لعبنا عارفكم على بهجة 🎉' : 'We played Knows You Best on Bahjah 🎉');
    if (window.BahjahShareCard) {
      Promise.resolve(window.BahjahShareCard.share({
        gameId: 'knows-you-best', lang,
        headline: question,
        subline: winnerNames || (lang === 'ar' ? 'عارفكم' : 'Knows You Best'),
        text, url, shareBtn: btn,
      })).catch(() => {});
      return;
    }
    if (navigator.share) navigator.share({ text, url }).catch(() => {});
  }

})();
