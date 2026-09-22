// فبركة | Fabrication -- the big screen. Mounted into #host-console on
// fabrication-lobby.html, where the host stays for the whole match
// (host-plays="false", so lobby-room.js never redirects them to the phone
// page). Same arrangement, and the same two events, as
// assets/trivia-host-console.js.
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

  // The reveal is staged rather than dropped on the room at once: the truth
  // lands first, then who wrote what, then the standings. The spec asks for
  // exactly this -- the reveal is the game's payoff and needs room to breathe.
  const TRUTH_MS = 3200;
  const VERDICT_MS = 5200;
  let revealTimer = null;
  let revealRound = null;
  let revealStartedAt = 0;

  function t(en, ar) {
    return LANG() === 'ar' ? ar : en;
  }

  // Arabic counts one, a pair, then a plural -- see the same helpers in
  // assets/fabrication-play.js.
  function arTimes(n) {
    if (n === 1) return 'مرة واحدة';
    if (n === 2) return 'مرتين';
    return `${n} مرات`;
  }
  function arPlayers(n) {
    if (n === 1) return 'لاعبًا واحدًا';
    if (n === 2) return 'لاعبين اثنين';
    return `${n} لاعبين`;
  }
  function arTruths(n) {
    if (n === 1) return 'حقيقة واحدة';
    if (n === 2) return 'حقيقتين';
    return `${n} حقائق`;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

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
    if (state.gameType !== 'fabrication') return;
    latestState = state;
    if (active) render();
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (active) render();
  });

  // --- Ending the room: asks first, then says something either way. Same
  // control, and the same reasoning, as the trivia console's. ---------------
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

  function questionText(q) {
    if (!q) return '';
    return LANG() === 'ar' && q.promptAr ? q.promptAr : q.prompt;
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

  function stageHead(d, right) {
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
        <div class="fab-timer-track"><div class="fab-timer-fill" id="hc-timer-fill"></div></div>
        <div class="fab-ring" id="hc-ring"><span id="hc-timer-text"></span></div>
      </div>`;
  }

  function questionCard(d, kicker) {
    return `
      <div class="fab-question">
        <span class="fab-question-kicker">${esc(kicker)}</span>
        <h2>${esc(questionText(d.currentQuestion))}</h2>
      </div>`;
  }

  function startTimer(endsAt) {
    const ringEl = document.getElementById('hc-ring');
    const textEl = document.getElementById('hc-timer-text');
    window.BahjahTimerBar.start('hc-fab', document.getElementById('hc-timer-fill'), null, endsAt, {
      onTick: (secs) => {
        if (textEl) textEl.textContent = String(Math.max(0, secs));
        const danger = secs <= 5;
        if (ringEl) ringEl.classList.toggle('is-danger', danger);
        const fill = document.getElementById('hc-timer-fill');
        if (fill) fill.classList.toggle('is-danger', danger);
      },
    });
  }

  // Who the room is still waiting on. Shown as names rather than a bare count
  // so the room can chase the person holding it up, which is half the fun.
  function waitingStrip(doneCount, doneNames) {
    const roster = players();
    return `
      <div class="fab-waiting">
        ${roster
          .map((m) => {
            const isIn = doneNames.includes(m.userId);
            return `<span class="fab-waiting-chip ${isIn ? 'is-in' : ''}">${isIn ? '✓' : '…'} ${esc(m.displayName)}</span>`;
          })
          .join('')}
      </div>
      <p class="fab-foot">${esc(t(`${doneCount} of ${roster.length} in`, `${doneCount} من ${roster.length} جاهزون`))}</p>`;
  }

  function render() {
    renderPhase();
    restoreEndUi();
  }

  function renderPhase() {
    if (!latestRoom) return;

    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }

    if (latestRoom.status === 'ended') {
      window.BahjahTimerBar.stop('hc-fab');
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
      revealRound = null;
      mount.innerHTML = `
        ${topbar(t('Get ready', 'استعدّوا'))}
        <div class="fab-stage fab-stage--host">
          <div class="fab-countdown">
            <div class="fab-countdown-num" id="hc-timer-text">3</div>
            <div class="fab-countdown-label">${t('Everyone is about to lie to you', 'الجميع على وشك الكذب عليك')}</div>
          </div>
        </div>`;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (phase === 'question') {
      mount.innerHTML = `
        ${topbar('')}
        <div class="fab-stage fab-stage--host">
          ${stageHead(d, '')}
          ${timerRow()}
          ${questionCard(d, t('Read it out', 'اقرأه بصوت عالٍ'))}
          <p class="fab-foot">${t('No answers yet — just the question.', 'لا إجابات بعد — السؤال فقط.')}</p>
        </div>`;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (phase === 'fabrication') {
      // The server sends a count, not a list of who: the phones are writing
      // in private and the television must not hint at what anybody typed.
      const done = d.submittedCount || 0;
      mount.innerHTML = `
        ${topbar('')}
        <div class="fab-stage fab-stage--host">
          ${stageHead(d, '')}
          ${timerRow()}
          ${questionCard(d, t('Invent an answer', 'اخترعوا إجابة'))}
          <p class="fab-foot">${esc(t(`${done} of ${players().length} have written theirs`, `${done} من ${players().length} كتبوا إجابتهم`))}</p>
        </div>`;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (phase === 'voting') {
      const options = d.options || [];
      const voted = d.votedCount || 0;
      mount.innerHTML = `
        ${topbar('')}
        <div class="fab-stage fab-stage--host">
          ${stageHead(d, '')}
          ${timerRow()}
          ${questionCard(d, t('One of these is true', 'واحدة منها صحيحة'))}
          <div class="fab-options">
            ${options
              .map(
                (o) => `
                <div class="fab-option is-static">
                  <span class="fab-option-key">${esc(o.key)}</span>
                  <span class="fab-option-text">${esc(o.text)}</span>
                </div>`
              )
              .join('')}
          </div>
          <p class="fab-foot">${esc(t(`${voted} of ${players().length} have voted`, `${voted} من ${players().length} صوّتوا`))}</p>
        </div>`;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (phase === 'reveal') {
      renderRevealStaged(d);
      return;
    }

    if (phase === 'finished') {
      window.BahjahTimerBar.stop('hc-fab');
      renderFinished(d);
    }
  }

  // Three views, one after the other, inside the single reveal phase: the
  // truth, then who fooled whom, then the standings. Timed from when this
  // round's reveal began rather than from the last render, so a lobby update
  // or a language switch mid-reveal does not restart the sequence.
  function renderRevealStaged(d) {
    window.BahjahTimerBar.stop('hc-fab');
    if (revealRound !== d.roundIndex) {
      revealRound = d.roundIndex;
      revealStartedAt = Date.now();
    }
    const elapsed = Date.now() - revealStartedAt;

    if (elapsed < TRUTH_MS) {
      renderTruth(d);
      revealTimer = setTimeout(() => {
        revealTimer = null;
        if (active) render();
      }, TRUTH_MS - elapsed);
      return;
    }
    if (elapsed < TRUTH_MS + VERDICT_MS) {
      renderVerdicts(d);
      revealTimer = setTimeout(() => {
        revealTimer = null;
        if (active) render();
      }, TRUTH_MS + VERDICT_MS - elapsed);
      return;
    }
    renderStandings(d);
  }

  function renderTruth(d) {
    const answer = LANG() === 'ar' && d.answerAr ? d.answerAr : d.answer;
    mount.innerHTML = `
      ${topbar('')}
      <div class="fab-stage fab-stage--host">
        ${stageHead(d, '')}
        ${questionCard(d, t('The question was', 'كان السؤال'))}
        <div class="fab-reveal-card is-truth">
          <span class="fab-reveal-kicker">${t('The real answer', 'الإجابة الحقيقية')}</span>
          <h2 class="fab-reveal-answer">${esc(answer || '')}</h2>
          ${d.source ? `<p class="fab-reveal-source">${t('Source', 'المصدر')}: ${esc(d.source)}</p>` : ''}
        </div>
      </div>`;
  }

  function renderVerdicts(d) {
    const rows = d.reveal || [];
    mount.innerHTML = `
      ${topbar('')}
      <div class="fab-stage fab-stage--host">
        ${stageHead(d, '')}
        <h2 class="fab-screen-title">${t('Who fooled whom.', 'من خدع من.')}</h2>
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
                    `${authors.join(', ')} wrote it${voters.length ? ` · fooled ${voters.join(', ')}` : ' · fooled nobody'}`,
                    `كتبها ${authors.join('، ')}${voters.length ? ` · انطلت على ${voters.join('، ')}` : ' · لم تنطلِ على أحد'}`
                  );
              const points = row.isTruth ? 0 : voters.length * 2;
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
                      ? `<span class="fab-verdict-pts">+${points}</span>`
                      : `<span class="fab-stamp fab-stamp--lie">${t('Fake', 'مفبركة')}</span>`}
                </div>`;
            })
            .join('')}
        </div>
      </div>`;
  }

  function renderStandings(d) {
    const scores = d.scores || {};
    const deltas = d.lastRoundScores || {};
    const continued = d.continueUserIds || [];
    const rows = players()
      .map((m) => ({ userId: m.userId, displayName: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
    const topScore = rows.reduce((max, r) => Math.max(max, r.score), 0) || 1;
    const isLastRound = d.roundIndex + 1 >= d.totalRounds;

    mount.innerHTML = `
      ${topbar('')}
      <div class="fab-stage fab-stage--host">
        <h2 class="fab-screen-title">${t('Standings.', 'الترتيب.')}</h2>
        <div class="fab-ranks" id="hc-standings"></div>
        <div class="hc-actions">
          <button type="button" id="hc-next-btn" class="btn btn-primary">${
            isLastRound ? t('Final results', 'النتائج النهائية') : t('Next round', 'الجولة التالية')
          }</button>
        </div>
        <p class="fab-foot">${esc(
          t(`${continued.length} of ${rows.length} ready — or move the room on yourself`,
            `${continued.length} من ${rows.length} جاهزون — أو انتقل بالغرفة بنفسك`)
        )}</p>
      </div>`;

    window.BahjahRankedBoard.render('fabrication-host', document.getElementById('hc-standings'), rows, (row, i) => {
      const delta = deltas[row.userId];
      const pct = Math.max(4, Math.round((row.score / topScore) * 100));
      return `
        <div class="fab-rank">
          <div class="fab-rank-line">
            <span class="fab-rank-no">${i + 1}</span>
            <span class="fab-rank-av">${esc((row.displayName || '?').trim().charAt(0).toUpperCase())}</span>
            <span class="fab-rank-name">${esc(row.displayName)}${
              continued.includes(row.userId) ? ' ✓' : ''
            }</span>
            ${delta && delta.total ? `<span class="fab-rank-delta">+${delta.total}</span>` : ''}
            <span class="fab-rank-total">${row.score}</span>
          </div>
          <div class="fab-rank-bar"><span style="width:${pct}%"></span></div>
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

    // The spec's optional awards. Each is only shown when somebody actually
    // earned it -- an award for zero of something is not an award.
    const best = (pick) =>
      rows
        .map((r) => ({ name: r.displayName, value: pick(stats[r.userId] || {}) || 0 }))
        .sort((a, b) => b.value - a.value)[0];
    const truthMaster = best((s) => s.correctVotes);
    const masterFaker = best((s) => s.playersFooled);
    const mostFooled = best((s) => s.timesFooled);

    const awards = [
      truthMaster && truthMaster.value > 0
        ? { title: t('Trivia Master', 'سيد المعلومات'), name: truthMaster.name, note: t(`${truthMaster.value} truths found`, `اكتشف ${arTruths(truthMaster.value)}`) }
        : null,
      masterFaker && masterFaker.value > 0
        ? { title: t('Master Faker', 'سيد الفبركة'), name: masterFaker.name, note: t(`Fooled ${masterFaker.value} players`, `خدع ${arPlayers(masterFaker.value)}`) }
        : null,
      mostFooled && mostFooled.value > 0
        ? { title: t('Most Gullible', 'الأكثر تصديقًا'), name: mostFooled.name, note: t(`Fooled ${mostFooled.value} times`, `انطلت عليه ${arTimes(mostFooled.value)}`) }
        : null,
    ].filter(Boolean);

    mount.innerHTML = `
      ${topbar(t('Game finished', 'انتهت اللعبة'))}
      <div class="fab-stage fab-stage--host">
        <div class="fab-winner">
          <div class="fab-winner-label">${t('Winner', 'الفائز')}</div>
          <h2 class="fab-winner-name">${esc(winnerNames.length ? winnerNames.join(t(', ', '، ')) : t('No winner', 'لا فائز'))}</h2>
          <p class="fab-winner-sub">${rows[0] ? esc(t(`${rows[0].score} points`, `${rows[0].score} نقطة`)) : ''}</p>
        </div>

        ${awards.length
          ? `<div class="fab-awards">
              ${awards
                .map(
                  (a) => `
                  <div class="fab-award">
                    <span class="fab-award-title">${esc(a.title)}</span>
                    <span class="fab-award-name">${esc(a.name)}</span>
                    <span class="fab-award-note">${esc(a.note)}</span>
                  </div>`
                )
                .join('')}
            </div>`
          : ''}

        <div class="fab-ranks" id="hc-standings"></div>
      </div>`;

    window.BahjahRankedBoard.render('fabrication-host', document.getElementById('hc-standings'), rows, (row, i) => `
      <div class="fab-rank ${winners.has(row.userId) ? 'is-me' : ''}">
        <div class="fab-rank-line">
          <span class="fab-rank-no">${winners.has(row.userId) ? '★' : i + 1}</span>
          <span class="fab-rank-av">${esc((row.displayName || '?').trim().charAt(0).toUpperCase())}</span>
          <span class="fab-rank-name">${esc(row.displayName)}</span>
          <span class="fab-rank-total">${row.score}</span>
        </div>
      </div>`);

    const actions = document.createElement('div');
    actions.className = 'hc-actions';
    actions.innerHTML = `<button type="button" id="hc-restart-btn" class="btn btn-primary">${t('Play again', 'العب مجددًا')}</button>`;
    mount.appendChild(actions);
  }
})();
