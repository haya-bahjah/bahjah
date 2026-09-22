// إنسان حيوان جماد -- the big screen. Mounted into #host-console on
// insan-hayawan-jamad-lobby.html, where the host stays for the whole match.
//
// The television is where this game is actually played: §10 asks for every
// player, every answer and every mark to be up there as they arrive, because
// the scoring is a room decision and the room has to be able to see what it is
// agreeing to. The host does not write answers and does not mark anybody --
// they run the room and can move it on when a phone has been put down.
(function () {
  const mount = document.getElementById('host-console');
  if (!mount) return;

  const gate = document.getElementById('lobby-gate');
  const main = document.getElementById('lobby-main');

  let latestRoom = null;
  let latestState = null;
  let code = null;
  let socket = null;
  let active = false;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arNum = (n) => Number(n || 0).toLocaleString('ar-EG');

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
    if (state.gameType !== 'insan-hayawan-jamad') return;
    latestState = state;
    if (active) render();
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (active) render();
  });

  // --- Ending the room: same control and reasoning as the other consoles ---
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
    btn.textContent = endPending ? 'جارٍ الإنهاء…' : confirmingEnd ? 'اضغط للتأكيد' : 'أنهِ الغرفة';
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
        endNotice('سيؤدي هذا إلى إنهاء اللعبة لجميع اللاعبين.', 'warn');
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
        endNotice('لا يوجد اتصال — أعد تحميل الصفحة.', 'error');
        paintEndButton();
        return;
      }
      endPending = true;
      paintEndButton();
      endNotice('جارٍ إنهاء الغرفة…', 'info');
      socket.emit('room:end');
      setTimeout(() => {
        if (!endPending) return;
        endPending = false;
        paintEndButton();
        endNotice('لا استجابة — حاول مرة أخرى.', 'error');
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
    return member ? member.displayName : 'لاعب';
  }

  function topbar(label) {
    return `
      <div class="hc-topbar">
        <span class="hc-round-label">${esc(label || '')}</span>
        <div class="hc-end-wrap">
          <button type="button" id="hc-end-btn" class="hc-btn-secondary hc-end-btn">أنهِ الغرفة</button>
          <span id="hc-end-note" class="hc-end-note" role="status"></span>
        </div>
      </div>`;
  }

  function stageHead(d) {
    const round = d.totalRounds ? `الجولة ${arNum(d.roundIndex + 1)} من ${arNum(d.totalRounds)}` : '';
    return `<div class="ihj-head"><span class="ihj-round">${esc(round)}</span></div>`;
  }

  function letterRow(d) {
    return `
      <div class="ihj-letter-row">
        <div class="ihj-letter">${esc(d.currentLetter || '')}</div>
        <div class="ihj-letter-label">الحرف<b>${esc(d.currentLetter || '')}</b></div>
      </div>`;
  }

  function timerRow() {
    return `
      <div class="ihj-timer">
        <div class="ihj-timer-track"><div class="ihj-timer-fill" id="hc-timer-fill"></div></div>
        <div class="ihj-ring" id="hc-ring"><span id="hc-timer-text"></span></div>
      </div>`;
  }

  function startTimer(endsAt) {
    const ringEl = document.getElementById('hc-ring');
    const textEl = document.getElementById('hc-timer-text');
    window.BahjahTimerBar.start('hc-ihj', document.getElementById('hc-timer-fill'), null, endsAt, {
      onTick: (secs) => {
        if (textEl) textEl.textContent = arNum(Math.max(0, secs));
        const danger = secs <= 10;
        if (ringEl) ringEl.classList.toggle('is-danger', danger);
        const fill = document.getElementById('hc-timer-fill');
        if (fill) fill.classList.toggle('is-danger', danger);
      },
    });
  }

  // The five columns, named, so the room can read the round before it starts
  // filling in. Nobody's answers are on this screen while they are being
  // typed -- that is the one thing the writing phase has to keep back.
  function categoryStrip(d) {
    return `
      <div class="ihj-chips">
        ${(d.categories || []).map((c) => `<span class="ihj-chip">${esc(c.name)}</span>`).join('')}
      </div>`;
  }

  function submittedStrip(d) {
    const submitted = d.submittedCount || 0;
    const roster = players();
    return `
      <p class="ihj-foot">${arNum(submitted)} من ${arNum(roster.length)} أرسلوا</p>`;
  }

  function boardTable(d) {
    const categories = d.categories || [];
    const board = d.board || {};
    const rows = players();
    const continued = d.continueUserIds || [];
    const scoreOf = (a) => (a.ownedValid === false || a.verdict === 'blank' ? 0 : a.verdict === 'unique' ? 10 : 5);
    return `
      <div class="ihj-board">
        <table class="ihj-grid">
          <thead>
            <tr>
              <th>اللاعب</th>
              ${categories.map((c) => `<th>${esc(c.name)}</th>`).join('')}
              <th>المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((m) => {
                const answers = board[m.userId] || [];
                const total = answers.reduce((sum, a) => sum + scoreOf(a), 0);
                return `
                  <tr>
                    <th>${esc(m.displayName)}${continued.includes(m.userId) ? ' ✓' : ''}</th>
                    ${answers
                      .map((a) => {
                        const pts = scoreOf(a);
                        const cls = a.verdict === 'blank'
                          ? 'is-blank is-zero'
                          : pts === 0
                            ? 'is-zero'
                            : a.verdict === 'unique'
                              ? 'is-unique'
                              : 'is-shared';
                        const shared = a.verdict === 'shared' && a.sharedWith.length
                          ? `<span class="ihj-shared-note">مع ${esc(a.sharedWith.map(nameOf).join('، '))}</span>`
                          : '';
                        return `
                          <td>
                            <div class="ihj-cell ${cls}">
                              <span class="ihj-cell-text">${a.verdict === 'blank' ? '—' : esc(a.text)}${shared}</span>
                              <span class="ihj-cell-pts">${arNum(pts)}</span>
                            </div>
                          </td>`;
                      })
                      .join('')}
                    <td class="is-total">${arNum(total)}</td>
                  </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`;
  }

  function legend() {
    return `
      <div class="ihj-legend">
        <span><i style="background:var(--ihj-olive)"></i> منفردة ١٠</span>
        <span><i style="background:var(--ihj-sand)"></i> مكررة ٥</span>
        <span><i style="background:var(--ihj-dust)"></i> فارغة أو ملغاة ٠</span>
      </div>`;
  }

  function ranks(d, elId) {
    const scores = d.scores || {};
    const deltas = d.lastRoundScores || {};
    const rows = players()
      .map((m) => ({ userId: m.userId, displayName: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
    const top = rows.reduce((max, r) => Math.max(max, r.score), 0) || 1;
    setTimeout(() => {
      const el = document.getElementById(elId);
      if (!el) return;
      window.BahjahRankedBoard.render('ihj-host', el, rows, (row, i) => {
        const delta = deltas[row.userId];
        const pct = Math.max(4, Math.round((row.score / top) * 100));
        return `
          <div class="ihj-rank">
            <div class="ihj-rank-line">
              <span class="ihj-rank-no">${arNum(i + 1)}</span>
              <span class="ihj-rank-av">${esc((row.displayName || '؟').trim().charAt(0))}</span>
              <span class="ihj-rank-name">${esc(row.displayName)}</span>
              ${delta && delta.total ? `<span class="ihj-rank-delta">+${arNum(delta.total)}</span>` : ''}
              <span class="ihj-rank-total">${arNum(row.score)}</span>
            </div>
            <div class="ihj-rank-bar"><span style="width:${pct}%"></span></div>
          </div>`;
      });
    }, 0);
    return `<div class="ihj-ranks" id="${elId}"></div>`;
  }

  function render() {
    renderPhase();
    restoreEndUi();
  }

  function renderPhase() {
    if (!latestRoom) return;

    if (latestRoom.status === 'ended') {
      window.BahjahTimerBar.stop('hc-ihj');
      endPending = false;
      confirmingEnd = false;
      endNote = { text: '', tone: 'info' };
      mount.innerHTML = `
        <div style="text-align:center; padding-block:60px;">
          <p class="hc-stat">أنهيت هذه اللعبة (الرمز: ${esc(code)}).</p>
        </div>`;
      return;
    }

    if (!latestState) {
      mount.innerHTML = topbar('جارٍ بدء اللعبة…');
      return;
    }

    const d = latestState.data || {};
    const phase = latestState.phase;

    if (phase === 'countdown') {
      mount.innerHTML = `
        ${topbar('استعدّوا')}
        <div class="ihj-stage ihj-stage--host">
          <div class="ihj-countdown">
            <div class="ihj-countdown-num" id="hc-timer-text">٣</div>
            <div class="ihj-countdown-label">الحرف قادم</div>
          </div>
        </div>`;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (phase === 'answering') {
      mount.innerHTML = `
        ${topbar('')}
        <div class="ihj-stage ihj-stage--host">
          ${stageHead(d)}
          ${letterRow(d)}
          ${timerRow()}
          ${categoryStrip(d)}
          ${submittedStrip(d)}
        </div>`;
      startTimer(d.phaseEndsAt);
      return;
    }

    if (phase === 'scoring') {
      window.BahjahTimerBar.stop('hc-ihj');
      const continued = (d.continueUserIds || []).length;
      mount.innerHTML = `
        ${topbar('التصحيح')}
        <div class="ihj-stage ihj-stage--host">
          ${stageHead(d)}
          ${letterRow(d)}
          ${boardTable(d)}
          ${legend()}
          <div class="hc-actions">
            <button type="button" id="hc-next-btn" class="btn btn-primary">اعتمد النقاط</button>
          </div>
          <p class="ihj-foot">${arNum(continued)} من ${arNum(players().length)} وافقوا — أو اعتمدها بنفسك</p>
        </div>`;
      return;
    }

    if (phase === 'standings') {
      window.BahjahTimerBar.stop('hc-ihj');
      mount.innerHTML = `
        ${topbar('')}
        <div class="ihj-stage ihj-stage--host">
          <h2 class="ihj-screen-title">الترتيب.</h2>
          ${ranks(d, 'hc-standings')}
          <p class="ihj-foot">الجولة التالية بعد لحظات…</p>
        </div>`;
      return;
    }

    if (phase === 'finished') {
      window.BahjahTimerBar.stop('hc-ihj');
      renderFinished(d);
    }
  }

  function renderFinished(d) {
    const scores = d.scores || {};
    const stats = d.finalStats || {};
    const winners = new Set(d.winnerUserIds || []);
    const rows = players()
      .map((m) => ({ userId: m.userId, displayName: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
    const winnerNames = rows.filter((r) => winners.has(r.userId)).map((r) => r.displayName);

    const best = (pick) =>
      rows.map((r) => ({ name: r.displayName, value: pick(stats[r.userId] || {}) || 0 })).sort((a, b) => b.value - a.value)[0];
    const mostUnique = best((s) => s.uniqueAnswers);
    const bestRound = best((s) => s.bestRound);

    const awards = [
      mostUnique && mostUnique.value > 0
        ? { title: 'أكثر إجابات منفردة', name: mostUnique.name, note: `${arNum(mostUnique.value)} إجابة لم يكتبها غيره` }
        : null,
      bestRound && bestRound.value > 0
        ? { title: 'أقوى جولة', name: bestRound.name, note: `${arNum(bestRound.value)} نقطة في جولة واحدة` }
        : null,
    ].filter(Boolean);

    mount.innerHTML = `
      ${topbar('انتهت اللعبة')}
      <div class="ihj-stage ihj-stage--host">
        <div class="ihj-winner">
          <div class="ihj-winner-label">الفائز</div>
          <h2 class="ihj-winner-name">${esc(winnerNames.length ? winnerNames.join('، ') : 'لا فائز')}</h2>
          <p class="ihj-winner-sub">${rows[0] ? `${arNum(rows[0].score)} نقطة` : ''}</p>
        </div>
        ${awards.length
          ? `<div class="ihj-awards">
              ${awards
                .map(
                  (a) => `
                  <div class="ihj-award">
                    <span class="ihj-award-title">${esc(a.title)}</span>
                    <span class="ihj-award-name">${esc(a.name)}</span>
                    <span class="ihj-award-note">${esc(a.note)}</span>
                  </div>`
                )
                .join('')}
            </div>`
          : ''}
        ${ranks(d, 'hc-standings')}
      </div>`;

    const actions = document.createElement('div');
    actions.className = 'hc-actions';
    actions.innerHTML = '<button type="button" id="hc-restart-btn" class="btn btn-primary">العب مجددًا</button>';
    mount.appendChild(actions);
  }
})();
