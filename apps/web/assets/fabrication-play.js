// فبركة | Fabrication -- the player's phone. Driven entirely by the
// 'bahjah:game-state' events assets/lobby.js dispatches, exactly like
// assets/trivia-play.js and assets/knows-you-best-play.js. The host never
// lands here: lobby-room.js keeps them on fabrication-lobby.html's console.
(function () {
  const LANG = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
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
  let currentRoundKey = null;
  // The fabrication screen is the one phase with a text box in it. Rebuilding
  // it on every state tick would wipe what the player is halfway through
  // typing, so once it is drawn for a round it is patched, never redrawn --
  // the same rule trivia's question screen follows for its answer tiles.
  let writeRenderKey = null;
  let errorListenerAttached = false;

  function t(en, ar) {
    return LANG() === 'ar' ? ar : en;
  }

  // Arabic counts a noun three different ways -- one, a pair, then a plural --
  // so "1 مرات" is simply wrong rather than merely clumsy. Only the handful of
  // nouns this screen actually counts are covered.
  function arTimes(n) {
    if (n === 1) return 'مرة واحدة';
    if (n === 2) return 'مرتين';
    return `${n} مرات`;
  }
  function arPlayers(n) {
    if (n === 1) return 'لاعب واحد';
    if (n === 2) return 'لاعبين اثنين';
    return `${n} لاعبين`;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function nonHostMembers() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }

  function nameOf(userId) {
    if (me && userId === me.id) return t('You', 'أنت');
    const member = nonHostMembers().find((m) => m.userId === userId);
    return member ? member.displayName : t('Player', 'لاعب');
  }

  function questionText(q) {
    if (!q) return '';
    return LANG() === 'ar' && q.promptAr ? q.promptAr : q.prompt;
  }

  function myScore(d) {
    if (!d || !d.scores || !me) return 0;
    return d.scores[me.id] || 0;
  }

  function formatScore(n) {
    return Number(n || 0).toLocaleString(LANG() === 'ar' ? 'ar-EG' : 'en-US');
  }

  function renderMeChip() {
    const chip = document.getElementById('me-chip');
    if (!chip || !me) return;
    const member = latestRoom ? latestRoom.members.find((m) => m.userId === me.id) : null;
    const name = (member && member.displayName) || me.fullName || '';
    if (!name) return;
    const avatarEl = document.getElementById('me-chip-avatar');
    const nameEl = document.getElementById('me-chip-name');
    if (avatarEl && window.BahjahAvatars) {
      avatarEl.innerHTML = window.BahjahAvatars.renderAvatarHtml(member ? member.avatar : null, me.id);
    }
    if (nameEl) nameEl.textContent = name;
    chip.hidden = false;
  }
  renderMeChip();

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
    renderMeChip();
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
    // A language switch has to redraw the fabrication screen in the new
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
      // TOO_TRUE is the interesting one: the player has accidentally written
      // the real answer, and the server refuses it rather than putting two
      // right answers on the board.
      hint.textContent = err.message;
      hint.setAttribute('data-tone', 'error');
      if (err.code === 'TOO_TRUE') {
        const input = document.getElementById('fab-input');
        const submit = document.getElementById('fab-submit');
        if (input) input.disabled = false;
        if (submit) submit.disabled = false;
        myFabrication = null;
      }
    });
  }

  function send(action) {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    socket.emit('game:action', { action });
  }

  function render(state) {
    if (splash) splash.style.display = 'none';
    wrap.style.display = 'block';
    const d = state.data || {};

    const roundKey = `${d.roundIndex}`;
    if (roundKey !== currentRoundKey) {
      currentRoundKey = roundKey;
      myFabrication = null;
      myVote = null;
      writeRenderKey = null;
    }
    // The server is the authority on what this player has already done -- a
    // reconnect mid-round gets its answers back from here, not from memory.
    if (d.myFabrication) myFabrication = d.myFabrication;
    if (d.myVote) myVote = d.myVote;

    if (state.phase !== 'fabrication') writeRenderKey = null;

    if (state.phase === 'countdown') return renderCountdown(d);
    if (state.phase === 'question') return renderQuestion(d);
    if (state.phase === 'fabrication') return renderWrite(d);
    if (state.phase === 'voting') return renderVote(d);
    if (state.phase === 'reveal') return renderReveal(d);
    if (state.phase === 'finished') return renderFinished(d);
  }

  function head(d, right) {
    const round = d.totalRounds
      ? t(`Round ${d.roundIndex + 1} of ${d.totalRounds}`, `الجولة ${d.roundIndex + 1} من ${d.totalRounds}`)
      : '';
    const category = d.currentQuestion ? d.currentQuestion.category : '';
    return `
      <div class="fab-head">
        <div class="fab-head-l">
          <span class="fab-round">${esc(round)}</span>
          ${category ? `<span class="fab-cat">${esc(category)}</span>` : ''}
        </div>
        ${right || ''}
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
        if (label) label.textContent = Math.max(0, secs);
        if (ring) ring.classList.toggle('is-danger', secs > 0 && secs <= 5);
      },
    });
  }

  function renderCountdown(d) {
    box.innerHTML = `
      <div class="fab-stage">
        <div class="fab-countdown">
          <div class="fab-countdown-num" id="fab-count">3</div>
          <div class="fab-countdown-label">${t('Get ready to lie', 'استعدّ للكذب')}</div>
        </div>
      </div>`;
    const el = document.getElementById('fab-count');
    const tick = () => {
      const secs = Math.max(0, Math.ceil(((d.phaseEndsAt || Date.now()) - Date.now()) / 1000));
      if (el) el.textContent = secs > 0 ? String(secs) : t('Go!', 'هيا!');
    };
    tick();
    clearInterval(window.__fabCountdown);
    window.__fabCountdown = setInterval(tick, 250);
  }

  // The reading phase. Deliberately has no input on it: everybody meets the
  // fact at the same moment, and nobody gets a head start on inventing an
  // answer for it.
  function renderQuestion(d) {
    box.innerHTML = `
      <div class="fab-stage">
        ${head(d, `<span class="fab-score">${formatScore(myScore(d))}</span>`)}
        ${timerRow()}
        <div class="fab-question">
          <span class="fab-question-kicker">${t('Read it', 'اقرأ السؤال')}</span>
          <h2>${esc(questionText(d.currentQuestion))}</h2>
        </div>
        <p class="fab-foot">${t('In a moment you will invent an answer that sounds true.', 'بعد لحظات ستخترع إجابة تبدو صحيحة.')}</p>
      </div>`;
    startTimer(d.phaseEndsAt);
  }

  function renderWrite(d) {
    const key = `${d.roundIndex}|${LANG()}`;
    if (key === writeRenderKey) {
      // Same round, already on screen: only the counter moves, so patch it
      // rather than rebuild the box under whatever is being typed.
      const foot = document.getElementById('fab-write-foot');
      if (foot) foot.textContent = submittedLine(d);
      return;
    }
    writeRenderKey = key;

    const locked = Boolean(myFabrication);
    box.innerHTML = `
      <div class="fab-stage">
        ${head(d, `<span class="fab-score">${formatScore(myScore(d))}</span>`)}
        ${timerRow()}
        <div class="fab-question">
          <span class="fab-question-kicker">${t('Make them believe it', 'اجعلهم يصدقونها')}</span>
          <h2>${esc(questionText(d.currentQuestion))}</h2>
        </div>
        <div class="fab-write">
          <input class="fab-input" id="fab-input" type="text" maxlength="80" autocomplete="off"
                 placeholder="${t('Write a believable answer…', 'اكتب إجابة مقنعة…')}"
                 value="${esc(myFabrication || '')}" ${locked ? 'disabled' : ''}>
          <button type="button" class="fab-submit ${locked ? 'is-locked' : ''}" id="fab-submit" ${locked ? 'disabled' : ''}>
            ${locked ? t('Sent ✓', 'تم الإرسال ✓') : t('Submit fabrication', 'أرسل الفبركة')}
          </button>
          <span class="fab-hint" id="fab-hint">${
            locked ? t('Waiting for the others…', 'بانتظار البقية…') : t('Nobody sees who wrote what.', 'لا أحد يرى من كتب ماذا.')
          }</span>
        </div>
        <p class="fab-foot" id="fab-write-foot">${submittedLine(d)}</p>
      </div>`;

    const input = document.getElementById('fab-input');
    const submit = document.getElementById('fab-submit');
    const commit = () => {
      if (myFabrication) return;
      const text = (input.value || '').trim();
      if (!text) {
        const hint = document.getElementById('fab-hint');
        if (hint) {
          hint.textContent = t('Write something first.', 'اكتب شيئًا أولاً.');
          hint.setAttribute('data-tone', 'error');
        }
        return;
      }
      myFabrication = text;
      input.disabled = true;
      submit.disabled = true;
      submit.classList.add('is-locked');
      submit.textContent = t('Sent ✓', 'تم الإرسال ✓');
      const hint = document.getElementById('fab-hint');
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

  function submittedLine(d) {
    const done = d.submittedCount || 0;
    const total = d.playerCount || nonHostMembers().length || done;
    return t(`${done} of ${total} have written theirs`, `${done} من ${total} كتبوا إجابتهم`);
  }

  function renderVote(d) {
    const options = d.options || [];
    const mine = d.myOptionKey;
    const voted = myVote || d.myVote;
    box.innerHTML = `
      <div class="fab-stage">
        ${head(d, `<span class="fab-score">${formatScore(myScore(d))}</span>`)}
        ${timerRow()}
        <div class="fab-question">
          <span class="fab-question-kicker">${t('Which one is true?', 'أيها الصحيح؟')}</span>
          <h2>${esc(questionText(d.currentQuestion))}</h2>
        </div>
        <div class="fab-options" id="fab-options">
          ${options
            .map((o) => {
              const isMine = o.key === mine;
              const isPicked = o.key === voted;
              return `
                <button type="button" class="fab-option ${isMine ? 'is-mine' : ''} ${isPicked ? 'is-picked' : ''}"
                        data-key="${esc(o.key)}" ${isMine || voted ? 'disabled' : ''}>
                  <span class="fab-option-key">${esc(o.key)}</span>
                  <span class="fab-option-text">${esc(o.text)}</span>
                  ${isMine ? `<span class="fab-option-tag">${t('Yours', 'إجابتك')}</span>` : ''}
                </button>`;
            })
            .join('')}
        </div>
        <span class="fab-hint" id="fab-hint">${
          voted ? t('Locked in. Waiting for the others…', 'تم التثبيت. بانتظار البقية…') : t('One choice, and it is final.', 'اختيار واحد ولا رجعة فيه.')
        }</span>
      </div>`;

    box.querySelectorAll('.fab-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (myVote) return;
        myVote = btn.dataset.key;
        box.querySelectorAll('.fab-option').forEach((b) => {
          b.disabled = true;
          b.classList.toggle('is-picked', b === btn);
        });
        const hint = document.getElementById('fab-hint');
        if (hint) hint.textContent = t('Locked in. Waiting for the others…', 'تم التثبيت. بانتظار البقية…');
        window.BahjahSoundFx.submit();
        send({ type: 'vote', optionKey: myVote });
      });
    });
    startTimer(d.phaseEndsAt);
  }

  function renderReveal(d) {
    window.BahjahTimerBar.stop('fabrication');
    const rows = d.reveal || [];
    const mine = me ? (d.lastRoundScores || {})[me.id] : null;
    const truth = rows.find((r) => r.isTruth);
    const votedFor = rows.find((r) => me && r.voterUserIds.includes(me.id));
    const gotIt = Boolean(truth && votedFor && truth.key === votedFor.key);
    const answerText = LANG() === 'ar' && d.answerAr ? d.answerAr : d.answer;
    const continued = (d.continueUserIds || []).includes(me ? me.id : '');

    if (mine) window.BahjahSoundFx[gotIt ? 'correct' : 'wrong']();

    const tone = gotIt ? 'is-right' : 'is-wrong';
    const headline = gotIt ? t('You found it.', 'وجدتها.') : t('Fooled.', 'انطلت عليك.');
    const detail = gotIt
      ? t('You picked the real answer.', 'اخترت الإجابة الحقيقية.')
      : votedFor
        ? t(`You believed ${nameOf(votedFor.authorUserIds[0])}.`, `صدّقت ${nameOf(votedFor.authorUserIds[0])}.`)
        : t('You did not vote.', 'لم تصوّت.');

    box.innerHTML = `
      <div class="fab-stage">
        ${head(d, `<span class="fab-score">${formatScore(myScore(d))}</span>`)}

        <div class="fab-reveal-card is-truth">
          <span class="fab-reveal-kicker">${t('The real answer', 'الإجابة الحقيقية')}</span>
          <h2 class="fab-reveal-answer">${esc(answerText || '')}</h2>
          ${d.source ? `<p class="fab-reveal-source">${t('Source', 'المصدر')}: ${esc(d.source)}</p>` : ''}
        </div>

        <div class="fab-personal ${tone}">
          <span class="fab-personal-badge" aria-hidden="true">${gotIt ? '✓' : '✕'}</span>
          <div class="fab-personal-copy">
            <h2>${headline}</h2>
            <p>${detail}</p>
          </div>
          ${mine ? `<div class="fab-personal-pts"><b>+${mine.total}</b><span>${t('Points', 'نقطة')}</span></div>` : ''}
        </div>

        ${mine && mine.fooledCount > 0
          ? `<p class="fab-foot">${t(
              `Your fabrication fooled ${mine.fooledCount} ${mine.fooledCount === 1 ? 'player' : 'players'}.`,
              `فبركتك انطلت على ${arPlayers(mine.fooledCount)}.`
            )}</p>`
          : ''}

        <div class="fab-verdicts">
          ${rows
            .map((row) => {
              const voters = row.voterUserIds.map(nameOf);
              const authors = row.authorUserIds.map(nameOf);
              const caught = !row.isTruth && voters.length > 0;
              const meta = row.isTruth
                ? voters.length
                  ? t(`Found by ${voters.join(', ')}`, `وجدها ${voters.join('، ')}`)
                  : t('Nobody found it', 'لم يجدها أحد')
                : t(
                    `Written by ${authors.join(', ')}${voters.length ? ` · fooled ${voters.join(', ')}` : ' · fooled nobody'}`,
                    `كتبها ${authors.join('، ')}${voters.length ? ` · انطلت على ${voters.join('، ')}` : ' · لم تنطلِ على أحد'}`
                  );
              return `
                <div class="fab-verdict ${row.isTruth ? 'is-truth' : caught ? 'is-caught' : ''}">
                  <span class="fab-verdict-key">${esc(row.key)}</span>
                  <div class="fab-verdict-body">
                    <span class="fab-verdict-text">${esc(row.text)}</span>
                    <span class="fab-verdict-meta">${esc(meta)}</span>
                  </div>
                  ${row.isTruth
                    ? `<span class="fab-stamp fab-stamp--truth">${t('True', 'صحيح')}</span>`
                    : caught
                      ? `<span class="fab-stamp fab-stamp--lie">${t('Fake', 'مفبركة')}</span>`
                      : ''}
                </div>`;
            })
            .join('')}
        </div>

        <button type="button" class="fab-submit ${continued ? 'is-locked' : ''}" id="fab-next" ${continued ? 'disabled' : ''}>
          ${continued ? t('Waiting for the others…', 'بانتظار البقية…') : t('Next', 'التالي')}
        </button>
      </div>`;

    const next = document.getElementById('fab-next');
    if (next) {
      next.addEventListener('click', () => {
        next.disabled = true;
        next.classList.add('is-locked');
        next.textContent = t('Waiting for the others…', 'بانتظار البقية…');
        send({ type: 'continue' });
      });
    }
  }

  function renderFinished(d) {
    window.BahjahTimerBar.stop('fabrication');
    clearInterval(window.__fabCountdown);
    const scores = d.scores || {};
    const winners = new Set(d.winnerUserIds || []);
    const rows = nonHostMembers()
      .slice()
      .sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));
    const myRank = me ? rows.findIndex((m) => m.userId === me.id) + 1 : 0;
    const stats = me && d.finalStats ? d.finalStats[me.id] : null;
    const winnerNames = rows.filter((m) => winners.has(m.userId)).map((m) => m.displayName);

    if (me && winners.has(me.id)) window.BahjahSoundFx.win();

    box.innerHTML = `
      <div class="fab-stage">
        <div class="fab-winner">
          <div class="fab-winner-label">${t('Winner', 'الفائز')}</div>
          <h2 class="fab-winner-name">${esc(winnerNames.length ? winnerNames.join(t(', ', '، ')) : t('No winner', 'لا فائز'))}</h2>
          <p class="fab-winner-sub">${
            rows[0] ? t(`${formatScore(scores[rows[0].userId] || 0)} points`, `${formatScore(scores[rows[0].userId] || 0)} نقطة`) : ''
          }</p>
        </div>

        ${stats
          ? `<div class="fab-awards">
              <div class="fab-award"><span class="fab-award-title">${t('Your score', 'نقاطك')}</span><span class="fab-award-name">${formatScore(
                scores[me.id] || 0
              )}</span><span class="fab-award-note">${t(`Rank #${myRank}`, `المركز #${myRank}`)}</span></div>
              <div class="fab-award"><span class="fab-award-title">${t('Truths found', 'الحقائق المكتشفة')}</span><span class="fab-award-name">${
                stats.correctVotes
              }</span><span class="fab-award-note">${t(`of ${d.totalRounds}`, `من ${d.totalRounds}`)}</span></div>
              <div class="fab-award"><span class="fab-award-title">${t('Players fooled', 'من انطلت عليهم')}</span><span class="fab-award-name">${
                stats.playersFooled
              }</span><span class="fab-award-note">${t(
                `Fooled ${stats.timesFooled} ${stats.timesFooled === 1 ? 'time' : 'times'}`,
                `انطلت عليك ${arTimes(stats.timesFooled)}`
              )}</span></div>
            </div>`
          : ''}

        <div class="fab-ranks">
          ${rows
            .map((m, i) => {
              const isMe = Boolean(me && m.userId === me.id);
              return `
                <div class="fab-rank ${isMe ? 'is-me' : ''}">
                  <div class="fab-rank-line">
                    <span class="fab-rank-no">${i + 1}</span>
                    <span class="fab-rank-av">${esc((m.displayName || '?').trim().charAt(0).toUpperCase())}</span>
                    <span class="fab-rank-name">${esc(isMe ? t('You', 'أنت') : m.displayName)}</span>
                    <span class="fab-rank-total">${formatScore(scores[m.userId] || 0)}</span>
                  </div>
                </div>`;
            })
            .join('')}
        </div>

        <div class="fab-actions">
          <a class="is-primary" href="fabrication.html">${t('Play again', 'العب مرة أخرى')}</a>
          <button type="button" id="fab-share">${t('Share result', 'شارك النتيجة')}</button>
        </div>
        <p class="fab-foot">${t('Waiting for the host to start a new game…', 'بانتظار أن يبدأ المضيف لعبة جديدة…')}</p>
      </div>`;

    const shareBtn = document.getElementById('fab-share');
    if (shareBtn) shareBtn.addEventListener('click', () => shareResult(scores, myRank));
  }

  function shareResult(scores, myRank) {
    const lang = LANG();
    const score = me ? scores[me.id] || 0 : 0;
    const won = myRank === 1;
    const shareBtn = document.getElementById('fab-share');
    const url = `${location.origin}/bahjah-landing.html`;
    const headline = lang === 'ar'
      ? won ? 'لعبت فبركة على بهجة وفزت!' : 'لعبت فبركة على بهجة!'
      : won ? 'I just played Fabrication on Bahjah and won!' : 'I just played Fabrication on Bahjah!';
    const subline = lang === 'ar' ? `فبركة · ${score} نقطة · المركز #${myRank}` : `Fabrication · ${score} pts · Rank #${myRank}`;
    const text = lang === 'ar'
      ? `${headline} سجّلت ${score} نقطة وحللت في المركز #${myRank}. 🎭`
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
    window.BahjahTimerBar.stop('fabrication');
    clearInterval(window.__fabCountdown);
    if (splash) splash.style.display = 'none';
    wrap.style.display = 'block';
    box.innerHTML = `
      <div class="fab-stage">
        <div class="fab-question">
          <h2>${t(`The host ended this game (code: ${code})`, `أنهى المضيف هذه اللعبة (الرمز: ${code})`)}</h2>
        </div>
        <div class="fab-actions">
          <a class="is-primary" href="bahjah-landing.html">${t('Back to Bahjah', 'العودة إلى بهجة')}</a>
        </div>
      </div>`;
  }
})();
