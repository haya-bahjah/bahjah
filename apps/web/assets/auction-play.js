// مزاد | Auction -- the player's phone. Driven by the 'bahjah:game-state'
// events assets/lobby.js dispatches, the same arrangement as the other games'
// phone scripts. The host never lands here: lobby-room.js keeps them on
// auction-lobby.html's console, where they run the room and rule on answers.
(function () {
  const LANG = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const splash = document.getElementById('auc-splash');
  const wrap = document.getElementById('auc-live');
  const box = document.getElementById('auc-play-box');
  if (!wrap || !box) return;

  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();

  let latestRoom = null;
  let latestState = null;
  let roomEnded = false;
  // The bidding screen carries a number the player is adjusting and the
  // answer screen carries a box they are typing in, so neither may be
  // rebuilt underneath them on a state tick. Both are drawn once per round
  // and patched afterwards.
  let bidRenderKey = null;
  let answerRenderKey = null;
  // What this player has staged but not sent: the number showing in the bid
  // box. Reset whenever the standing bid moves, since a raise that no longer
  // beats the table is not a raise.
  let stagedBid = null;
  let errorListenerAttached = false;

  const t = (en, ar) => (LANG() === 'ar' ? ar : en);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function nonHostMembers() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }

  function nameOf(userId, youIsYou) {
    if (youIsYou !== false && me && userId === me.id) return t('You', 'أنت');
    const member = nonHostMembers().find((m) => m.userId === userId);
    return member ? member.displayName : t('Player', 'لاعب');
  }

  function categoryName(c) {
    if (!c) return '';
    return LANG() === 'ar' && c.nameAr ? c.nameAr : c.name;
  }

  function myScore(d) {
    if (!d || !d.scores || !me) return 0;
    return d.scores[me.id] || 0;
  }

  function formatNum(n) {
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
      window.location.href = `auction-lobby.html?code=${encodeURIComponent(code)}`;
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
    if (state.gameType !== 'auction') return;
    latestState = state;
    attachErrorListenerOnce();
    render(state);
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (roomEnded) {
      renderEnded();
      return;
    }
    bidRenderKey = null;
    answerRenderKey = null;
    if (latestState) render(latestState);
  });

  function attachErrorListenerOnce() {
    if (errorListenerAttached) return;
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    errorListenerAttached = true;
    socket.on('room:error', (err) => {
      const hint = document.getElementById('auc-hint');
      if (!hint) return;
      hint.textContent = err.message;
      hint.setAttribute('data-tone', 'error');
      // A refused bid leaves the controls live so the number can be fixed and
      // sent again -- it is still this player's turn.
      const raise = document.getElementById('auc-raise');
      const pass = document.getElementById('auc-pass');
      if (raise) raise.disabled = false;
      if (pass) pass.disabled = false;
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

    if (state.phase !== 'bidding') bidRenderKey = null;
    if (state.phase !== 'answering') answerRenderKey = null;

    if (state.phase === 'countdown') return renderCountdown(d);
    if (state.phase === 'bidding') return renderBidding(d);
    if (state.phase === 'sold') return renderSold(d);
    if (state.phase === 'answering') return renderAnswering(d);
    if (state.phase === 'judging') return renderJudging(d);
    if (state.phase === 'results') return renderResults(d);
    if (state.phase === 'finished') return renderFinished(d);
  }

  function head(d, right) {
    const round = d.totalRounds
      ? t(`Lot ${d.roundIndex + 1} of ${d.totalRounds}`, `القطعة ${d.roundIndex + 1} من ${d.totalRounds}`)
      : '';
    return `
      <div class="auc-head">
        <span class="auc-round">${esc(round)}</span>
        ${right || ''}
      </div>`;
  }

  function lotCard(d) {
    return `
      <div class="auc-lot">
        <span class="auc-lot-kicker">${t('The lot', 'القطعة المعروضة')}</span>
        <h2 class="auc-lot-name">${esc(categoryName(d.currentCategory))}</h2>
      </div>`;
  }

  function paddles(d) {
    const active = d.activeBidders || [];
    const top = d.currentBid ? d.currentBid.userId : null;
    return `
      <div class="auc-paddles">
        ${(d.order || [])
          .map((userId) => {
            const isOut = !active.includes(userId);
            const isTop = userId === top;
            const isTurn = userId === d.turnUserId;
            const state = isTop
              ? t('Top bid', 'أعلى مزايدة')
              : isOut
                ? t('Out', 'خرج')
                : isTurn
                  ? t('Their turn', 'دوره')
                  : t('In', 'مستمر');
            return `
              <div class="auc-paddle ${isTop ? 'is-top' : ''} ${isOut ? 'is-out' : ''} ${isTurn ? 'is-turn' : ''}">
                <span class="auc-paddle-name">${esc(nameOf(userId))}</span>
                <span class="auc-paddle-state">${esc(state)}</span>
              </div>`;
          })
          .join('')}
      </div>`;
  }

  function bidBlock(d) {
    if (!d.currentBid) {
      return `
        <div class="auc-bid">
          <div class="auc-bid-label">${t('No bid yet', 'لا مزايدة بعد')}</div>
          <div class="auc-bid-number">—</div>
          <div class="auc-bid-none">${t('The opener names a number.', 'من يفتتح المزاد يحدد الرقم.')}</div>
        </div>`;
    }
    return `
      <div class="auc-bid">
        <div class="auc-bid-label">${t('Standing bid', 'المزايدة الحالية')}</div>
        <div class="auc-bid-number">${formatNum(d.currentBid.amount)}</div>
        <div class="auc-bid-holder">${esc(t(`${nameOf(d.currentBid.userId)} — ${d.currentBid.amount} answers`,
          `${nameOf(d.currentBid.userId)} — ${d.currentBid.amount} إجابة`))}</div>
      </div>`;
  }

  function renderCountdown(d) {
    box.innerHTML = `
      <div class="auc-stage">
        <div class="auc-countdown">
          <div class="auc-countdown-num" id="auc-count">3</div>
          <div class="auc-countdown-label">${t('The saleroom is opening', 'قاعة المزاد تفتح أبوابها')}</div>
        </div>
      </div>`;
    const el = document.getElementById('auc-count');
    const tick = () => {
      const secs = Math.max(0, Math.ceil(((d.phaseEndsAt || Date.now()) - Date.now()) / 1000));
      if (el) el.textContent = secs > 0 ? String(secs) : t('Go!', 'هيا!');
    };
    tick();
    clearInterval(window.__aucCountdown);
    window.__aucCountdown = setInterval(tick, 250);
  }

  function renderBidding(d) {
    const myTurn = Boolean(me && d.turnUserId === me.id);
    const minBid = d.minBid || 3;
    const amIn = (d.activeBidders || []).includes(me ? me.id : '');
    const isOpener = !d.currentBid;
    // Redraw only when something the player can act on changes -- their turn,
    // the standing bid, who is left, the language. Anything else (another
    // phone reconnecting) patches nothing and leaves the staged number alone.
    const key = [d.roundIndex, d.turnUserId, d.currentBid ? d.currentBid.amount : 'none', (d.activeBidders || []).join(','), LANG()].join('|');
    if (key === bidRenderKey) return;
    bidRenderKey = key;
    stagedBid = minBid;

    const controls = !amIn
      ? `<div class="auc-turn-banner">${t('You are out of this auction.', 'خرجت من هذا المزاد.')}</div>`
      : myTurn
        ? `
          <div class="auc-turn-banner is-mine">${
            isOpener ? t('You open the bidding.', 'أنت تفتتح المزاد.') : t('Your turn — raise or pass.', 'دورك — زايد أو انسحب.')
          }</div>
          <div class="auc-bid-row">
            <button type="button" class="auc-step" id="auc-minus" aria-label="${t('Lower', 'أقل')}">−</button>
            <input class="auc-bid-input" id="auc-amount" type="number" inputmode="numeric" value="${minBid}" min="${minBid}">
            <button type="button" class="auc-step" id="auc-plus" aria-label="${t('Higher', 'أكثر')}">+</button>
          </div>
          <div class="auc-actions-row">
            <button type="button" class="auc-btn auc-btn--raise" id="auc-raise">${
              isOpener ? t('Open the bidding', 'افتتح المزاد') : t('Raise', 'زايد')
            }</button>
            ${isOpener ? '' : `<button type="button" class="auc-btn auc-btn--pass" id="auc-pass">${t('Pass', 'انسحب')}</button>`}
          </div>
          <span class="auc-hint" id="auc-hint">${esc(
            isOpener
              ? t(`Bid at least ${minBid}. You must find that many answers.`, `زايد بـ ${minBid} على الأقل. عليك إيجاد هذا العدد من الإجابات.`)
              : t(`You have to beat ${d.currentBid.amount}.`, `عليك تجاوز ${d.currentBid.amount}.`)
          )}</span>`
        : `<div class="auc-turn-banner">${esc(
            t(`Waiting for ${nameOf(d.turnUserId)}…`, `بانتظار ${nameOf(d.turnUserId)}…`)
          )}</div>`;

    box.innerHTML = `
      <div class="auc-stage">
        ${head(d, `<span class="auc-score">${formatNum(myScore(d))}</span>`)}
        ${lotCard(d)}
        ${bidBlock(d)}
        ${paddles(d)}
        ${controls}
      </div>`;

    if (!myTurn || !amIn) return;
    const input = document.getElementById('auc-amount');
    const clamp = () => {
      let v = Math.floor(Number(input.value));
      if (!Number.isFinite(v) || v < minBid) v = minBid;
      input.value = String(v);
      stagedBid = v;
    };
    input.addEventListener('input', () => { stagedBid = Math.floor(Number(input.value)); });
    input.addEventListener('blur', clamp);
    document.getElementById('auc-minus').addEventListener('click', () => {
      input.value = String(Math.max(minBid, Math.floor(Number(input.value)) - 1));
      clamp();
      window.BahjahSoundFx.tick();
    });
    document.getElementById('auc-plus').addEventListener('click', () => {
      input.value = String(Math.floor(Number(input.value)) + 1);
      clamp();
      window.BahjahSoundFx.tick();
    });
    document.getElementById('auc-raise').addEventListener('click', () => {
      clamp();
      const amount = stagedBid;
      if (!Number.isFinite(amount) || amount < minBid) return;
      document.getElementById('auc-raise').disabled = true;
      const pass = document.getElementById('auc-pass');
      if (pass) pass.disabled = true;
      window.BahjahSoundFx.submit();
      send({ type: 'bid', amount });
    });
    const passBtn = document.getElementById('auc-pass');
    if (passBtn) {
      passBtn.addEventListener('click', () => {
        passBtn.disabled = true;
        document.getElementById('auc-raise').disabled = true;
        send({ type: 'pass' });
      });
    }
  }

  function renderSold(d) {
    const iWon = Boolean(me && d.winnerUserId === me.id);
    if (iWon) window.BahjahSoundFx.correct();
    box.innerHTML = `
      <div class="auc-stage">
        ${head(d, '')}
        ${lotCard(d)}
        <div class="auc-sold">
          <span class="auc-sold-word">${t('SOLD!', 'بيعت!')}</span>
          <p class="auc-sold-line">${
            d.winnerUserId
              ? esc(t(`${nameOf(d.winnerUserId)} for ${d.winningBid}`, `${nameOf(d.winnerUserId)} بـ ${d.winningBid}`))
              : t('Nobody took it.', 'لم يأخذها أحد.')
          }</p>
          ${d.winnerUserId
            ? `<p class="auc-foot">${
                iWon
                  ? t('Now prove it.', 'والآن أثبت ذلك.')
                  : esc(t(`${nameOf(d.winnerUserId)} has to prove it.`, `على ${nameOf(d.winnerUserId)} أن يثبت ذلك.`))
              }</p>`
            : ''}
        </div>
      </div>`;
  }

  function targetRow(d, valid) {
    return `
      <div class="auc-target">
        <div>
          <div class="auc-target-count"><b>${formatNum(valid)}</b> / ${formatNum(d.winningBid || 0)}</div>
          <div class="auc-target-label">${t('Valid answers', 'إجابات صحيحة')}</div>
        </div>
      </div>`;
  }

  function answerList(d, opts) {
    const answers = d.answers || [];
    const rows = opts && opts.newestFirst ? [...answers].reverse() : answers;
    if (rows.length === 0) {
      return `<p class="auc-foot">${t('Nothing yet.', 'لا شيء بعد.')}</p>`;
    }
    return `
      <div class="auc-list">
        ${rows
          .map((a) => {
            const n = answers.indexOf(a) + 1;
            return `
              <span class="auc-item ${a.duplicate ? 'is-dupe' : ''} ${a.rejected ? 'is-rejected' : ''}">
                <span class="auc-item-no">${n}</span>${esc(a.text)}
              </span>`;
          })
          .join('')}
      </div>`;
  }

  function validCount(d) {
    return (d.answers || []).filter((a) => !a.duplicate && !a.rejected).length;
  }

  function startTimer(endsAt) {
    const ring = document.getElementById('auc-ring');
    const label = document.getElementById('auc-countdown-label');
    window.BahjahTimerBar.start('auction', document.getElementById('auc-timer-fill'), null, endsAt, {
      onTick: (secs) => {
        if (secs > 0 && secs <= 3) window.BahjahSoundFx.tick();
        if (label) label.textContent = Math.max(0, secs);
        if (ring) ring.classList.toggle('is-danger', secs > 0 && secs <= 10);
      },
    });
  }

  function timerRow() {
    return `
      <div class="auc-timer">
        <div class="auc-timer-track"><div class="auc-timer-fill" id="auc-timer-fill"></div></div>
        <div class="auc-ring" id="auc-ring"><span id="auc-countdown-label"></span></div>
      </div>`;
  }

  function renderAnswering(d) {
    const mine = Boolean(me && d.winnerUserId === me.id);
    const key = `${d.roundIndex}|${mine}|${LANG()}`;
    if (key === answerRenderKey) {
      // Same sprint, already on screen: patch the list and the counter so the
      // box the winner is typing into is never rebuilt under them.
      const list = document.getElementById('auc-answer-list');
      if (list) list.innerHTML = answerList(d, { newestFirst: mine });
      const count = document.getElementById('auc-valid-count');
      if (count) count.innerHTML = `<b>${formatNum(validCount(d))}</b> / ${formatNum(d.winningBid || 0)}`;
      return;
    }
    answerRenderKey = key;

    box.innerHTML = `
      <div class="auc-stage">
        ${head(d, `<span class="auc-score">${formatNum(myScore(d))}</span>`)}
        ${lotCard(d)}
        <div class="auc-target">
          <div>
            <div class="auc-target-count" id="auc-valid-count"><b>${formatNum(validCount(d))}</b> / ${formatNum(d.winningBid || 0)}</div>
            <div class="auc-target-label">${t('Valid answers', 'إجابات صحيحة')}</div>
          </div>
        </div>
        ${timerRow()}
        ${mine
          ? `
            <input class="auc-answer-input" id="auc-answer" type="text" maxlength="60" autocomplete="off"
                   placeholder="${t('Type one, press enter…', 'اكتب إجابة ثم اضغط إدخال…')}">
            <button type="button" class="auc-btn" id="auc-done">${t('I\\u2019m done', 'انتهيت')}</button>`
          : `<div class="auc-turn-banner">${esc(
              t(`${nameOf(d.winnerUserId, false)} is answering.`, `${nameOf(d.winnerUserId, false)} يجيب الآن.`)
            )}</div>`}
        <div id="auc-answer-list">${answerList(d, { newestFirst: mine })}</div>
      </div>`;

    if (mine) {
      const input = document.getElementById('auc-answer');
      const commit = () => {
        const text = (input.value || '').trim();
        if (!text) return;
        input.value = '';
        window.BahjahSoundFx.tick();
        send({ type: 'answer', text });
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
      });
      input.focus();
      document.getElementById('auc-done').addEventListener('click', () => {
        send({ type: 'finishAnswering' });
      });
    }
    startTimer(d.phaseEndsAt);
  }

  function renderJudging(d) {
    window.BahjahTimerBar.stop('auction');
    const mine = Boolean(me && d.winnerUserId === me.id);
    box.innerHTML = `
      <div class="auc-stage">
        ${head(d, `<span class="auc-score">${formatNum(myScore(d))}</span>`)}
        ${lotCard(d)}
        <div class="auc-turn-banner">${
          mine
            ? t('The host is checking your list…', 'المضيف يراجع قائمتك…')
            : esc(t(`The host is checking ${nameOf(d.winnerUserId, false)}’s list…`, `المضيف يراجع قائمة ${nameOf(d.winnerUserId, false)}…`))
        }</div>
        ${targetRow(d, validCount(d))}
        ${answerList(d)}
      </div>`;
  }

  function renderResults(d) {
    window.BahjahTimerBar.stop('auction');
    const r = d.lastRound;
    const continued = (d.continueUserIds || []).includes(me ? me.id : '');
    const iWon = Boolean(r && me && r.winnerUserId === me.id);
    if (r && iWon) window.BahjahSoundFx[r.success ? 'correct' : 'wrong']();

    const headline = !r || !r.winnerUserId
      ? t('No sale.', 'لم تُبع.')
      : r.success
        ? iWon ? t('You made it.', 'حققتها.') : t('Bid made.', 'تحققت المزايدة.')
        : iWon ? t('You fell short.', 'لم تكملها.') : t('Bid failed.', 'فشلت المزايدة.');
    const detail = !r || !r.winnerUserId
      ? t('Nobody bid on this lot.', 'لم يزايد أحد على هذه القطعة.')
      : t(
          `${nameOf(r.winnerUserId)} bid ${r.bid} and found ${r.validCount}.`,
          `${nameOf(r.winnerUserId)} زايد بـ ${r.bid} ووجد ${r.validCount}.`
        );

    box.innerHTML = `
      <div class="auc-stage">
        ${head(d, `<span class="auc-score">${formatNum(myScore(d))}</span>`)}
        <div class="auc-verdict ${r && r.success ? 'is-made' : 'is-failed'}">
          <span class="auc-verdict-badge" aria-hidden="true">${r && r.success ? '✓' : '✕'}</span>
          <div class="auc-verdict-copy">
            <h2>${esc(headline)}</h2>
            <p>${esc(detail)}</p>
          </div>
          ${r && r.winnerUserId ? `<div class="auc-verdict-pts"><b>+${formatNum(r.awarded)}</b><span>${t('Points', 'نقطة')}</span></div>` : ''}
        </div>
        ${answerList(d)}
        ${standings(d)}
        <button type="button" class="auc-btn ${continued ? '' : 'auc-btn--raise'}" id="auc-next" ${continued ? 'disabled' : ''}>
          ${continued ? t('Waiting for the others…', 'بانتظار البقية…') : t('Next lot', 'القطعة التالية')}
        </button>
      </div>`;

    const next = document.getElementById('auc-next');
    if (next) {
      next.addEventListener('click', () => {
        next.disabled = true;
        next.classList.remove('auc-btn--raise');
        next.textContent = t('Waiting for the others…', 'بانتظار البقية…');
        send({ type: 'continue' });
      });
    }
  }

  function standings(d) {
    const scores = d.scores || {};
    const rows = nonHostMembers()
      .map((m) => ({ userId: m.userId, displayName: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
    const top = rows.reduce((max, r) => Math.max(max, r.score), 0) || 1;
    return `
      <div class="auc-ranks">
        ${rows
          .map((row, i) => {
            const isMe = Boolean(me && row.userId === me.id);
            const pct = Math.max(4, Math.round((row.score / top) * 100));
            return `
              <div class="auc-rank ${isMe ? 'is-me' : ''}">
                <div class="auc-rank-line">
                  <span class="auc-rank-no">${i + 1}</span>
                  <span class="auc-rank-av">${esc((row.displayName || '?').trim().charAt(0).toUpperCase())}</span>
                  <span class="auc-rank-name">${esc(isMe ? t('You', 'أنت') : row.displayName)}</span>
                  <span class="auc-rank-total">${formatNum(row.score)}</span>
                </div>
                <div class="auc-rank-bar"><span style="width:${pct}%"></span></div>
              </div>`;
          })
          .join('')}
      </div>`;
  }

  function renderFinished(d) {
    window.BahjahTimerBar.stop('auction');
    clearInterval(window.__aucCountdown);
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
      <div class="auc-stage">
        <div class="auc-winner">
          <div class="auc-winner-label">${t('Winner', 'الفائز')}</div>
          <h2 class="auc-winner-name">${esc(winnerNames.length ? winnerNames.join(t(', ', '، ')) : t('No winner', 'لا فائز'))}</h2>
          <p class="auc-winner-sub">${rows[0] ? esc(t(`${formatNum(scores[rows[0].userId] || 0)} points`, `${formatNum(scores[rows[0].userId] || 0)} نقطة`)) : ''}</p>
        </div>

        ${stats
          ? `<div class="auc-awards">
              <div class="auc-award"><span class="auc-award-title">${t('Your score', 'نقاطك')}</span><span class="auc-award-name">${formatNum(scores[me.id] || 0)}</span><span class="auc-award-note">${esc(t(`Rank #${myRank}`, `المركز #${myRank}`))}</span></div>
              <div class="auc-award"><span class="auc-award-title">${t('Auctions made', 'مزادات محققة')}</span><span class="auc-award-name">${formatNum(stats.successfulAuctions)}</span><span class="auc-award-note">${esc(t(`of ${stats.auctionsWon} won`, `من ${formatNum(stats.auctionsWon)} فُزت بها`))}</span></div>
              <div class="auc-award"><span class="auc-award-title">${t('Biggest bid made', 'أكبر مزايدة محققة')}</span><span class="auc-award-name">${stats.highestSuccessfulBid ? formatNum(stats.highestSuccessfulBid) : '—'}</span><span class="auc-award-note">${t('answers', 'إجابة')}</span></div>
            </div>`
          : ''}

        ${standings(d)}

        <div class="auc-actions">
          <a class="is-primary" href="auction.html">${t('Play again', 'العب مرة أخرى')}</a>
          <button type="button" id="auc-share">${t('Share result', 'شارك النتيجة')}</button>
        </div>
        <p class="auc-foot">${t('Waiting for the host to start a new game…', 'بانتظار أن يبدأ المضيف لعبة جديدة…')}</p>
      </div>`;

    const shareBtn = document.getElementById('auc-share');
    if (shareBtn) shareBtn.addEventListener('click', () => shareResult(scores, myRank, stats));
  }

  function shareResult(scores, myRank, stats) {
    const lang = LANG();
    const score = me ? scores[me.id] || 0 : 0;
    const won = myRank === 1;
    const shareBtn = document.getElementById('auc-share');
    const url = `${location.origin}/bahjah-landing.html`;
    const headline = lang === 'ar'
      ? won ? 'لعبت مزاد على بهجة وفزت!' : 'لعبت مزاد على بهجة!'
      : won ? 'I just played Auction on Bahjah and won!' : 'I just played Auction on Bahjah!';
    const subline = lang === 'ar' ? `مزاد · ${score} نقطة · المركز #${myRank}` : `Auction · ${score} pts · Rank #${myRank}`;
    const best = stats && stats.highestSuccessfulBid ? stats.highestSuccessfulBid : 0;
    const text = lang === 'ar'
      ? `${headline} سجّلت ${score} نقطة${best ? ` وأكبر مزايدة حققتها ${best}` : ''}. 🔨`
      : `${headline} Scored ${score} points${best ? `, biggest bid made: ${best}` : ''}. 🔨`;

    if (window.BahjahShareCard) {
      window.BahjahShareCard.share({ gameId: 'auction', lang, headline, subline, text, url, shareBtn });
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
    window.BahjahTimerBar.stop('auction');
    clearInterval(window.__aucCountdown);
    if (splash) splash.style.display = 'none';
    wrap.style.display = 'block';
    box.innerHTML = `
      <div class="auc-stage">
        <div class="auc-lot">
          <h2 class="auc-lot-name">${esc(t(`The host ended this game (code: ${code})`, `أنهى المضيف هذه اللعبة (الرمز: ${code})`))}</h2>
        </div>
        <div class="auc-actions">
          <a class="is-primary" href="bahjah-landing.html">${t('Back to Bahjah', 'العودة إلى بهجة')}</a>
        </div>
      </div>`;
  }
})();
