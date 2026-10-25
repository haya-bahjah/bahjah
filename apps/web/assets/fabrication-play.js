// فبركة | Fabrication -- the player's phone. Driven entirely by the
// 'bahjah:game-state' events assets/lobby.js dispatches, exactly like
// assets/trivia-play.js and assets/knows-you-best-play.js. The host never
// lands here: lobby-room.js keeps them on fabrication-lobby.html's console.
//
// A round on the phone, per the design: write a lie -> vote -> your own
// verdict -> the standings. Every screen is one thumb-high column with its
// action pinned to the bottom.
(function () {
  const U = window.FabUI;
  const t = U.t;
  const esc = U.esc;
  const num = U.num;
  const splash = document.getElementById('fab-splash');
  const wrap = document.getElementById('fab-live');
  const box = document.getElementById('fab-play-box');
  if (!wrap || !box) return;

  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();

  let latestRoom = null;
  let latestState = null;
  let roomEnded = false;
  // What this player has committed this round. Kept locally as well as read
  // back from the server view so the screen can be rebuilt (a language switch,
  // a reconnect) without losing what they have already done.
  let myFabrication = null;
  let myVote = null;
  // A vote is picked first and then locked with its own button.
  let myPick = null;
  let currentRoundKey = null;
  // The writing screen is the one phase with a text box in it. Rebuilding it
  // on every state tick would wipe what the player is halfway through typing,
  // so once it is drawn for a round it is patched, never redrawn -- the same
  // rule trivia's question screen follows for its answer tiles.
  let writeRenderKey = null;
  let errorListenerAttached = false;
  // The reveal is paced with the television: eyes on the screen while the
  // lies go up, then your verdict, then the standings.
  let revealRound = null;
  let revealStartedAt = 0;
  let revealTimer = null;
  let showStandingsNow = false;

  function nonHostMembers() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }

  function nameOf(userId) {
    if (me && userId === me.id) return t('You', 'أنت');
    const member = nonHostMembers().find((m) => m.userId === userId);
    return member ? member.displayName : t('Player', 'لاعب');
  }

  const list = (names) => names.join(t(', ', '، '));

  // The question, in the game's language.
  function questionText() {
    return U.question(latestState && latestState.data);
  }

  function myScore(d) {
    if (!d || !d.scores || !me) return 0;
    return d.scores[me.id] || 0;
  }

  function meChip() {
    if (!me) return '';
    const member = latestRoom ? latestRoom.members.find((m) => m.userId === me.id) : null;
    const name = (member && member.displayName) || me.fullName || '';
    if (!name) return '';
    const av = window.BahjahAvatars ? window.BahjahAvatars.renderAvatarHtml(member ? member.avatar : null, me.id) : '';
    return `<div class="fab-me"><span class="fab-me-av">${av}</span><span>${esc(name)}</span></div>`;
  }

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
    if (e.detail.status === 'lobby') {
      window.location.href = `fabrication-lobby.html?code=${encodeURIComponent(code)}`;
      return;
    }
    if (e.detail.status === 'ended' && !roomEnded) {
      roomEnded = true;
      renderEnded();
    }
  });

  document.addEventListener('bahjah:game-state', (e) => {
    if (roomEnded) return;
    const state = e.detail;
    if (state.gameType !== 'fabrication') return;
    latestState = state;
    attachErrorListenerOnce();
    render(state);
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (roomEnded) {
      renderEnded();
      return;
    }
    // A language switch has to redraw the writing screen in the new
    // language, which means its "already drawn" key must stop matching.
    writeRenderKey = null;
    if (latestState) render(latestState);
  });

  function attachErrorListenerOnce() {
    if (errorListenerAttached) return;
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    errorListenerAttached = true;
    socket.on('room:error', (err) => {
      const hint = document.getElementById('fab-hint');
      if (!hint) return;
      // The server's own copy is English; the ones a player can actually hit
      // are said in their language and in the game's voice.
      const inVoice = {
        TOO_TRUE: t('That is the real answer -- write something believable instead.', 'هذه هي الإجابة الحقيقية — اكتب شيئًا مقنعًا بدلًا منها.'),
        OWN_FABRICATION: t('You cannot vote for your own fabrication.', 'لا يمكنك التصويت لفبركتك.'),
        INVALID_ACTION: t('Write something first.', 'اكتب شيئًا أولًا.'),
      };
      hint.textContent = inVoice[err.code] || err.message;
      hint.setAttribute('data-tone', 'error');
      // TOO_TRUE is the interesting one: the player has accidentally written
      // the real answer, and the server refuses it rather than putting two
      // right answers on the board.
      if (err.code === 'TOO_TRUE') {
        const input = document.getElementById('fab-input');
        const submit = document.getElementById('fab-submit');
        if (input) input.disabled = false;
        if (submit) {
          submit.disabled = false;
          submit.className = 'fab-btn fab-btn--lg fab-btn--block';
          submit.textContent = t('Submit fabrication', 'أرسل فبركتك');
        }
        myFabrication = null;
      }
    });
  }

  function send(action) {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    socket.emit('game:action', { action });
  }

  function show(html) {
    if (splash) splash.style.display = 'none';
    wrap.style.display = 'block';
    document.body.classList.add('is-live');
    box.innerHTML = html;
  }

  function stopClocks() {
    window.BahjahTimerBar.stop('fabrication');
    clearInterval(window.__fabCountdown);
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
  }

  function render(state) {
    const d = state.data || {};
    if (U.adoptGameLang(d)) return;

    const roundKey = `${d.roundIndex}`;
    if (roundKey !== currentRoundKey) {
      currentRoundKey = roundKey;
      myFabrication = null;
      myVote = null;
      myPick = null;
      writeRenderKey = null;
      showStandingsNow = false;
    }
    // The server is the authority on what this player has already done -- a
    // reconnect mid-round gets its answers back from here, not from memory.
    if (d.myFabrication) myFabrication = d.myFabrication;
    if (d.myVote) myVote = d.myVote;

    if (state.phase !== 'fabrication') writeRenderKey = null;
    if (state.phase !== 'fabrication' || writeRenderKey === null) stopClocks();

    if (state.phase === 'countdown') return renderCountdown(d);
    if (state.phase === 'question') return renderQuestion(d);
    if (state.phase === 'fabrication') return renderWrite(d);
    if (state.phase === 'voting') return renderVote(d);
    if (state.phase === 'reveal') return renderReveal(d);
    if (state.phase === 'finished') return renderFinished(d);
  }

  function head(d) {
    const round = d.totalRounds
      ? t(`Round ${d.roundIndex + 1} of ${d.totalRounds}`, `الجولة ${num(d.roundIndex + 1)} من ${num(d.totalRounds)}`)
      : '';
    const category = d.currentQuestion ? U.category(d.currentQuestion.category, U.gameLang(d)) : '';
    return `
      <div class="fab-head">
        <div class="fab-head-l">
          <span class="fab-round">${esc(round)}</span>
          ${category ? `<span class="fab-chip fab-chip--cat">${esc(category)}</span>` : ''}
        </div>
        <span class="fab-score" aria-label="${t('Your score', 'نقاطك')}">${num(myScore(d))}</span>
      </div>`;
  }

  function timerRow() {
    return `
      <div class="fab-timer">
        <div class="fab-timer-track"><div class="fab-timer-fill" id="fab-timer-fill"></div></div>
        <div class="fab-ring" id="fab-ring"><span id="fab-countdown"></span></div>
      </div>`;
  }

  function startTimer(endsAt) {
    const ring = document.getElementById('fab-ring');
    const label = document.getElementById('fab-countdown');
    window.BahjahTimerBar.start('fabrication', document.getElementById('fab-timer-fill'), null, endsAt, {
      onTick: (secs) => {
        if (secs > 0 && secs <= 3) window.BahjahSoundFx.tick();
        if (label) label.textContent = num(Math.max(0, secs));
        if (ring) ring.classList.toggle('is-danger', secs > 0 && secs <= 5);
      },
    });
  }

  function renderCountdown(d) {
    show(`
      <div class="fab-screen" style="justify-content:center;">
        <div class="fab-countdown">
          <div class="fab-countdown-num" id="fab-count">${num(3)}</div>
          <span class="fab-kicker">${t('Get ready to lie', 'استعدّ للكذب')}</span>
        </div>
      </div>`);
    const el = document.getElementById('fab-count');
    const tick = () => {
      const secs = Math.max(0, Math.ceil(((d.phaseEndsAt || Date.now()) - Date.now()) / 1000));
      if (el) el.textContent = secs > 0 ? num(secs) : t('Go', 'هيا');
    };
    tick();
    window.__fabCountdown = setInterval(tick, 250);
  }

  // The reading phase. Deliberately has no input on it: everybody meets the
  // fact at the same moment, and nobody gets a head start on inventing an
  // answer for it.
  function renderQuestion(d) {
    show(`
      <div class="fab-screen">
        ${meChip()}
        ${head(d)}
        ${timerRow()}
        <div class="fab-question">
          <span class="fab-kicker">${t('Read it', 'اقرأ السؤال')}</span>
          <h2>${esc(questionText())}</h2>
        </div>
        <div class="fab-push">
          <p class="fab-foot">${t('In a moment you will invent an answer that sounds true.', 'بعد لحظات ستخترع إجابة تبدو صحيحة.')}</p>
        </div>
      </div>`);
    startTimer(d.phaseEndsAt);
  }

  function submittedLine(d) {
    const done = d.submittedCount || 0;
    const total = d.playerCount || nonHostMembers().length || done;
    return t(`${done} of ${total} have written theirs`, `${num(done)} من ${num(total)} كتبوا كذبتهم`);
  }

  function renderWrite(d) {
    const key = `${d.roundIndex}|${U.lang()}`;
    if (key === writeRenderKey) {
      // Same round, already on screen: only the counter moves, so patch it
      // rather than rebuild the box under whatever is being typed.
      const foot = document.getElementById('fab-write-foot');
      if (foot) foot.textContent = submittedLine(d);
      return;
    }
    writeRenderKey = key;

    const locked = Boolean(myFabrication);
    show(`
      <div class="fab-screen">
        ${meChip()}
        ${head(d)}
        ${timerRow()}
        <div class="fab-question">
          <span class="fab-kicker">${t('Write a believable lie', 'اكتب كذبة مقنعة')}</span>
          <h2>${esc(questionText())}</h2>
        </div>
        <input class="fab-input" id="fab-input" type="text" maxlength="80" autocomplete="off" enterkeyhint="send"
               aria-label="${t('Your fabrication', 'فبركتك')}"
               placeholder="${t('Write a believable answer…', 'اكتب إجابة مقنعة…')}"
               value="${esc(myFabrication || '')}" ${locked ? 'disabled' : ''}>
        <span class="fab-hint" id="fab-hint">${
          locked ? t('Waiting for the others…', 'بانتظار البقية…') : t("Don't write the real answer. We'll know.", 'لا تكتب الإجابة الحقيقية. سنعرف.')
        }</span>
        <div class="fab-push">
          <button type="button" class="fab-btn fab-btn--lg fab-btn--block ${locked ? 'fab-btn--locked' : ''}" id="fab-submit" ${locked ? 'disabled' : ''}>
            ${locked ? t('Sent ✓', 'تم الإرسال ✓') : t('Submit fabrication', 'أرسل فبركتك')}
          </button>
          <p class="fab-foot" id="fab-write-foot">${esc(submittedLine(d))}</p>
        </div>
      </div>`);

    const input = document.getElementById('fab-input');
    const submit = document.getElementById('fab-submit');
    const commit = () => {
      if (myFabrication) return;
      const text = (input.value || '').trim();
      const hint = document.getElementById('fab-hint');
      if (!text) {
        if (hint) {
          hint.textContent = t('Write something first.', 'اكتب شيئًا أولًا.');
          hint.setAttribute('data-tone', 'error');
        }
        return;
      }
      myFabrication = text;
      input.disabled = true;
      submit.disabled = true;
      submit.classList.add('fab-btn--locked');
      submit.textContent = t('Sent ✓', 'تم الإرسال ✓');
      if (hint) {
        hint.textContent = t('Waiting for the others…', 'بانتظار البقية…');
        hint.removeAttribute('data-tone');
      }
      window.BahjahSoundFx.submit();
      send({ type: 'fabricate', text });
    };
    if (submit) submit.addEventListener('click', commit);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
      });
      if (!locked) input.focus();
    }
    startTimer(d.phaseEndsAt);
  }

  function renderVote(d) {
    const options = d.options || [];
    const mine = d.myOptionKey;
    const voted = myVote || d.myVote;
    const picked = voted || myPick;
    show(`
      <div class="fab-screen">
        ${head(d)}
        ${timerRow()}
        <div class="vote-q">
          <span class="fab-kicker fab-kicker--red">${t('Which one is true?', 'أيها الحقيقي؟')}</span>
          <b>${esc(questionText())}</b>
        </div>
        <div class="fab-options" id="fab-options">
          ${options
            .map((o) => {
              const isMine = o.key === mine;
              return `
                <button type="button" class="fab-option ${isMine ? 'is-mine' : ''} ${o.key === picked ? 'is-picked' : ''}"
                        data-key="${esc(o.key)}" ${isMine || voted ? 'disabled' : ''} aria-pressed="${o.key === picked}">
                  <span class="fab-option-key">${esc(o.key)}</span>
                  <span class="fab-option-text">${esc(o.text)}</span>
                  ${isMine ? `<span class="fab-option-tag">${t('Yours', 'كذبتك')}</span>` : ''}
                </button>`;
            })
            .join('')}
        </div>
        <span class="fab-hint" id="fab-hint">${voted ? t('Locked in. Waiting for the others…', 'تم التثبيت. بانتظار البقية…') : ''}</span>
        <div class="fab-push">
          <button type="button" class="fab-btn fab-btn--lg fab-btn--block ${voted ? 'fab-btn--locked' : 'fab-btn--ink'}" id="fab-lock" ${voted || !picked ? 'disabled' : ''}>
            ${voted ? t('Vote locked ✓', 'تم تثبيت صوتك ✓') : t('Lock my vote', 'ثبّت صوتي')}
          </button>
        </div>
      </div>`);

    const lock = document.getElementById('fab-lock');
    box.querySelectorAll('.fab-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (myVote || btn.classList.contains('is-mine')) return;
        myPick = btn.dataset.key;
        box.querySelectorAll('.fab-option').forEach((b) => {
          b.classList.toggle('is-picked', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        if (lock) lock.disabled = false;
      });
    });
    if (lock) {
      lock.addEventListener('click', () => {
        if (myVote || !myPick) return;
        myVote = myPick;
        box.querySelectorAll('.fab-option').forEach((b) => (b.disabled = true));
        lock.disabled = true;
        lock.className = 'fab-btn fab-btn--lg fab-btn--block fab-btn--locked';
        lock.textContent = t('Vote locked ✓', 'تم تثبيت صوتك ✓');
        const hint = document.getElementById('fab-hint');
        if (hint) hint.textContent = t('Locked in. Waiting for the others…', 'تم التثبيت. بانتظار البقية…');
        window.BahjahSoundFx.submit();
        send({ type: 'vote', optionKey: myVote });
      });
    }
    startTimer(d.phaseEndsAt);
  }

  // --- The reveal: eyes on the TV, your verdict, then the standings -------
  function renderReveal(d) {
    const rows = d.reveal || [];
    const lies = rows.filter((r) => !r.isTruth).length;
    if (revealRound !== d.roundIndex) {
      revealRound = d.roundIndex;
      // Remembered for the tab, so a reload mid-reveal picks up where the
      // room is rather than playing the lies over again.
      const key = `fab_reveal_${code}_${d.roundIndex}_${d.currentQuestion ? d.currentQuestion.id : ""}`;
      let saved = 0;
      try { saved = Number(sessionStorage.getItem(key)) || 0; } catch {}
      revealStartedAt = saved && Date.now() - saved < 10 * 60 * 1000 ? saved : Date.now();
      try { sessionStorage.setItem(key, String(revealStartedAt)); } catch {}
    }
    const elapsed = Date.now() - revealStartedAt;
    const verdictAt = U.reveal.truthAt(lies);
    const standingsAt = U.reveal.standingsAt(lies);
    const continued = (d.continueUserIds || []).includes(me ? me.id : '');

    if (!showStandingsNow && !continued && elapsed < verdictAt) {
      renderEyesUp();
      revealTimer = setTimeout(() => latestState && render(latestState), verdictAt - elapsed);
      return;
    }
    if (!showStandingsNow && !continued && elapsed < standingsAt) {
      renderVerdict(d, elapsed < verdictAt + 400);
      revealTimer = setTimeout(() => latestState && render(latestState), standingsAt - elapsed);
      return;
    }
    renderStandings(d, continued);
  }

  function renderEyesUp() {
    show(`
      <div class="fab-screen" style="justify-content:center; text-align:center;">
        <span class="fab-kicker fab-kicker--red">${t('The reveal', 'لحظة الكشف')}</span>
        <h2 class="fab-headline">${t('Eyes on the big screen.', 'عيونكم على الشاشة الكبيرة.')}</h2>
        <p class="fab-foot">${t('The lies go up first. The truth comes last.', 'الأكاذيب أولًا. والحقيقة في الآخر.')}</p>
      </div>`);
  }

  function renderVerdict(d, fresh) {
    const rows = d.reveal || [];
    const mine = me ? (d.lastRoundScores || {})[me.id] : null;
    const truth = rows.find((r) => r.isTruth);
    const votedFor = rows.find((r) => me && r.voterUserIds.includes(me.id));
    const gotIt = Boolean(truth && votedFor && truth.key === votedFor.key);
    const myRow = rows.find((r) => me && r.authorUserIds.includes(me.id));

    if (fresh && mine) window.BahjahSoundFx[gotIt ? 'correct' : 'wrong']();

    const tone = gotIt ? 'is-right' : votedFor ? '' : 'is-none';
    const headline = gotIt ? t('You found it.', 'وجدتها.') : votedFor ? t('Fooled.', 'انخدعت.') : t('No vote.', 'لم تصوّت.');
    const detail = gotIt
      ? t('You picked the real answer.', 'اخترت الإجابة الحقيقية.')
      : votedFor
        ? t(`You believed ${list(votedFor.authorUserIds.map(nameOf))}.`, `صدّقت ${list(votedFor.authorUserIds.map(nameOf))}.`)
        : t('The clock ran out on you.', 'انتهى الوقت قبل أن تختار.');

    // What your own lie did: "+2 · Your lie fooled Omar."
    let fooledCard = '';
    if (myRow && mine && mine.fooledCount > 0) {
      const victims = myRow.voterUserIds.filter((v) => !myRow.authorUserIds.includes(v)).map(nameOf);
      fooledCard = `
        <div class="fab-fooled">
          <b>+${num(mine.foolPoints)}</b>
          <span>${esc(t(`Your lie fooled ${list(victims)}.`, `كذبتك خدعت ${list(victims)}.`))}</span>
        </div>`;
    }

    // The rows that matter to you first: lies that caught somebody, then the
    // truth, then the rest.
    const rank = (r) => (!r.isTruth && r.voterUserIds.length ? 0 : r.isTruth ? 1 : 2);
    const ordered = rows.slice().sort((a, b) => rank(a) - rank(b));

    show(`
      <div class="fab-screen">
        <span class="fab-kicker">${t('The reveal', 'لحظة الكشف')}</span>
        <div class="fab-personal ${tone}">
          <span class="fab-personal-badge" aria-hidden="true">${gotIt ? '✓' : '✕'}</span>
          <div class="fab-personal-copy">
            <h2>${esc(headline)}</h2>
            <p>${esc(detail)}</p>
          </div>
          ${mine && mine.votePoints ? `<div class="fab-personal-pts"><b>+${num(mine.votePoints)}</b><span>${t('Points', 'نقاط')}</span></div>` : ''}
        </div>
        ${fooledCard}
        <div class="fab-verdicts">
          ${ordered.map(verdictRow).join('')}
        </div>
        <div class="fab-push">
          <button type="button" class="fab-btn fab-btn--ghost fab-btn--block" id="fab-to-standings">${t('Standings', 'الترتيب')}</button>
        </div>
      </div>`);

    const skip = document.getElementById('fab-to-standings');
    if (skip) {
      skip.addEventListener('click', () => {
        showStandingsNow = true;
        stopClocks();
        if (latestState) render(latestState);
      });
    }
  }

  function verdictRow(row) {
    const voters = row.voterUserIds.map(nameOf);
    const authors = row.authorUserIds.map(nameOf);
    const caught = !row.isTruth && voters.length > 0;
    const meta = row.isTruth
      ? voters.length
        ? t(`Found by ${list(voters)}`, `اكتشفها ${list(voters)}`)
        : t('Nobody found it', 'لم يكتشفها أحد')
      : t(
          `Written by ${list(authors)} · ${voters.length ? `fooled ${list(voters)}` : 'fooled nobody'}`,
          `كتبها ${list(authors)} · ${voters.length ? `خدعت ${list(voters)}` : 'لم تخدع أحدًا'}`
        );
    return `
      <div class="fab-verdict ${row.isTruth ? 'is-truth' : caught ? 'is-caught' : ''}">
        <span class="fab-verdict-key">${esc(row.key)}</span>
        <div class="fab-verdict-body">
          <span class="fab-verdict-text">${esc(row.text)}</span>
          <span class="fab-verdict-meta">${esc(meta)}</span>
        </div>
        ${row.isTruth
          ? `<span class="fab-stamp fab-stamp--truth">${t('True', 'حقيقي')}</span>`
          : caught
            ? `<span class="fab-stamp fab-stamp--lie">${t('Fake', 'مزيّف')}</span>`
            : ''}
      </div>`;
  }

  function standingsRows(d) {
    const scores = d.scores || {};
    return nonHostMembers()
      .map((m) => ({ userId: m.userId, name: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
  }

  function rankRow(row, i, top, delta) {
    const isMe = Boolean(me && row.userId === me.id);
    const pct = top > 0 && row.score > 0 ? Math.max(4, Math.round((row.score / top) * 100)) : 0;
    const name = isMe ? t('You', 'أنت') : row.name;
    return `
      <div class="fab-rank ${isMe ? 'is-me' : ''}">
        <div class="fab-rank-line">
          <span class="fab-rank-no">${num(i + 1)}</span>
          <span class="fab-rank-av" data-c="${i % 4}">${esc((row.name || '?').trim().charAt(0).toUpperCase())}</span>
          <span class="fab-rank-name">${esc(name)}</span>
          ${delta ? `<span class="fab-rank-delta">+${num(delta)}</span>` : ''}
          <span class="fab-rank-total">${num(row.score)}</span>
        </div>
        <div class="fab-rank-bar"><span style="width:${pct}%"></span></div>
      </div>`;
  }

  function renderStandings(d, continued) {
    const rows = standingsRows(d);
    const top = rows.reduce((max, r) => Math.max(max, r.score), 0);
    const deltas = d.lastRoundScores || {};
    const waitingOn = (d.continueUserIds || []).length;
    show(`
      <div class="fab-screen">
        <span class="fab-kicker">${t(`After round ${d.roundIndex + 1}`, `بعد الجولة ${num(d.roundIndex + 1)}`)}</span>
        <h2 class="fab-screen-title">${t('Standings.', 'الترتيب.')}</h2>
        <div class="fab-ranks">
          ${rows.map((r, i) => rankRow(r, i, top, deltas[r.userId] && deltas[r.userId].total)).join('')}
        </div>
        <div class="fab-push">
          <button type="button" class="fab-btn fab-btn--lg fab-btn--block ${continued ? 'fab-btn--locked' : ''}" id="fab-next" ${continued ? 'disabled' : ''}>
            ${continued ? t('Ready ✓', 'جاهز ✓') : t('Ready', 'جاهز')}
          </button>
          <p class="fab-foot">${esc(
            continued
              ? t(`Next fact once everyone's ready… (${waitingOn} of ${rows.length})`, `المعلومة التالية حين يجهز الجميع… (${num(waitingOn)} من ${num(rows.length)})`)
              : t('Tap when you are ready for the next fact.', 'اضغط حين تكون جاهزًا للمعلومة التالية.')
          )}</p>
        </div>
      </div>`);

    const next = document.getElementById('fab-next');
    if (next && !continued) {
      next.addEventListener('click', () => {
        next.disabled = true;
        next.classList.add('fab-btn--locked');
        next.textContent = t('Ready ✓', 'جاهز ✓');
        send({ type: 'continue' });
      });
    }
  }

  // --- Results -------------------------------------------------------------
  function placementLine(rank) {
    if (rank === 1) return t('You won. Nobody saw it coming.', 'فزت. ولا أحد توقّعها.');
    if (rank === 2) return t('You came second. Respectably dishonest.', 'جئت ثانيًا. كاذب محترم.');
    if (rank === 3) return t('You came third. Room for more lies.', 'جئت ثالثًا. ما زال في الكذب متّسع.');
    return t(`You came #${rank}. Honesty didn't pay.`, `جئت في المركز ${num(rank)}. الصدق لم ينفعك.`);
  }

  function renderFinished(d) {
    const scores = d.scores || {};
    const rows = standingsRows(d);
    const myRank = me ? rows.findIndex((r) => r.userId === me.id) + 1 : 0;
    const stats = me && d.finalStats ? d.finalStats[me.id] : null;
    const winners = new Set(d.winnerUserIds || []);
    if (me && winners.has(me.id)) window.BahjahSoundFx.win();

    const best = stats && stats.bestLie;
    show(`
      <div class="fab-screen">
        <span class="fab-kicker">${t('Game over', 'انتهت اللعبة')}</span>
        <h2 class="fab-headline">${myRank ? esc(placementLine(myRank)) : t('That was the game.', 'انتهت اللعبة.')}</h2>
        ${stats
          ? `
          <div class="fab-award">
            <span class="fab-kicker">${t('Your score', 'نقاطك')}</span>
            <span class="fab-award-value">${num(scores[me.id] || 0)}</span>
            <span class="fab-award-note">${t(`Rank #${myRank}`, `المركز ${num(myRank)}`)}</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="fab-award fab-award--blue">
              <span class="fab-kicker">${t('Truths found', 'حقائق اكتشفتها')}</span>
              <span class="fab-award-value">${num(stats.correctVotes)}</span>
              <span class="fab-award-note">${t(`of ${d.totalRounds}`, `من ${num(d.totalRounds)}`)}</span>
            </div>
            <div class="fab-award fab-award--red">
              <span class="fab-kicker">${t('Players fooled', 'لاعبون خدعتهم')}</span>
              <span class="fab-award-value">${num(stats.playersFooled)}</span>
              <span class="fab-award-note">${esc(
                t(`Fooled ${stats.timesFooled} ${stats.timesFooled === 1 ? 'time' : 'times'}`, `انخدعت ${U.count(stats.timesFooled, 'time')}`)
              )}</span>
            </div>
          </div>`
          : ''}
        ${best
          ? `<div class="fab-slip">
              <span class="fab-kicker fab-kicker--red">${t('Your best lie', 'أفضل كذبة لك')}</span>
              <b>${esc(t(`“${best.text}” — fooled ${best.fooled}`, `«${best.text}» — خدعت ${num(best.fooled)}`))}</b>
            </div>`
          : ''}
        <div class="fab-push">
          <button type="button" class="fab-btn fab-btn--ink fab-btn--lg fab-btn--block" id="fab-share">${t('Share result', 'شارك النتيجة')}</button>
          <p class="fab-foot">${t('Waiting for the host…', 'بانتظار المضيف…')}</p>
        </div>
      </div>`);

    const shareBtn = document.getElementById('fab-share');
    if (shareBtn) shareBtn.addEventListener('click', () => shareResult(scores, myRank));
  }

  function shareResult(scores, myRank) {
    const lang = U.lang();
    const score = me ? scores[me.id] || 0 : 0;
    const won = myRank === 1;
    const shareBtn = document.getElementById('fab-share');
    const url = `${location.origin}/fabrication.html`;
    const headline = lang === 'ar'
      ? won ? 'لعبت فبركة على بهجة وفزت!' : 'لعبت فبركة على بهجة!'
      : won ? 'I just played Fabrication on Bahjah and won!' : 'I just played Fabrication on Bahjah!';
    const subline = lang === 'ar' ? `فبركة · ${num(score)} نقطة · المركز ${num(myRank)}` : `Fabrication · ${score} pts · Rank #${myRank}`;
    const text = lang === 'ar'
      ? `${headline} سجّلت ${num(score)} نقطة وحللت في المركز ${num(myRank)}. 🎭`
      : `${headline} Scored ${score} points and placed #${myRank}. 🎭`;

    if (window.BahjahShareCard) {
      window.BahjahShareCard.share({ gameId: 'fabrication', lang, headline, subline, text, url, shareBtn });
      return;
    }
    if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(`${text} ${url}`).then(() => {
      if (!shareBtn) return;
      const original = shareBtn.textContent;
      shareBtn.textContent = t('Copied!', 'تم النسخ!');
      setTimeout(() => (shareBtn.textContent = original), 1500);
    }).catch(() => {});
  }

  function renderEnded() {
    stopClocks();
    show(`
      <div class="fab-screen" style="justify-content:center;">
        <span class="fab-kicker fab-kicker--red">${t('Room closed', 'أُغلقت الغرفة')}</span>
        <h2 class="fab-headline">${esc(t(`The host ended this game (code: ${code}).`, `أنهى المضيف هذه اللعبة (الرمز: ${code}).`))}</h2>
        <div class="fab-push">
          <a class="fab-btn fab-btn--lg fab-btn--block" href="fabrication.html">${t('Back to Fabrication', 'العودة إلى فبركة')}</a>
        </div>
      </div>`);
  }
})();
