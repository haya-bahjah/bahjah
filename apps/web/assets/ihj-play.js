// إنسان حيوان جماد -- the player's phone. Driven by the 'bahjah:game-state'
// events assets/lobby.js dispatches, the same arrangement as the other games'
// phone scripts.
//
// The game's own text is Arabic whatever the site chrome is set to: this is an
// Arabic word game, its letters and categories are Arabic, and a round played
// in English would be a different game. Only the header and footer follow the
// EN/AR switch.
(function () {
  const splash = document.getElementById('ihj-splash');
  const wrap = document.getElementById('ihj-live');
  const box = document.getElementById('ihj-play-box');
  if (!wrap || !box) return;

  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();

  let latestRoom = null;
  let latestState = null;
  let roomEnded = false;
  // The answer sheet holds five boxes somebody is typing into, so it is drawn
  // once a round and patched after that -- a rebuild would throw away
  // everything not yet sent.
  let sheetRenderKey = null;
  let submitted = false;
  let autoSubmitted = false;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arNum = (n) => Number(n || 0).toLocaleString('ar-EG');

  function nonHostMembers() {
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }

  function nameOf(userId) {
    if (me && userId === me.id) return 'أنت';
    const member = nonHostMembers().find((m) => m.userId === userId);
    return member ? member.displayName : 'لاعب';
  }

  function myScore(d) {
    if (!d || !d.scores || !me) return 0;
    return d.scores[me.id] || 0;
  }

  function renderMeChip() {
    const chip = document.getElementById('me-chip');
    if (!chip || !me) return;
    const member = latestRoom ? latestRoom.members.find((m) => m.userId === me.id) : null;
    const name = (member && member.displayName) || me.fullName || '';
    if (!name) return;
    const avatarEl = document.getElementById('me-chip-avatar');
    const nameEl = document.getElementById('me-chip-name');
    if (avatarEl && window.BahjahAvatars) {
      avatarEl.innerHTML = window.BahjahAvatars.renderAvatarHtml(member ? member.avatar : null, me.id);
    }
    if (nameEl) nameEl.textContent = name;
    chip.hidden = false;
  }
  renderMeChip();

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
    renderMeChip();
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

  // The stage is Arabic either way, so a chrome language switch only needs the
  // board redrawn for the names around it.
  document.addEventListener('bahjah:lang-change', () => {
    if (roomEnded) return renderEnded();
    if (latestState) render(latestState);
  });

  function send(action) {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    socket.emit('game:action', { action });
  }

  function render(state) {
    if (splash) splash.style.display = 'none';
    wrap.style.display = 'block';
    const d = state.data || {};

    if (state.phase !== 'answering') {
      sheetRenderKey = null;
      if (state.phase !== 'scoring') {
        submitted = false;
        autoSubmitted = false;
      }
    }

    if (state.phase === 'countdown') return renderCountdown(d);
    if (state.phase === 'answering') return renderSheet(d);
    if (state.phase === 'scoring') return renderScoring(d);
    if (state.phase === 'standings') return renderStandings(d);
    if (state.phase === 'finished') return renderFinished(d);
  }

  function head(d) {
    const round = d.totalRounds ? `الجولة ${arNum(d.roundIndex + 1)} من ${arNum(d.totalRounds)}` : '';
    return `
      <div class="ihj-head">
        <span class="ihj-round">${esc(round)}</span>
        <span class="ihj-score">${arNum(myScore(d))}</span>
      </div>`;
  }

  function letterRow(d, note) {
    return `
      <div class="ihj-letter-row">
        <div class="ihj-letter">${esc(d.currentLetter || '')}</div>
        <div class="ihj-letter-label">الحرف<b>${esc(d.currentLetter || '')}</b>${note ? `<span>${esc(note)}</span>` : ''}</div>
      </div>`;
  }

  function timerRow() {
    return `
      <div class="ihj-timer">
        <div class="ihj-timer-track"><div class="ihj-timer-fill" id="ihj-timer-fill"></div></div>
        <div class="ihj-ring" id="ihj-ring"><span id="ihj-countdown"></span></div>
      </div>`;
  }

  function renderCountdown(d) {
    box.innerHTML = `
      <div class="ihj-stage">
        <div class="ihj-countdown">
          <div class="ihj-countdown-num" id="ihj-count">٣</div>
          <div class="ihj-countdown-label">استعدّوا… الحرف قادم</div>
        </div>
      </div>`;
    const el = document.getElementById('ihj-count');
    const tick = () => {
      const secs = Math.max(0, Math.ceil(((d.phaseEndsAt || Date.now()) - Date.now()) / 1000));
      if (el) el.textContent = secs > 0 ? arNum(secs) : 'هيا!';
    };
    tick();
    clearInterval(window.__ihjCountdown);
    window.__ihjCountdown = setInterval(tick, 250);
  }

  function currentDraft() {
    return Array.from(box.querySelectorAll('.ihj-field input')).map((input) => input.value.trim());
  }

  function commit(auto) {
    if (submitted) return;
    submitted = true;
    const answers = currentDraft();
    box.querySelectorAll('.ihj-field input').forEach((input) => { input.disabled = true; });
    const btn = document.getElementById('ihj-submit');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('is-locked');
      btn.textContent = auto ? 'انتهى الوقت — أُرسلت إجاباتك' : 'تم الإرسال ✓';
    }
    const hint = document.getElementById('ihj-hint');
    if (hint) hint.textContent = 'بانتظار بقية اللاعبين…';
    window.BahjahSoundFx.submit();
    send({ type: 'submit', answers });
  }

  function paintProgress() {
    const values = currentDraft();
    box.querySelectorAll('.ihj-field').forEach((field, i) => {
      field.classList.toggle('is-filled', Boolean(values[i]));
    });
    const dots = box.querySelectorAll('.ihj-progress i');
    dots.forEach((dot, i) => dot.classList.toggle('is-filled', Boolean(values[i])));
    const btn = document.getElementById('ihj-submit');
    if (btn && !submitted) {
      const filled = values.filter(Boolean).length;
      btn.textContent = filled === values.length ? 'أرسل — اكتملت' : `أرسل (${arNum(filled)}/${arNum(values.length)})`;
    }
  }

  function renderSheet(d) {
    const categories = d.categories || [];
    const key = `${d.roundIndex}`;
    if (key === sheetRenderKey) {
      const foot = document.getElementById('ihj-foot');
      if (foot) foot.textContent = `${arNum(d.submittedCount || 0)} من ${arNum(d.playerCount || nonHostMembers().length)} أرسلوا`;
      return;
    }
    sheetRenderKey = key;
    submitted = Boolean(d.mySubmitted);
    autoSubmitted = false;

    const draft = d.myDraft || [];
    box.innerHTML = `
      <div class="ihj-stage">
        ${head(d)}
        ${letterRow(d)}
        ${timerRow()}
        <div class="ihj-sheet">
          ${categories
            .map(
              (c, i) => `
              <div class="ihj-field">
                <span class="ihj-field-label">${esc(c.name)}</span>
                <input type="text" maxlength="40" autocomplete="off" data-i="${i}"
                       value="${esc(draft[i] || '')}" ${submitted ? 'disabled' : ''}
                       placeholder="${esc(`${c.name} بحرف ${d.currentLetter || ''}`)}">
              </div>`
            )
            .join('')}
        </div>
        <div class="ihj-progress">${categories.map(() => '<i></i>').join('')}</div>
        <button type="button" class="ihj-submit ${submitted ? 'is-locked' : ''}" id="ihj-submit" ${submitted ? 'disabled' : ''}>
          ${submitted ? 'تم الإرسال ✓' : 'أرسل'}
        </button>
        <span class="ihj-hint" id="ihj-hint">${submitted ? 'بانتظار بقية اللاعبين…' : 'لا أحد يرى إجاباتك قبل أن ترسلها.'}</span>
        <p class="ihj-foot" id="ihj-foot">${arNum(d.submittedCount || 0)} من ${arNum(d.playerCount || nonHostMembers().length)} أرسلوا</p>
      </div>`;

    const inputs = Array.from(box.querySelectorAll('.ihj-field input'));
    inputs.forEach((input, i) => {
      input.addEventListener('input', paintProgress);
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        // Enter walks down the sheet and sends from the last box, so the
        // whole round can be played without ever leaving the keyboard.
        const next = inputs[i + 1];
        if (next) next.focus();
        else commit(false);
      });
    });
    const btn = document.getElementById('ihj-submit');
    if (btn) btn.addEventListener('click', () => commit(false));
    if (!submitted && inputs[0]) inputs[0].focus();
    paintProgress();
    startTimer(d.phaseEndsAt);
  }

  function startTimer(endsAt) {
    const ring = document.getElementById('ihj-ring');
    const label = document.getElementById('ihj-countdown');
    window.BahjahTimerBar.start('ihj', document.getElementById('ihj-timer-fill'), null, endsAt, {
      onTick: (secs) => {
        if (secs > 0 && secs <= 3) window.BahjahSoundFx.tick();
        if (label) label.textContent = arNum(Math.max(0, secs));
        if (ring) ring.classList.toggle('is-danger', secs > 0 && secs <= 10);
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

  // The board, as the room sees it. Every player's row is public here; only
  // your own cells can be argued with.
  function boardTable(d, interactive) {
    const categories = d.categories || [];
    const board = d.board || {};
    const rows = nonHostMembers();
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
                const isMe = Boolean(me && m.userId === me.id);
                const total = answers.reduce((sum, a) => sum + scoreOf(a), 0);
                return `
                  <tr class="${isMe ? 'is-me' : ''}">
                    <th>${esc(isMe ? 'أنت' : m.displayName)}</th>
                    ${answers
                      .map((a, i) => {
                        const pts = scoreOf(a);
                        const cls = a.verdict === 'blank'
                          ? 'is-blank is-zero'
                          : pts === 0
                            ? 'is-zero'
                            : a.verdict === 'unique'
                              ? 'is-unique'
                              : 'is-shared';
                        const mine = interactive && isMe && a.verdict !== 'blank';
                        const shared = a.verdict === 'shared' && a.sharedWith.length
                          ? `<span class="ihj-shared-note">مع ${esc(a.sharedWith.map(nameOf).join('، '))}</span>`
                          : '';
                        return `
                          <td>
                            <div class="ihj-cell ${cls} ${mine ? 'is-mine' : ''}" ${mine ? `data-index="${i}" data-valid="${a.ownedValid === false ? 'false' : 'true'}"` : ''}>
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
        <span><i style="background:var(--ihj-olive)"></i> إجابة منفردة ١٠</span>
        <span><i style="background:var(--ihj-sand)"></i> إجابة مكررة ٥</span>
        <span><i style="background:var(--ihj-dust)"></i> فارغة أو ملغاة ٠</span>
      </div>`;
  }

  // Your own five, as a list. The full grid belongs on the television: five
  // columns crushed into a phone wrap mid-word and are unreadable, and the
  // only cells you can actually do anything about are your own.
  function myRows(d) {
    const categories = d.categories || [];
    const mine = (d.board || {})[me ? me.id : ''] || [];
    const scoreOf = (a) => (a.ownedValid === false || a.verdict === 'blank' ? 0 : a.verdict === 'unique' ? 10 : 5);
    return `
      <div class="ihj-mine">
        ${mine
          .map((a, i) => {
            const pts = scoreOf(a);
            const cls = a.verdict === 'blank' ? 'is-blank is-zero' : pts === 0 ? 'is-zero' : a.verdict === 'unique' ? 'is-unique' : 'is-shared';
            const shared = a.verdict === 'shared' && a.sharedWith.length
              ? `<span class="ihj-shared-note">مع ${esc(a.sharedWith.map(nameOf).join('، '))}</span>`
              : '';
            const tappable = a.verdict !== 'blank';
            return `
              <div class="ihj-mine-row ${cls} ${tappable ? 'is-mine' : ''}" ${tappable ? `data-index="${i}" data-valid="${a.ownedValid === false ? 'false' : 'true'}"` : ''}>
                <span class="ihj-mine-cat">${esc((categories[i] || {}).name || '')}</span>
                <span class="ihj-mine-text">${a.verdict === 'blank' ? '—' : esc(a.text)}${shared}</span>
                <span class="ihj-cell-pts">${arNum(pts)}</span>
              </div>`;
          })
          .join('')}
      </div>`;
  }

  function renderScoring(d) {
    window.BahjahTimerBar.stop('ihj');
    const continued = (d.continueUserIds || []).includes(me ? me.id : '');
    box.innerHTML = `
      <div class="ihj-stage">
        ${head(d)}
        ${letterRow(d)}
        <h2 class="ihj-screen-title">التصحيح.</h2>
        <p class="ihj-foot">المكرر يُحسب ٥ للطرفين. اضغط على أي إجابة من إجاباتك لإلغائها إن كانت غير صحيحة.</p>
        ${myRows(d)}
        ${legend()}
        <button type="button" class="ihj-submit ${continued ? 'is-locked' : ''}" id="ihj-next" ${continued ? 'disabled' : ''}>
          ${continued ? 'بانتظار البقية…' : 'التالي'}
        </button>
        <p class="ihj-foot">${arNum((d.continueUserIds || []).length)} من ${arNum(nonHostMembers().length)} جاهزون — النقاط تُعتمد عندما يوافق الجميع</p>
        <details class="ihj-others">
          <summary>لوحة الجميع</summary>
          ${boardTable(d, false)}
        </details>
      </div>`;

    box.querySelectorAll('.ihj-mine-row.is-mine').forEach((row) => {
      row.addEventListener('click', () => {
        const index = Number(row.dataset.index);
        const currentlyValid = row.dataset.valid !== 'false';
        window.BahjahSoundFx.tick();
        send({ type: 'mark', index, valid: !currentlyValid });
      });
    });
    const next = document.getElementById('ihj-next');
    if (next) {
      next.addEventListener('click', () => {
        next.disabled = true;
        next.classList.add('is-locked');
        next.textContent = 'بانتظار البقية…';
        send({ type: 'continue' });
      });
    }
  }

  function ranks(d) {
    const scores = d.scores || {};
    const deltas = d.lastRoundScores || {};
    const rows = nonHostMembers()
      .map((m) => ({ userId: m.userId, displayName: m.displayName, score: scores[m.userId] || 0 }))
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
    const top = rows.reduce((max, r) => Math.max(max, r.score), 0) || 1;
    return `
      <div class="ihj-ranks">
        ${rows
          .map((row, i) => {
            const isMe = Boolean(me && row.userId === me.id);
            const delta = deltas[row.userId];
            const pct = Math.max(4, Math.round((row.score / top) * 100));
            return `
              <div class="ihj-rank ${isMe ? 'is-me' : ''}">
                <div class="ihj-rank-line">
                  <span class="ihj-rank-no">${arNum(i + 1)}</span>
                  <span class="ihj-rank-av">${esc((row.displayName || '؟').trim().charAt(0))}</span>
                  <span class="ihj-rank-name">${esc(isMe ? 'أنت' : row.displayName)}</span>
                  ${delta && delta.total ? `<span class="ihj-rank-delta">+${arNum(delta.total)}</span>` : ''}
                  <span class="ihj-rank-total">${arNum(row.score)}</span>
                </div>
                <div class="ihj-rank-bar"><span style="width:${pct}%"></span></div>
              </div>`;
          })
          .join('')}
      </div>`;
  }

  function renderStandings(d) {
    window.BahjahTimerBar.stop('ihj');
    box.innerHTML = `
      <div class="ihj-stage">
        ${head(d)}
        <h2 class="ihj-screen-title">الترتيب.</h2>
        ${ranks(d)}
        <p class="ihj-foot">الجولة التالية بعد لحظات…</p>
      </div>`;
  }

  function renderFinished(d) {
    window.BahjahTimerBar.stop('ihj');
    clearInterval(window.__ihjCountdown);
    const scores = d.scores || {};
    const winners = new Set(d.winnerUserIds || []);
    const rows = nonHostMembers().slice().sort((a, b) => (scores[b.userId] || 0) - (scores[a.userId] || 0));
    const myRank = me ? rows.findIndex((m) => m.userId === me.id) + 1 : 0;
    const stats = me && d.finalStats ? d.finalStats[me.id] : null;
    const winnerNames = rows.filter((m) => winners.has(m.userId)).map((m) => m.displayName);
    if (me && winners.has(me.id)) window.BahjahSoundFx.win();

    box.innerHTML = `
      <div class="ihj-stage">
        <div class="ihj-winner">
          <div class="ihj-winner-label">الفائز</div>
          <h2 class="ihj-winner-name">${esc(winnerNames.length ? winnerNames.join('، ') : 'لا فائز')}</h2>
          <p class="ihj-winner-sub">${rows[0] ? `${arNum(scores[rows[0].userId] || 0)} نقطة` : ''}</p>
        </div>
        ${stats
          ? `<div class="ihj-awards">
              <div class="ihj-award"><span class="ihj-award-title">نقاطك</span><span class="ihj-award-name">${arNum(scores[me.id] || 0)}</span><span class="ihj-award-note">المركز ${arNum(myRank)}</span></div>
              <div class="ihj-award"><span class="ihj-award-title">إجابات منفردة</span><span class="ihj-award-name">${arNum(stats.uniqueAnswers)}</span><span class="ihj-award-note">١٠ نقاط لكل واحدة</span></div>
              <div class="ihj-award"><span class="ihj-award-title">أفضل جولة</span><span class="ihj-award-name">${arNum(stats.bestRound)}</span><span class="ihj-award-note">من ٥٠</span></div>
            </div>`
          : ''}
        ${ranks(d)}
        <div class="ihj-actions">
          <a class="is-primary" href="insan-hayawan-jamad.html">العب مرة أخرى</a>
          <button type="button" id="ihj-share">شارك النتيجة</button>
        </div>
        <p class="ihj-foot">بانتظار أن يبدأ المضيف لعبة جديدة…</p>
      </div>`;

    const shareBtn = document.getElementById('ihj-share');
    if (shareBtn) shareBtn.addEventListener('click', () => shareResult(scores, myRank, stats));
  }

  function shareResult(scores, myRank, stats) {
    const score = me ? scores[me.id] || 0 : 0;
    const won = myRank === 1;
    const shareBtn = document.getElementById('ihj-share');
    const url = `${location.origin}/bahjah-landing.html`;
    const headline = won ? 'لعبت إنسان حيوان جماد على بهجة وفزت!' : 'لعبت إنسان حيوان جماد على بهجة!';
    const subline = `إنسان حيوان جماد · ${score} نقطة · المركز #${myRank}`;
    const unique = stats ? stats.uniqueAnswers : 0;
    const text = `${headline} سجّلت ${score} نقطة${unique ? ` و${unique} إجابة لم يكتبها أحد غيري` : ''}. ✏️`;
    if (window.BahjahShareCard) {
      window.BahjahShareCard.share({ gameId: 'insan-hayawan-jamad', lang: 'ar', headline, subline, text, url, shareBtn });
      return;
    }
    if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(`${text} ${url}`).then(() => {
      if (!shareBtn) return;
      const original = shareBtn.textContent;
      shareBtn.textContent = 'تم النسخ!';
      setTimeout(() => (shareBtn.textContent = original), 1500);
    }).catch(() => {});
  }

  function renderEnded() {
    window.BahjahTimerBar.stop('ihj');
    clearInterval(window.__ihjCountdown);
    if (splash) splash.style.display = 'none';
    wrap.style.display = 'block';
    box.innerHTML = `
      <div class="ihj-stage">
        <h2 class="ihj-screen-title">أنهى المضيف هذه اللعبة (الرمز: ${esc(code)})</h2>
        <div class="ihj-actions">
          <a class="is-primary" href="bahjah-landing.html">العودة إلى بهجة</a>
        </div>
      </div>`;
  }
})();
