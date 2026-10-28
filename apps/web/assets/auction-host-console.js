// مزاد | Auction -- the big screen. Mounted into #host-console on
// auction-lobby.html, where the host stays for the whole match: the shared
// stage everyone looks up at, laid out at 1280 x 760 (the design's D1 / D2)
// and scaled to the screen. A host holding the room on a phone gets the same
// screens stacked for a hand (.is-narrow).
//
// This console has a job the other games' hosts do not: when the clock runs
// out, the host reviews every player's list. That is the whole of the game's
// validation -- there is no answer database -- so everything counts until the
// host strikes it.
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
    if (item) return emit({ type: 'toggleAnswer', userId: item.dataset.user, index: Number(item.dataset.toggleAnswer) });
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
  const CREAM = ['var(--auc-cream)', 'var(--auc-ink)'];
  const paddleOf = (userId, d, opts) =>
    U.paddle(nameOf(userId), seatIndex(userId, d), Object.assign({ colour: TV_COLOURS[seatIndex(userId, d) % TV_COLOURS.length] }, opts || {}));
  const cat = (d) => U.category(d.currentCategory, U.gameLang(d));
  const lotNo = (d) => `${num(String(d.roundIndex + 1).padStart(2, '0'))} / ${num(String(d.totalRounds).padStart(2, '0'))}`;

  function ranked(d) {
    const scores = (d && d.scores) || {};
    return players()
      .map((m) => ({ userId: m.userId, name: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || seatIndex(a.userId, d) - seatIndex(b.userId, d));
  }

  // The oxblood leaderboard column beside the live lot: the game's totals.
  function leaderboard(d) {
    const present = new Set(players().filter((m) => m.connected).map((m) => m.userId));
    return `
      <aside class="auc-tv-side auc-ground g-oxblood">
        <span class="auc-label is-accent tvx-label">${t('Leaderboard', 'الترتيب')}</span>
        <div class="auc-tv-lb">${ranked(d).map((r, i) => {
          const away = !present.has(r.userId);
          return `<div class="${away ? 'is-out' : ''}"><span class="auc-num">${num(i + 1)}</span><span>${esc(r.name)}${away ? t(' · offline', ' · غير متصل') : ''}</span><b>${num(r.score)}</b></div>`;
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
    if (phase === 'writing') return renderWriting(d);
    if (phase === 'judging') return renderReview(d);
    if (phase === 'results') return renderResult(d);
    if (phase === 'standings') return renderStandings(d);
    if (phase === 'finished') return renderFinal(d);
  }

  function renderReveal(d) {
    stage(`
      <div class="auc-tv-screen auc-ground g-brick"><div class="auc-tv-main">
        <div class="auc-tv-top"><span class="auc-label is-accent tvx-label">${t('Up for auction', 'معروض للمزاد')}</span><span class="auc-label tvx-label">${t('Lot', 'الجولة')} ${lotNo(d)}</span></div>
        <h1 class="auc-display tvx-reveal-word" id="hc-reveal-word">${esc(cat(d))}</h1>
        <div style="margin-top:auto; display:flex; align-items:flex-end; justify-content:space-between; gap:20px;">
          <div class="tvx-opener"><span class="auc-num" style="width:52px; height:52px; border-radius:50%; background:var(--auc-cream); color:var(--auc-brick); display:grid; place-items:center; font-size:30px;" ${live(d.phaseEndsAt, 'secs')}>${num(U.secsLeft(d.phaseEndsAt))}</span><div><b>${t('Everyone writes at once', 'الكل يكتب مع بعض')}</b><span>${esc(t(`Most answers in ${d.answerSeconds}s wins the lot`, `اللي يكتب أكثر خلال ${num(d.answerSeconds)} ثانية ياخذ المزاد`))}</span></div></div>
          ${U.figure('y', '')}
        </div>
      </div></div>`, '', `reveal|${d.roundIndex}|${U.lang()}`);
    U.fitEl(document.getElementById('hc-reveal-word'), window.innerWidth < 900 ? 150 : 250, window.innerWidth < 900 ? 360 : 470);
  }

  // Everyone writing: the clock, and each player's count rising live as a
  // bar -- the room's bids going up. The answers themselves stay hidden.
  function countRows(d) {
    const counts = d.counts || {};
    const top = Math.max(1, ...Object.values(counts));
    const lead = Math.max(0, ...Object.values(counts));
    const done = new Set(d.doneUserIds || []);
    return (d.order || []).map((id) => {
      const n = counts[id] || 0;
      return `<div class="row ${n > 0 && n === lead ? 'is-lead' : ''}">
        ${paddleOf(id, d, { size: 44, colour: CREAM })}<span class="nm">${esc(nameOf(id))}</span>
        <span class="track"><i style="width:${Math.round((n / top) * 100)}%"></i></span>
        <b class="auc-num">${num(n)}</b><span>${done.has(id) ? '✓' : ''}</span>
      </div>`;
    }).join('');
  }

  function renderWriting(d) {
    const key = `write|${d.roundIndex}|${U.lang()}`;
    if (key === lastKey) {
      const el = document.getElementById('hc-counts');
      if (el) el.innerHTML = countRows(d);
      return;
    }
    stage(`
      <div class="auc-tv-screen">
        <div class="auc-tv-main auc-ground g-orange">
          ${lotTop(d)}
          <div class="tvx-ans-head">
            <span class="auc-num timer" ${live(d.phaseEndsAt, 'clock')}>${U.clock(U.secsLeft(d.phaseEndsAt))}</span>
            <span class="auc-label tvx-label" style="align-self:flex-end; padding-bottom:20px;">${t('Most answers wins the lot', 'الأكثر إجابات ياخذ المزاد')}</span>
          </div>
          <div class="tvx-counts" id="hc-counts">${countRows(d)}</div>
        </div>
        ${leaderboard(d)}
      </div>`, '', key);
  }

  // The host's review: every player's list. Everything counts unless the
  // host strikes it; the count on each list follows the strikes.
  function renderReview(d) {
    const counts = d.counts || {};
    const lead = Math.max(0, ...Object.values(counts));
    const leaders = (d.order || []).filter((id) => lead > 0 && counts[id] === lead);
    const struck = Object.values(d.answers || {}).reduce((n, list) => n + list.filter((a) => a.rejected).length, 0);
    stage(`
      <div class="auc-tv-screen auc-ground g-cream"><div class="tvx-review">
        <div class="auc-tv-top"><span class="auc-label auc-accent tvx-label">${t('Host · Review', 'المضيف · مراجعة')}</span><span class="auc-label tvx-label">${esc(cat(d))} · ${t('Lot', 'الجولة')} ${lotNo(d)}</span></div>
        <h1 class="auc-display" style="font-size:64px;">${t('Check the lists', 'راجع القوائم')}</h1>
        <div class="auc-panel" style="background:var(--auc-cream-2); display:flex; justify-content:space-between; gap:16px; font-size:17px;">
          <span>${t('Everything counts unless you strike it. Tap any answer that shouldn’t.', 'كل إجابة محسوبة إلا اللي تشطبها. اضغط على أي إجابة ما تنحسب.')}</span>
          ${struck ? `<b>${esc(t(`${struck} struck`, `${num(struck)} مشطوبة`))}</b>` : ''}
        </div>
        <div class="tvx-lists">${(d.order || []).map((id) => {
          const list = (d.answers || {})[id] || [];
          return `<div class="tvx-list ${leaders.includes(id) ? 'is-lead' : ''}">
            <h3><span style="display:flex; align-items:center; gap:8px; min-width:0;">${paddleOf(id, d, { size: 32 })}<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(nameOf(id))}</span></span><span class="auc-num">${num(counts[id] || 0)}</span></h3>
            <div class="items">${list.length ? list.map((a, i) => a.duplicate
              ? `<span class="auc-ans is-dupe"><s>${esc(a.text)}</s></span>`
              : `<button type="button" class="auc-ans ${a.rejected ? 'is-rejected' : ''}" data-toggle-answer="${i}" data-user="${esc(id)}" aria-pressed="${a.rejected}">${a.rejected ? '✕ ' : ''}${esc(a.text)}</button>`).join('')
              : `<span style="opacity:.6; font-size:14px;">${t('Nothing written', 'ما كتب شي')}</span>`}</div>
          </div>`;
        }).join('')}</div>
        <div class="tvx-review-foot">
          <div class="auc-tally">${leaders.length
            ? `${t('As it stands', 'الحين')} <span class="auc-flip">→</span> ${esc(t(`sold to ${leaders.map(nameOf).join(' & ')} at ${lead}.`, `ينباع لـ ${leaders.map(nameOf).join(' و')} على ${num(lead)}.`))}`
            : t('As it stands, nobody has anything that counts.', 'الحين ما أحد عنده شي ينحسب.')}</div>
          <button type="button" class="auc-btn auc-btn--orange" id="hc-confirm-btn">${t('Confirm counts', 'تأكيد العدد')}</button>
        </div>
      </div></div>`, '', `review|${d.roundIndex}|${JSON.stringify(Object.values(d.answers || {}).map((l) => l.map((a) => (a.rejected ? 1 : 0)).join('')))}|${U.lang()}`);
  }

  function nextLine(d) {
    const last = d.roundIndex + 1 >= d.totalRounds;
    if (last) return `${t('Final results in', 'النتائج النهائية بعد')} <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}`;
    return `${t(`Lot ${d.roundIndex + 2} in`, `الجولة ${num(d.roundIndex + 2)} بعد`)} <span ${live(d.phaseEndsAt, 'secs')}></span>${t('s', ' ث')}`;
  }
  const nextBtn = () => `<button type="button" id="hc-next-btn">${t('Next', 'التالي')} <span class="auc-flip">→</span></button>`;

  // The result: the counts rise like bids, lowest first, each a beat after
  // the last; then SOLD! to the top count, with the gavel.
  const RISE_MS = 600;
  function renderResult(d) {
    const r = d.lastRound || {};
    const catName = U.gameLang(d) === 'ar' ? r.categoryNameAr || r.categoryName : r.categoryName;
    const sold = (r.winnerUserIds || []).length > 0;
    const rows = (d.order || []).map((id) => ({ id, n: (r.counts || {})[id] || 0 }))
      .sort((a, b) => a.n - b.n || seatIndex(a.id, d) - seatIndex(b.id, d));
    const top = Math.max(1, r.topCount || 0);
    const delay = rows.length * RISE_MS + 200;
    const names = (r.winnerUserIds || []).map(nameOf).join(t(' & ', ' و'));
    stage(`
      <div class="auc-tv-screen auc-ground g-${sold ? 'orange' : 'brick'}"><div class="auc-tv-main">
        <div class="auc-tv-top"><span class="auc-label tvx-label">${t('Lot', 'الجولة')} ${num(String(d.roundIndex + 1).padStart(2, '0'))} · ${esc(catName)}</span><span class="auc-label tvx-label">${sold ? t('Sold', 'انباعت') : t('Unsold', 'ما انباعت')}</span></div>
        <div class="tvx-result" style="grid-template-columns:1.25fr 1fr;">
          <div class="auc-ladder tvx-ladder">${rows.map((row, i) => `
            <div class="auc-rung ${(r.winnerUserIds || []).includes(row.id) ? 'is-win' : ''}" style="animation-delay:${i * RISE_MS}ms">
              ${paddleOf(row.id, d, { size: 44, colour: CREAM })}<span class="nm">${esc(nameOf(row.id))}</span>
              <span class="track"><i style="width:${Math.max(3, Math.round((row.n / top) * 100))}%; animation-delay:${i * RISE_MS}ms"></i></span>
              <b class="auc-num">${num(row.n)}</b>
            </div>`).join('')}</div>
          <div class="tvx-sold-side auc-sold-line-up auc-delayed" style="animation-delay:${delay}ms">
            ${sold ? `${U.mark('ink', 'is-striking')}
              <h1 class="auc-display tvx-sold-word" style="color:var(--auc-cream);">${t('Sold!', 'بيع!')}</h1>
              <p style="font-size:28px;">${esc(t(`to ${names} at ${r.topCount}`, `لصالح ${names} على ${num(r.topCount)}`))} · <b>+${num(d.winBonus || 5)}</b></p>`
              : `${U.block()}<h1 class="auc-display" style="font-size:96px;">${t('No sale.', 'ما انباعت.')}</h1><p style="font-size:22px;">${t('Nobody named anything that counted.', 'ما أحد كتب شي ينحسب.')}</p>`}
            <p class="tvx-next">${t('Everyone scores their count.', 'كل لاعب ياخذ عدده نقاط.')} ${nextLine(d)}</p>
          </div>
        </div>
      </div></div>`, nextBtn(), `res|${d.roundIndex}|${U.lang()}`);
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
        <p class="auc-mustard" style="font-size:20px; font-weight:700;">${esc(t(`Every answer counts. Winning a lot adds +${d.winBonus || 5}.`, `كل إجابة تنحسب، واللي ياخذ المزاد له +${num(d.winBonus || 5)}.`))}</p>
      </div></div>`, nextBtn(), `stand|${d.roundIndex}|${U.lang()}`);
  }

  function renderFinal(d) {
    const rows = ranked(d);
    const stats = d.finalStats || {};
    const winners = new Set(d.winnerUserIds || []);
    const winnerRows = rows.filter((r) => winners.has(r.userId));
    const lead = winnerRows[0] || rows[0];
    const s = (lead && stats[lead.userId]) || {};
    const best = Math.max(0, ...Object.values(stats).map((x) => x.bestCount || 0));
    const names = winnerRows.map((r) => r.name).join(t(' & ', ' و'));
    stage(`
      <div class="auc-tv-screen auc-ground g-orange"><div class="tvx-final">
        <div class="tvx-final-art"><img src="assets/auction/keyart.svg" alt=""></div>
        <div class="tvx-final-side">
          <span class="auc-label tvx-label">${t('Final', 'النهائي')} · ${esc(t(`${d.totalRounds} lots`, `${num(d.totalRounds)} جولات`))}</span>
          <h1 class="auc-display">${esc(winnerRows.length ? t(`${names} ${winnerRows.length > 1 ? 'win' : 'wins'} · ${lead.score}`, `${names} ${winnerRows.length > 1 ? 'يفوزون' : 'يفوز'} · ${num(lead.score)}`) : t('No winner', 'ما فيه فائز'))}</h1>
          ${winnerRows.length ? `<div class="auc-final-facts">
            <span>${esc(t(`Won ${s.lotsWon || 0} of ${d.totalRounds} lots`, `أخذ ${num(s.lotsWon || 0)} من ${num(d.totalRounds)} مزادات`))}</span>
            <span>${esc(t(`Most in one lot: ${best}`, `أكثر عدد في جولة: ${num(best)}`))}</span>
          </div>` : ''}
          <div class="auc-ranks">${rows.map((r, i) => `<div class="${winners.has(r.userId) ? 'is-me' : ''}"><span>${num(i + 1)} ${esc(r.name)}</span><span>${num(r.score)}</span></div>`).join('')}</div>
          <div class="actions">
            <button type="button" class="auc-btn" id="hc-restart-btn">${t('Play again', 'العب مرة ثانية')}</button>
          </div>
        </div>
      </div></div>`, '', `final|${U.lang()}`);
  }
})();
