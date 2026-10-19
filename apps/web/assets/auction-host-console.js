// مزاد | Auction -- the big screen. Mounted into #host-console on
// auction-lobby.html, where the host stays for the whole match: the shared
// stage everyone looks up at, laid out at 1280 x 760 (the design's D1 / D2)
// and scaled to the screen. A host holding the room on a phone gets the same
// screens stacked for a hand (.is-narrow).
//
// This console has a job the other games' hosts do not: when the winner's
// list reaches their bid, the host rules on it. That is the whole of the
// game's validation -- there is no answer database -- so everything counts
// until the host strikes it, and the review only appears when a ruling could
// change the outcome.
(function () {
  const U = window.AucUI;
  const { t, esc, num, live } = U;
  const mount = document.getElementById('host-console');
  if (!mount) return;

  const gate = document.getElementById('lobby-gate');
  const main = document.getElementById('lobby-main');

  let latestRoom = null;
  let latestState = null;
  let code = null;
  let socket = null;
  let active = false;
  let lastKey = null;

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    latestRoom = detail.room;
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
    document.body.classList.remove('is-host-phone');
    lastKey = null;
    render();
  });

  document.addEventListener('bahjah:game-state', (e) => {
    const state = e.detail;
    if (state.gameType !== 'auction') return;
    latestState = state;
    if (U.adoptGameLang(state.data)) return;
    if (active) render();
  });

  document.addEventListener('bahjah:lang-change', () => {
    lastKey = null;
    if (active) render();
  });

  window.addEventListener('resize', () => {
    if (!active) return;
    lastKey = null;
    render();
  });

  const emit = (action) => socket && socket.emit('game:action', { action });

  // --- Ending the room: asks first, then says something either way. ------
  let endPending = false;
  let confirmingEnd = false;
  let endNote = '';

  function paintEnd() {
    const btn = document.getElementById('hc-end-btn');
    if (btn) {
      btn.disabled = endPending;
      btn.classList.toggle('is-confirming', confirmingEnd);
      btn.textContent = endPending ? t('Ending…', 'جاري الإنهاء…') : confirmingEnd ? t('Tap to confirm', 'اضغط للتأكيد') : t('End room', 'أنهِ الغرفة');
    }
    const note = document.getElementById('hc-end-note');
    if (note) note.textContent = endNote;
  }

  document.addEventListener('click', (e) => {
    if (!active) return;
    if (e.target.closest('#hc-restart-btn')) return socket && socket.emit('room:restart');
    if (e.target.closest('#hc-next-btn')) return emit({ type: 'advance' });
    if (e.target.closest('#hc-confirm-btn')) return emit({ type: 'confirmJudging' });
    const item = e.target.closest('[data-toggle-answer]');
    if (item) return emit({ type: 'toggleAnswer', index: Number(item.dataset.toggleAnswer) });
    if (e.target.closest('#hc-end-btn')) {
      if (endPending) return;
      if (!confirmingEnd) {
        confirmingEnd = true;
        endNote = t('This ends the game for everyone.', 'هذا ينهي اللعبة للجميع.');
        paintEnd();
        setTimeout(() => {
          if (!confirmingEnd || endPending) return;
          confirmingEnd = false;
          endNote = '';
          paintEnd();
        }, 5000);
        return;
      }
      confirmingEnd = false;
      if (!socket) {
        endNote = t('Not connected — reload the page.', 'لا يوجد اتصال — أعد تحميل الصفحة.');
        return paintEnd();
      }
      endPending = true;
      endNote = t('Ending the room…', 'جاري إنهاء الغرفة…');
      paintEnd();
      socket.emit('room:end');
      setTimeout(() => {
        if (!endPending) return;
        endPending = false;
        endNote = t('No response — try again.', 'لا استجابة — حاول مرة ثانية.');
        paintEnd();
      }, 6000);
    }
  });

  // --- Pieces ---------------------------------------------------------------
  function players() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }
  function seatIndex(userId, d) {
    return Math.max(0, ((d && d.order) || players().map((m) => m.userId)).indexOf(userId));
  }
  function nameOf(userId) {
    const member = players().find((m) => m.userId === userId);
    return member ? member.displayName : t('Player', 'لاعب');
  }
  // The live lot is on orange, so the orange seat is drawn cream there.
  const TV_COLOURS = [['var(--auc-paddle)', 'var(--auc-ink)'], ['var(--auc-cream)', 'var(--auc-ink)'], ['var(--auc-brick)', 'var(--auc-cream)'], ['var(--auc-oxblood)', 'var(--auc-cream)'], ['var(--auc-ink)', 'var(--auc-cream)']];
  const paddleOf = (userId, d, opts) =>
    U.paddle(nameOf(userId), seatIndex(userId, d), Object.assign({ colour: TV_COLOURS[seatIndex(userId, d) % TV_COLOURS.length] }, opts || {}));
  const cat = (d) => U.category(d.currentCategory, U.gameLang(d));
  const lotNo = (d) => `${num(String(d.roundIndex + 1).padStart(2, '0'))} / ${num(String(d.totalRounds).padStart(2, '0'))}`;
  const validCount = (d) => (d.answers || []).filter((a) => !a.duplicate && !a.rejected).length;

  function ranked(d) {
    const scores = (d && d.scores) || {};
    return players()
      .map((m) => ({ userId: m.userId, name: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || seatIndex(a.userId, d) - seatIndex(b.userId, d));
  }

  // The oxblood leaderboard column beside the live lot.
  function leaderboard(d) {
    const passed = new Set(d.passedBidders || []);
    const dropped = new Set(d.droppedBidders || []);
    return `
      <aside class="auc-tv-side auc-ground g-oxblood">
        <span class="auc-label is-accent tvx-label">${t('Leaderboard', 'الترتيب')}</span>
        <div class="auc-tv-lb">${ranked(d).map((r, i) => {
          const out = passed.has(r.userId) || dropped.has(r.userId);
          const note = dropped.has(r.userId) ? t(' · offline', ' · غير متصل') : passed.has(r.userId) ? t(' · passed', ' · مرّر') : '';
          return `<div class="${out ? 'is-out' : ''}"><span class="auc-num">${num(i + 1)}</span><span>${esc(r.name)}${note}</span><b>${num(r.score)}</b></div>`;
        }).join('')}</div>
        <div class="tvx-side-mark">${U.mark('cream')}</div>
      </aside>`;
  }

  function lotTop(d, pillCls) {
    return `<div class="auc-tv-top"><span class="auc-pill ${pillCls || ''}">${esc(cat(d))}</span><span class="auc-label tvx-label">${t('Lot', 'الجولة')} ${lotNo(d)}</span></div>`;
  }

  function controls(extra) {
    return `
      <div class="auc-tv-ctrl">
        ${extra || ''}
        <button type="button" data-lang-toggle>${U.isAr() ? 'EN' : 'ع'}</button>
        <button type="button" id="hc-end-btn">${t('End room', 'أنهِ الغرفة')}</button>
      </div>
      <div class="auc-tv-note" id="hc-end-note" role="status"></div>`;
  }

  function stage(screenHtml, ctrlExtra, key) {
    // Redraw only when something on screen changes; the clocks tick on their
    // own (AucUI's data-ends), so a redraw never restarts an animation.
    if (key && key === lastKey) return;
    lastKey = key || null;
    const narrow = window.innerWidth < 900;
    document.body.classList.toggle('is-tv', !narrow);
    mount.innerHTML = `
      <div class="auc-tv-frame ${narrow ? 'is-narrow' : ''}">
        <div class="auc-tv" id="hc-stage">${screenHtml}${controls(ctrlExtra)}</div>
      </div>`;
    if (!narrow) U.fitTv(document.getElementById('hc-stage'));
    paintEnd();
  }

  // --- Phases ---------------------------------------------------------------
  function render() {
    if (!latestRoom) return;
    if (latestRoom.status === 'ended') {
      endPending = false;
      confirmingEnd = false;
      endNote = '';
      return stage(`
        <div class="auc-tv-screen auc-ground g-oxblood"><div class="auc-tv-main" style="align-items:center; justify-content:center; text-align:center;">
          <div style="width:200px;">${U.mark('cream')}</div>
          <h1 class="auc-display" style="font-size:72px;">${t('Room closed', 'الغرفة انتهت')}</h1>
          <p style="font-size:18px;">${esc(t(`You ended this game (code: ${code}).`, `أنهيت هذي اللعبة (الرمز: ${code}).`))}</p>
          <a class="auc-btn auc-btn--cream" href="auction.html">${t('Start a new room', 'ابدأ غرفة جديدة')}</a>
        </div></div>`, '', `ended|${U.lang()}`);
    }
    if (!latestState) {
      return stage(`<div class="auc-tv-screen auc-ground g-orange"><div class="auc-tv-main" style="align-items:center; justify-content:center;"><div style="width:220px;">${U.mark('ink')}</div><span class="auc-label tvx-label">${t('Opening the saleroom…', 'جاري فتح المزاد…')}</span></div></div>`, '', `wait|${U.lang()}`);
    }
    const d = latestState.data || {};
    const phase = latestState.phase;
    if (phase === 'reveal') return renderReveal(d);
    if (phase === 'bidding') return renderBidding(d);
    if (phase === 'sold') return renderSold(d);
    if (phase === 'answering') return renderAnswering(d);
    if (phase === 'judging') return renderReview(d);
    if (phase === 'results') return renderResult(d);
    if (phase === 'standings') return renderStandings(d);
    if (phase === 'finished') return renderFinal(d);
  }

  function renderReveal(d) {
    const opener = d.openerUserId;
    stage(`
      <div class="auc-tv-screen auc-ground g-brick"><div class="auc-tv-main">
        <div class="auc-tv-top"><span class="auc-label is-accent tvx-label">${t('Up for auction', 'معروض للمزاد')}</span><span class="auc-label tvx-label">${t('Lot', 'الجولة')} ${lotNo(d)}</span></div>
        <h1 class="auc-display tvx-reveal-word">${esc(cat(d))}</h1>
        <div style="margin-top:auto; display:flex; align-items:flex-end; justify-content:space-between; gap:20px;">
          ${opener ? `<div class="tvx-opener">${paddleOf(opener, d, { size: 52 })}<div><b>${esc(t(`${nameOf(opener)} opens the bidding`, `${nameOf(opener)} يفتح المزاد`))}</b><span>${t('The first bidder rotates every lot', 'أول مزايد يتغير كل جولة')}</span></div></div>` : '<span></span>'}
          ${U.figure('y', '')}
        </div>
      </div></div>`, '', `reveal|${d.roundIndex}|${U.lang()}`);
  }

  function trail(d) {
    const bids = (d.bids || []).slice(-6);
    return `<div class="auc-trail tvx-trail">${bids.map((b, i) => `${i ? '<span class="arr auc-flip">→</span>' : ''}<span class="auc-tag ${i === bids.length - 1 ? 'is-top' : ''}">${esc(nameOf(b.userId))} ${num(b.amount)}</span>`).join('')}</div>`;
  }

  // D2: the standing bid at 400px, who holds it, who it is waiting on.
  function renderBidding(d) {
    const top = d.currentBid;
    const dropped = d.droppedBidders || [];
    const banner = dropped.length
      ? `<div class="auc-banner" style="align-self:flex-start;">${U.paddle(nameOf(dropped[dropped.length - 1]), 0, { cls: 'is-offline', size: 34 })}<span><b>${esc(t(`${nameOf(dropped[dropped.length - 1])} lost connection.`, `انقطع اتصال ${nameOf(dropped[dropped.length - 1])}.`))}</b> ${t('Skipped for the rest of this lot.', 'بيتم تخطيه لبقية هذي الجولة.')}</span></div>`
      : '';
    const waiting = d.turnUserId
      ? `${esc(t(`Waiting on ${nameOf(d.turnUserId)}`, `بانتظار ${nameOf(d.turnUserId)}`))} · <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}`
      : '';
    stage(`
      <div class="auc-tv-screen">
        <div class="auc-tv-main auc-ground g-orange">
          ${lotTop(d)}
          ${banner}
          ${top ? `
          <div class="tvx-bid">
            <span class="auc-num">${num(top.amount)}</span>
            <div class="tvx-bid-who">
              <span class="auc-label">${t('Highest bid', 'أعلى مزايدة')}</span>
              <span class="who">${paddleOf(top.userId, d, { size: 64 })}<b class="auc-display">${esc(nameOf(top.userId))}</b></span>
              <span class="wait">${waiting}</span>
            </div>
          </div>` : `
          <div class="tvx-bid">
            <span class="auc-num" style="opacity:.35;">—</span>
            <div class="tvx-bid-who">
              <span class="auc-label">${t('No bid yet', 'ما فيه مزايدة')}</span>
              <span class="who">${d.turnUserId ? paddleOf(d.turnUserId, d, { size: 64 }) : ''}<b class="auc-display">${esc(d.turnUserId ? t(`${nameOf(d.turnUserId)} opens`, `${nameOf(d.turnUserId)} يفتح`) : '')}</b></span>
              <span class="wait">${waiting}</span>
            </div>
          </div>`}
          <div class="auc-turnbar" style="background:rgba(0,0,0,.15); max-width:520px;"><i style="background:var(--auc-ink)" ${live(d.phaseEndsAt, 'bar', d.turnSeconds || 15)}></i></div>
          ${trail(d)}
        </div>
        ${leaderboard(d)}
      </div>`, '', ['bid', d.roundIndex, d.turnUserId, top ? top.amount : 0, (d.passedBidders || []).join(','), dropped.join(','), U.lang()].join('|'));
  }

  function renderSold(d) {
    const winner = d.winnerUserId;
    stage(`
      <div class="auc-tv-screen auc-ground g-brick"><div class="auc-tv-main">
        <div class="auc-tv-top"><span class="auc-label is-accent tvx-label">${winner ? t('Everyone passed', 'الكل مرّر') : t('No bids', 'ما أحد زايد')}</span><span class="auc-label tvx-label">${t('Lot', 'الجولة')} ${lotNo(d)}</span></div>
        <div class="tvx-sold">
          ${U.mark('cream', winner ? 'is-striking' : '')}
          <div>
            <h1 class="auc-display tvx-sold-word">${winner ? t('Sold!', 'بيع!') : t('No sale', 'ما انباعت')}</h1>
            <p class="tvx-sold-line">${winner
              ? `<b>${esc(nameOf(winner))}</b> ${esc(t(`owes ${d.winningBid} ${cat(d).toLowerCase()} in ${d.answerSeconds} seconds`, `عليه ${num(d.winningBid)} من «${cat(d)}» خلال ${num(d.answerSeconds)} ثانية`))}`
              : t('Nobody opened the bidding, so this lot goes unsold.', 'ما أحد فتح المزاد، فالجولة ما انباعت.')}</p>
            ${winner ? `<div class="auc-goline"><span class="auc-display">${t('Now prove it', 'الحين أثبتها')}</span><span class="auc-count auc-num" ${live(d.phaseEndsAt, 'secs')}>${num(3)}</span></div>` : ''}
          </div>
        </div>
      </div></div>`, '', `sold|${d.roundIndex}|${U.lang()}`);
  }

  function chips(d) {
    return (d.answers || []).map((a) => {
      if (a.duplicate) return `<span class="auc-ans is-dupe"><s>${esc(a.text)}</s> · ${t('already counted', 'محسوبة')}</span>`;
      if (a.rejected) return `<span class="auc-ans is-rejected">${esc(a.text)}</span>`;
      return `<span class="auc-ans">${esc(a.text)}</span>`;
    }).join('');
  }
  function segs(d) {
    const target = d.winningBid || 0;
    if (target > 60) return '';
    const valid = validCount(d);
    return `<div class="auc-segs tvx-segs">${Array.from({ length: target }, (_, i) => `<i class="${i < valid ? 'is-on' : ''}"></i>`).join('')}</div>`;
  }

  function renderAnswering(d) {
    stage(`
      <div class="auc-tv-screen">
        <div class="auc-tv-main auc-ground g-orange">
          <div class="auc-tv-top"><span class="auc-pill">${esc(cat(d))}</span><span class="auc-label tvx-label">${esc(t(`${nameOf(d.winnerUserId)} · target ${d.winningBid}`, `${nameOf(d.winnerUserId)} · الهدف ${num(d.winningBid)}`))}</span></div>
          <div class="tvx-ans-head">
            <span class="auc-num timer" ${live(d.phaseEndsAt, 'clock')}>${U.clock(U.secsLeft(d.phaseEndsAt))}</span>
            <span class="count"><span class="auc-num">${num(validCount(d))}</span><small>/${num(d.winningBid)}</small><br><span class="auc-label tvx-label">${t('Valid', 'صحيحة')}</span></span>
          </div>
          ${segs(d)}
          <div class="auc-ans-list tvx-chips">${chips(d)}</div>
        </div>
        ${leaderboard(d)}
      </div>`, '', `ans|${d.roundIndex}|${(d.answers || []).length}|${U.lang()}`);
  }

  // 09 Host review. Only reached when the list meets the bid: everything
  // counts unless the host strikes it, and the tally says what each strike
  // does to the result.
  function renderReview(d) {
    const target = d.winningBid || 0;
    const valid = validCount(d);
    const made = valid >= target && target > 0;
    const who = nameOf(d.winnerUserId);
    const struck = (d.answers || []).filter((a) => a.rejected).length;
    stage(`
      <div class="auc-tv-screen auc-ground g-cream"><div class="tvx-review">
        <div class="auc-tv-top"><span class="auc-label auc-accent tvx-label">${t('Host · Review', 'المضيف · مراجعة')}</span><span class="auc-label tvx-label">${esc(`${who} · ${cat(d)}`)}</span></div>
        <h1 class="auc-display">${esc(t(`${valid} answers counted`, `${num(valid)} إجابة محسوبة`))}</h1>
        <div class="auc-panel" style="background:var(--auc-cream-2); display:flex; justify-content:space-between; font-size:17px;">
          <span>${t('Everything counts unless you strike it. Tap any answer that shouldn’t.', 'كل إجابة محسوبة إلا اللي تشطبها. اضغط على أي إجابة ما تنحسب.')}</span>
          ${struck ? `<b>${esc(t(`${struck} struck`, `${num(struck)} مشطوبة`))}</b>` : ''}
        </div>
        <div class="tvx-review-list">${(d.answers || []).map((a, i) => a.duplicate
          ? `<span class="auc-ans is-dupe"><s>${esc(a.text)}</s> · ${t('already counted', 'محسوبة')}</span>`
          : `<button type="button" class="auc-ans ${a.rejected ? 'is-rejected' : ''}" data-toggle-answer="${i}" aria-pressed="${a.rejected}">${a.rejected ? '✕ ' : '✓ '}${esc(a.text)}</button>`).join('')}</div>
        <div class="tvx-review-foot">
          <div class="auc-tally">${made
            ? `${t('As it stands', 'الحين')} <span class="auc-flip">→</span> <b>${num(valid)} / ${num(target)}</b>. ${esc(t(`${who} makes the bid.`, `${who} حقق المزايدة.`))}`
            : `${t('As it stands', 'الحين')} <span class="auc-flip">→</span> <b>${num(valid)} / ${num(target)}</b>. ${esc(t(`${who} falls short.`, `${who} ما كمّلها.`))}`}</div>
          <button type="button" class="auc-btn auc-btn--orange" id="hc-confirm-btn">${t('Confirm result', 'تأكيد النتيجة')}</button>
        </div>
      </div></div>`, '', `review|${d.roundIndex}|${(d.answers || []).map((a) => (a.rejected ? 1 : 0)).join('')}|${U.lang()}`);
  }

  function nextLine(d) {
    const last = d.roundIndex + 1 >= d.totalRounds;
    if (last) return `${t('Final results in', 'النتائج النهائية بعد')} <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}`;
    const opener = d.nextOpenerUserId;
    return `${t(`Lot ${d.roundIndex + 2} in`, `الجولة ${num(d.roundIndex + 2)} بعد`)} <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}${opener ? ` · ${esc(t(`${nameOf(opener)} opens`, `${nameOf(opener)} يفتح`))}` : ''}`;
  }
  const nextBtn = () => `<button type="button" id="hc-next-btn">${t('Next', 'التالي')} <span class="auc-flip">→</span></button>`;

  function movement(d) {
    const r = d.lastRound;
    const before = Object.assign({}, d.scores || {});
    if (r && r.winnerUserId && r.awarded) before[r.winnerUserId] = (before[r.winnerUserId] || 0) - r.awarded;
    const prev = ranked({ scores: before, order: d.order }).map((x) => x.userId);
    return (userId, now) => {
      const was = prev.indexOf(userId);
      if (was < 0 || was === now) return '';
      return ` <span class="mv">${was > now ? '▲' : '▼'}</span>`;
    };
  }

  function renderResult(d) {
    const r = d.lastRound || {};
    const mv = movement(d);
    const ranks = `<div class="auc-ranks">${ranked(d).slice(0, 3).map((x, i) => `<div><span>${num(i + 1)} · ${esc(x.name)}${mv(x.userId, i)}</span><span>${num(x.score)}</span></div>`).join('')}</div>`;
    const catName = U.gameLang(d) === 'ar' ? r.categoryNameAr || r.categoryName : r.categoryName;
    const head = `<div class="auc-tv-top"><span class="auc-label tvx-label">${t('Lot', 'الجولة')} ${num(String(d.roundIndex + 1).padStart(2, '0'))} · ${esc(catName)}</span><span class="auc-label tvx-label">${!r.winnerUserId ? t('Unsold', 'ما انباعت') : r.success ? t('Delivered', 'تم الإنجاز') : t('Short', 'ما اكتملت')}</span></div>`;
    const who = r.winnerUserId ? nameOf(r.winnerUserId) : '';
    let body;
    if (!r.winnerUserId || r.dropped) {
      body = `
        <div class="tvx-result">
          <div>${U.block()}</div>
          <div style="display:flex; flex-direction:column; gap:18px;">
            <h2 class="auc-display">${r.dropped ? esc(t(`${who} left the stand`, `${who} غادر المنصة`)) : t('No sale.', 'ما انباعت.')}</h2>
            <p style="font-size:22px;">${r.dropped ? t('Disconnected while answering. The lot fails and nobody scores.', 'انقطع الاتصال أثناء الإجابة. الجولة تفشل وما أحد ياخذ نقاط.') : t('Nobody bid on this lot, so nobody scores.', 'ما أحد زايد على هذي الجولة، فما أحد ياخذ نقاط.')}</p>
            ${ranks}
            <p class="tvx-next">${nextLine(d)}</p>
          </div>
        </div>`;
    } else {
      body = `
        <div class="tvx-result">
          <div style="display:flex; align-items:flex-end;"><span class="auc-num auc-points">${r.success ? `+${num(r.awarded)}` : num(0)}</span>${U.figure(r.success ? 'raised' : 'still', r.success ? '' : 'is-turned')}</div>
          <div style="display:flex; flex-direction:column; gap:16px;">
            <h2 class="auc-display">${esc(r.success ? t(`${who} proved it.`, `${who} أثبتها.`) : t(`${who} fell short.`, `${who} ما كمّلها.`))}</h2>
            ${r.success ? '' : `<p style="font-size:22px; font-weight:700;">${esc(t(`${r.validCount}/${r.bid} · 0 points`, `${num(r.validCount)}/${num(r.bid)} · ٠ نقاط`))}</p>`}
            <div class="auc-stats">
              <div class="auc-stat"><span class="auc-label">${t('Bid', 'المزايدة')}</span><span class="auc-num">${num(r.bid)}</span></div>
              <div class="auc-stat"><span class="auc-label">${t('Valid', 'صحيحة')}</span><span class="auc-num">${num(r.validCount)}</span></div>
              <div class="auc-stat"><span class="auc-label">${t('Left', 'المتبقي')}</span><span class="auc-num">${U.clock(r.secondsLeft || 0)}</span></div>
            </div>
            ${ranks}
            <p class="tvx-next">${nextLine(d)}</p>
          </div>
        </div>`;
    }
    stage(`<div class="auc-tv-screen auc-ground g-${r.success ? 'orange' : 'brick'}"><div class="auc-tv-main">${head}${body}</div></div>`, nextBtn(), `res|${d.roundIndex}|${U.lang()}`);
  }

  function renderStandings(d) {
    const rows = ranked(d);
    const lead = rows[0];
    const top = Math.max(1, ...rows.map((r) => r.score));
    stage(`
      <div class="auc-tv-screen auc-ground g-oxblood"><div class="auc-tv-main">
        <div class="auc-tv-top"><span class="auc-label is-accent tvx-label">${t('Standings · after lot', 'الترتيب · بعد الجولة')} ${num(d.roundIndex + 1)}/${num(d.totalRounds)}</span><span class="auc-label tvx-label">${t(`Lot ${d.roundIndex + 2} in`, `الجولة ${num(d.roundIndex + 2)} بعد`)} <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}</span></div>
        <div class="tvx-stand">
          ${lead ? `<div class="auc-lead" style="flex-direction:column; align-items:flex-start;"><span class="auc-num">${num(lead.score)}</span><span><b class="auc-display">${esc(lead.score > 0 ? lead.name : t('All square', 'متعادلين'))}</b>${lead.score > 0 ? `<span style="font-size:20px; font-weight:600;">${t('in the lead', 'في الصدارة')}</span>` : ''}</span></div>` : '<span></span>'}
          <div class="auc-bars">${rows.map((r, i) => `
            <div class="auc-bar ${i === 0 && r.score > 0 ? 'is-me' : ''}">
              ${paddleOf(r.userId, d, { size: 52 })}
              <span class="track"><i class="${r.score ? '' : 'is-zero'}" style="width:${Math.round((r.score / top) * 100)}%"></i></span>
              <b>${num(r.score)}</b>
            </div>`).join('')}</div>
        </div>
        <p class="auc-mustard" style="font-size:20px; font-weight:700;">${t('The higher the bid, the bigger the swing.', 'كل ما كبرت المزايدة، كبر الفرق.')}</p>
      </div></div>`, nextBtn(), `stand|${d.roundIndex}|${U.lang()}`);
  }

  function renderFinal(d) {
    const rows = ranked(d);
    const stats = d.finalStats || {};
    const winners = new Set(d.winnerUserIds || []);
    const winnerRows = rows.filter((r) => winners.has(r.userId));
    const lead = winnerRows[0] || rows[0];
    const s = (lead && stats[lead.userId]) || {};
    const highest = Math.max(0, ...Object.values(stats).map((x) => x.highestSuccessfulBid || 0));
    const names = winnerRows.map((r) => r.name).join(t(' & ', ' و'));
    stage(`
      <div class="auc-tv-screen auc-ground g-orange"><div class="tvx-final">
        <div class="tvx-final-art"><img src="assets/auction/keyart.svg" alt=""></div>
        <div class="tvx-final-side">
          <span class="auc-label tvx-label">${t('Final', 'النهائي')} · ${esc(t(`${d.totalRounds} lots`, `${num(d.totalRounds)} جولات`))}</span>
          <h1 class="auc-display">${esc(winnerRows.length ? t(`${names} ${winnerRows.length > 1 ? 'win' : 'wins'} · ${lead.score}`, `${names} ${winnerRows.length > 1 ? 'يفوزون' : 'يفوز'} · ${num(lead.score)}`) : t('No winner', 'ما فيه فائز'))}</h1>
          ${winnerRows.length ? `<div class="auc-final-facts">
            <span>${esc(t(`${s.successfulAuctions || 0} of ${s.auctionsWon || 0} auctions delivered`, `${num(s.successfulAuctions || 0)} من ${num(s.auctionsWon || 0)} مزادات تم إنجازها`))}</span>
            <span>${esc(t(`Highest successful bid: ${highest}`, `أعلى مزايدة ناجحة: ${num(highest)}`))}</span>
          </div>` : ''}
          <div class="auc-ranks">${rows.map((r, i) => `<div class="${winners.has(r.userId) ? 'is-me' : ''}"><span>${num(i + 1)} ${esc(r.name)}</span><span>${num(r.score)}</span></div>`).join('')}</div>
          <div class="actions">
            <button type="button" class="auc-btn" id="hc-restart-btn">${t('Play again', 'العب مرة ثانية')}</button>
          </div>
        </div>
      </div></div>`, '', `final|${U.lang()}`);
  }
})();
