// إنسان حيوان جماد -- the big screen (wireframes 5e·02 and 5e·03, plus the
// reveal, the writing and the host's dispute card). Mounted into
// #host-console on insan-hayawan-jamad-lobby.html, where the host stays for
// the whole match.
//
// The television is where this game is actually played: every answer and
// every mark goes up there as it arrives, because the marking is a room
// decision and the room has to see what it is agreeing to. The host does not
// write answers or mark anybody -- they run the room, settle disputes, and
// can lock the scores when a phone has been put down.
//
// Drawn on the same 960 x 540 stage as the TV lobby, scaled to the screen.
(function () {
  const mount = document.getElementById('host-console');
  if (!mount) return;

  const Ink = window.IhjInk;
  const { esc, t } = Ink;
  const n = (v) => Ink.num(v);
  const LETTER_FONT = 'Marhey, cursive';

  const gate = document.getElementById('lobby-gate');
  const main = document.getElementById('lobby-main');

  let latestRoom = null;
  let latestState = null;
  let code = null;
  let socket = null;
  let active = false;
  let countdownTimer = null;
  // What each cell's mark showed last time, so a mark draws itself in once,
  // when the player makes it, and not again on every update after.
  let shownCells = {};
  let shownPhaseKey = null;
  // The last ruling, held on screen for a moment so the room sees the stamp.
  let lastRuling = null;

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
    document.body.classList.add('ihj-tv-body');
    document.body.classList.remove('ihj-phone-body');
    render();
  });

  document.addEventListener('bahjah:game-state', (e) => {
    const state = e.detail;
    if (state.gameType !== 'insan-hayawan-jamad') return;
    const before = latestState;
    latestState = state;
    noteRuling(before, state);
    if (active) render();
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (active) render();
  });

  window.addEventListener('resize', () => {
    if (active) Ink.fitTv(document.getElementById('hc-stage'));
  });

  // --- Ending the room: same control and reasoning as the other consoles ---
  let endPending = false;
  let confirmingEnd = false;
  let endNote = '';

  function paintEnd() {
    const btn = document.getElementById('hc-end-btn');
    if (btn) {
      btn.disabled = endPending;
      btn.classList.toggle('is-confirming', confirmingEnd);
      btn.textContent = endPending ? t('Ending…', 'جارٍ الإنهاء…') : confirmingEnd ? t('Tap to confirm', 'اضغط للتأكيد') : t('End room', 'أنهِ الغرفة');
    }
    const note = document.getElementById('hc-end-note');
    if (note) note.textContent = endNote;
  }

  document.addEventListener('click', (e) => {
    if (!active) return;
    if (e.target.closest('#hc-restart-btn')) {
      if (socket) socket.emit('room:restart');
      return;
    }
    if (e.target.closest('#hc-lock-btn')) {
      if (socket) socket.emit('game:action', { action: { type: 'advance' } });
      return;
    }
    const settle = e.target.closest('[data-settle]');
    if (settle) {
      if (socket) socket.emit('game:action', { action: { type: 'settle', disputeId: settle.dataset.dispute, accept: settle.dataset.settle === 'accept' } });
      return;
    }
    if (e.target.closest('#hc-end-btn')) {
      if (endPending) return;
      if (!confirmingEnd) {
        confirmingEnd = true;
        endNote = t('This ends the game for everyone.', 'سيؤدي هذا إلى إنهاء اللعبة لجميع اللاعبين.');
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
        endNote = t('No connection — reload the page.', 'لا يوجد اتصال — أعد تحميل الصفحة.');
        paintEnd();
        return;
      }
      endPending = true;
      endNote = '';
      paintEnd();
      socket.emit('room:end');
      setTimeout(() => {
        if (!endPending) return;
        endPending = false;
        endNote = t('No response — try again.', 'لا استجابة — حاول مرة أخرى.');
        paintEnd();
      }, 6000);
      return;
    }
    if (confirmingEnd && !endPending) {
      confirmingEnd = false;
      endNote = '';
      paintEnd();
    }
  });

  // --- Who is who --------------------------------------------------------

  function players() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }

  function nameOf(userId) {
    const member = players().find((m) => m.userId === userId);
    return member ? member.displayName : t('a player', 'لاعب');
  }

  // The host's strike, then the player's own mark, then the system's verdict
  // (the same order as the engine's valueOf).
  function valueOf(a) {
    if (!a || a.verdict === 'blank' || a.ownedValid === false || a.ownedPoints === 0 || a.hostValid === false) return 0;
    if (a.ownedPoints !== undefined) return a.ownedPoints;
    return a.verdict === 'unique' ? 10 : 5;
  }

  function roundLabel(d) {
    return t(`Round ${d.roundIndex + 1} of ${d.totalRounds}`, `الجولة ${n(d.roundIndex + 1)} من ${n(d.totalRounds)}`);
  }

  // A dispute that has just been settled: keep its card up with the stamp.
  function noteRuling(before, after) {
    const prev = (before && before.data && before.data.disputes) || [];
    const next = (after && after.data && after.data.disputes) || [];
    const settled = next.find((x) => x.status !== 'open' && (prev.find((p) => p.id === x.id) || {}).status === 'open');
    if (!settled) return;
    lastRuling = { dispute: settled, until: Date.now() + 1800 };
    setTimeout(() => {
      if (lastRuling && lastRuling.dispute.id === settled.id) {
        lastRuling = null;
        if (active) render();
      }
    }, 1900);
  }

  // --- The stage -----------------------------------------------------------

  function controls(extra) {
    return `
      <div class="ihj-tv-ctrl">
        <span class="ihj-tv-note" id="hc-end-note" role="status"></span>
        ${extra || ''}
        <button type="button" class="ihj-chip" id="hc-end-btn">${t('End room', 'أنهِ الغرفة')}</button>
        <button type="button" class="ihj-chip" onclick="toggleLang()">${Ink.isAr() ? 'EN' : 'ع'}</button>
      </div>`;
  }

  function stage(inner, extraControls, overlay) {
    mount.innerHTML = `
      <div class="ihj-tv-frame">
        <div class="ihj-tv" id="hc-stage">
          <div class="ihj-tv-body-inner">${inner}</div>
          ${overlay || ''}
          ${controls(extraControls)}
        </div>
      </div>`;
    Ink.fitTv(document.getElementById('hc-stage'));
    paintEnd();
  }

  function stopCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  function countdown(id, endsAt, label) {
    stopCountdown();
    const tick = () => {
      const el = document.getElementById(id);
      const secs = Math.max(0, Math.ceil(((endsAt || Date.now()) - Date.now()) / 1000));
      if (el) el.textContent = label(secs);
      if (secs <= 0) stopCountdown();
    };
    tick();
    countdownTimer = setInterval(tick, 250);
  }

  function render() {
    if (!latestRoom) return;

    if (latestRoom.status === 'ended') {
      window.BahjahTimerBar.stop('hc-ihj');
      stopCountdown();
      endPending = false;
      confirmingEnd = false;
      endNote = '';
      stage(`
        <div style="height:200px;"></div>
        <div class="ihj-row ihj-row--2 ihj-tv-h">${t('You ended this game', 'أنهيت هذه اللعبة')}</div>
        <div class="ihj-row" style="font-size:17px;">${t('Room', 'الغرفة')}&nbsp;<span dir="ltr">${esc(code)}</span></div>`);
      return;
    }

    if (!latestState) {
      stage(`<div style="height:200px;"></div><div class="ihj-row ihj-row--2 ihj-tv-h">${t('Starting the game…', 'جارٍ بدء اللعبة…')}</div>`);
      return;
    }

    const d = latestState.data || {};
    const phase = latestState.phase;
    const phaseKey = `${phase}:${d.roundIndex}`;
    if (phaseKey !== shownPhaseKey) {
      shownPhaseKey = phaseKey;
      shownCells = {};
    }
    if (phase !== 'answering') window.BahjahTimerBar.stop('hc-ihj');
    if (phase !== 'reveal' && phase !== 'countdown' && phase !== 'standings') stopCountdown();

    if (phase === 'reveal' || phase === 'countdown') return renderReveal(d);
    if (phase === 'answering') return renderWriting(d);
    if (phase === 'scoring') return renderSheet(d);
    if (phase === 'standings') return renderStandings(d);
    if (phase === 'finished') return renderFinished(d);
  }

  // --- The letter ----------------------------------------------------------

  function renderReveal(d) {
    const cats = d.categories || [];
    stage(`
      <div style="height:80px; display:flex; align-items:center; font-size:18px; font-weight:500;">${d.totalRounds ? esc(roundLabel(d)) : ''}</div>
      <div style="display:grid; grid-template-columns:minmax(0,1fr) 260px; gap:40px; align-items:start;">
        <div>
          <div class="ihj-row ihj-row--2 ihj-tv-h">${d.currentLetter ? t('The letter is…', 'الحرف هو…') : t('Get ready…', 'استعدّوا…')}</div>
          <div style="display:flex; flex-wrap:wrap; column-gap:22px;" dir="rtl">
            ${cats.map((c) => `<span class="ihj-row" style="font-size:22px; font-weight:500;">${esc(c.name)}</span>`).join('')}
          </div>
          <div class="ihj-row ihj-row--2" id="hc-starts" style="font:400 34px var(--ihj-hand); color:var(--ihj-pen);"></div>
        </div>
        <div style="position:relative; width:260px; height:320px; display:grid; place-items:center; padding-top:40px;">
          <span style="position:absolute; left:36px; top:52px; width:188px; height:236px; background:#fff; border-radius:4px; transform:rotate(-8deg);"></span>
          <span style="position:absolute; inset:0; background:url(assets/ihj/notepad-tilt.png) center/contain no-repeat;"></span>
          <span style="position:relative;">${d.currentLetter ? Ink.circled(d.currentLetter, 140, { font: LETTER_FONT, delay: 0.2, width: 5 }) : ''}</span>
        </div>
      </div>`);
    countdown('hc-starts', d.phaseEndsAt, (s) => (s > 0 ? t(`Starting in ${s}…`, `نبدأ خلال ${n(s)}…`) : t('Go!', 'هيا!')));
  }

  // --- Writing: the letter, the clock, and who is in. Nobody's answers are
  // up here while they are being typed -- the one secret this game keeps. ---

  function renderWriting(d) {
    const cats = d.categories || [];
    const roster = players();
    const submitted = d.submittedCount || 0;
    const sent = new Set(d.submittedUserIds || []);
    stage(`
      <div style="height:80px; display:flex; align-items:center; gap:16px; white-space:nowrap;">
        ${Ink.circled(d.currentLetter || '', 34, { font: LETTER_FONT, still: true })}
        <span style="flex:1; font:400 30px/1.2 var(--ihj-hand);">${esc(t(`Round ${d.roundIndex + 1} — writing`, `الجولة ${n(d.roundIndex + 1)} — الكتابة`))}</span>
        <span id="hc-time" style="font:700 30px var(--ihj-ui); color:var(--ihj-pen);"></span>
      </div>
      <div style="display:flex; gap:48px;">
        <div style="width:200px; flex:none;">
          <div class="ihj-row" style="font-size:15px; font-weight:500;">${t('Categories', 'الفئات')}</div>
          ${cats.map((c) => `<div class="ihj-row ihj-hand" style="font-size:22px;" dir="rtl">${esc(c.name)}</div>`).join('')}
        </div>
        <div style="flex:1; min-width:0;">
          <div class="ihj-row" style="font-size:15px; font-weight:500;">${esc(t(`${submitted} of ${roster.length} sent`, `${n(submitted)} من ${n(roster.length)} أرسلوا`))}</div>
          <div style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); column-gap:24px;">
            ${roster.map((m) => `<div class="ihj-row" style="font-size:20px; font-weight:500;"><span class="ihj-ellipsis"${sent.has(m.userId) ? '' : ' style="opacity:.45;"'}>${esc(m.displayName)}</span>${sent.has(m.userId) ? '<span style="color:var(--ihj-pen);">✓</span>' : ''}</div>`).join('')}
          </div>
        </div>
      </div>
      <div style="position:absolute; inset-inline:100px 48px; top:62px;"><div class="ihj-bar" style="height:8px;"><span id="hc-bar"></span></div></div>`);
    const time = document.getElementById('hc-time');
    window.BahjahTimerBar.start('hc-ihj', document.getElementById('hc-bar'), null, d.phaseEndsAt, {
      onTick: (secs) => {
        const s = Math.max(0, secs);
        if (time) time.textContent = `${n(Math.floor(s / 60))}:${n(String(s % 60).padStart(2, '0'))}`;
      },
    });
  }

  // --- 5e·02 The live marking sheet ---------------------------------------

  function renderSheet(d) {
    const cats = d.categories || [];
    const board = d.board || {};
    const roster = players();
    const disputes = d.disputes || [];
    const continued = d.continueUserIds || [];
    const open = disputes.find((x) => x.status === 'open');
    const showing = open || (lastRuling && Date.now() < lastRuling.until ? lastRuling.dispute : null);
    // Columns narrow as the room grows; eight players still fit the sheet.
    const fs = roster.length <= 4 ? 18 : roster.length <= 6 ? 15 : 13;
    const markSize = roster.length <= 4 ? 13 : 11;

    const disputedCell = (userId, i) => {
      const a = (board[userId] || [])[i] || {};
      return disputes.find((x) => x.index === i && (x.targetUserId === userId || (a.sharedWith || []).includes(x.targetUserId)));
    };

    const columns = roster
      .map((m) => {
        const answers = board[m.userId] || [];
        const cells = cats
          .map((_, i) => {
            const a = answers[i];
            const value = valueOf(a);
            const key = `${m.userId}:${i}`;
            const first = shownCells[key] === undefined;
            const changed = !first && shownCells[key] !== value;
            shownCells[key] = value;
            const dispute = disputedCell(m.userId, i);
            const dashed = dispute && dispute.status === 'open';
            return `
              <span style="height:40px; display:flex; align-items:flex-end; justify-content:space-between; gap:4px; font-size:${fs}px; font-weight:500; white-space:nowrap;${dashed ? ' outline:2px dashed var(--ihj-pen); outline-offset:-4px; border-radius:6px; padding-inline:4px;' : ''}">
                <span class="ihj-ellipsis" dir="auto" style="padding-bottom:6px;">${a && a.verdict !== 'blank' ? esc(a.text) : '—'}</span>
                <span style="padding-bottom:3px; flex:none;">${a ? Ink.mark(value, { size: markSize, delay: first ? 0.15 * i : 0, still: !(first || changed) }) : ''}</span>
              </span>`;
          })
          .join('');
        return `
          <div style="flex:1; min-width:0; display:flex; flex-direction:column; padding:0 ${roster.length <= 4 ? 14 : 8}px; border-inline-start:2.5px solid var(--ihj-ink);">
            <span class="ihj-ellipsis" style="height:40px; display:flex; align-items:flex-end; gap:6px; padding-bottom:6px; font:700 ${fs + 2}px/1 var(--ihj-hand); white-space:nowrap;">${esc(m.displayName)}${continued.includes(m.userId) ? '<span style="color:var(--ihj-pen); font-weight:400;">✓</span>' : ''}</span>
            ${cells}
          </div>`;
      })
      .join('');

    stage(
      `
      <div style="height:80px; display:flex; align-items:center; gap:16px; white-space:nowrap;">
        ${Ink.circled(d.currentLetter || '', 34, { font: LETTER_FONT, still: true })}
        <span style="flex:1; font:400 30px/1.2 var(--ihj-hand);">${esc(t(`Round ${d.roundIndex + 1} — marking`, `الجولة ${n(d.roundIndex + 1)} — التصحيح`))}</span>
        <span style="font:400 20px var(--ihj-hand); color:var(--ihj-pen);">${esc(t(`${continued.length}/${roster.length} ready`, `جاهزون ${n(continued.length)}/${n(roster.length)}`))}</span>
      </div>
      <div style="display:flex;">
        <div style="width:110px; flex:none; display:flex; flex-direction:column;" dir="rtl">
          <span style="height:40px;"></span>
          ${cats.map((c) => `<span class="ihj-ellipsis" style="height:40px; display:flex; align-items:flex-end; padding-bottom:6px; font:400 18px/1 var(--ihj-hand); white-space:nowrap;">${esc(c.name)}</span>`).join('')}
        </div>
        ${columns}
      </div>
      <div style="height:40px;"></div>
      <div style="height:40px; display:flex; gap:28px; align-items:flex-end; padding-bottom:3px; font-size:15px; font-weight:500; white-space:nowrap;">
        <span style="display:flex; gap:6px; align-items:center;">${Ink.mark(10, { size: 11, still: true })}${t('Unique', 'فريدة')}</span>
        <span style="display:flex; gap:6px; align-items:center;">${Ink.mark(5, { size: 11, still: true })}${t('Shared', 'مكررة')}</span>
        <span style="display:flex; gap:6px; align-items:center;">${Ink.mark(0, { size: 11, still: true })}${t('Wrong or blank', 'خطأ أو فارغة')}</span>
        <span style="display:flex; gap:6px; align-items:center;"><span style="width:28px; height:20px; border:2px dashed var(--ihj-pen); border-radius:6px; background:#fff;"></span>${t('Disputed', 'اعتراض')}</span>
      </div>`,
      `<button type="button" class="ihj-chip" id="hc-lock-btn" title="${esc(t('Score the round now, without waiting for every phone', 'احسب نقاط الجولة الآن دون انتظار كل الجوالات'))}">${t('Lock scores', 'اعتمد النقاط')}</button>`,
      showing ? disputeCard(d, showing) : ''
    );
  }

  // 5d·07, on the television: the host rules on a dispute alone.
  function disputeCard(d, dispute) {
    const cat = ((d.categories || [])[dispute.index] || {}).name || '';
    const a = ((d.board || {})[dispute.targetUserId] || [])[dispute.index] || {};
    const settled = dispute.status !== 'open';
    return `
      <div style="position:absolute; inset:0; z-index:4; background:rgba(26,26,26,.35); display:flex; align-items:center; justify-content:center;">
        <div class="ihj-page" style="width:360px; max-width:none; height:500px; min-height:0; border:10px solid var(--ihj-ink); border-radius:36px; --ihj-margin:46px;">
          <div style="height:40px; flex:none;"></div>
          <div class="ihj-lines ihj-ruled">
            <div class="ihj-row ihj-row--2 ihj-title">${t('New dispute', 'اعتراض جديد')}</div>
            <div class="ihj-row ihj-label"><span class="ihj-ellipsis">${esc(t(`${nameOf(dispute.byUserId)} disputes ${nameOf(dispute.targetUserId)}'s answer`, `${nameOf(dispute.byUserId)} يعترض على إجابة ${nameOf(dispute.targetUserId)}`))}</span></div>
            <div class="ihj-bubble" style="height:120px; margin-top:0;">
              <div class="ihj-bubble-in" dir="rtl">
                <span style="font:400 15px Marhey, cursive;">${esc(cat)} · ${esc(d.currentLetter || '')}</span>
                <span style="font-size:26px; font-weight:700; line-height:1.15;">${esc(a.text || '')}</span>
                <span style="font-size:12px; font-weight:500;">${esc(t(`Does it count as ${cat}?`, `هل تُحسب «${a.text || ''}» ${cat}؟`))}</span>
              </div>
            </div>
            <div style="height:40px; display:flex; align-items:center; justify-content:center;">
              ${settled ? Ink.stamp(dispute.status === 'accepted' ? t('Accepted', 'مقبولة') : t('Rejected', 'مرفوضة')) : ''}
            </div>
          </div>
          <div class="ihj-strip" style="padding:12px 18px 14px; gap:8px;">
            <button type="button" class="ihj-btn" style="height:44px; font-size:16px;" data-settle="accept" data-dispute="${esc(dispute.id)}" ${settled ? 'disabled' : ''}>${t('Accept answer', 'أقبل الإجابة')}</button>
            <button type="button" class="ihj-btn ihj-btn--line" style="height:42px;" data-settle="reject" data-dispute="${esc(dispute.id)}" ${settled ? 'disabled' : ''}>${t('Reject answer', 'أرفض الإجابة')}</button>
            <span class="ihj-strip-note" style="font-size:12px;">${t('The host has the final say', 'القرار النهائي للمضيف')}</span>
          </div>
        </div>
      </div>`;
  }

  // --- 5e·03 Leaderboard ----------------------------------------------------

  function standings(d) {
    const scores = d.scores || {};
    const deltas = d.lastRoundScores || {};
    return players()
      .map((m) => ({ userId: m.userId, name: m.displayName, total: scores[m.userId] || 0, plus: (deltas[m.userId] || {}).total || 0 }))
      .sort((a, b) => b.total - a.total || a.userId.localeCompare(b.userId));
  }

  function table(rows, withRound) {
    return `
      <div class="ihj-row" style="font-size:14px; font-weight:500; gap:0; padding-bottom:7px;">
        <span style="width:36px;">#</span><span style="flex:1;"></span>
        ${withRound ? `<span style="width:100px;">${t('Round', 'الجولة')}</span>` : ''}
        <span style="width:80px; text-align:end;">${t('Total', 'المجموع')}</span>
      </div>
      ${rows
        .map(
          (r, i) => `
        <div class="ihj-row" style="font-size:22px; gap:0;">
          <span class="ihj-hand" style="width:36px; font-size:22px; line-height:1;">${n(i + 1)}</span>
          <span class="ihj-ellipsis" style="flex:1; font-weight:500;">${esc(r.name)}</span>
          ${withRound ? `<span style="width:100px; font:700 22px/1 var(--ihj-hand); color:var(--ihj-pen);">+${n(r.plus)}</span>` : ''}
          <span style="width:80px; text-align:end; font-weight:700;">${n(r.total)}</span>
        </div>`
        )
        .join('')}`;
  }

  function renderStandings(d) {
    const last = d.roundIndex + 1 >= d.totalRounds;
    stage(`
      <div style="padding-inline-end:152px;">
        <div style="height:80px; display:flex; align-items:center; font:400 34px/1.2 var(--ihj-hand); white-space:nowrap;">${esc(t(`Round ${d.roundIndex + 1} results`, `نتائج الجولة ${n(d.roundIndex + 1)}`))}</div>
        ${table(standings(d), true)}
        <div class="ihj-row" id="hc-next" style="font:400 22px var(--ihj-hand); color:var(--ihj-pen);"></div>
      </div>`);
    countdown('hc-next', d.phaseEndsAt, (s) =>
      last ? t(`Final results in ${s}…`, `النتيجة النهائية خلال ${n(s)}…`) : t(`Next round in ${s}…`, `الجولة التالية خلال ${n(s)}…`)
    );
  }

  function renderFinished(d) {
    const rows = standings(d);
    const winners = new Set(d.winnerUserIds || []);
    const names = rows.filter((r) => winners.has(r.userId)).map((r) => r.name);
    const stats = d.finalStats || {};
    const mostUnique = rows
      .map((r) => ({ name: r.name, value: (stats[r.userId] || {}).uniqueAnswers || 0 }))
      .sort((a, b) => b.value - a.value)[0];
    const joined = names.join(t(' & ', ' و'));
    const headline = !names.length
      ? t('No winner this time', 'لا فائز هذه المرة')
      : names.length > 1
        ? t("It's a tie!", 'تعادل!')
        : t(`${joined} wins!`, `الفوز من نصيب ${joined}!`);
    stage(
      `
      <div style="display:grid; grid-template-columns:minmax(0,1fr) 220px; gap:40px;">
        <div style="min-width:0;">
          <div style="height:80px; display:flex; align-items:center; font-size:18px; font-weight:500;">${t('Final results', 'النتيجة النهائية')}</div>
          <div class="ihj-row ihj-row--2" style="gap:12px; padding-bottom:2px;">
            ${names.length === 1 ? Ink.circled(names[0].trim().charAt(0), 40, { delay: 0.2 }) : ''}
            <span class="ihj-ellipsis" style="font:400 40px/1.2 var(--ihj-hand); padding-bottom:4px;">${esc(headline)}</span>
          </div>
          ${table(rows.slice(0, 8), false)}
        </div>
        <div style="padding-top:160px; display:flex; flex-direction:column; min-width:0;">
          ${names.length > 1 ? `<div class="ihj-row" style="font-size:18px; font-weight:500;"><span class="ihj-ellipsis">${esc(joined)}</span></div>` : ''}
          <div class="ihj-row" style="font-size:20px; font-weight:700;">${rows[0] ? esc(t(`${rows[0].total} points`, `${n(rows[0].total)} نقطة`)) : ''}</div>
          ${mostUnique && mostUnique.value > 0 ? `<div style="font-size:15px; line-height:40px; position:relative; top:3px;">${esc(t(`Most unique answers: ${mostUnique.name} · ${mostUnique.value}`, `أكثر إجابات فريدة: ${mostUnique.name} · ${n(mostUnique.value)}`))}</div>` : ''}
          <div style="height:40px; display:flex; align-items:flex-end; padding-bottom:0;"></div>
          <button type="button" class="ihj-btn" id="hc-restart-btn" style="flex:none; height:48px;">${t('Play again', 'العب مرة أخرى')}</button>
        </div>
      </div>`
    );
  }
})();
