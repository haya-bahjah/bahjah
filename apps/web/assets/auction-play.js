// مزاد | Auction -- the player's phone. Driven by the 'bahjah:game-state'
// events assets/lobby.js dispatches, the same arrangement as the other games'
// phone scripts. The host never lands here: lobby-room.js keeps them on
// auction-lobby.html's console, where they run the room and rule on answers.
//
// A lot: the category is revealed, everyone types answers at once with the
// room's counts rising live, the host reviews every list, then the counts
// rise like bids and the lot is SOLD to the top count. Every phase is one
// full screen on its own ground colour (the design's "read the state from
// across the room"): reveal brick, writing orange, reviewing oxblood, result
// orange (brick when unsold), standings oxblood, final orange, share ink.
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
  // The writing screen carries a box the player is typing in, so it may not
  // be rebuilt underneath them on a state tick: it is drawn once and patched.
  let renderKey = null;
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
    if (phase === 'writing') return renderWriting(d);
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
    setBox(`reveal|${d.roundIndex}|${U.lang()}`, screen('brick', `
      <div class="auc-top"><span class="auc-label">${t('Lot', 'الجولة')} ${lotNo(d)}</span>${youChip(d)}</div>
      <span class="auc-label" style="margin-top:12px;">${t('Up for auction', 'معروض للمزاد')}</span>
      <h1 class="auc-display auc-reveal-word" id="auc-reveal-word">${esc(cat(d))}</h1>
      <div class="auc-push">
        <div style="display:flex; justify-content:center; padding-block:20px 8px;">${U.figure('y')}</div>
        <div class="auc-opener">
          <span class="auc-count auc-num" style="flex:none; width:40px; height:40px; border-radius:50%; background:var(--auc-cream); color:var(--auc-brick); display:grid; place-items:center; font-size:24px;" ${live(d.phaseEndsAt, 'secs')}>${num(U.secsLeft(d.phaseEndsAt))}</span>
          <div><b>${t('Everyone writes at once', 'الكل يكتب مع بعض')}</b>
          <span>${esc(t(`Most answers in ${d.answerSeconds}s wins the lot`, `اللي يكتب أكثر خلال ${num(d.answerSeconds)} ثانية ياخذ المزاد`))}</span></div>
        </div>
      </div>`));
    U.fitEl(document.getElementById('auc-reveal-word'), 168, window.innerHeight * 0.45);
    window.BahjahSoundFx.tick();
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

  // ---- Writing: everyone at once, counts live ------------------------------
  function myList(d) {
    return (d.answers && d.answers[myId]) || [];
  }
  function myCount(d) {
    return (d.counts && d.counts[myId]) || 0;
  }
  function answerChips(list, opts) {
    return list.map((a, i) => {
      const fresh = opts && opts.freshFrom != null && i >= opts.freshFrom ? ' is-new' : '';
      if (a.duplicate) return `<span class="auc-ans is-dupe${fresh}"><s>${esc(a.text)}</s> · ${t('already counted', 'محسوبة')}</span>`;
      if (a.rejected) return `<span class="auc-ans is-rejected${fresh}">${esc(a.text)}</span>`;
      return `<span class="auc-ans${fresh}">${esc(a.text)}</span>`;
    }).join('');
  }
  // Everyone's count, live, in seat order: the room's bids rising.
  function countStrip(d) {
    const counts = d.counts || {};
    const top = Math.max(0, ...Object.values(counts));
    const done = new Set(d.doneUserIds || []);
    return (d.order || []).map((id) => {
      const n = counts[id] || 0;
      const lead = n > 0 && n === top;
      return `<span class="auc-live-count ${lead ? 'is-lead' : ''} ${id === myId ? 'is-me' : ''}">${paddleOf(id, d, { size: 30, colour: id === myId ? null : CREAM })}<b class="auc-num">${num(n)}</b>${done.has(id) ? '<i>✓</i>' : ''}</span>`;
    }).join('');
  }
  let shownAnswers = 0;
  // Everyone but you is a cream disc on the coloured grounds, where a seat
  // colour could be the ground itself.
  const CREAM = ['var(--auc-cream)', 'var(--auc-ink)'];

  function renderWriting(d) {
    const done = (d.doneUserIds || []).includes(myId);
    const playing = (d.order || []).includes(myId);
    const key = `write|${d.roundIndex}|${done}|${U.lang()}`;
    if (key === renderKey) {
      // Same lot, already on screen: patch the list and the counts so the box
      // being typed into is never rebuilt under the player.
      const list = document.getElementById('auc-ans-list');
      if (list) list.innerHTML = answerChips(myList(d), { freshFrom: shownAnswers });
      shownAnswers = myList(d).length;
      const count = document.getElementById('auc-valid');
      if (count) count.textContent = num(myCount(d));
      const strip = document.getElementById('auc-strip');
      if (strip) strip.innerHTML = countStrip(d);
      return;
    }
    shownAnswers = myList(d).length;
    setBox(key, screen('orange', `
      ${categoryTop(d, esc(lotYou(d)))}
      <div class="auc-ans-head">
        <span class="auc-num timer" ${live(d.phaseEndsAt, 'clock')}>${U.clock(U.secsLeft(d.phaseEndsAt))}</span>
        <span class="count"><span class="auc-num" id="auc-valid">${num(myCount(d))}</span><br><span class="auc-label">${t('Your count', 'عددك')}</span></span>
      </div>
      <div class="auc-strip" id="auc-strip" aria-label="${t('Everyone’s count', 'عدد كل لاعب')}">${countStrip(d)}</div>
      <div class="auc-ans-list" id="auc-ans-list">${answerChips(myList(d))}</div>
      ${!playing ? `<div class="auc-push"><p class="auc-note">${t('You joined after this game started. Watch this one; you play the next.', 'دخلت بعد ما بدأت اللعبة. تابع هذي، وتلعب الجاية.')}</p></div>`
        : done ? `<div class="auc-push"><p class="auc-note">${t('Done. Waiting for the clock or the others…', 'خلصت. بانتظار الوقت أو الباقين…')}</p></div>`
        : `<div class="auc-push">
        <form class="auc-typebar" id="auc-type" autocomplete="off">
          <input class="auc-input" id="auc-answer" type="text" maxlength="60" enterkeyhint="send" autocapitalize="words"
                 placeholder="${t('Type one, press enter…', 'اكتب وحدة واضغط إدخال…')}" aria-label="${t('Answer', 'إجابة')}">
          <button type="submit" aria-label="${t('Submit', 'إرسال')}"><span class="auc-flip">↵</span></button>
        </form>
        <button type="button" class="auc-link" id="auc-done" style="align-self:center;">${t("I'm done", 'خلصت')}</button>
      </div>`}`));
    if (!playing || done) return;
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

  // ---- Host is reviewing ---------------------------------------------------
  function renderReviewing(d) {
    const list = myList(d);
    setBox(`review|${d.roundIndex}|${list.map((a) => (a.rejected ? 1 : 0)).join('')}|${U.lang()}`, screen('oxblood', `
      <div class="auc-eyes">${'<img src="assets/auction/eye.svg" alt="">'.repeat(7)}</div>
      <h2 class="auc-display auc-title" style="text-align:center;">${t('Host is reviewing…', 'المضيف يراجع…')}</h2>
      <p class="auc-note" style="font-weight:500;">${esc(t(`Your list counts ${myCount(d)} for now. The host strikes anything that shouldn't count.`, `قائمتك محسوب منها ${num(myCount(d))} للحين. المضيف يشطب أي إجابة ما تنحسب.`))}</p>
      <div class="auc-ans-list" style="justify-content:center;">${answerChips(list)}</div>`));
  }

  // ---- Result: the counts rise like bids, then SOLD! -----------------------
  // Ranks with ▲▼: where everyone stood before this lot's points went on.
  function movement(d) {
    const r = d.lastRound;
    const before = Object.assign({}, d.scores || {});
    if (r && r.awarded) Object.entries(r.awarded).forEach(([id, n]) => { before[id] = (before[id] || 0) - n; });
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
    return `${t(`Lot ${d.roundIndex + 2} in`, `الجولة ${num(d.roundIndex + 2)} بعد`)} <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}`;
  }
  // The bid ladder: lowest count first, each row arriving a beat after the
  // last, the winning count last. RISE_MS apart; SOLD lands after the top.
  const RISE_MS = 600;
  function ladder(d, r) {
    const rows = (d.order || []).map((id) => ({ id, n: (r.counts || {})[id] || 0 }))
      .sort((a, b) => a.n - b.n || seatIndex(a.id, d) - seatIndex(b.id, d));
    const top = Math.max(1, r.topCount || 0);
    return `<div class="auc-ladder">${rows.map((row, i) => `
      <div class="auc-rung ${(r.winnerUserIds || []).includes(row.id) ? 'is-win' : ''} ${row.id === myId ? 'is-me' : ''}" style="animation-delay:${i * RISE_MS}ms">
        ${paddleOf(row.id, d, { size: 30, colour: row.id === myId ? null : CREAM })}<span class="nm">${esc(nameOf(row.id))}</span>
        <span class="track"><i style="width:${Math.max(3, Math.round((row.n / top) * 100))}%; animation-delay:${i * RISE_MS}ms"></i></span>
        <b class="auc-num">${num(row.n)}</b>
      </div>`).join('')}</div>`;
  }
  function soldDelay(d) {
    return (d.order || []).length * RISE_MS + 200;
  }
  function winnersLine(r, opts) {
    const names = (r.winnerUserIds || []).map((id) => nameOf(id, opts)).join(t(' & ', ' و'));
    return names;
  }

  function renderResult(d) {
    const r = d.lastRound || {};
    const key = `res|${d.roundIndex}|${U.lang()}`;
    if (key === renderKey) return;
    const catName = U.gameLang(d) === 'ar' ? r.categoryNameAr || r.categoryName : r.categoryName;
    const sold = (r.winnerUserIds || []).length > 0;
    const iWon = (r.winnerUserIds || []).includes(myId);
    const mine = (r.awarded || {})[myId] || 0;
    const delay = soldDelay(d);
    setBox(key, screen(sold ? 'orange' : 'brick', `
      <div class="auc-top"><span class="auc-label">${t('Lot', 'الجولة')} ${num(String(d.roundIndex + 1).padStart(2, '0'))} · ${esc(catName)}</span><span class="auc-top-r">${sold ? t('Sold', 'انباعت') : t('Unsold', 'ما انباعت')}</span></div>
      ${ladder(d, r)}
      <div class="auc-sold-line-up auc-delayed" style="animation-delay:${delay}ms">
        ${sold ? `<div class="auc-sold-row"><span class="auc-sold-mini">${U.mark('ink', 'is-striking')}</span><h1 class="auc-display auc-sold-word" style="font-size:96px; color:var(--auc-cream); text-align:start;">${t('Sold!', 'بيع!')}</h1></div>
        <p class="auc-sold-line" style="text-align:start;">${esc(t(`to ${winnersLine(r)} at ${r.topCount}`, `لصالح ${winnersLine(r)} على ${num(r.topCount)}`))}</p>`
        : `<h1 class="auc-display auc-title">${t('No sale.', 'ما انباعت.')}</h1><p class="auc-note" style="text-align:start;">${t('Nobody named anything that counted.', 'ما أحد كتب شي ينحسب.')}</p>`}
        ${(d.order || []).includes(myId) ? `<div class="auc-stats" style="grid-template-columns:1fr 1fr;">
          <div class="auc-stat"><span class="auc-label">${t('Your count', 'عددك')}</span><span class="auc-num">${num((r.counts || {})[myId] || 0)}</span></div>
          <div class="auc-stat"><span class="auc-label">${t('Your points', 'نقاطك')}</span><span class="auc-num">+${num(mine)}</span></div>
        </div>${iWon ? `<p class="auc-note" style="text-align:start;">${esc(t(`Includes +${d.winBonus || 5} for winning the lot.`, `منها +${num(d.winBonus || 5)} لأنك أخذت المزاد.`))}</p>` : ''}` : ''}
      </div>
      <div class="auc-push">${rankCard(d, 3)}<p class="auc-note">${nextLine(d)}</p></div>`));
    clearTimeout(window.__aucSoldSfx);
    window.__aucSoldSfx = setTimeout(() => { if (sold) window.BahjahSoundFx[iWon ? 'correct' : 'submit'](); }, delay);
  }

  // ---- Standings -----------------------------------------------------------
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
      <div class="auc-push"><p class="auc-note auc-mustard">${esc(t(`Every answer counts. Winning a lot adds +${d.winBonus || 5}.`, `كل إجابة تنحسب، واللي ياخذ المزاد له +${num(d.winBonus || 5)}.`))}</p>
      <p class="auc-note" style="font-weight:500;">${t(`Lot ${d.roundIndex + 2} in`, `الجولة ${num(d.roundIndex + 2)} بعد`)} <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}</p></div>`));
  }

  // ---- Final ---------------------------------------------------------------
  function finalFacts(d) {
    const stats = d.finalStats || {};
    const rows = ranked(d);
    const winners = new Set(d.winnerUserIds || []);
    const winnerRows = rows.filter((r) => winners.has(r.userId));
    const lead = winnerRows[0] || rows[0];
    const s = (lead && stats[lead.userId]) || {};
    const best = Math.max(0, ...Object.values(stats).map((x) => x.bestCount || 0));
    return { rows, winnerRows, lead, s, best };
  }

  function renderFinal(d) {
    const { rows, winnerRows, lead, s, best } = finalFacts(d);
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
        <span>${esc(t(`Won ${s.lotsWon || 0} of ${d.totalRounds} lots`, `أخذ ${num(s.lotsWon || 0)} من ${num(d.totalRounds)} مزادات`))}</span>
        <span>${esc(t(`Most in one lot: ${best}`, `أكثر عدد في جولة: ${num(best)}`))}</span>
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
    return { rank: i + 1, score: mine.score, best: stats.bestCount || 0, beat: Math.max(0, rows.length - (i + 1)), won };
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
      ? `${num(f.score)} نقطة · أكثر عدد ${num(f.best)}${f.beat ? ` · فزت على ${num(f.beat)} أصدقاء` : ''}`
      : `${f.score} pts · best lot ${f.best}${f.beat ? ` · beat ${f.beat} friend${f.beat === 1 ? '' : 's'}` : ''}`;
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
