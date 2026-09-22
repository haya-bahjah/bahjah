// مزاد | Auction -- the big screen. Mounted into #host-console on
// auction-lobby.html, where the host stays for the whole match.
//
// This console has a job the other games' hosts do not: at the end of every
// answer sprint the host rules on the winner's list. That is the whole of the
// game's validation -- there is no answer database -- so the judging screen is
// built to be tapped through quickly on a television, with everything counted
// until the host says otherwise.
(function () {
  const LANG = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const mount = document.getElementById('host-console');
  if (!mount) return;

  const gate = document.getElementById('lobby-gate');
  const main = document.getElementById('lobby-main');

  let latestRoom = null;
  let latestState = null;
  let code = null;
  let socket = null;
  let active = false;

  const t = (en, ar) => (LANG() === 'ar' ? ar : en);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
    render();
  });

  document.addEventListener('bahjah:game-state', (e) => {
    const state = e.detail;
    if (state.gameType !== 'auction') return;
    latestState = state;
    if (active) render();
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (active) render();
  });

  // --- Ending the room, same control and reasoning as the other consoles ---
  let endPending = false;
  let confirmingEnd = false;
  let endNote = { text: '', tone: 'info' };

  function endNotice(message, tone) {
    endNote = { text: message || '', tone: tone || 'info' };
    const el = document.getElementById('hc-end-note');
    if (!el) return;
    el.textContent = endNote.text;
    el.setAttribute('data-tone', endNote.tone);
  }

  function restoreEndUi() {
    paintEndButton();
    const el = document.getElementById('hc-end-note');
    if (!el) return;
    el.textContent = endNote.text;
    el.setAttribute('data-tone', endNote.tone);
  }

  function paintEndButton() {
    const btn = document.getElementById('hc-end-btn');
    if (!btn) return;
    btn.disabled = endPending;
    btn.classList.toggle('is-confirming', confirmingEnd);
    btn.textContent = endPending
      ? t('Ending…', 'جارٍ الإنهاء…')
      : confirmingEnd
        ? t('Tap to confirm', 'اضغط للتأكيد')
        : t('End room', 'أنهِ الغرفة');
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#hc-restart-btn')) {
      if (socket) socket.emit('room:restart');
      return;
    }
    if (e.target.closest('#hc-next-btn')) {
      if (socket) socket.emit('game:action', { action: { type: 'advance' } });
      return;
    }
    if (e.target.closest('#hc-confirm-btn')) {
      if (socket) socket.emit('game:action', { action: { type: 'confirmJudging' } });
      return;
    }
    const item = e.target.closest('.auc-item.is-judgeable');
    if (item) {
      const index = Number(item.dataset.index);
      if (Number.isFinite(index) && socket) socket.emit('game:action', { action: { type: 'toggleAnswer', index } });
      return;
    }
    if (e.target.closest('#hc-end-btn')) {
      if (endPending) return;
      if (!confirmingEnd) {
        confirmingEnd = true;
        paintEndButton();
        endNotice(t('This ends the game for everyone.', 'سيؤدي هذا إلى إنهاء اللعبة لجميع اللاعبين.'), 'warn');
        setTimeout(() => {
          if (!confirmingEnd || endPending) return;
          confirmingEnd = false;
          paintEndButton();
          endNotice('');
        }, 5000);
        return;
      }
      confirmingEnd = false;
      if (!socket) {
        endNotice(t('Not connected — reload the page.', 'لا يوجد اتصال — أعد تحميل الصفحة.'), 'error');
        paintEndButton();
        return;
      }
      endPending = true;
      paintEndButton();
      endNotice(t('Ending the room…', 'جارٍ إنهاء الغرفة…'), 'info');
      socket.emit('room:end');
      setTimeout(() => {
        if (!endPending) return;
        endPending = false;
        paintEndButton();
        endNotice(t('No response — try again.', 'لا استجابة — حاول مرة أخرى.'), 'error');
      }, 6000);
      return;
    }
    if (confirmingEnd && !endPending) {
      confirmingEnd = false;
      paintEndButton();
      endNotice('');
    }
  });

  function players() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }

  function nameOf(userId) {
    const member = players().find((m) => m.userId === userId);
    return member ? member.displayName : t('Player', 'لاعب');
  }

  function categoryName(c) {
    if (!c) return '';
    return LANG() === 'ar' && c.nameAr ? c.nameAr : c.name;
  }

  function topbar(label) {
    return `
      <div class="hc-topbar">
        <span class="hc-round-label">${esc(label || '')}</span>
        <div class="hc-end-wrap">
          <button type="button" id="hc-end-btn" class="hc-btn-secondary hc-end-btn">${t('End room', 'أنهِ الغرفة')}</button>
          <span id="hc-end-note" class="hc-end-note" role="status"></span>
        </div>
      </div>`;
  }

  function stageHead(d) {
    const round = d.totalRounds
      ? t(`Lot ${d.roundIndex + 1} of ${d.totalRounds}`, `القطعة ${d.roundIndex + 1} من ${d.totalRounds}`)
      : '';
    return `<div class="auc-head"><span class="auc-round">${esc(round)}</span></div>`;
  }

  function lotCard(d, depth) {
    const c = d.currentCategory;
    return `
      <div class="auc-lot">
        <span class="auc-lot-kicker">${t('The lot', 'القطعة المعروضة')}</span>
        <h2 class="auc-lot-name">${esc(categoryName(c))}</h2>
        ${depth ? `<p class="auc-lot-depth">${esc(depth)}</p>` : ''}
      </div>`;
  }

  function bidBlock(d) {
    if (!d.currentBid) {
      return `
        <div class="auc-bid">
          <div class="auc-bid-label">${t('No bid yet', 'لا مزايدة بعد')}</div>
          <div class="auc-bid-number">—</div>
          <div class="auc-bid-none">${esc(t(`${nameOf(d.turnUserId)} opens the bidding`, `${nameOf(d.turnUserId)} يفتتح المزاد`))}</div>
        </div>`;
    }
    return `
      <div class="auc-bid">
        <div class="auc-bid-label">${t('Standing bid', 'المزايدة الحالية')}</div>
        <div class="auc-bid-number">${d.currentBid.amount}</div>
        <div class="auc-bid-holder">${esc(nameOf(d.currentBid.userId))}</div>
      </div>`;
  }

  function paddles(d) {
    const activeIds = d.activeBidders || [];
    const top = d.currentBid ? d.currentBid.userId : null;
    return `
      <div class="auc-paddles">
        ${(d.order || [])
          .map((userId) => {
            const isOut = !activeIds.includes(userId);
            const isTop = userId === top;
            const isTurn = userId === d.turnUserId;
            const state = isTop ? t('Top bid', 'أعلى مزايدة') : isOut ? t('Out', 'خرج') : isTurn ? t('Bidding…', 'يزايد…') : t('In', 'مستمر');
            return `
              <div class="auc-paddle ${isTop ? 'is-top' : ''} ${isOut ? 'is-out' : ''} ${isTurn ? 'is-turn' : ''}">
                <span class="auc-paddle-name">${esc(nameOf(userId))}</span>
                <span class="auc-paddle-state">${esc(state)}</span>
              </div>`;
          })
          .join('')}
      </div>`;
  }

  function timerRow() {
    return `
      <div class="auc-timer">
        <div class="auc-timer-track"><div class="auc-timer-fill" id="hc-timer-fill"></div></div>
        <div class="auc-ring" id="hc-ring"><span id="hc-timer-text"></span></div>
      </div>`;
  }

  function startTimer(endsAt) {
    const ringEl = document.getElementById('hc-ring');
    const textEl = document.getElementById('hc-timer-text');
    window.BahjahTimerBar.start('hc-auc', document.getElementById('hc-timer-fill'), null, endsAt, {
      onTick: (secs) => {
        if (textEl) textEl.textContent = String(Math.max(0, secs));
        const danger = secs <= 10;
        if (ringEl) ringEl.classList.toggle('is-danger', danger);
        const fill = document.getElementById('hc-timer-fill');
        if (fill) fill.classList.toggle('is-danger', danger);
      },
    });
  }

  function validCount(d) {
    return (d.answers || []).filter((a) => !a.duplicate && !a.rejected).length;
  }

  function answerList(d, judgeable) {
    const answers = d.answers || [];
    if (answers.length === 0) return `<p class="auc-foot">${t('Nothing yet.', 'لا شيء بعد.')}</p>`;
    return `
      <div class="auc-list">
        ${answers
          .map(
            (a, i) => `
            <span class="auc-item ${a.duplicate ? 'is-dupe' : ''} ${a.rejected ? 'is-rejected' : ''} ${
              judgeable && !a.duplicate ? 'is-judgeable' : ''
            }" ${judgeable && !a.duplicate ? `data-index="${i}"` : ''}>
              <span class="auc-item-no">${i + 1}</span>${esc(a.text)}
            </span>`
          )
          .join('')}
      </div>`;
  }

  function targetBlock(d) {
    return `
      <div class="auc-target">
        <div>
          <div class="auc-target-count"><b>${validCount(d)}</b> / ${d.winningBid || 0}</div>
          <div class="auc-target-label">${esc(t(`${nameOf(d.winnerUserId)} bid ${d.winningBid || 0}`, `${nameOf(d.winnerUserId)} زايد بـ ${d.winningBid || 0}`))}</div>
        </div>
      </div>`;
  }

  function render() {
    renderPhase();
    restoreEndUi();
  }

  function renderPhase() {
    if (!latestRoom) return;

    if (latestRoom.status === 'ended') {
      window.BahjahTimerBar.stop('hc-auc');
      endPending = false;
      confirmingEnd = false;
      endNote = { text: '', tone: 'info' };
      mount.innerHTML = `
        <div style="text-align:center; padding-block:60px;">
          <p class="hc-stat">${esc(t(`You ended this game (code: ${code}).`, `أنهيت هذه اللعبة (الرمز: ${code}).`))}</p>
        </div>`;
      return;
    }

    if (!latestState) {
      mount.innerHTML = topbar(t('Starting the game…', 'جارٍ بدء اللعبة…'));
      return;
    }

    const d = latestState.data || {};
    const phase = latestState.phase;

    if (phase === 'countdown') {
      mount.innerHTML = `
        ${topbar(t('Get ready', 'استعدّوا'))}
        <div class="auc-stage auc-stage--host">
          <div class="auc-countdown">
            <div class="auc-countdown-num" id="hc-timer-text">3</div>
            <div class="auc-countdown-label">${t('The saleroom is opening', 'قاعة المزاد تفتح أبوابها')}</div>
          </div>
        </div>`;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (phase === 'bidding') {
      window.BahjahTimerBar.stop('hc-auc');
      mount.innerHTML = `
        ${topbar('')}
        <div class="auc-stage auc-stage--host">
          ${stageHead(d)}
          ${lotCard(d)}
          ${bidBlock(d)}
          ${paddles(d)}
          <p class="auc-foot">${
            d.currentBid
              ? esc(t(`${nameOf(d.turnUserId)} — raise or pass`, `${nameOf(d.turnUserId)} — زايد أو انسحب`))
              : t('The auction ends when everyone else has passed.', 'ينتهي المزاد عندما ينسحب الجميع.')
          }</p>
        </div>`;
      return;
    }

    if (phase === 'sold') {
      mount.innerHTML = `
        ${topbar('')}
        <div class="auc-stage auc-stage--host">
          ${stageHead(d)}
          ${lotCard(d)}
          <div class="auc-sold">
            <span class="auc-sold-word">${t('SOLD!', 'بيعت!')}</span>
            <p class="auc-sold-line">${
              d.winnerUserId
                ? esc(t(`${nameOf(d.winnerUserId)} for `, `${nameOf(d.winnerUserId)} بـ `)) + `<b>${d.winningBid}</b>`
                : t('Nobody took it.', 'لم يأخذها أحد.')
            }</p>
            ${d.winnerUserId ? `<p class="auc-foot">${t('Now prove it.', 'والآن أثبت ذلك.')}</p>` : ''}
          </div>
        </div>`;
      return;
    }

    if (phase === 'answering') {
      mount.innerHTML = `
        ${topbar('')}
        <div class="auc-stage auc-stage--host">
          ${stageHead(d)}
          ${lotCard(d)}
          ${targetBlock(d)}
          ${timerRow()}
          ${answerList(d, false)}
        </div>`;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (phase === 'judging') {
      window.BahjahTimerBar.stop('hc-auc');
      const target = d.winningBid || 0;
      const valid = validCount(d);
      mount.innerHTML = `
        ${topbar(t('Your call', 'القرار لك'))}
        <div class="auc-stage auc-stage--host">
          ${stageHead(d)}
          ${lotCard(d)}
          ${targetBlock(d)}
          <p class="auc-foot">${t(
            'Everything counts unless you say otherwise — tap anything that should not.',
            'كل إجابة محتسبة ما لم تقرر خلاف ذلك — اضغط على أي إجابة لا تُحتسب.'
          )}</p>
          ${answerList(d, true)}
          <div class="hc-actions">
            <button type="button" id="hc-confirm-btn" class="btn btn-primary">${
              valid >= target && target > 0
                ? esc(t(`Confirm — bid made (${valid}/${target})`, `تأكيد — تحققت المزايدة (${valid}/${target})`))
                : esc(t(`Confirm — ${valid} of ${target}`, `تأكيد — ${valid} من ${target}`))
            }</button>
          </div>
        </div>`;
      return;
    }

    if (phase === 'results') {
      window.BahjahTimerBar.stop('hc-auc');
      renderResults(d);
      return;
    }

    if (phase === 'finished') {
      window.BahjahTimerBar.stop('hc-auc');
      renderFinished(d);
    }
  }

  function renderResults(d) {
    const r = d.lastRound;
    const scores = d.scores || {};
    const continued = d.continueUserIds || [];
    const rows = players()
      .map((m) => ({ userId: m.userId, displayName: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
    const top = rows.reduce((max, x) => Math.max(max, x.score), 0) || 1;
    const isLast = d.roundIndex + 1 >= d.totalRounds;

    const headline = !r || !r.winnerUserId
      ? t('No sale.', 'لم تُبع.')
      : r.success
        ? esc(t(`${nameOf(r.winnerUserId)} made it.`, `${nameOf(r.winnerUserId)} حققها.`))
        : esc(t(`${nameOf(r.winnerUserId)} fell short.`, `${nameOf(r.winnerUserId)} لم يكملها.`));

    mount.innerHTML = `
      ${topbar('')}
      <div class="auc-stage auc-stage--host">
        ${stageHead(d)}
        <div class="auc-verdict ${r && r.success ? 'is-made' : 'is-failed'}">
          <span class="auc-verdict-badge" aria-hidden="true">${r && r.success ? '✓' : '✕'}</span>
          <div class="auc-verdict-copy">
            <h2>${headline}</h2>
            <p>${r && r.winnerUserId ? esc(t(`Bid ${r.bid}, found ${r.validCount}.`, `زايد بـ ${r.bid}، ووجد ${r.validCount}.`)) : esc(t('Nobody bid on this lot.', 'لم يزايد أحد على هذه القطعة.'))}</p>
          </div>
          ${r && r.winnerUserId ? `<div class="auc-verdict-pts"><b>+${r.awarded}</b><span>${t('Points', 'نقطة')}</span></div>` : ''}
        </div>
        ${answerList(d, false)}
        <h2 class="auc-screen-title">${t('Standings.', 'الترتيب.')}</h2>
        <div class="auc-ranks" id="hc-standings"></div>
        <div class="hc-actions">
          <button type="button" id="hc-next-btn" class="btn btn-primary">${
            isLast ? t('Final results', 'النتائج النهائية') : t('Next lot', 'القطعة التالية')
          }</button>
        </div>
        <p class="auc-foot">${esc(
          t(`${continued.length} of ${rows.length} ready — or move the room on yourself`,
            `${continued.length} من ${rows.length} جاهزون — أو انتقل بالغرفة بنفسك`)
        )}</p>
      </div>`;

    window.BahjahRankedBoard.render('auction-host', document.getElementById('hc-standings'), rows, (row, i) => {
      const pct = Math.max(4, Math.round((row.score / top) * 100));
      const delta = r && r.winnerUserId === row.userId && r.awarded > 0 ? r.awarded : 0;
      return `
        <div class="auc-rank">
          <div class="auc-rank-line">
            <span class="auc-rank-no">${i + 1}</span>
            <span class="auc-rank-av">${esc((row.displayName || '?').trim().charAt(0).toUpperCase())}</span>
            <span class="auc-rank-name">${esc(row.displayName)}${continued.includes(row.userId) ? ' ✓' : ''}</span>
            ${delta ? `<span class="auc-rank-delta">+${delta}</span>` : ''}
            <span class="auc-rank-total">${row.score}</span>
          </div>
          <div class="auc-rank-bar"><span style="width:${pct}%"></span></div>
        </div>`;
    });
  }

  function renderFinished(d) {
    const scores = d.scores || {};
    const stats = d.finalStats || {};
    const winners = new Set(d.winnerUserIds || []);
    const rows = players()
      .map((m) => ({ userId: m.userId, displayName: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
    const winnerNames = rows.filter((r) => winners.has(r.userId)).map((r) => r.displayName);

    // The spec's closing figures: how many auctions each player actually made
    // good on, and the biggest bid anybody delivered.
    const best = (pick) =>
      rows.map((r) => ({ name: r.displayName, value: pick(stats[r.userId] || {}) || 0 })).sort((a, b) => b.value - a.value)[0];
    const mostMade = best((s) => s.successfulAuctions);
    const biggest = best((s) => s.highestSuccessfulBid);

    const awards = [
      mostMade && mostMade.value > 0
        ? { title: t('Most auctions made', 'الأكثر تحقيقًا'), name: mostMade.name, note: t(`${mostMade.value} delivered`, `${mostMade.value} محققة`) }
        : null,
      biggest && biggest.value > 0
        ? { title: t('Biggest bid delivered', 'أكبر مزايدة محققة'), name: biggest.name, note: t(`${biggest.value} answers`, `${biggest.value} إجابة`) }
        : null,
    ].filter(Boolean);

    mount.innerHTML = `
      ${topbar(t('Game finished', 'انتهت اللعبة'))}
      <div class="auc-stage auc-stage--host">
        <div class="auc-winner">
          <div class="auc-winner-label">${t('Winner', 'الفائز')}</div>
          <h2 class="auc-winner-name">${esc(winnerNames.length ? winnerNames.join(t(', ', '، ')) : t('No winner', 'لا فائز'))}</h2>
          <p class="auc-winner-sub">${rows[0] ? esc(t(`${rows[0].score} points`, `${rows[0].score} نقطة`)) : ''}</p>
        </div>
        ${awards.length
          ? `<div class="auc-awards">
              ${awards
                .map(
                  (a) => `
                  <div class="auc-award">
                    <span class="auc-award-title">${esc(a.title)}</span>
                    <span class="auc-award-name">${esc(a.name)}</span>
                    <span class="auc-award-note">${esc(a.note)}</span>
                  </div>`
                )
                .join('')}
            </div>`
          : ''}
        <div class="auc-ranks" id="hc-standings"></div>
      </div>`;

    window.BahjahRankedBoard.render('auction-host', document.getElementById('hc-standings'), rows, (row, i) => `
      <div class="auc-rank ${winners.has(row.userId) ? 'is-me' : ''}">
        <div class="auc-rank-line">
          <span class="auc-rank-no">${winners.has(row.userId) ? '★' : i + 1}</span>
          <span class="auc-rank-av">${esc((row.displayName || '?').trim().charAt(0).toUpperCase())}</span>
          <span class="auc-rank-name">${esc(row.displayName)}</span>
          <span class="auc-rank-total">${row.score}</span>
        </div>
      </div>`);

    const actions = document.createElement('div');
    actions.className = 'hc-actions';
    actions.innerHTML = `<button type="button" id="hc-restart-btn" class="btn btn-primary">${t('Play again', 'العب مجددًا')}</button>`;
    mount.appendChild(actions);
  }
})();
