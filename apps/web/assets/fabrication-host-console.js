// فبركة | Fabrication -- the big screen. Mounted into #host-console on
// fabrication-lobby.html, where the host stays for the whole match
// (host-plays="false", so lobby-room.js never redirects them to the phone
// page). Same arrangement, and the same two events, as
// assets/trivia-host-console.js.
//
// Every screen is drawn on the 1280 x 720 stage the wireframes use and scaled
// to the television. The TV carries the question and the drama; the phones
// carry the private input.
(function () {
  const U = window.FabUI;
  const t = U.t;
  const esc = U.esc;
  const num = U.num;
  const mount = document.getElementById('host-console');
  if (!mount) return;

  const gate = document.getElementById('lobby-gate');
  const main = document.getElementById('lobby-main');

  let latestRoom = null;
  let latestState = null;
  let code = null;
  let socket = null;
  let active = false;

  // The reveal plays lie by lie, the truth stamped last, then the standings
  // (timings shared with the phones in FabUI.reveal). Timed from when this
  // round's reveal began rather than from the last render, so a lobby update
  // or a language switch mid-reveal does not restart the sequence.
  let revealTimer = null;
  let revealRound = null;
  let revealStartedAt = 0;
  let newPlayersPending = false;

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
    document.body.classList.add('is-tv');
    if (newPlayersPending && latestRoom.status === 'ended') startFreshRoom();
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

  window.addEventListener('resize', () => {
    if (active) U.fitTv(document.getElementById('hc-stage'));
  });

  // --- Ending the room: asks first, then says something either way. Same
  // control, and the same reasoning, as the trivia console's. ---------------
  let endPending = false;
  let confirmingEnd = false;
  let endNote = '';

  function endNotice(message) {
    endNote = message || '';
    const el = document.getElementById('hc-end-note');
    if (el) el.textContent = endNote;
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
        : t('End game', 'أنهِ اللعبة');
  }

  function startFreshRoom() {
    newPlayersPending = false;
    if (window.BahjahRoomActions) window.BahjahRoomActions.createRoom('fabrication');
    else window.location.href = 'fabrication.html';
  }

  document.addEventListener('click', (e) => {
    if (!active) return;
    if (e.target.closest('#hc-restart-btn')) {
      if (socket) socket.emit('room:restart');
      return;
    }
    // A new group: close this room and open a fresh one, with its own code,
    // for the next people to join.
    if (e.target.closest('#hc-new-btn')) {
      if (newPlayersPending) return;
      newPlayersPending = true;
      e.target.closest('#hc-new-btn').disabled = true;
      if (socket) socket.emit('room:end');
      setTimeout(() => newPlayersPending && startFreshRoom(), 2500);
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
        endNotice(t('This ends the game for everyone.', 'سيؤدي هذا إلى إنهاء اللعبة لجميع اللاعبين.'));
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
        endNotice(t('Not connected — reload the page.', 'لا يوجد اتصال — أعد تحميل الصفحة.'));
        paintEndButton();
        return;
      }
      endPending = true;
      paintEndButton();
      endNotice(t('Ending the game…', 'جارٍ إنهاء اللعبة…'));
      socket.emit('room:end');
      setTimeout(() => {
        if (!endPending) return;
        endPending = false;
        paintEndButton();
        endNotice(t('No response — try again.', 'لا استجابة — حاول مرة أخرى.'));
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

  const list = (names) => names.join(t(', ', '، '));

  // The question, in the game's language.
  function questionText() {
    return U.question(latestState && latestState.data);
  }

  function roundLabel(d) {
    return d.totalRounds
      ? t(`Round ${d.roundIndex + 1} of ${d.totalRounds}`, `الجولة ${num(d.roundIndex + 1)} من ${num(d.totalRounds)}`)
      : '';
  }

  // The stage, with the host's quiet controls in the corner.
  function stage(inner, dark) {
    mount.innerHTML = `
      <div class="fab-tv-frame">
        <div class="fab-tv${dark ? ' is-dark' : ''}" id="hc-stage">
          ${inner}
          <div class="fab-tv-ctrl">
            <span class="fab-tv-ctrl-note" id="hc-end-note" role="status">${esc(endNote)}</span>
            <button type="button" class="fab-tv-lang" onclick="toggleLang()">${U.isAr() ? 'EN' : 'ع'}</button>
            <button type="button" id="hc-end-btn">${t('End game', 'أنهِ اللعبة')}</button>
          </div>
        </div>
      </div>`;
    U.fitTv(document.getElementById('hc-stage'));
    paintEndButton();
  }

  function timerRow() {
    return `
      <div class="fab-timer">
        <div class="fab-timer-track"><div class="fab-timer-fill" id="hc-timer-fill"></div></div>
        <div class="fab-ring" id="hc-ring"><span id="hc-timer-text"></span></div>
      </div>`;
  }

  function startTimer(endsAt) {
    const ringEl = document.getElementById('hc-ring');
    const textEl = document.getElementById('hc-timer-text');
    window.BahjahTimerBar.start('hc-fab', document.getElementById('hc-timer-fill'), null, endsAt, {
      onTick: (secs) => {
        if (textEl) textEl.textContent = num(Math.max(0, secs));
        if (ringEl) ringEl.classList.toggle('is-danger', secs > 0 && secs <= 5);
      },
    });
  }

  function render() {
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    window.BahjahTimerBar.stop('hc-fab');
    clearInterval(window.__fabHcCountdown);
    renderPhase();
  }

  function renderPhase() {
    if (!latestRoom) return;

    if (latestRoom.status === 'ended') {
      endPending = false;
      confirmingEnd = false;
      endNote = '';
      stage(`
        <div class="fab-tv-pad" style="justify-content:center; align-items:center; text-align:center; gap:18px;">
          ${U.logo('light', 'fab-logo hc-ended-logo')}
          <span class="fab-kicker fab-kicker--red" style="font-size:15px;">${t('Room closed', 'أُغلقت الغرفة')}</span>
          <h2 style="font-size:40px; font-weight:900;">${esc(t(`You ended this game (code: ${code}).`, `أنهيت هذه اللعبة (الرمز: ${code}).`))}</h2>
          ${newPlayersPending ? `<p class="fab-foot" style="font-size:18px;">${t('Opening a fresh room…', 'جارٍ فتح غرفة جديدة…')}</p>` : ''}
        </div>`);
      // Nothing left to end.
      document.getElementById('hc-end-btn')?.remove();
      return;
    }

    if (!latestState) {
      stage(`<div class="fab-tv-pad" style="justify-content:center; align-items:center;"><span class="fab-kicker" style="font-size:15px;">${t('Starting the game…', 'جارٍ بدء اللعبة…')}</span></div>`);
      return;
    }

    const d = latestState.data || {};
    const phase = latestState.phase;
    if (U.adoptGameLang(d)) return;
    if (phase !== 'reveal') revealRound = null;

    if (phase === 'countdown') return renderCountdown(d);
    if (phase === 'question' || phase === 'fabrication') return renderWrite(d, phase === 'question');
    if (phase === 'voting') return renderVote(d);
    if (phase === 'reveal') return renderReveal(d);
    if (phase === 'finished') return renderFinished(d);
  }

  function renderCountdown(d) {
    stage(`
      <div class="fab-tv-pad" style="justify-content:center; align-items:center; gap:28px;">
        ${U.logo('light', 'fab-logo hc-count-logo')}
        <div class="fab-countdown" style="padding:0;">
          <div class="fab-countdown-num" id="hc-count">${num(3)}</div>
          <span class="fab-kicker" style="font-size:16px;">${t('Everyone is about to lie to you', 'الجميع على وشك الكذب عليك')}</span>
        </div>
      </div>`);
    const el = document.getElementById('hc-count');
    const tick = () => {
      const secs = Math.max(0, Math.ceil(((d.phaseEndsAt || Date.now()) - Date.now()) / 1000));
      if (el) el.textContent = secs > 0 ? num(secs) : t('Go', 'هيا');
    };
    tick();
    window.__fabHcCountdown = setInterval(tick, 250);
  }

  // 05 · Write (and the reading phase before it, which looks the same with no
  // one writing yet): the taped question sheet beside a red cutout panel.
  function renderWrite(d, reading) {
    const q = questionText();
    const category = d.currentQuestion ? U.category(d.currentQuestion.category, U.gameLang(d)) : '';
    const roster = players();
    const done = d.submittedUserIds || [];
    const doneCount = d.submittedCount || done.length;
    stage(`
      <div class="fab-tv-pad" style="gap:26px;">
        <div class="hc-row">
          <div class="hc-row-l">
            <span class="hc-round">${esc(roundLabel(d))}</span>
            ${category ? `<span class="fab-chip fab-chip--cat">${esc(category)}</span>` : ''}
          </div>
          <span class="hc-code" dir="ltr">${esc(code)}</span>
        </div>
        <div class="hc-write">
          <div class="hc-sheet">
            <span class="hc-tape" aria-hidden="true"></span>
            <span class="fab-kicker fab-kicker--red" style="font-size:15px; letter-spacing:.16em;">${
              reading ? t('Read it out', 'اقرأه بصوت عالٍ') : t('Write your lie on your phone', 'اكتب كذبتك على هاتفك')
            }</span>
            <h2 class="${q.length > 90 ? 'is-long' : ''}">${esc(q)}</h2>
          </div>
          <div class="fab-accent fab-accent--red hc-cut"><span class="fab-cutout" data-cutout="${esc(d.currentQuestion ? d.currentQuestion.category : '')}"></span></div>
        </div>
        ${timerRow()}
        <div class="hc-row">
          ${reading
            ? `<span class="hc-sub">${t('No answers yet — just the question.', 'لا إجابات بعد — السؤال فقط.')}</span><span></span>`
            : `<div class="fab-waiting">${roster
                .map((m) => {
                  const isIn = done.includes(m.userId);
                  return `<span class="fab-chip fab-chip--wait ${isIn ? 'is-in' : ''}">${esc(m.displayName)}${isIn ? ' ✓' : ''}</span>`;
                })
                .join('')}</div>
              <b class="hc-count">${esc(t(`${doneCount} of ${roster.length} have written theirs`, `${num(doneCount)} من ${num(roster.length)} كتبوا كذبتهم`))}</b>`}
        </div>
      </div>`);
    startTimer(d.phaseEndsAt);
  }

  // 05 · Vote board. Fairness rule: before the reveal every option looks the
  // same -- no colour, order or stamp hint on the truth.
  function renderVote(d) {
    const options = d.options || [];
    const voted = d.votedCount || 0;
    const radii = ['var(--fab-radius)', 'var(--fab-radius-flip)'];
    const size = options.length > 8 ? 'is-tight' : options.length > 6 ? 'is-dense' : '';
    stage(`
      <div class="fab-tv-pad" style="gap:22px;">
        <div class="hc-vote-head">
          <div style="display:flex; flex-direction:column; gap:6px; min-width:0;">
            <span class="fab-kicker fab-kicker--red" style="font-size:15px; letter-spacing:.16em;">${t('Which one is true?', 'أيها الحقيقي؟')}</span>
            <h2>${esc(questionText())}</h2>
          </div>
          <div style="width:280px; flex:none;">${timerRow()}</div>
        </div>
        <div class="hc-board ${size}">
          ${options
            .map(
              (o, i) => `
              <div class="hc-opt" style="border-radius:${radii[i % 2]};">
                <span class="hc-opt-key">${esc(o.key)}</span>
                <span class="hc-opt-text">${esc(o.text)}</span>
              </div>`
            )
            .join('')}
        </div>
        <div class="hc-row">
          <span class="hc-sub">${t("Everyone's lies, plus the real answer. Shuffled.", 'كل الأكاذيب، مع الإجابة الحقيقية. مخلوطة.')}</span>
          <b class="hc-count">${esc(t(`${voted} of ${players().length} have voted`, `${num(voted)} من ${num(players().length)} صوّتوا`))}</b>
        </div>
      </div>`);
    startTimer(d.phaseEndsAt);
  }

  // 05 · Reveal, on ink: the lies one at a time, stamped FAKE, then the
  // truth stamped TRUE, who found it, and the round's best lie. Then the
  // standings.
  function renderReveal(d) {
    const rows = d.reveal || [];
    const lies = rows
      .filter((r) => !r.isTruth)
      .map((r) => ({ ...r, fooled: r.voterUserIds.filter((v) => !r.authorUserIds.includes(v)).length }))
      .sort((a, b) => b.fooled - a.fooled);
    const truth = rows.find((r) => r.isTruth);

    if (revealRound !== d.roundIndex) {
      revealRound = d.roundIndex;
      const key = `fab_hc_reveal_${code}_${d.roundIndex}_${d.currentQuestion ? d.currentQuestion.id : ''}`;
      let saved = 0;
      try { saved = Number(sessionStorage.getItem(key)) || 0; } catch {}
      revealStartedAt = saved && Date.now() - saved < 10 * 60 * 1000 ? saved : Date.now();
      try { sessionStorage.setItem(key, String(revealStartedAt)); } catch {}
    }
    const elapsed = Date.now() - revealStartedAt;
    const truthAt = U.reveal.truthAt(lies.length);
    const standingsAt = U.reveal.standingsAt(lies.length);

    if (elapsed >= standingsAt) return renderStandings(d);

    // Which beats have landed, and when the next one is due.
    const shown = lies.filter((_, i) => elapsed >= U.reveal.lieAt(i)).length;
    const truthShown = elapsed >= truthAt;
    const nextAt = shown < lies.length ? U.reveal.lieAt(shown) : truthShown ? standingsAt : truthAt;
    revealTimer = setTimeout(() => {
      revealTimer = null;
      if (active) render();
    }, Math.max(50, nextAt - elapsed));
    // A beat that landed more than a moment ago is drawn still, so a
    // re-render does not drop every stamp in again.
    const still = (at) => (elapsed - at > 450 ? ' is-still' : '');

    const density = lies.length > 7 ? 'is-grid' : lies.length > 4 ? 'is-dense' : '';
    const answer = U.gameLang(d) === 'ar' && d.answerAr ? d.answerAr : d.answer;
    const finders = truth ? truth.voterUserIds.map(nameOf) : [];
    const bestFooled = lies.length ? lies[0].fooled : 0;
    const bestLiars = bestFooled > 0 ? lies.filter((l) => l.fooled === bestFooled).flatMap((l) => l.authorUserIds.map(nameOf)) : [];

    stage(`
      <div class="hc-reveal">
        <div class="hc-lies ${density}">
          <span class="fab-kicker fab-kicker--yellow" style="font-size:15px; letter-spacing:.16em;">${t('Lies, one by one', 'الأكاذيب، واحدة تلو الأخرى')}</span>
          <div class="hc-lies-list">
            ${lies
              .slice(0, shown)
              .map((l, i) => {
                const authors = list(l.authorUserIds.map(nameOf));
                const meta = l.fooled
                  ? t(`${authors} · fooled ${l.fooled}`, `${authors} · خدعت ${num(l.fooled)}`)
                  : t(`${authors} · fooled nobody`, `${authors} · لم تخدع أحدًا`);
                return `
                  <div class="hc-lie">
                    <span class="hc-opt-key">${esc(l.key)}</span>
                    <div class="hc-lie-body">
                      <b>${esc(l.text)}</b>
                      <span>${esc(meta)}</span>
                    </div>
                    <span class="fab-stamp fab-stamp--lie${still(U.reveal.lieAt(i))}">${t('Fake', 'مزيّف')}</span>
                  </div>`;
              })
              .join('')}
          </div>
        </div>
        <div class="hc-truth">
          ${truthShown
            ? `
            <div class="fab-reveal-card">
              <span class="fab-kicker">${t('The real answer', 'الإجابة الحقيقية')}</span>
              <h2 class="fab-reveal-answer">${esc(answer || (truth ? truth.text : ''))}</h2>
              <span class="fab-stamp fab-stamp--truth fab-stamp--lg${still(truthAt)}">${t('True', 'حقيقي')}</span>
            </div>
            <div class="hc-found">
              <span class="fab-kicker fab-kicker--blue" style="font-size:13px;">${t('Found it', 'اكتشفوها')}</span>
              <b>${esc(
                finders.length
                  ? finders.length === 1
                    ? t(`${finders[0]} · +2`, `${finders[0]} · +٢`)
                    : t(`${list(finders)} · +2 each`, `${list(finders)} · +٢ لكلٍّ منهم`)
                  : t('Nobody. Not one of you.', 'لا أحد. ولا واحد منكم.')
              )}</b>
              ${d.source ? `<span>${esc(t(`Source: ${d.source}`, `المصدر: ${d.source}`))}</span>` : ''}
            </div>
            ${bestLiars.length
              ? `<div class="hc-best">
                  <span class="fab-kicker" style="color:var(--ink); font-size:13px; font-weight:900;">${t('Best lie this round', 'أفضل كذبة في الجولة')}</span>
                  <b>${esc(list(bestLiars))}</b>
                </div>`
              : ''}`
            : `<div class="hc-truth-wait">
                <span class="fab-kicker fab-kicker--yellow" style="font-size:15px;">${t('The truth comes last', 'الحقيقة في الآخر')}</span>
                <h2>${esc(questionText())}</h2>
              </div>`}
        </div>
      </div>`, true);
  }

  function rankRows(rows, deltas, readyIds) {
    const top = rows.reduce((max, r) => Math.max(max, r.score), 0);
    return rows
      .map((row, i) => {
        const pct = top > 0 && row.score > 0 ? Math.max(4, Math.round((row.score / top) * 100)) : 0;
        const delta = deltas && deltas[row.userId] && deltas[row.userId].total;
        const ready = readyIds && readyIds.includes(row.userId);
        return `
          <div class="fab-rank">
            <div class="fab-rank-line">
              <span class="fab-rank-no">${num(i + 1)}</span>
              <span class="fab-rank-av" data-c="${i % 4}">${esc((row.displayName || '?').trim().charAt(0).toUpperCase())}</span>
              <span class="fab-rank-name">${esc(row.displayName)}${ready ? ' ✓' : ''}</span>
              ${delta ? `<span class="fab-rank-delta">+${num(delta)}</span>` : ''}
              <span class="fab-rank-total">${num(row.score)}</span>
            </div>
            <div class="fab-rank-bar"><span style="width:${pct}%"></span></div>
          </div>`;
      })
      .join('');
  }

  function sortedPlayers(d) {
    const scores = d.scores || {};
    return players()
      .map((m) => ({ userId: m.userId, displayName: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
  }

  function renderStandings(d) {
    const rows = sortedPlayers(d);
    const continued = d.continueUserIds || [];
    const isLastRound = d.roundIndex + 1 >= d.totalRounds;
    stage(`
      <div class="fab-tv-pad" style="gap:18px;">
        <div class="hc-row" style="align-items:flex-end;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span class="fab-kicker" style="font-size:15px;">${t(`After round ${d.roundIndex + 1}`, `بعد الجولة ${num(d.roundIndex + 1)}`)}</span>
            <h2 style="font-size:44px; font-weight:900; line-height:1.05;">${t('Standings.', 'الترتيب.')}</h2>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
            <button type="button" id="hc-next-btn" class="fab-btn fab-btn--lg">${
              isLastRound ? t('Final results', 'النتائج النهائية') : t('Next round', 'الجولة التالية')
            }</button>
            <span class="hc-sub" style="font-size:14px;">${esc(
              t(`${continued.length} of ${rows.length} ready — or move the room on yourself`,
                `${num(continued.length)} من ${num(rows.length)} جاهزون — أو انتقل بالغرفة بنفسك`)
            )}</span>
          </div>
        </div>
        <div class="fab-ranks hc-ranks ${rows.length > 6 ? 'is-two' : ''}">${rankRows(rows, d.lastRoundScores || {}, continued)}</div>
      </div>`);
  }

  // 06 · Results: the winner, three titles, the final standings, and what
  // next -- the same group again, or a fresh room for new people.
  function renderFinished(d) {
    const stats = d.finalStats || {};
    const winners = new Set(d.winnerUserIds || []);
    const rows = sortedPlayers(d);
    const winnerRows = rows.filter((r) => winners.has(r.userId));
    const winnerNames = winnerRows.map((r) => r.displayName);

    // Each title is only handed out when somebody actually earned it -- an
    // award for zero of something is not an award.
    const best = (pick) =>
      rows
        .map((r) => ({ name: r.displayName, value: pick(stats[r.userId] || {}) || 0 }))
        .sort((a, b) => b.value - a.value)[0];
    const forger = best((s) => s.playersFooled);
    const detector = best((s) => s.correctVotes);
    const mark = best((s) => s.timesFooled);
    const titles = [
      forger && forger.value > 0
        ? { cls: 'is-red', title: t('Master forger', 'أمهر مزوّر'), who: forger.name, why: t(`Fooled ${forger.value} ${forger.value === 1 ? 'player' : 'players'}`, `خدع ${U.count(forger.value, 'player')}`) }
        : null,
      detector && detector.value > 0
        ? { cls: 'is-blue', title: t('Lie detector', 'كاشف الكذب'), who: detector.name, why: t(`Found ${detector.value} of ${d.totalRounds}`, `اكتشف ${num(detector.value)} من ${num(d.totalRounds)}`) }
        : null,
      mark && mark.value > 0
        ? { cls: '', title: t('Easy mark', 'أسهل ضحية'), who: mark.name, why: t(`Fooled ${mark.value} ${mark.value === 1 ? 'time' : 'times'}`, `انخدع ${U.count(mark.value, 'time')}`) }
        : null,
    ].filter(Boolean);

    const lead = winnerRows[0];
    const leadFooled = lead && stats[lead.userId] ? stats[lead.userId].playersFooled : 0;
    const sub = lead
      ? t(
          `${lead.score} points${leadFooled ? ` · fooled the room ${leadFooled} ${leadFooled === 1 ? 'time' : 'times'}` : ''}`,
          `${U.count(lead.score, 'point')}${leadFooled ? ` · خدع الغرفة ${U.count(leadFooled, 'time')}` : ''}`
        )
      : '';

    stage(`
      <div class="hc-results">
        <div style="display:flex; flex-direction:column; gap:20px; min-width:0;">
          <div class="fab-winner">
            <span class="fab-label">${winnerNames.length > 1 ? t('Winners', 'الفائزون') : t('Winner', 'الفائز')}</span>
            <h2 class="fab-winner-name">${esc(winnerNames.length ? list(winnerNames) : t('Nobody. Everyone lied badly.', 'لا أحد. الكل كذب بشكل سيئ.'))}</h2>
            ${sub ? `<p class="fab-winner-sub">${esc(sub)}</p>` : ''}
          </div>
          <div class="hc-titles">
            ${titles
              .map(
                (x) => `
                <div class="hc-title ${x.cls}">
                  <span class="fab-kicker">${esc(x.title)}</span>
                  <b>${esc(x.who)}</b>
                  <span>${esc(x.why)}</span>
                </div>`
              )
              .join('')}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; min-width:0;">
          <span class="fab-kicker" style="font-size:15px; letter-spacing:.16em;">${t('Final standings', 'الترتيب النهائي')}</span>
          <div class="fab-ranks hc-ranks is-final">${rankRows(rows)}</div>
          <div style="margin-top:auto; display:flex; gap:12px; justify-content:flex-end;">
            <button type="button" id="hc-new-btn" class="fab-btn fab-btn--ghost fab-btn--lg">${t('New players', 'لاعبون جدد')}</button>
            <button type="button" id="hc-restart-btn" class="fab-btn fab-btn--lg">${t('Rematch', 'جولة ثانية')}</button>
          </div>
        </div>
      </div>`);
  }
})();
