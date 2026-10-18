// إنسان حيوان جماد -- the player's phone (wireframes 5d·04 to 5d·09). Driven
// by the 'bahjah:game-state' events assets/lobby.js dispatches, the same
// arrangement as the other games' phone scripts.
//
// The page is a notebook page: a blank band at the top, the ruled lines, and
// a strip under a tear line for the buttons. Each phase fills those three.
// Everything the game says follows the EN / ع switch; the letters, the
// categories and the answers are Arabic whatever it is set to, because they
// are the game.
(function () {
  const band = document.getElementById('ihj-band');
  const lines = document.getElementById('ihj-lines');
  const strip = document.getElementById('ihj-strip');
  if (!band || !lines || !strip) return;

  const Ink = window.IhjInk;
  const { esc, t } = Ink;
  const n = (v) => Ink.num(v);
  const LETTER_FONT = 'Marhey, cursive';

  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();
  const myId = me ? me.id : '';

  let latestRoom = null;
  let latestState = null;
  let roomEnded = false;
  // The answer sheet holds five boxes somebody is typing into, so it is drawn
  // once a round and patched after that -- a rebuild would throw away
  // everything not yet sent.
  let sheetKey = null;
  let submitted = false;
  let autoSubmitted = false;
  // What each of my marks showed last time, so only a mark that just changed
  // draws itself in; the rest are redrawn already finished.
  let shownMarks = {};
  let shownPhaseKey = null;
  let countdownTimer = null;
  let disputeOpen = false;

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
    if (e.detail.status === 'lobby') {
      window.location.href = `insan-hayawan-jamad-lobby.html?code=${encodeURIComponent(code)}`;
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
    if (state.gameType !== 'insan-hayawan-jamad') return;
    latestState = state;
    render(state);
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (roomEnded) return renderEnded();
    if (!latestState) return;
    // The sheet is rebuilt in the new language with whatever is typed in it.
    const typed = latestState.phase === 'answering' ? currentDraft() : null;
    sheetKey = null;
    render(latestState, typed);
  });

  function send(action) {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    socket.emit('game:action', { action });
  }

  // --- Who is who --------------------------------------------------------

  function players() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }

  function nameOf(userId) {
    const member = players().find((m) => m.userId === userId);
    return member ? member.displayName : t('a player', 'لاعب');
  }

  function valueOf(a) {
    if (!a || a.verdict === 'blank' || a.ownedValid === false || a.hostValid === false) return 0;
    return a.verdict === 'unique' ? 10 : 5;
  }

  function roundLabel(d) {
    return t(`Round ${d.roundIndex + 1} of ${d.totalRounds}`, `الجولة ${n(d.roundIndex + 1)} من ${n(d.totalRounds)}`);
  }

  // --- The three parts of the page ----------------------------------------

  function chrome() {
    return `<span class="ihj-band-end">
      <button type="button" class="ihj-pill ihj-pill--sm" id="sound-btn" onclick="toggleSound()" aria-label="${t('Toggle sound effects', 'تشغيل المؤثرات الصوتية أو إيقافها')}">${window.BahjahSoundFx.isEnabled() ? '&#128266;' : '&#128263;'}</button>
      <button type="button" class="ihj-pill lang-btn" onclick="toggleLang()">${Ink.isAr() ? 'EN' : 'ع'}</button>
    </span>`;
  }

  function brandBand() {
    band.innerHTML = `<a class="ihj-brand" href="bahjah-landing.html">${t('Bahjah', 'بهجة')}</a>${chrome()}`;
  }

  function textBand(text) {
    band.innerHTML = `<span style="font-size:15px; font-weight:500;">${esc(text)}</span>${chrome()}`;
  }

  function setStrip(html) {
    strip.hidden = !html;
    strip.innerHTML = html || '';
  }

  function stopCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  // A line of red handwriting counting down to phaseEndsAt.
  function countdown(el, endsAt, label) {
    stopCountdown();
    const tick = () => {
      const secs = Math.max(0, Math.ceil(((endsAt || Date.now()) - Date.now()) / 1000));
      if (el) el.textContent = label(secs);
      if (secs <= 0) stopCountdown();
    };
    tick();
    countdownTimer = setInterval(tick, 250);
  }

  function render(state, typed) {
    document.body.classList.add('is-live');
    const d = state.data || {};
    const phaseKey = `${state.phase}:${d.roundIndex}`;
    if (phaseKey !== shownPhaseKey) {
      shownPhaseKey = phaseKey;
      shownMarks = {};
      lines.scrollTop = 0;
      closeDispute();
    }
    if (state.phase !== 'answering') {
      sheetKey = null;
      window.BahjahTimerBar.stop('ihj');
    }
    if (state.phase === 'reveal' || state.phase === 'countdown') {
      submitted = false;
      autoSubmitted = false;
    }
    if (state.phase !== 'reveal' && state.phase !== 'countdown' && state.phase !== 'standings') stopCountdown();

    if (state.phase === 'reveal' || state.phase === 'countdown') return renderReveal(d);
    if (state.phase === 'answering') return renderSheet(d, typed);
    if (state.phase === 'scoring') return renderScoring(d);
    if (state.phase === 'standings') return renderStandings(d);
    if (state.phase === 'finished') return renderFinished(d);
  }

  // --- 5d·04 The letter ---------------------------------------------------

  function renderReveal(d) {
    const cats = d.categories || [];
    textBand(d.totalRounds ? roundLabel(d) : '');
    lines.innerHTML = `
      <div class="ihj-row ihj-row--2 ihj-row--center ihj-title">${d.currentLetter ? t('The letter is…', 'الحرف هو…') : t('Get ready…', 'استعدّوا…')}</div>
      <div style="height:280px; display:grid; place-items:center;">
        <div style="position:relative; width:220px; height:268px; display:grid; place-items:center; padding-top:34px;">
          <span style="position:absolute; left:30px; top:44px; width:160px; height:200px; background:#fff; border-radius:4px; transform:rotate(-8deg);"></span>
          <span style="position:absolute; inset:0; background:url(assets/ihj/notepad-tilt.png) center/contain no-repeat;"></span>
          <span style="position:relative;">${d.currentLetter ? Ink.circled(d.currentLetter, 120, { font: LETTER_FONT, delay: 0.2, width: 5 }) : ''}</span>
        </div>
      </div>
      <div style="display:flex; flex-wrap:wrap; justify-content:center; column-gap:14px;" dir="rtl">
        ${cats.map((c) => `<span class="ihj-row" style="font-size:17px; font-weight:500;">${esc(c.name)}</span>`).join('')}
      </div>`;
    setStrip(`<div id="ihj-starts" style="height:58px; display:grid; place-items:center; font:400 28px var(--ihj-hand); color:var(--ihj-pen);"></div>`);
    countdown(document.getElementById('ihj-starts'), d.phaseEndsAt, (s) =>
      s > 0 ? t(`Starting in ${s}…`, `نبدأ خلال ${n(s)}…`) : t('Go!', 'هيا!')
    );
  }

  // --- 5d·05 Answers -------------------------------------------------------

  function currentDraft() {
    return Array.from(lines.querySelectorAll('.ihj-answer')).map((input) => input.value.trim());
  }

  function waitingNote(d) {
    const total = d.playerCount || players().length;
    return t(`Sent. Waiting for the others · ${d.submittedCount || 0} of ${total} in`, `أُرسلت. بانتظار البقية · ${n(d.submittedCount || 0)} من ${n(total)}`);
  }

  function commit(auto) {
    if (submitted) return;
    submitted = true;
    const answers = currentDraft();
    lines.querySelectorAll('.ihj-answer').forEach((input) => { input.disabled = true; });
    const btn = document.getElementById('ihj-submit');
    if (btn) {
      btn.disabled = true;
      btn.textContent = auto ? t("Time's up — sent", 'انتهى الوقت — أُرسلت') : t('Sent ✓', 'أُرسلت ✓');
    }
    const note = document.getElementById('ihj-note');
    if (note && latestState) note.textContent = waitingNote(latestState.data || {});
    window.BahjahSoundFx.submit();
    send({ type: 'submit', answers });
  }

  function paintProgress() {
    const values = currentDraft();
    lines.querySelectorAll('.ihj-done').forEach((el, i) => { el.textContent = values[i] ? '✓' : ''; });
    const filled = document.getElementById('ihj-filled');
    if (filled) filled.textContent = t(`${values.filter(Boolean).length} of ${values.length}`, `${n(values.filter(Boolean).length)} من ${n(values.length)}`);
  }

  function renderSheet(d, typed) {
    const cats = d.categories || [];
    const key = `${d.roundIndex}`;
    if (key === sheetKey) {
      const note = document.getElementById('ihj-note');
      if (note && submitted) note.textContent = waitingNote(d);
      return;
    }
    const fresh = sheetKey === null && !typed;
    sheetKey = key;
    submitted = submitted || Boolean(d.mySubmitted);
    const draft = typed || d.myDraft || [];

    band.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; width:100%;">
        ${Ink.circled(d.currentLetter || '', 34, { font: LETTER_FONT, delay: 0.1, still: !fresh })}
        <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:500;">
            <span id="ihj-filled"></span><span id="ihj-time" style="font-weight:700; color:var(--ihj-pen);"></span>
          </div>
          <div class="ihj-bar"><span id="ihj-bar-fill"></span></div>
        </div>
      </div>`;
    lines.innerHTML = cats
      .map(
        (c, i) => `
        <label class="ihj-row ihj-hand" style="font-size:16px;" for="ihj-a${i}">${esc(c.name)}</label>
        <div class="ihj-row ihj-row--split" style="font-size:20px; font-weight:500;">
          <input id="ihj-a${i}" class="ihj-line-input ihj-answer" type="text" maxlength="40" autocomplete="off" dir="auto"
                 enterkeyhint="${i === cats.length - 1 ? 'send' : 'next'}"
                 value="${esc(draft[i] || '')}" ${submitted ? 'disabled' : ''}
                 placeholder="${esc(t(`${c.name} with ${d.currentLetter || ''}`, `${c.name} بحرف ${d.currentLetter || ''}`))}">
          <span class="ihj-done" style="color:var(--ihj-link); font-size:17px;"></span>
        </div>`
      )
      .join('');
    setStrip(`
      <button type="button" class="ihj-btn" id="ihj-submit" ${submitted ? 'disabled' : ''}>${submitted ? t('Sent ✓', 'أُرسلت ✓') : t('Submit answers', 'أرسل الإجابات')}</button>
      <span class="ihj-strip-note" id="ihj-note">${submitted ? esc(waitingNote(d)) : t('Auto-submits when time runs out', 'تُرسل تلقائياً عند انتهاء الوقت')}</span>`);

    const inputs = Array.from(lines.querySelectorAll('.ihj-answer'));
    inputs.forEach((input, i) => {
      input.addEventListener('input', paintProgress);
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        // Enter walks down the sheet and sends from the last box, so the
        // whole round can be played without leaving the keyboard.
        const next = inputs[i + 1];
        if (next) next.focus();
        else commit(false);
      });
    });
    document.getElementById('ihj-submit').addEventListener('click', () => commit(false));
    if (!submitted && inputs[0] && !typed) inputs[0].focus();
    paintProgress();
    startTimer(d.phaseEndsAt);
  }

  function startTimer(endsAt) {
    const time = document.getElementById('ihj-time');
    window.BahjahTimerBar.start('ihj', document.getElementById('ihj-bar-fill'), null, endsAt, {
      onTick: (secs) => {
        const s = Math.max(0, secs);
        if (time) time.textContent = `${n(Math.floor(s / 60))}:${n(String(s % 60).padStart(2, '0'))}`;
        if (secs > 0 && secs <= 3) window.BahjahSoundFx.tick();
        // §7's automatic submission. Fired with a second still on the clock so
        // it lands before the round closes: a player who filled four boxes and
        // ran out of time keeps those four rather than losing the lot.
        if (secs <= 1 && !submitted && !autoSubmitted) {
          autoSubmitted = true;
          commit(true);
        }
      },
    });
  }

  // --- 5d·06 Marking your own sheet --------------------------------------

  function renderScoring(d) {
    const cats = d.categories || [];
    const mine = (d.board || {})[myId] || [];
    const disputes = d.disputes || [];
    const continued = d.continueUserIds || [];
    const amReady = continued.includes(myId);
    const total = mine.reduce((sum, a) => sum + valueOf(a), 0);
    const roster = players();

    brandBand();
    const rows = mine.map((a, i) => {
      const value = valueOf(a);
      const verdictValue = a.verdict === 'unique' ? 10 : a.verdict === 'shared' ? 5 : 0;
      // Your own say runs between what the system worked out and nothing. A
      // blank has nothing to argue about, and a word the host struck is
      // settled.
      const locked = a.verdict === 'blank' || a.hostValid === false;
      const changed = shownMarks[i] !== undefined && shownMarks[i] !== value;
      const first = shownMarks[i] === undefined;
      shownMarks[i] = value;
      const taps = [10, 5, 0]
        .map((v) => {
          const picked = v === value;
          const allowed = !locked && (v === 0 || v === verdictValue);
          return `<button type="button" class="ihj-tap${picked ? ' is-picked' : ''}" data-i="${i}" data-v="${v}" ${allowed && !picked ? '' : 'disabled'} aria-pressed="${picked}" ${picked ? 'style="opacity:1;"' : ''}>
            ${picked ? Ink.mark(v, { size: 14, delay: first ? 0.15 * i : 0, still: !(first || changed) }) : n(v)}
          </button>`;
        })
        .join('');
      return `
        <div class="ihj-row ihj-row--split" style="padding-bottom:0;">
          <span style="display:flex; gap:10px; align-items:baseline; padding-bottom:6px; min-width:0;">
            <span class="ihj-ellipsis" style="flex:none; min-width:52px; max-width:96px; font:400 15px/1.4 var(--ihj-hand);">${esc((cats[i] || {}).name || '')}</span>
            <span class="ihj-ellipsis" dir="auto" style="font-size:18px; font-weight:500;${value === 0 && a.verdict !== 'blank' ? ' text-decoration:line-through; text-decoration-color:var(--ihj-pen);' : ''}">${a.verdict === 'blank' ? '—' : esc(a.text)}</span>
          </span>
          <span dir="ltr" style="display:flex; gap:2px; padding-bottom:1px; flex:none;">${taps}</span>
        </div>`;
    });

    // Red-pen notes under the sheet: matches, and any argument about a word.
    const notes = [];
    mine.forEach((a, i) => {
      if (a.verdict === 'shared' && valueOf(a) > 0 && a.sharedWith.length) {
        const who = a.sharedWith.map(nameOf).join(t(' & ', ' و'));
        notes.push(t(`"${a.text}" matches ${who} → 5 each`, `«${a.text}» مكررة مع ${who} ← ٥ لكلٍّ منكما`));
      }
      const about = disputes.find((x) => x.index === i && (x.targetUserId === myId || (a.sharedWith || []).includes(x.targetUserId)));
      if (about) {
        if (about.status === 'open') notes.push(t(`${nameOf(about.byUserId)} disputes "${a.text}" — the host decides`, `${nameOf(about.byUserId)} يعترض على «${a.text}» — والقرار للمضيف`));
        else if (about.status === 'rejected') notes.push(t(`The host rejected "${a.text}"`, `رفض المضيف «${a.text}»`));
        else notes.push(t(`The host accepted "${a.text}"`, `قبل المضيف «${a.text}»`));
      }
    });
    disputes
      .filter((x) => x.byUserId === myId)
      .forEach((x) => {
        const a = ((d.board || {})[x.targetUserId] || [])[x.index] || {};
        const status = x.status === 'open' ? t('waiting for the host', 'بانتظار المضيف') : x.status === 'rejected' ? t('rejected', 'رُفضت') : t('accepted', 'قُبلت');
        notes.push(t(`You disputed ${nameOf(x.targetUserId)}'s "${a.text}" — ${status}`, `اعترضت على «${a.text}» من ${nameOf(x.targetUserId)} — ${status}`));
      });

    lines.innerHTML = `
      <div class="ihj-row ihj-row--2 ihj-title">${t('Mark your sheet', 'صحّح ورقتك')}</div>
      ${rows.join('')}
      ${notes.map((x) => `<div class="ihj-row ihj-small ihj-red"><span class="ihj-ellipsis">${esc(x)}</span></div>`).join('')}
      <div class="ihj-row ihj-row--split" style="padding-bottom:5px;">
        <span class="ihj-hand" style="font-size:18px; line-height:1;">${t('Your round', 'مجموعك')}</span>
        <span style="font:700 24px/1 var(--ihj-ui);">${n(total)}</span>
      </div>`;

    const ready = t(`${continued.length}/${roster.length} ready`, `جاهزون ${n(continued.length)}/${n(roster.length)}`);
    setStrip(`
      <div class="ihj-strip-row">
        <button type="button" class="ihj-btn ihj-btn--line ihj-btn--tall ihj-btn--snug" id="ihj-dispute-btn">${t('Dispute', 'اعتراض')}</button>
        <button type="button" class="ihj-btn" id="ihj-next" ${amReady ? 'disabled' : ''} style="font-size:16px;">
          <span>${amReady ? t('Ready ✓', 'جاهز ✓') : t('Next', 'التالي')}</span><span>·</span><span>${esc(ready)}</span>
        </button>
      </div>`);

    lines.querySelectorAll('.ihj-tap:not([disabled])').forEach((btn) =>
      btn.addEventListener('click', () => {
        window.BahjahSoundFx.tick();
        send({ type: 'mark', index: Number(btn.dataset.i), valid: Number(btn.dataset.v) !== 0 });
      })
    );
    document.getElementById('ihj-next').addEventListener('click', (e) => {
      e.currentTarget.disabled = true;
      send({ type: 'continue' });
    });
    document.getElementById('ihj-dispute-btn').addEventListener('click', () => openDispute());
    if (disputeOpen) openDispute();
  }

  // Picking somebody else's answer to dispute: every word on the board that
  // still scores, theirs not yours, one per line.
  function openDispute() {
    const d = (latestState && latestState.data) || {};
    const cats = d.categories || [];
    const disputes = d.disputes || [];
    disputeOpen = true;
    let over = document.getElementById('ihj-dispute');
    if (!over) {
      over = document.createElement('div');
      over.id = 'ihj-dispute';
      over.className = 'ihj-sheet-over';
      document.body.appendChild(over);
      over.addEventListener('click', (e) => {
        if (e.target === over || e.target.closest('#ihj-dispute-close')) closeDispute();
        const pick = e.target.closest('[data-target]');
        if (pick && !pick.disabled) {
          send({ type: 'dispute', targetUserId: pick.dataset.target, index: Number(pick.dataset.index) });
          closeDispute();
        }
      });
    }
    const items = [];
    cats.forEach((c, i) => {
      players()
        .filter((m) => m.userId !== myId)
        .forEach((m) => {
          const a = ((d.board || {})[m.userId] || [])[i];
          if (!a || a.verdict === 'blank' || valueOf(a) === 0) return;
          const taken = disputes.some((x) => x.index === i && (x.targetUserId === m.userId || (a.sharedWith || []).includes(x.targetUserId)));
          items.push(`
            <button type="button" class="ihj-row ihj-row--split" data-target="${esc(m.userId)}" data-index="${i}" ${taken ? 'disabled' : ''}
                    style="width:100%; background:none; border:none; padding:0 0 6px; font-size:16px; text-align:start;${taken ? ' opacity:.45;' : ''}">
              <span class="ihj-ellipsis"><span class="ihj-hand" style="font-size:14px;">${esc(c.name)}</span> · ${esc(m.displayName)}</span>
              <span dir="auto" style="font-weight:700;">${esc(a.text)}</span>
            </button>`);
        });
    });
    over.innerHTML = `
      <div class="ihj-page" role="dialog" aria-modal="true">
        <header class="ihj-band"><span class="ihj-brand">${t('Bahjah', 'بهجة')}</span></header>
        <div class="ihj-lines ihj-ruled">
          <div class="ihj-row ihj-row--2 ihj-title">${t('Dispute an answer', 'اعتراض على إجابة')}</div>
          <div class="ihj-row ihj-small">${t('Pick the word you think does not count.', 'اختر الكلمة التي ترى أنها لا تُحسب.')}</div>
          ${items.join('') || `<div class="ihj-row ihj-small">${t('Nothing left to dispute.', 'لا شيء للاعتراض عليه.')}</div>`}
        </div>
        <div class="ihj-strip">
          <button type="button" class="ihj-btn ihj-btn--line" id="ihj-dispute-close">${t('Cancel', 'إلغاء')}</button>
          <span class="ihj-strip-note">${t('The host has the final say', 'القرار النهائي للمضيف')}</span>
        </div>
      </div>`;
    over.hidden = false;
  }

  function closeDispute() {
    disputeOpen = false;
    const over = document.getElementById('ihj-dispute');
    if (over) over.hidden = true;
  }

  // --- 5d·08 The round's leaderboard -------------------------------------

  function standings(d) {
    const scores = d.scores || {};
    const deltas = d.lastRoundScores || {};
    return players()
      .map((m) => ({ userId: m.userId, name: m.displayName, total: scores[m.userId] || 0, plus: (deltas[m.userId] || {}).total || 0 }))
      .sort((a, b) => b.total - a.total || a.userId.localeCompare(b.userId));
  }

  function renderStandings(d) {
    const rows = standings(d);
    const last = d.roundIndex + 1 >= d.totalRounds;
    brandBand();
    lines.innerHTML = `
      <div class="ihj-row ihj-row--2 ihj-title">${t(`Round ${d.roundIndex + 1} results`, `نتائج الجولة ${n(d.roundIndex + 1)}`)}</div>
      <div class="ihj-row" style="font-size:13px; font-weight:500; gap:0; padding-bottom:7px;">
        <span style="width:20px;">#</span><span style="flex:1;"></span><span style="width:56px;">${t('Round', 'الجولة')}</span><span style="width:50px; text-align:end;">${t('Total', 'المجموع')}</span>
      </div>
      ${rows
        .map(
          (r, i) => `
        <div class="ihj-row" style="font-size:18px; gap:0;">
          <span class="ihj-hand" style="width:20px; font-size:18px; line-height:1;">${n(i + 1)}</span>
          <span class="ihj-ellipsis" style="flex:1; padding:0 8px; font-weight:${r.userId === myId ? 700 : 500};">${esc(r.name)}</span>
          <span style="width:56px; font:700 17px/1 var(--ihj-hand); color:var(--ihj-pen);">+${n(r.plus)}</span>
          <span style="width:50px; text-align:end; font-weight:700;">${n(r.total)}</span>
        </div>`
        )
        .join('')}`;
    setStrip(`<div id="ihj-next-round" style="height:54px; display:grid; place-items:center; font:400 22px var(--ihj-hand); color:var(--ihj-pen);"></div>`);
    countdown(document.getElementById('ihj-next-round'), d.phaseEndsAt, (s) =>
      last ? t(`Final results in ${s}…`, `النتيجة النهائية خلال ${n(s)}…`) : t(`Next round in ${s}…`, `الجولة التالية خلال ${n(s)}…`)
    );
  }

  // --- 5d·09 The final page ----------------------------------------------

  // One winner gets the headline; a tie says so, and names everybody on the
  // line under it, where a long list has room.
  function winnerLine(names) {
    if (!names.length) return t('No winner this time', 'لا فائز هذه المرة');
    if (names.length > 1) return t("It's a tie!", 'تعادل!');
    return t(`${names[0]} wins!`, `الفوز من نصيب ${names[0]}!`);
  }

  function renderFinished(d) {
    const rows = standings(d);
    const winners = new Set(d.winnerUserIds || []);
    const winnerNames = rows.filter((r) => winners.has(r.userId)).map((r) => r.name);
    const top = rows[0];
    const stats = d.finalStats || {};
    const mostUnique = rows
      .map((r) => ({ name: r.name, value: (stats[r.userId] || {}).uniqueAnswers || 0 }))
      .sort((a, b) => b.value - a.value)[0];
    if (winners.has(myId)) window.BahjahSoundFx.win();

    textBand(t('Final results', 'النتيجة النهائية'));
    lines.innerHTML = `
      <div class="ihj-row ihj-row--2" style="gap:10px; padding-bottom:2px;">
        ${winnerNames.length === 1 ? Ink.circled(winnerNames[0].trim().charAt(0), 36, { delay: 0.2 }) : ''}
        <span class="ihj-title ihj-ellipsis" style="padding-bottom:4px;">${esc(winnerLine(winnerNames))}</span>
      </div>
      <div class="ihj-row" style="font-size:17px; font-weight:700;"><span class="ihj-ellipsis">${top ? esc((winnerNames.length > 1 ? `${winnerNames.join(t(' & ', ' و'))} · ` : '') + t(`${top.total} points`, `${n(top.total)} نقطة`)) : ''}</span></div>
      ${rows
        .map(
          (r, i) => `
        <div class="ihj-row" style="font-size:18px; gap:0;">
          <span class="ihj-hand" style="width:20px; font-size:18px; line-height:1;">${n(i + 1)}</span>
          <span class="ihj-ellipsis" style="flex:1; padding:0 8px; font-weight:${r.userId === myId ? 700 : 400};">${esc(r.name)}</span>
          <span style="font-weight:700;">${n(r.total)}</span>
        </div>`
        )
        .join('')}
      ${mostUnique && mostUnique.value > 0 ? `<div class="ihj-row ihj-small">${esc(t(`Most unique answers: ${mostUnique.name} · ${mostUnique.value}`, `أكثر إجابات فريدة: ${mostUnique.name} · ${n(mostUnique.value)}`))}</div>` : ''}`;
    setStrip(`
      <button type="button" class="ihj-btn" id="ihj-share" style="height:52px;">${t('Share result', 'شارك النتيجة')}</button>
      <a class="ihj-btn ihj-btn--line" href="insan-hayawan-jamad.html">${t('Play again', 'العب مرة أخرى')}</a>`);
    document.getElementById('ihj-share').addEventListener('click', (e) => shareResult(d, rows, winnerNames, e.currentTarget));
  }

  // The share card is a notebook page too: the logo, the winner, your score
  // and the way back to Bahjah, written on the rules.
  async function buildCard(rows, winnerNames) {
    const W = 1080;
    const H = 1920;
    const ar = Ink.isAr();
    const hand = ar ? 'Marhey' : 'Kalam';
    try {
      await Promise.all([document.fonts.load(`84px ${hand}`), document.fonts.load('700 52px "IBM Plex Sans Arabic"'), document.fonts.load('84px Marhey')]);
    } catch {
      /* best effort */
    }
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.direction = ar ? 'rtl' : 'ltr';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#4a56e2';
    for (let y = 316; y < H; y += 80) ctx.fillRect(0, y, W, 4);
    const marginX = ar ? W - 116 : 112;
    ctx.fillStyle = '#e3261d';
    ctx.fillRect(marginX, 0, 4, H);
    const startX = ar ? W - 160 : 160;
    ctx.textAlign = ar ? 'right' : 'left';

    ctx.fillStyle = '#e3261d';
    ctx.font = `56px ${hand}`;
    ctx.fillText(t('Bahjah', 'بهجة'), startX, 170);

    try {
      const logo = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = 'assets/logos/ihj-logo.png?v=20261018';
      });
      const lw = 820;
      const lh = (logo.height / logo.width) * lw;
      ctx.drawImage(logo, (W - lw) / 2, 380, lw, lh);
    } catch {
      /* the card still reads without it */
    }

    const mine = rows.findIndex((r) => r.userId === myId);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `76px ${hand}`;
    ctx.fillText(winnerLine(winnerNames), startX, 1028, W - 320);
    ctx.font = '700 52px "IBM Plex Sans Arabic", sans-serif';
    const tied = winnerNames.length > 1 ? `${winnerNames.join(t(' & ', ' و'))} · ` : '';
    if (rows[0]) ctx.fillText(tied + t(`${rows[0].total} points`, `${n(rows[0].total)} نقطة`), startX, 1108, W - 320);
    if (mine >= 0) {
      ctx.font = '500 46px "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(t(`Me: #${mine + 1} · ${rows[mine].total} points`, `أنا: المركز ${n(mine + 1)} · ${n(rows[mine].total)} نقطة`), startX, 1268);
    }
    ctx.fillStyle = '#2530d8';
    ctx.font = '700 54px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(t('Play on bahjah.com', 'العب على bahjah.com'), startX, 1668);
    return canvas;
  }

  function shareResult(d, rows, winnerNames, shareBtn) {
    const mine = rows.find((r) => r.userId === myId);
    const score = mine ? mine.total : 0;
    const won = (d.winnerUserIds || []).includes(myId);
    const url = `${location.origin}/insan-hayawan-jamad.html`;
    const text = won
      ? t(`I won Insan Hayawan Jamad on Bahjah with ${score} points! ✏️`, `فزت في إنسان حيوان جماد على بهجة بـ${n(score)} نقطة! ✏️`)
      : t(`I played Insan Hayawan Jamad on Bahjah and scored ${score} points. ✏️`, `لعبت إنسان حيوان جماد على بهجة وسجّلت ${n(score)} نقطة. ✏️`);
    if (window.BahjahShareCard) {
      window.BahjahShareCard.share({
        gameId: 'insan-hayawan-jamad',
        lang: Ink.lang(),
        text,
        url,
        shareBtn,
        buildCanvas: () => buildCard(rows, winnerNames),
      });
      return;
    }
    if (navigator.share) navigator.share({ text, url }).catch(() => {});
  }

  function renderEnded() {
    window.BahjahTimerBar.stop('ihj');
    stopCountdown();
    closeDispute();
    document.body.classList.add('is-live');
    brandBand();
    lines.innerHTML = `
      <div class="ihj-gap"></div>
      <div class="ihj-row ihj-row--2 ihj-title">${t('The host ended this game', 'أنهى المضيف هذه اللعبة')}</div>
      <div class="ihj-row ihj-small">${t('Room', 'الغرفة')} <span dir="ltr">${esc(code)}</span></div>`;
    setStrip(`<a class="ihj-btn" href="bahjah-landing.html">${t('Back to Bahjah', 'العودة إلى بهجة')}</a>`);
  }
})();
