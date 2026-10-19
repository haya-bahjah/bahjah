// مزاد | Auction -- the player's phone. Driven by the 'bahjah:game-state'
// events assets/lobby.js dispatches, the same arrangement as the other games'
// phone scripts. The host never lands here: lobby-room.js keeps them on
// auction-lobby.html's console, where they run the room and rule on answers.
//
// Every phase is one full screen on its own ground colour (the design's
// "read the state from across the room"): join orange, lobby oxblood, reveal
// brick, bidding orange, holding the bid oxblood, sold brick, answers orange,
// result orange or brick, standings oxblood, final orange, share ink.
(function () {
  const U = window.AucUI;
  const { t, esc, num } = U;
  const splash = document.getElementById('auc-splash');
  const wrap = document.getElementById('auc-live');
  const box = document.getElementById('auc-play-box');
  if (!wrap || !box) return;

  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();
  const myId = me ? me.id : '';

  let latestRoom = null;
  let latestState = null;
  let roomEnded = false;
  // The bidding sheet carries a number the player is adjusting and the
  // answer screen carries a box they are typing in, so neither may be
  // rebuilt underneath them on a state tick. Both are drawn once and patched.
  let renderKey = null;
  let stagedBid = null;
  let shareOpen = false;
  let errorListenerAttached = false;
  let lastPhase = null;

  function players() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }
  function seatIndex(userId, d) {
    const order = (d && d.order) || players().map((m) => m.userId);
    return Math.max(0, order.indexOf(userId));
  }
  function nameOf(userId, opts) {
    if (!(opts && opts.real) && userId === myId) return t('You', 'أنت');
    const member = players().find((m) => m.userId === userId);
    return member ? member.displayName : t('Player', 'لاعب');
  }
  function paddleOf(userId, d, opts) {
    return U.paddle(nameOf(userId, { real: true }), seatIndex(userId, d), Object.assign({ isMe: userId === myId }, opts || {}));
  }
  const cat = (d) => U.category(d.currentCategory, U.gameLang(d));
  const lotNo = (d) => `${num(String(d.roundIndex + 1).padStart(2, '0'))} / ${num(String(d.totalRounds).padStart(2, '0'))}`;

  // Everyone sorted by score, for "You · 2nd · 14" and the standings.
  function ranked(d) {
    const scores = (d && d.scores) || {};
    return players()
      .map((m) => ({ userId: m.userId, name: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || seatIndex(a.userId, d) - seatIndex(b.userId, d));
  }
  function youChip(d) {
    const rows = ranked(d);
    const i = rows.findIndex((r) => r.userId === myId);
    if (i < 0) return '';
    return `<span class="auc-top-r">${esc(t(`You · ${U.ordinal(i + 1)} · ${rows[i].score}`, `أنت · ${U.ordinal(i + 1)} · ${num(rows[i].score)}`))}</span>`;
  }

  function screen(ground, inner, extra) {
    return `<div class="auc-screen auc-ground g-${ground}" ${extra || ''}><div class="auc-phone">${inner}</div></div>`;
  }

  // ---- Wiring --------------------------------------------------------------
  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
    if (e.detail.status === 'lobby') {
      window.location.href = `auction-lobby.html?code=${encodeURIComponent(code)}`;
      return;
    }
    if (e.detail.status === 'ended' && !roomEnded) {
      roomEnded = true;
      renderEnded();
      return;
    }
    if (latestState && !roomEnded) {
      renderKey = null;
      render(latestState);
    }
  });

  document.addEventListener('bahjah:game-state', (e) => {
    if (roomEnded) return;
    const state = e.detail;
    if (state.gameType !== 'auction') return;
    latestState = state;
    attachErrorListenerOnce();
    if (U.adoptGameLang(state.data)) return;
    render(state);
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (roomEnded) return renderEnded();
    renderKey = null;
    if (latestState) render(latestState);
  });

  function attachErrorListenerOnce() {
    if (errorListenerAttached) return;
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    errorListenerAttached = true;
    socket.on('room:error', (err) => {
      const hint = document.getElementById('auc-hint');
      if (hint) {
        hint.textContent = err.message;
        hint.setAttribute('data-tone', 'error');
      }
      // A refused bid leaves the controls live so the number can be fixed and
      // sent again -- it is still this player's turn.
      document.querySelectorAll('#auc-raise, #auc-pass').forEach((b) => (b.disabled = false));
    });
  }

  function send(action) {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (socket) socket.emit('game:action', { action });
  }

  const live = U.live;

  function render(state) {
    if (splash) splash.style.display = 'none';
    wrap.style.display = 'block';
    const d = state.data || {};
    const phase = state.phase;
    if (phase !== lastPhase) {
      shareOpen = false;
      lastPhase = phase;
    }

    if (phase === 'reveal') return renderReveal(d);
    if (phase === 'bidding') return renderBidding(d);
    if (phase === 'sold') return renderSold(d);
    if (phase === 'answering') return renderAnswering(d);
    if (phase === 'judging') return renderReviewing(d);
    if (phase === 'results') return renderResult(d);
    if (phase === 'standings') return renderStandings(d);
    if (phase === 'finished') return shareOpen ? renderShare(d) : renderFinal(d);
  }

  function setBox(key, html) {
    if (key && key === renderKey) return false;
    renderKey = key;
    box.innerHTML = html;
    wrap.scrollTop = 0;
    return true;
  }

  // ---- 04 Category reveal --------------------------------------------------
  function renderReveal(d) {
    const opener = d.openerUserId;
    const mine = opener === myId;
    setBox(`reveal|${d.roundIndex}|${U.lang()}`, screen('brick', `
      <div class="auc-top"><span class="auc-label">${t('Lot', 'الجولة')} ${lotNo(d)}</span>${youChip(d)}</div>
      <span class="auc-label" style="margin-top:12px;">${t('Up for auction', 'معروض للمزاد')}</span>
      <h1 class="auc-display auc-reveal-word">${esc(cat(d))}</h1>
      <div class="auc-push">
        <div style="display:flex; justify-content:center; padding-block:20px 8px;">${U.figure('y')}</div>
        ${opener ? `
        <div class="auc-opener">
          ${paddleOf(opener, d, { size: 40 })}
          <div><b>${esc(mine ? t('You open the bidding', 'أنت تفتح المزاد') : t(`${nameOf(opener)} opens the bidding`, `${nameOf(opener)} يفتح المزاد`))}</b>
          <span>${t('The first bidder rotates every lot', 'أول مزايد يتغير كل جولة')}</span></div>
        </div>` : ''}
      </div>`));
    window.BahjahSoundFx.tick();
  }

  // ---- 05 Bidding / 06 Holding the bid -------------------------------------
  function bidTrail(d) {
    const bids = (d.bids || []).slice(-4);
    if (!bids.length) return '';
    return `<div class="auc-trail">${bids
      .map((b, i) => `${i ? '<span class="arr auc-flip">→</span>' : ''}<span class="auc-tag ${i === bids.length - 1 ? 'is-top' : ''}">${esc(nameOf(b.userId))} ${num(b.amount)}</span>`)
      .join('')}</div>`;
  }
  function passedLine(d) {
    const passed = d.passedBidders || [];
    if (!passed.length) return '';
    return `<p class="auc-passed">${t('Passed:', 'مرّروا:')} ${passed.map((id) => `<s>${esc(nameOf(id))}</s>`).join(' · ')}</p>`;
  }
  function dropBanner(d) {
    const dropped = d.droppedBidders || [];
    if (!dropped.length) return '';
    const who = nameOf(dropped[dropped.length - 1], { real: true });
    return `<div class="auc-banner">${U.paddle(who, 0, { cls: 'is-offline', size: 34 })}<span><b>${esc(t(`${who} lost connection.`, `انقطع اتصال ${who}.`))}</b> ${t('Skipped for the rest of this lot.', 'بيتم تخطيه لبقية هذي الجولة.')}</span></div>`;
  }
  function categoryTop(d, right) {
    return `<div class="auc-top"><span class="auc-pill">${esc(cat(d))}</span><span class="auc-top-r">${right || ''}</span></div>`;
  }
  function lotYou(d) {
    const rows = ranked(d);
    const i = rows.findIndex((r) => r.userId === myId);
    const lot = t(`Lot ${d.roundIndex + 1}/${d.totalRounds}`, `الجولة ${num(d.roundIndex + 1)}/${num(d.totalRounds)}`);
    return i < 0 ? lot : `${lot} · ${t(`You ${U.ordinal(i + 1)}`, `أنت ${U.ordinal(i + 1)}`)}`;
  }

  function renderBidding(d) {
    const top = d.currentBid ? d.currentBid.userId : null;
    if (top && top === myId) return renderHolding(d);

    const myTurn = d.turnUserId === myId;
    const amIn = (d.activeBidders || []).includes(myId);
    const minBid = d.minBid || 3;
    // Redraw only when something the player can act on changes -- their turn,
    // the standing bid, who is left, the language.
    const key = ['bid', d.roundIndex, d.turnUserId, top, d.currentBid ? d.currentBid.amount : 0, (d.activeBidders || []).join(','), (d.droppedBidders || []).join(','), U.lang()].join('|');
    if (key === renderKey) return;
    if (myTurn && !renderKey?.startsWith(`bid|${d.roundIndex}|${myId}|`)) window.BahjahSoundFx.tick();
    stagedBid = minBid;

    const hero = d.currentBid
      ? `<div class="auc-bidhero">
          <span class="auc-num auc-mega">${num(d.currentBid.amount)}</span>
          <span class="auc-bidhero-who">${paddleOf(top, d, { handle: true, size: 40 })}${esc(nameOf(top))}</span>
        </div>`
      : `<div class="auc-bidhero"><span class="auc-num auc-mega" style="opacity:.35;">—</span></div>
         <p class="auc-passed">${esc(d.turnUserId === myId ? t('No bid yet. You open.', 'ما فيه مزايدة. أنت تفتح.') : t(`No bid yet. ${nameOf(d.turnUserId)} opens.`, `ما فيه مزايدة. ${nameOf(d.turnUserId)} يفتح.`))}</p>`;

    let bottom;
    if (myTurn) {
      const opener = !d.currentBid;
      bottom = `
        <div class="auc-sheet auc-ground g-cream">
          <div class="auc-turnbar"><i ${live(d.phaseEndsAt, 'bar', d.turnSeconds || 15)}></i></div>
          <h2 class="auc-display auc-sheet-title">${opener ? t('Your turn. I can do that…', 'دورك. أقدر عليها…') : t('Your turn. I can do more…', 'دورك. أقدر أكثر…')}</h2>
          <div class="auc-stepper">
            <button type="button" class="auc-step" id="auc-minus" aria-label="${t('Lower', 'أقل')}">−</button>
            <span class="auc-num" id="auc-amount">${num(minBid)}</span>
            <button type="button" class="auc-step auc-step--fill" id="auc-plus" aria-label="${t('Higher', 'أكثر')}">+</button>
          </div>
          <div class="auc-quick">${[1, 3, 5].map((n) => `<button type="button" data-quick="${n}">+${num(n)}</button>`).join('')}</div>
          <div class="${opener ? '' : 'auc-bidrow'}">
            ${opener ? '' : `<button type="button" class="auc-btn auc-btn--cream2" id="auc-pass">${t('Pass', 'تمرير')}</button>`}
            <button type="button" class="auc-btn ${opener ? 'auc-btn--block' : ''}" id="auc-raise"></button>
          </div>
          <span class="auc-hint" id="auc-hint">${opener ? esc(t(`Open at ${minBid} or more. You'll have to name that many.`, `افتح بـ ${num(minBid)} أو أكثر. وعليك تذكرها كلها.`)) : ''}</span>
        </div>`;
    } else if (amIn) {
      bottom = `<div class="auc-push">
          <p class="auc-note">${esc(t(`Waiting on ${nameOf(d.turnUserId)}`, `بانتظار ${nameOf(d.turnUserId)}`))} · <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}</p>
          <div class="auc-turnbar" style="background:rgba(0,0,0,.15)"><i style="background:var(--auc-ink)" ${live(d.phaseEndsAt, 'bar', d.turnSeconds || 15)}></i></div>
        </div>`;
    } else {
      bottom = `<div class="auc-push"><p class="auc-note">${(d.droppedBidders || []).includes(myId)
        ? t('You were offline, so you sit this lot out. You are back in from the next one.', 'كنت غير متصل، فتابع هذي الجولة. ترجع معنا من الجولة الجاية.')
        : t('You passed. Watch the room.', 'مرّرت. تابع المزاد.')}</p></div>`;
    }

    setBox(key, screen('orange', `
      ${dropBanner(d)}
      ${categoryTop(d, esc(lotYou(d)))}
      <span class="auc-label">${t('Highest bid', 'أعلى مزايدة')}</span>
      ${hero}
      ${bidTrail(d)}
      ${passedLine(d)}
      ${bottom}`));

    if (!myTurn) return;
    const amountEl = document.getElementById('auc-amount');
    const raise = document.getElementById('auc-raise');
    const minus = document.getElementById('auc-minus');
    const paint = () => {
      amountEl.textContent = num(stagedBid);
      raise.textContent = d.currentBid ? t(`Raise to ${stagedBid}`, `زايد إلى ${num(stagedBid)}`) : t(`Open at ${stagedBid}`, `افتح بـ ${num(stagedBid)}`);
      minus.disabled = stagedBid <= minBid;
    };
    paint();
    minus.addEventListener('click', () => { stagedBid = Math.max(minBid, stagedBid - 1); paint(); window.BahjahSoundFx.tick(); });
    document.getElementById('auc-plus').addEventListener('click', () => { stagedBid += 1; paint(); window.BahjahSoundFx.tick(); });
    box.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => {
      const base = d.currentBid ? d.currentBid.amount : minBid - 1;
      stagedBid = Math.max(minBid, base + Number(b.dataset.quick));
      paint();
      window.BahjahSoundFx.tick();
    }));
    raise.addEventListener('click', () => {
      if (stagedBid < minBid) return;
      raise.disabled = true;
      const pass = document.getElementById('auc-pass');
      if (pass) pass.disabled = true;
      window.BahjahSoundFx.submit();
      send({ type: 'bid', amount: stagedBid });
    });
    const passBtn = document.getElementById('auc-pass');
    if (passBtn) passBtn.addEventListener('click', () => {
      passBtn.disabled = true;
      raise.disabled = true;
      send({ type: 'pass' });
    });
  }

  function renderHolding(d) {
    const key = ['hold', d.roundIndex, d.turnUserId, d.currentBid.amount, (d.passedBidders || []).join(','), (d.droppedBidders || []).join(','), U.lang()].join('|');
    if (key === renderKey) return;
    const passed = new Set(d.passedBidders || []);
    const dropped = new Set(d.droppedBidders || []);
    const others = (d.order || []).filter((id) => id !== myId && ((d.activeBidders || []).includes(id) || passed.has(id) || dropped.has(id)));
    const rows = others.map((id) => {
      if (id === d.turnUserId) return `<div class="is-live"><span>${esc(nameOf(id))}</span><span>${t('deciding', 'يفكّر')} · <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}</span></div>`;
      if (dropped.has(id)) return `<div class="is-done"><span>${esc(nameOf(id))}</span><span>${t('offline', 'غير متصل')}</span></div>`;
      if (passed.has(id)) return `<div class="is-done"><span>${esc(nameOf(id))}</span><span>${t('passed ✓', 'مرّر ✓')}</span></div>`;
      return `<div><span>${esc(nameOf(id))}</span><span>${t('waiting', 'بالانتظار')}</span></div>`;
    }).join('');
    setBox(key, screen('oxblood', `
      <div class="auc-eyes">${'<img src="assets/auction/eye.svg" alt="">'.repeat(7)}</div>
      <div class="auc-top" style="position:absolute; inset-inline:20px; top:20px; z-index:2;"><span class="auc-pill auc-pill--cream">${esc(cat(d))}</span><span class="auc-top-r">${t(`Lot ${d.roundIndex + 1}/${d.totalRounds}`, `الجولة ${num(d.roundIndex + 1)}/${num(d.totalRounds)}`)}</span></div>
      <div style="display:flex; justify-content:center;">${U.figure('y')}</div>
      <h2 class="auc-display auc-title" style="text-align:center;">${t('Are you sure?', 'متأكد؟')}</h2>
      <p class="auc-note" style="font-weight:500;">${t('You hold the bid at', 'المزايدة عندك على')} <b class="auc-mustard">${num(d.currentBid.amount)}</b></p>
      <div class="auc-panel auc-status">${rows}</div>
      <div class="auc-push"><div class="auc-blocked" role="note">${t("You can't raise your own bid", 'ما تقدر تزايد على نفسك')}</div></div>`, 'style="position:relative"'));
  }

  // ---- 07 Sold -------------------------------------------------------------
  function renderSold(d) {
    const winner = d.winnerUserId;
    const iWon = winner === myId;
    const key = `sold|${d.roundIndex}|${U.lang()}`;
    if (!setBox(key, screen('brick', winner ? `
      <div class="auc-top"><span class="auc-label">${t('Everyone passed', 'الكل مرّر')}</span></div>
      <div class="auc-sold-mark">${U.mark('cream', 'is-striking')}</div>
      <h1 class="auc-display auc-sold-word">${t('Sold!', 'بيع!')}</h1>
      <p class="auc-sold-line">${iWon
        ? esc(t(`You owe ${d.winningBid} ${cat(d).toLowerCase()} in ${d.answerSeconds} seconds`, `عليك ${num(d.winningBid)} من «${cat(d)}» خلال ${num(d.answerSeconds)} ثانية`))
        : `<b>${esc(nameOf(winner))}</b> ${esc(t(`owes ${d.winningBid} ${cat(d).toLowerCase()} in ${d.answerSeconds} seconds`, `عليه ${num(d.winningBid)} من «${cat(d)}» خلال ${num(d.answerSeconds)} ثانية`))}`}</p>
      <div class="auc-push"><div class="auc-goline"><span class="auc-display">${t('Now prove it', 'الحين أثبتها')}</span><span class="auc-count auc-num" ${live(d.phaseEndsAt, 'secs')}>${num(3)}</span></div></div>` : `
      <div class="auc-top"><span class="auc-label">${t('No bids', 'ما أحد زايد')}</span></div>
      <div class="auc-sold-mark">${U.mark('cream')}</div>
      <h1 class="auc-display auc-sold-word" style="font-size:96px;">${t('No sale', 'ما انباعت')}</h1>
      <p class="auc-sold-line">${t('Nobody opened the bidding, so this lot goes unsold.', 'ما أحد فتح المزاد، فالجولة ما انباعت.')}</p>`))) return;
    if (winner) window.BahjahSoundFx[iWon ? 'correct' : 'submit']();
  }

  // ---- 08 Answers ----------------------------------------------------------
  function validCount(d) {
    return (d.answers || []).filter((a) => !a.duplicate && !a.rejected).length;
  }
  function answerChips(d, opts) {
    return (d.answers || []).map((a, i) => {
      const fresh = opts && opts.freshFrom != null && i >= opts.freshFrom ? ' is-new' : '';
      if (a.duplicate) return `<span class="auc-ans is-dupe${fresh}"><s>${esc(a.text)}</s> · ${t('already counted', 'محسوبة')}</span>`;
      if (a.rejected) return `<span class="auc-ans is-rejected${fresh}">${esc(a.text)}</span>`;
      return `<span class="auc-ans${fresh}">${esc(a.text)}</span>`;
    }).join('');
  }
  function segs(d) {
    const target = d.winningBid || 0;
    const valid = validCount(d);
    if (target > 60) return '';
    return Array.from({ length: target }, (_, i) => `<i class="${i < valid ? 'is-on' : ''}"></i>`).join('');
  }
  let shownAnswers = 0;

  function renderAnswering(d) {
    const mine = d.winnerUserId === myId;
    const key = `ans|${d.roundIndex}|${mine}|${U.lang()}`;
    if (key === renderKey) {
      // Same sprint, already on screen: patch the list and the counter so the
      // box the winner is typing into is never rebuilt under them.
      const list = document.getElementById('auc-ans-list');
      if (list) list.innerHTML = answerChips(d, { freshFrom: shownAnswers });
      shownAnswers = (d.answers || []).length;
      const count = document.getElementById('auc-valid');
      if (count) count.textContent = num(validCount(d));
      const bar = document.getElementById('auc-segs');
      if (bar) bar.innerHTML = segs(d);
      return;
    }
    shownAnswers = (d.answers || []).length;
    setBox(key, screen('orange', `
      ${categoryTop(d, esc(t(`Target ${d.winningBid}`, `الهدف ${num(d.winningBid)}`)))}
      ${mine ? '' : `<p class="auc-note" style="text-align:start;">${esc(t(`${nameOf(d.winnerUserId)} is proving it…`, `${nameOf(d.winnerUserId)} يثبتها الحين…`))}</p>`}
      <div class="auc-ans-head">
        <span class="auc-num timer" ${live(d.phaseEndsAt, 'clock')}>${U.clock(U.secsLeft(d.phaseEndsAt))}</span>
        <span class="count"><span class="auc-num" id="auc-valid">${num(validCount(d))}</span><small>/${num(d.winningBid)}</small><br><span class="auc-label">${t('Valid', 'صحيحة')}</span></span>
      </div>
      <div class="auc-segs" id="auc-segs">${segs(d)}</div>
      <div class="auc-ans-list" id="auc-ans-list">${answerChips(d)}</div>
      ${mine ? `
      <div class="auc-push">
        <form class="auc-typebar" id="auc-type" autocomplete="off">
          <input class="auc-input" id="auc-answer" type="text" maxlength="60" enterkeyhint="send" autocapitalize="words"
                 placeholder="${t('Type one, press enter…', 'اكتب وحدة واضغط إدخال…')}" aria-label="${t('Answer', 'إجابة')}">
          <button type="submit" aria-label="${t('Submit', 'إرسال')}"><span class="auc-flip">↵</span></button>
        </form>
        <button type="button" class="auc-link" id="auc-done" style="align-self:center;">${t("I'm done", 'خلصت')}</button>
      </div>` : ''}`));

    if (!mine) return;
    const input = document.getElementById('auc-answer');
    document.getElementById('auc-type').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = (input.value || '').trim();
      if (!text) return;
      input.value = '';
      input.focus();
      window.BahjahSoundFx.tick();
      send({ type: 'answer', text });
    });
    document.getElementById('auc-done').addEventListener('click', () => send({ type: 'finishAnswering' }));
    input.focus();
  }

  // ---- 09 Host is reviewing ------------------------------------------------
  function renderReviewing(d) {
    setBox(`review|${d.roundIndex}|${(d.answers || []).map((a) => (a.rejected ? 1 : 0)).join('')}|${U.lang()}`, screen('oxblood', `
      <div class="auc-eyes">${'<img src="assets/auction/eye.svg" alt="">'.repeat(7)}</div>
      <h2 class="auc-display auc-title" style="text-align:center;">${t('Host is reviewing…', 'المضيف يراجع…')}</h2>
      <p class="auc-note" style="font-weight:500;">${esc(d.winnerUserId === myId
        ? t(`Your ${validCount(d)} answers are with the host.`, `إجاباتك (${num(validCount(d))}) عند المضيف.`)
        : t(`${nameOf(d.winnerUserId)} has ${validCount(d)} of ${d.winningBid}. The host makes the call.`, `${nameOf(d.winnerUserId)} عنده ${num(validCount(d))} من ${num(d.winningBid)}. والقرار للمضيف.`))}</p>
      <div class="auc-ans-list" style="justify-content:center;">${answerChips(d)}</div>`));
  }

  // ---- 10 Round result -----------------------------------------------------
  // Ranks with ▲▼: where everyone stood before this lot's points went on.
  function movement(d) {
    const r = d.lastRound;
    const before = Object.assign({}, d.scores || {});
    if (r && r.winnerUserId && r.awarded) before[r.winnerUserId] = (before[r.winnerUserId] || 0) - r.awarded;
    const prev = ranked({ scores: before, order: d.order }).map((x) => x.userId);
    return (userId, now) => {
      const was = prev.indexOf(userId);
      if (was < 0 || was === now) return '';
      return `<span class="mv">${was > now ? '▲' : '▼'}</span>`;
    };
  }
  function rankCard(d, limit) {
    const rows = ranked(d).slice(0, limit || 99);
    const mv = movement(d);
    return `<div class="auc-ranks">${rows.map((r, i) => `<div class="${r.userId === myId ? 'is-me' : ''}"><span>${num(i + 1)} · ${esc(r.userId === myId ? t('You', 'أنت') : r.name)}${mv(r.userId, i)}</span><span>${num(r.score)}</span></div>`).join('')}</div>`;
  }
  function nextLine(d) {
    const last = d.roundIndex + 1 >= d.totalRounds;
    if (last) return `${t('Final results in', 'النتائج النهائية بعد')} <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}`;
    const opener = d.nextOpenerUserId;
    return `${t(`Lot ${d.roundIndex + 2} in`, `الجولة ${num(d.roundIndex + 2)} بعد`)} <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}${opener ? ` · ${esc(opener === myId ? t('you open', 'أنت تفتح') : t(`${nameOf(opener)} opens`, `${nameOf(opener)} يفتح`))}` : ''}`;
  }

  function renderResult(d) {
    const r = d.lastRound || {};
    const key = `res|${d.roundIndex}|${U.lang()}`;
    if (key === renderKey) return;
    const catName = U.gameLang(d) === 'ar' ? r.categoryNameAr || r.categoryName : r.categoryName;
    const head = `<div class="auc-top"><span class="auc-label">${t('Lot', 'الجولة')} ${num(String(d.roundIndex + 1).padStart(2, '0'))} · ${esc(catName)}</span><span class="auc-top-r">${
      !r.winnerUserId ? t('Unsold', 'ما انباعت') : r.success ? t('Delivered', 'تم الإنجاز') : t('Short', 'ما اكتملت')}</span></div>`;
    const who = r.winnerUserId ? nameOf(r.winnerUserId) : '';
    const iWon = r.winnerUserId === myId;
    let html;

    if (!r.winnerUserId) {
      html = screen('brick', `${head}
        <div style="margin-top:auto;">${U.block()}</div>
        <h1 class="auc-display auc-title" style="text-align:center;">${t('No sale.', 'ما انباعت.')}</h1>
        <p class="auc-note" style="font-weight:500;">${t('Nobody bid on this lot, so nobody scores.', 'ما أحد زايد على هذي الجولة، فما أحد ياخذ نقاط.')}</p>
        <div class="auc-push">${rankCard(d, 3)}<p class="auc-note">${nextLine(d)}</p></div>`);
    } else if (r.dropped) {
      html = screen('brick', `${head}
        <div style="margin-top:auto; padding-inline:16px;">${U.block()}</div>
        <h1 class="auc-display auc-title" style="text-align:center;">${esc(t(`${nameOf(r.winnerUserId, { real: true })} left the stand`, `${nameOf(r.winnerUserId, { real: true })} غادر المنصة`))}</h1>
        <p class="auc-note" style="font-weight:500;">${t('Disconnected while answering. The lot fails and nobody scores.', 'انقطع الاتصال أثناء الإجابة. الجولة تفشل وما أحد ياخذ نقاط.')}</p>
        <div class="auc-push"><div class="auc-panel" style="display:flex; justify-content:space-between; align-items:center; font-weight:700;"><span>${nextLine(d)}</span></div></div>`);
    } else {
      const left = r.secondsLeft || 0;
      html = screen(r.success ? 'orange' : 'brick', `${head}
        <div style="position:relative; display:flex; align-items:flex-end; justify-content:center;">
          <span class="auc-num auc-points">${r.success ? `+${num(r.awarded)}` : num(0)}</span>
          ${U.figure(r.success ? 'raised' : 'still', r.success ? '' : 'is-turned')}
        </div>
        <h2 class="auc-display" style="font-size:40px;">${esc(r.success
          ? (iWon ? t('You proved it.', 'أثبتها!') : t(`${who} proved it.`, `${who} أثبتها.`))
          : (iWon ? t('You fell short.', 'ما كمّلتها.') : t(`${who} fell short.`, `${who} ما كمّلها.`)))}</h2>
        ${r.success ? '' : `<p class="auc-note" style="text-align:start;">${esc(t(`${r.validCount}/${r.bid} · 0 points`, `${num(r.validCount)}/${num(r.bid)} · ٠ نقاط`))}</p>`}
        <div class="auc-stats">
          <div class="auc-stat"><span class="auc-label">${t('Bid', 'المزايدة')}</span><span class="auc-num">${num(r.bid)}</span></div>
          <div class="auc-stat"><span class="auc-label">${t('Valid', 'صحيحة')}</span><span class="auc-num">${num(r.validCount)}</span></div>
          <div class="auc-stat"><span class="auc-label">${t('Left', 'المتبقي')}</span><span class="auc-num">${U.clock(left)}</span></div>
        </div>
        ${rankCard(d, 3)}
        <div class="auc-push"><p class="auc-note">${nextLine(d)}</p></div>`);
      if (iWon) window.BahjahSoundFx[r.success ? 'correct' : 'wrong']();
    }
    setBox(key, html);
  }

  // ---- 11 Standings --------------------------------------------------------
  function renderStandings(d) {
    const rows = ranked(d);
    const lead = rows[0];
    const top = Math.max(1, ...rows.map((r) => r.score));
    setBox(`stand|${d.roundIndex}|${U.lang()}`, screen('oxblood', `
      <div class="auc-top"><span class="auc-label">${t('Standings · after lot', 'الترتيب · بعد الجولة')} ${num(d.roundIndex + 1)}/${num(d.totalRounds)}</span></div>
      ${lead ? `<div class="auc-lead"><span class="auc-num">${num(lead.score)}</span><span><b class="auc-display">${esc(lead.score > 0 ? (lead.userId === myId ? t('You', 'أنت') : lead.name) : t('All square', 'متعادلين'))}</b>${lead.score > 0 ? `<span style="font-size:14px; font-weight:600;">${t('in the lead', 'في الصدارة')}</span>` : ''}</span></div>` : ''}
      <div class="auc-bars">${rows.map((r) => `
        <div class="auc-bar ${r.userId === myId ? 'is-me' : ''}">
          ${U.paddle(r.name, seatIndex(r.userId, d), { isMe: r.userId === myId, size: 36, colour: r.userId === myId ? null : ['var(--auc-cream)', 'var(--auc-ink)'] })}
          <span class="track"><i class="${r.score ? '' : 'is-zero'}" style="width:${Math.round((r.score / top) * 100)}%"></i></span>
          <b>${num(r.score)}</b>
        </div>`).join('')}</div>
      <div class="auc-push"><p class="auc-note auc-mustard">${t('The higher the bid, the bigger the swing.', 'كل ما كبرت المزايدة، كبر الفرق.')}</p>
      <p class="auc-note" style="font-weight:500;">${t(`Lot ${d.roundIndex + 2} in`, `الجولة ${num(d.roundIndex + 2)} بعد`)} <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}</p></div>`));
  }

  // ---- 12 Final ------------------------------------------------------------
  function finalFacts(d) {
    const stats = d.finalStats || {};
    const rows = ranked(d);
    const winners = new Set(d.winnerUserIds || []);
    const winnerRows = rows.filter((r) => winners.has(r.userId));
    const lead = winnerRows[0] || rows[0];
    const s = (lead && stats[lead.userId]) || {};
    const highest = Math.max(0, ...Object.values(stats).map((x) => x.highestSuccessfulBid || 0));
    return { rows, winnerRows, lead, s, highest };
  }

  function renderFinal(d) {
    const { rows, winnerRows, lead, s, highest } = finalFacts(d);
    const key = `final|${U.lang()}`;
    const names = winnerRows.map((r) => (r.userId === myId ? t('You', 'أنت') : r.name)).join(t(' & ', ' و'));
    const title = winnerRows.length
      ? (winnerRows.length === 1 && winnerRows[0].userId === myId
        ? t(`You win · ${lead.score}`, `فزت · ${num(lead.score)} نقطة`)
        : t(`${names} ${winnerRows.length > 1 ? 'win' : 'wins'} · ${lead.score}`, `${names} ${winnerRows.length > 1 ? 'يفوزون' : 'يفوز'} · ${num(lead.score)} نقطة`))
      : t('No winner', 'ما فيه فائز');
    if (!setBox(key, screen('orange', `
      <div class="auc-top"><span class="auc-label">${t('Final', 'النهائي')} · ${esc(t(`${d.totalRounds} lots`, `${num(d.totalRounds)} جولات`))}</span></div>
      <img class="auc-keyart" src="assets/auction/keyart.svg" alt="">
      <h1 class="auc-display auc-final-title">${esc(title)}</h1>
      ${winnerRows.length ? `<div class="auc-final-facts">
        <span>${esc(t(`${s.successfulAuctions || 0} of ${s.auctionsWon || 0} auctions delivered`, `${num(s.successfulAuctions || 0)} من ${num(s.auctionsWon || 0)} مزادات تم إنجازها`))}</span>
        <span>${esc(t(`Highest successful bid: ${highest}`, `أعلى مزايدة ناجحة: ${num(highest)}`))}</span>
      </div>` : ''}
      <div class="auc-ranks">${rows.map((r, i) => `<div class="${r.userId === myId ? 'is-me' : ''}"><span>${num(i + 1)} ${esc(r.userId === myId ? t('You', 'أنت') : r.name)}</span><span>${num(r.score)}</span></div>`).join('')}</div>
      <div class="auc-push">
        <div class="auc-bidrow" style="grid-template-columns:1.3fr 1fr;">
          <button type="button" class="auc-btn" id="auc-share">${t('Share result', 'شارك النتيجة')}</button>
          <a class="auc-btn auc-btn--cream" href="auction.html">${t('Play again', 'العب مرة ثانية')}</a>
        </div>
        <p class="auc-note" style="font-weight:500;">${t('Or wait here: the host can start the next game.', 'أو انتظر هنا: المضيف يقدر يبدأ لعبة جديدة.')}</p>
      </div>`))) return;
    if (me && (d.winnerUserIds || []).includes(myId)) window.BahjahSoundFx.win();
    document.getElementById('auc-share').addEventListener('click', () => {
      shareOpen = true;
      renderKey = null;
      renderShare(d);
    });
  }

  // ---- 13 Share: the 9:16 story card --------------------------------------
  function myCardFacts(d) {
    const rows = ranked(d);
    const i = rows.findIndex((r) => r.userId === myId);
    const mine = rows[i] || { score: 0 };
    const stats = (d.finalStats || {})[myId] || {};
    const won = (d.winnerUserIds || []).includes(myId);
    return { rank: i + 1, score: mine.score, best: stats.highestSuccessfulBid || 0, beat: Math.max(0, rows.length - (i + 1)), won };
  }

  async function drawCard(d) {
    const f = myCardFacts(d);
    const ar = U.isAr();
    const W = 1080, H = 1920;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    await document.fonts.ready;
    x.fillStyle = '#A3302A';
    x.fillRect(0, 0, W, H);
    const img = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const display = (px) => (ar ? `${px}px Rakkas` : `900 ${px}px "Roboto Serif"`);
    x.textAlign = 'center';
    x.fillStyle = '#E8A33B';
    x.font = ar ? '700 40px "IBM Plex Sans Arabic"' : '800 34px Archivo';
    x.textAlign = ar ? 'right' : 'left';
    x.fillText(ar ? 'بهجة' : 'B A H J A H', ar ? W - 90 : 90, 150);
    x.fillStyle = '#F2E4CF';
    x.font = display(ar ? 90 : 80);
    x.textAlign = ar ? 'left' : 'right';
    if (!ar && 'fontStretch' in x) x.fontStretch = 'ultra-condensed';
    x.fillText(ar ? 'مزاد' : 'MAZAD', ar ? 90 : W - 90, 160);
    // The mark, drawn from the same SVG the phones use.
    const svg = new Blob([U.mark('cream').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" ')], { type: 'image/svg+xml' });
    const markImg = await img(URL.createObjectURL(svg));
    if (markImg) x.drawImage(markImg, 240, 330, 600, 600);
    x.textAlign = 'center';
    x.fillStyle = '#F2E4CF';
    x.font = display(ar ? 150 : 170);
    const head = f.won ? (ar ? ['فزت', 'بالمزاد'] : ['I WON THE', 'AUCTION']) : (ar ? ['لعبت', 'مزاد'] : ['I PLAYED', 'MAZAD']);
    x.fillText(head[0], W / 2, 1120);
    x.fillText(head[1], W / 2, ar ? 1290 : 1280);
    x.font = ar ? '600 44px "IBM Plex Sans Arabic"' : '600 44px Archivo';
    const sub = ar
      ? `${num(f.score)} نقطة · أعلى مزايدة ${num(f.best)}${f.beat ? ` · فزت على ${num(f.beat)} أصدقاء` : ''}`
      : `${f.score} pts · top bid ${f.best}${f.beat ? ` · beat ${f.beat} friend${f.beat === 1 ? '' : 's'}` : ''}`;
    x.fillText(sub, W / 2, 1400);
    x.fillStyle = '#F2E4CF';
    x.beginPath();
    x.roundRect ? x.roundRect(150, 1560, W - 300, 170, 12) : x.rect(150, 1560, W - 300, 170);
    x.fill();
    x.fillStyle = '#A3302A';
    x.font = ar ? '700 46px "IBM Plex Sans Arabic"' : '800 46px Archivo';
    x.fillText(ar ? 'تقدر تزايد علي؟' : 'Can you outbid me?', W / 2, 1632);
    x.font = '800 46px Archivo';
    x.fillText('bahjah.com/mazad', W / 2, 1694);
    // The grain, as on every coloured surface.
    const grain = await img('assets/auction/grain-dark.png');
    if (grain) {
      x.globalAlpha = 0.25;
      x.fillStyle = x.createPattern(grain, 'repeat');
      x.fillRect(0, 0, W, H);
      x.globalAlpha = 1;
    }
    return c;
  }

  function shareText(d) {
    const f = myCardFacts(d);
    return U.isAr()
      ? `${f.won ? 'فزت بالمزاد' : 'لعبت مزاد'} على بهجة: ${f.score} نقطة. تقدر تزايد علي؟ 🔨`
      : `${f.won ? 'I won the auction' : 'I played Mazad'} on Bahjah: ${f.score} pts. Can you outbid me? 🔨`;
  }

  function renderShare(d) {
    const url = `${location.origin}/mazad`;
    if (!setBox(`share|${U.lang()}`, screen('ink', `
      <div class="auc-top"><span class="auc-label">${t('Share your result', 'شارك نتيجتك')}</span><button type="button" class="auc-link" id="auc-share-back">${t('Back', 'رجوع')}</button></div>
      <div class="auc-share-card"><img class="auc-share-img" id="auc-card-img" alt="${t('Your story card', 'بطاقة نتيجتك')}"></div>
      <div class="auc-share-btns">
        <button type="button" data-share="wa"><i>W</i>${t('WhatsApp', 'واتساب')}</button>
        <button type="button" data-share="ig"><i>IG</i>${t('Instagram', 'إنستغرام')}</button>
        <button type="button" data-share="x"><i>X</i>${t('X', 'إكس')}</button>
        <button type="button" data-share="save" class="is-save"><i>↓</i>${t('Save', 'حفظ')}</button>
      </div>`))) return;
    let canvas = null;
    drawCard(d).then((c) => {
      canvas = c;
      const imgEl = document.getElementById('auc-card-img');
      if (imgEl) imgEl.src = c.toDataURL('image/png');
    });
    document.getElementById('auc-share-back').addEventListener('click', () => {
      shareOpen = false;
      renderKey = null;
      renderFinal(d);
    });
    box.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', () => {
      const text = shareText(d);
      const kind = b.dataset.share;
      if (kind === 'wa') return window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
      if (kind === 'x') return window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
      if (kind === 'save') {
        if (!canvas) return;
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'bahjah-mazad-story.png';
        a.click();
        return;
      }
      // Instagram has no web share link: hand the card to the phone's own
      // share sheet, which is where Instagram Stories lives.
      window.BahjahShareCard.share({ gameId: 'auction', lang: U.lang(), text, url, shareBtn: null, buildCanvas: () => (canvas ? Promise.resolve(canvas) : drawCard(d)) });
    }));
  }

  function renderEnded() {
    if (splash) splash.style.display = 'none';
    wrap.style.display = 'block';
    renderKey = null;
    setBox('ended', screen('oxblood', `
      <div class="auc-top"><span class="auc-label">${t('Room closed', 'الغرفة انتهت')}</span></div>
      <div style="margin-top:auto; width:160px; align-self:center;">${U.mark('cream')}</div>
      <h1 class="auc-display auc-title" style="text-align:center;">${t('The host ended the game.', 'المضيف أنهى اللعبة.')}</h1>
      <div class="auc-push"><a class="auc-btn auc-btn--cream auc-btn--block" href="auction.html">${t('Start your own room', 'ابدأ غرفتك')}</a></div>`));
  }
})();
