// Player-only mafia gameplay, driven entirely by 'bahjah:game-state' events
// dispatched by assets/lobby.js. Only active on mafia-play.html (needs
// #mafia-live + #mafia-play-box). Mafia's host plays like everyone else
// (GAME_HOST_PLAYS.mafia=true), so the host lands here too -- the finished
// screen below shows a host-only "Play again" button once they do.
(function () {
  const LANG_ATTR = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const wrap = document.getElementById('mafia-live');
  const box = document.getElementById('mafia-play-box');
  if (!wrap || !box) return;

  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || '').toUpperCase();
  const me = BahjahSession.getActiveUser();
  let latestRoom = null;
  let latestState = null;
  let errorListenerAttached = false;

  const ROLE_INFO = {
    mafia: {
      en: [
        'Mafia',
        "Work with the other Mafia members to eliminate all villagers without being discovered. During the Night Phase, you can communicate with the other Mafia members and vote on a target. Do not reveal your role.",
      ],
      ar: [
        'مافيا',
        'اعمل مع بقية أعضاء المافيا للتخلص من كل القرويين دون أن يتم اكتشافك. خلال مرحلة الليل، يمكنك التواصل مع بقية المافيا والتصويت على هدف. لا تكشف عن دورك.',
      ],
    },
    detective: {
      en: [
        'Detective',
        'Investigate one player each night. You will learn whether that player is Mafia or Not Mafia. Keep your findings secret unless you decide to reveal them during discussion.',
      ],
      ar: [
        'محقق',
        'حقّق مع لاعب واحد كل ليلة. ستعرف إن كان ذلك اللاعب من المافيا أو لا. احتفظ بنتائجك سرية إلا إذا قررت الكشف عنها أثناء النقاش.',
      ],
    },
    doctor: {
      en: ['Doctor', 'Protect one player each night. You may choose yourself if the game settings allow it.'],
      ar: ['طبيب', 'احمِ لاعبًا واحدًا كل ليلة. يمكنك اختيار نفسك إذا سمحت إعدادات اللعبة بذلك.'],
    },
    villager: {
      en: ['Villager', 'Use discussion, observation, and voting to identify and eliminate the Mafia.'],
      ar: ['قروي', 'استخدم النقاش والملاحظة والتصويت لتحديد المافيا والتخلص منهم.'],
    },
  };

  // Small t()/COPY foundation for new noir-styled markup -- introduced here
  // and extended phase by phase as later phases touch renderNight/Day/Vote/
  // Finished; those still use their existing inline en/ar ternaries for now.
  function t(en, ar) {
    return LANG_ATTR() === 'ar' ? ar : en;
  }

  const HUD_SEGMENTS = ['day', 'vote', 'night', 'dawn', 'verdict'];
  const PHASE_TO_SEGMENT = { day: 'day', vote: 'vote', revote: 'vote', night: 'night', finished: 'verdict' };

  function renderHud(phase, round) {
    const hudWrap = document.getElementById('mf-hud-wrap');
    if (!hudWrap) return;
    const showHud = phase !== 'role-reveal' && phase !== 'briefing';
    hudWrap.style.display = showHud ? 'block' : 'none';
    if (!showHud) return;
    const activeSeg = PHASE_TO_SEGMENT[phase] || null;
    const activeIndex = activeSeg ? HUD_SEGMENTS.indexOf(activeSeg) : -1;
    document.querySelectorAll('#mf-hud-segments .mf-hud-seg').forEach((el) => {
      const idx = HUD_SEGMENTS.indexOf(el.dataset.seg);
      el.classList.toggle('is-active', idx === activeIndex);
      el.classList.toggle('is-done', activeIndex !== -1 && idx < activeIndex);
    });
    const roundEl = document.getElementById('mf-hud-round');
    if (roundEl) roundEl.textContent = round ? t(`Round ${round}`, `الجولة ${round}`) : '';
  }

  // Role-card art: server has one 'mafia' role and one 'villager' role, no
  // boss/hitman or citizen-f/citizen-m distinction, so the specific piece
  // shown is cosmetic only -- picked by a stable per-player hash so it
  // never flickers between renders (same rule the finished/verdict screen
  // uses for its win-card art in Phase 10).
  function hashSeed(str) {
    let hash = 0;
    for (let i = 0; i < String(str).length; i++) hash = (hash * 31 + String(str).charCodeAt(i)) >>> 0;
    return hash;
  }
  function roleArt(role, userId) {
    const base = 'assets/mafia/cards/';
    if (role === 'mafia') return base + (hashSeed(userId) % 2 === 0 ? 'mafia-boss.svg' : 'mafia-hitman.svg');
    if (role === 'doctor') return base + 'doctor.svg';
    if (role === 'detective') return base + 'sheriff.svg';
    return base + (hashSeed(userId) % 2 === 0 ? 'citizen-m.svg' : 'citizen-f.svg');
  }

  let roomEnded = false;

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
    // The host restarted the room ("Play again") -- follow everyone back
    // to the waiting room instead of sitting on a stale finished screen.
    if (e.detail.status === 'lobby') {
      window.location.href = `mafia-lobby.html?code=${encodeURIComponent(code)}`;
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
    if (state.gameType !== 'mafia') return;
    latestState = state;
    attachErrorListenerOnce();
    render(state);
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (roomEnded) {
      renderEnded();
      return;
    }
    if (latestState) render(latestState);
  });

  function renderEnded() {
    window.BahjahTimerBar.stop('mafia');
    document.body.classList.remove('night-mode');
    const hudWrap = document.getElementById('mf-hud-wrap');
    if (hudWrap) hudWrap.style.display = 'none';
    const lang = LANG_ATTR();
    box.innerHTML = `
      <div class="demo-sub" style="text-align:center; font-size:16px; color:var(--text); font-weight:700;">${lang === 'ar' ? `أنهى المضيف هذه اللعبة (الرمز: ${code})` : `Host has ended this game (code: ${code})`}</div>
      <a href="bahjah-landing.html" class="btn btn-primary" style="display:block; width:fit-content; margin:20px auto 0; text-decoration:none;">${lang === 'ar' ? 'العودة إلى بهجة' : 'Back to Bahjah'}</a>
    `;
  }

  function attachErrorListenerOnce() {
    if (errorListenerAttached) return;
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    errorListenerAttached = true;
    socket.on('room:error', (err) => {
      if (!['ALREADY_ACTED', 'INVALID_TARGET', 'WRONG_ROLE', 'NOT_ALIVE', 'INVALID_ACTION'].includes(err.code)) return;
      const footer = box.querySelector('.demo-footer');
      if (footer) {
        footer.textContent = err.message;
        return;
      }
      const errEl = document.createElement('div');
      errEl.className = 'demo-sub';
      errEl.style.color = 'var(--accent)';
      errEl.textContent = err.message;
      box.appendChild(errEl);
    });
  }

  function act(action) {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    window.BahjahSoundFx.submit();
    socket.emit('game:action', { action });
  }

  function nameFor(userId) {
    const m = latestRoom && latestRoom.members.find((x) => x.userId === userId);
    return m ? m.displayName : userId;
  }

  function avatarHtml(userId) {
    if (!window.BahjahAvatars) return '';
    const m = latestRoom && latestRoom.members.find((x) => x.userId === userId);
    return window.BahjahAvatars.renderAvatarHtml(m ? m.avatar : null, userId);
  }

  function roleLabel(role) {
    const info = ROLE_INFO[role] || ROLE_INFO.villager;
    return info[LANG_ATTR() === 'ar' ? 'ar' : 'en'][0];
  }

  function roleHeader(role) {
    if (!role) return '';
    const info = ROLE_INFO[role] || ROLE_INFO.villager;
    const [name, desc] = LANG_ATTR() === 'ar' ? info.ar : info.en;
    return `
      <div class="role-reveal">
        <span class="tag-role">${LANG_ATTR() === 'ar' ? 'دورك' : 'Your role'}: ${name}</span>
        <p>${desc}</p>
      </div>`;
  }

  function startCountdown(endsAt) {
    window.BahjahTimerBar.start(
      'mafia',
      document.getElementById('mafia-timer-fill'),
      document.getElementById('mafia-countdown'),
      endsAt,
      { longFormat: true, onTick: (secs) => { if (secs > 0 && secs <= 3) window.BahjahSoundFx.tick(); } }
    );
  }

  function targetList(targets, label, actionType) {
    return `<div class="suspect-list">${targets
      .map(
        (t) => `
      <div class="suspect-row">
        <span class="suspect-who"><span class="suspect-avatar">${avatarHtml(t.userId)}</span><span class="suspect-name">${nameFor(t.userId)}</span></span>
        <button class="btn btn-text btn-sm" data-target="${t.userId}" data-action="${actionType}">${label}</button>
      </div>`
      )
      .join('')}</div>`;
  }

  // Night-only target picker (mafia-kill/investigate/protect). Kept
  // separate from targetList() above, which renderVote (Phase 8) still
  // uses with the old suspect-row markup -- they'll converge once vote
  // gets its own dedicated redesign pass.
  function nightTargetGrid(targets, label, actionType) {
    return `<div class="mf-target-grid">${targets
      .map(
        (t2) => `
      <div class="mf-target-row">
        <span class="mf-target-who"><span class="mf-target-avatar">${avatarHtml(t2.userId)}</span><span class="mf-target-name">${nameFor(t2.userId)}</span></span>
        <button type="button" class="mf-target-action" data-target="${t2.userId}" data-action="${actionType}">${label}</button>
      </div>`
      )
      .join('')}</div>`;
  }

  // A one-shot "night falls" overlay, shown the first time we render a
  // given night round (not on every re-render within that round, e.g.
  // after a lang toggle or a teammate's chat message).
  let lastNightTransitionRound = null;
  function maybeShowNightTransition(round) {
    if (round === lastNightTransitionRound) return;
    lastNightTransitionRound = round;
    const el = document.getElementById('mf-night-transition');
    if (!el) return;
    el.style.display = 'flex';
    window.BahjahSoundFx.night && window.BahjahSoundFx.night();
    setTimeout(() => {
      el.style.display = 'none';
    }, 1600);
  }

  function bindTargetButtons() {
    box.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        box.querySelectorAll('button[data-action]').forEach((b) => (b.disabled = true));
        act({ type: btn.dataset.action, targetUserId: btn.dataset.target });
      });
    });
  }

  function eliminatedRosterLine(d) {
    const dead = d.players.filter((p) => !p.alive);
    if (dead.length === 0) return '';
    const lang = LANG_ATTR();
    const items = dead
      .map((p) => {
        const role = d.eliminatedRoles[p.userId];
        return `${nameFor(p.userId)} (${role ? roleLabel(role) : lang === 'ar' ? 'مجهول الدور' : 'role unknown'})`;
      })
      .join(', ');
    return `<div class="demo-sub">${lang === 'ar' ? 'أُقصوا حتى الآن' : 'Eliminated so far'}: ${items}</div>`;
  }

  function eliminationLine(userId, eliminatedRoles, verbEn, verbAr) {
    if (userId === undefined) return '';
    const lang = LANG_ATTR();
    if (!userId) {
      return `<div class="narrator-line">${lang === 'ar' ? 'لم يُقصَ أحد الليلة الماضية — الحماية نجحت.' : 'No one was eliminated last night — the protection held.'}</div>`;
    }
    const role = eliminatedRoles[userId];
    if (role) {
      return `<div class="narrator-line">${lang === 'ar' ? `${nameFor(userId)} (${roleLabel(role)}) ${verbAr}` : `${nameFor(userId)} (${roleLabel(role)}) ${verbEn}`}</div>`;
    }
    return `<div class="narrator-line">${lang === 'ar' ? `${nameFor(userId)} ${verbAr}. سيُكشف دوره لاحقًا.` : `${nameFor(userId)} ${verbEn}. Their role will be revealed later.`}</div>`;
  }

  function mafiaChatBox(messages) {
    const rows = (messages || [])
      .map((m) => `<div class="mf-mafia-chat-msg"><strong>${nameFor(m.userId)}:</strong> ${m.text.replace(/</g, '&lt;')}</div>`)
      .join('');
    return `
      <div class="mf-mafia-chat">
        <div class="mf-mafia-chat-label">${t('Mafia secret chat', 'دردشة المافيا السرية')}</div>
        <div class="mf-mafia-chat-log" id="mafia-chat-log">${rows || `<div class="mf-mafia-chat-empty">${t('No messages yet.', 'لا رسائل بعد.')}</div>`}</div>
        <div class="mf-mafia-chat-row">
          <input type="text" class="mf-mafia-chat-input" id="mafia-chat-input" maxlength="240" placeholder="${t('Message your team…', 'اكتب رسالة لفريقك...')}">
          <button type="button" class="bh-btn bh-btn--ghost bh-btn--sm" id="mafia-chat-send">${t('Send', 'إرسال')}</button>
        </div>
      </div>
    `;
  }

  function bindMafiaChat() {
    const input = document.getElementById('mafia-chat-input');
    const sendBtn = document.getElementById('mafia-chat-send');
    if (!input || !sendBtn) return;
    const log = document.getElementById('mafia-chat-log');
    if (log) log.scrollTop = log.scrollHeight;
    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      act({ type: 'mafia-chat', text });
      input.value = '';
    };
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });
  }

  function investigationLine(d) {
    if (d.myRole !== 'detective' || !d.myInvestigation) return '';
    const lang = LANG_ATTR();
    const verdict = d.myInvestigation.isMafia ? (lang === 'ar' ? 'من المافيا' : 'is Mafia') : lang === 'ar' ? 'ليس من المافيا' : 'not Mafia';
    return `<div class="narrator-line">${lang === 'ar' ? 'آخر تحقيق' : 'Last investigation'}: ${nameFor(d.myInvestigation.targetUserId)} — ${verdict}</div>`;
  }

  // Villagers have no night action, but may keep personal notes for
  // themselves -- purely client-side (localStorage), never sent to the
  // server, per the flow doc's explicit "never shared" requirement.
  function notesKey() {
    return `bahjah_mafia_notes_${code}`;
  }
  function villagerNotesBlock() {
    const saved = (localStorage.getItem(notesKey()) || '').replace(/</g, '&lt;');
    return `
      <div class="mf-notes-label">${t('Your private notes (never shared)', 'ملاحظاتك الخاصة (لن تُشارك أبدًا)')}</div>
      <textarea class="mf-notes-box" id="mafia-notes">${saved}</textarea>
    `;
  }
  function bindNotes() {
    const el = document.getElementById('mafia-notes');
    if (!el) return;
    el.addEventListener('input', () => localStorage.setItem(notesKey(), el.value));
  }

  function renderRoleReveal(d) {
    const info = ROLE_INFO[d.myRole] || ROLE_INFO.villager;
    const [name, desc] = LANG_ATTR() === 'ar' ? info.ar : info.en;
    const art = roleArt(d.myRole, me ? me.id : d.myRole);
    box.innerHTML = `
      <div class="mf-reveal-card" data-role="${d.myRole || 'villager'}">
        <img class="mf-reveal-art" src="${art}" alt="">
        <div class="mf-reveal-kicker">${t('Your role', 'دورك')}</div>
        <h2 class="mf-reveal-name">${name}</h2>
        <p class="mf-reveal-desc">${desc}</p>
      </div>
      <div class="mf-ready-row">
        <div class="mf-ready-count">${t(`${d.readyCount} of ${d.totalPlayers} ready`, `${d.readyCount} من ${d.totalPlayers} جاهزون`)}</div>
        ${
          d.iAmReady
            ? `<div class="mf-ready-waiting">${t('Waiting on the rest of the table…', 'بانتظار البقية...')}</div>`
            : `<button type="button" class="bh-btn bh-btn--hot bh-btn--md" id="mafia-ready-btn">${t("I'm ready", 'أنا جاهز')}</button>`
        }
      </div>
    `;
    const btn = document.getElementById('mafia-ready-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        btn.disabled = true;
        act({ type: 'ready' });
      });
    }
  }

  function renderBriefing(d) {
    box.innerHTML = `
      <div class="mf-briefing">
        <div class="mf-briefing-kicker">${t('Getting to know you', 'تعارف')}</div>
        <h2>${t('The table settles in.', 'تستقر الطاولة.')}</h2>
        <p>${t('Get a feel for the room before night falls for the first time.', 'تعرّفوا على بعضكم قبل أن يحل الليل لأول مرة.')}</p>
        <div class="mf-briefing-timer">
          <div class="mf-timer-track"><div class="mf-timer-fill" id="mafia-timer-fill"></div></div>
          <span class="mf-timer-count" id="mafia-countdown"></span>
        </div>
      </div>
    `;
    startCountdown(d.phaseEndsAt);
  }

  function renderNight(d) {
    document.body.classList.add('night-mode');
    maybeShowNightTransition(d.round);
    const roleScope = d.myRole || 'villager';
    let body = '';
    if (d.myRole === 'mafia') {
      const teammates = (d.mafiaTeammates || []).map(nameFor).join(', ') || t('none but you', 'لا أحد غيرك');
      const votesList = Object.entries(d.mafiaVotes || {})
        .map(([voter, target]) => `${nameFor(voter)} → ${nameFor(target)}`)
        .join(' · ');
      body = `
        <div class="mf-status-banner">${t('Your team', 'فريقك')}: <strong>${teammates}</strong></div>
        ${votesList ? `<div class="narrator-line">${votesList}</div>` : ''}
      `;
      if (d.myKillVote) {
        body += `<div class="mf-status-banner">${t('You chose', 'اخترت')} <strong>${nameFor(d.myKillVote)}</strong>. ${t('Waiting on the rest of the team…', 'بانتظار البقية...')}</div>`;
      } else {
        const excluded = new Set((d.mafiaTeammates || []).concat(me ? [me.id] : []));
        const targets = d.players.filter((p) => p.alive && !excluded.has(p.userId));
        body += nightTargetGrid(targets, t('Kill', 'اقتل'), 'mafia-kill');
      }
      body += mafiaChatBox(d.mafiaChat);
    } else if (d.myRole === 'detective') {
      if (d.actedThisRound) {
        body = `<div class="mf-status-banner">${t("You've investigated tonight. Waiting on the rest of the roles…", 'حققت الليلة. بانتظار البقية...')}</div>`;
      } else {
        const targets = d.players.filter((p) => p.alive && p.userId !== (me && me.id));
        body = nightTargetGrid(targets, t('Investigate', 'حقق'), 'investigate');
      }
      body += investigationLine(d);
    } else if (d.myRole === 'doctor') {
      if (d.myProtection) {
        body = `<div class="mf-status-banner">${t("You're protecting", 'تحمي')} <strong>${nameFor(d.myProtection)}</strong>. ${t('Waiting on the rest of the roles…', 'بانتظار البقية...')}</div>`;
      } else {
        const targets = d.players.filter((p) => p.alive);
        body = nightTargetGrid(targets, t('Protect', 'احمِ'), 'protect');
      }
    } else {
      body = `<div class="mf-sleep-line">${t('Night falls. The village sleeps while others act.', 'يحل الليل. القرية نائمة بينما يتصرف آخرون.')}</div>`;
      body += villagerNotesBlock();
    }

    const hasVoteHappened = d.lastVoteTally !== undefined;
    const voteRecap =
      hasVoteHappened && Object.keys(d.lastVoteTally).length
        ? `<div class="narrator-line">${t("Today's vote", 'نتيجة تصويت اليوم')}: ${Object.entries(d.lastVoteTally)
            .map(([voter, target]) => `${nameFor(voter)} → ${nameFor(target)}`)
            .join(' · ')}</div>`
        : '';
    const voteElimLine = hasVoteHappened
      ? d.lastVoteEliminated
        ? eliminationLine(d.lastVoteEliminated, d.eliminatedRoles, 'was voted out today', 'أُقصي بالتصويت اليوم')
        : `<div class="narrator-line">${t('No one was voted out today.', 'لم يُقصَ أحد بالتصويت اليوم.')}</div>`
      : '';

    box.innerHTML = `
      ${roleHeader(d.myRole)}
      <div class="demo-title">${t(`Night — round ${d.round}`, `الليل — الجولة ${d.round}`)} <span id="mafia-countdown" style="color:var(--mafia-red);"></span></div>
      <div class="timer-bar"><div class="timer-bar-fill" id="mafia-timer-fill"></div></div>
      ${voteElimLine}
      ${voteRecap}
      ${eliminatedRosterLine(d)}
      <div data-role-scope="${roleScope}">${body}</div>
    `;
    bindTargetButtons();
    bindMafiaChat();
    bindNotes();
    startCountdown(d.phaseEndsAt);
  }

  const QUICK_REPLIES = [
    { en: "I'm not Mafia", ar: 'أنا لست مافيا' },
    { en: 'Who do we vote?', ar: 'من نصوّت؟' },
    { en: "That's suspicious", ar: 'هذا مريب' },
    { en: 'I agree', ar: 'أوافق' },
  ];

  function dayRoster(players) {
    return `<div class="mf-day-roster">${players
      .map(
        (p) => `
      <div class="mf-day-roster-item ${p.alive ? '' : 'is-dead'}">
        <span class="mf-day-roster-avatar">${avatarHtml(p.userId)}</span>
        <span class="mf-day-roster-name">${nameFor(p.userId)}</span>
      </div>`
      )
      .join('')}</div>`;
  }

  function dayChatBox(messages) {
    const rows = (messages || [])
      .map((m) => `<div class="mf-day-chat-msg"><strong>${nameFor(m.userId)}:</strong> ${m.text.replace(/</g, '&lt;')}</div>`)
      .join('');
    const chips = QUICK_REPLIES.map(
      (q) => `<button type="button" class="mf-quick-reply" data-quick="${(LANG_ATTR() === 'ar' ? q.ar : q.en).replace(/"/g, '&quot;')}">${LANG_ATTR() === 'ar' ? q.ar : q.en}</button>`
    ).join('');
    return `
      <div class="mf-day-chat">
        <div class="mf-day-chat-log" id="mafia-day-chat-log">${rows || `<div class="mf-day-chat-empty">${t('No messages yet.', 'لا رسائل بعد.')}</div>`}</div>
        <div class="mf-quick-replies">${chips}</div>
        <div class="mf-day-chat-row">
          <input type="text" class="mf-day-chat-input" id="mafia-day-chat-input" maxlength="240" placeholder="${t('Say something…', 'قل شيئًا...')}">
          <button type="button" class="bh-btn bh-btn--ghost bh-btn--sm" id="mafia-day-chat-send">${t('Send', 'إرسال')}</button>
        </div>
      </div>
    `;
  }

  function bindDayChat() {
    const input = document.getElementById('mafia-day-chat-input');
    const sendBtn = document.getElementById('mafia-day-chat-send');
    if (!input || !sendBtn) return;
    const log = document.getElementById('mafia-day-chat-log');
    if (log) log.scrollTop = log.scrollHeight;
    const send = (text) => {
      const value = (text ?? input.value).trim();
      if (!value) return;
      act({ type: 'day-chat', text: value });
      input.value = '';
    };
    sendBtn.addEventListener('click', () => send());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });
    box.querySelectorAll('.mf-quick-reply').forEach((chip) => {
      chip.addEventListener('click', () => send(chip.dataset.quick));
    });
  }

  function renderDay(d) {
    document.body.classList.remove('night-mode');
    const line = eliminationLine(d.lastNightEliminated, d.eliminatedRoles, 'was eliminated last night', 'أُقصي الليلة الماضية');
    box.innerHTML = `
      ${roleHeader(d.myRole)}
      <div class="demo-title">${t('Morning discussion', 'نقاش الصباح')} <span id="mafia-countdown" style="color:var(--mafia-red);"></span></div>
      <div class="timer-bar"><div class="timer-bar-fill" id="mafia-timer-fill"></div></div>
      ${line}
      ${eliminatedRosterLine(d)}
      ${investigationLine(d)}
      <div class="mf-day-layout">
        ${dayRoster(d.players)}
        ${dayChatBox(d.dayChat)}
      </div>
      <div class="mf-start-vote-row">
        <button type="button" class="bh-btn bh-btn--hot bh-btn--md" disabled>${t('Start vote', 'ابدأ التصويت')}</button>
        <div class="mf-start-vote-hint">${t('Voting opens automatically when discussion time runs out.', 'يبدأ التصويت تلقائيًا عند انتهاء وقت النقاش.')}</div>
      </div>
    `;
    bindDayChat();
    startCountdown(d.phaseEndsAt);
  }

  function renderVote(d, isRevote) {
    document.body.classList.remove('night-mode');
    const lang = LANG_ATTR();
    const votedCount = (d.votedUserIds || []).length;
    const totalAlive = d.players.filter((p) => p.alive).length;
    const progressLine = `<div class="demo-sub">${lang === 'ar' ? `${votedCount} من ${totalAlive} صوّتوا` : `${votedCount} of ${totalAlive} have voted`}</div>`;
    let body;
    if (d.myVote) {
      body = `<div class="demo-sub">${lang === 'ar' ? 'صوّت لصالح' : 'You voted for'}: ${nameFor(d.myVote)}. ${lang === 'ar' ? 'ستظل النتيجة سرية حتى يصوّت الجميع.' : 'Results stay hidden until everyone has voted.'}</div>`;
    } else {
      const candidateIds = isRevote ? new Set(d.revoteCandidates || []) : null;
      const targets = d.players.filter((p) => p.alive && p.userId !== (me && me.id) && (!candidateIds || candidateIds.has(p.userId)));
      body = targetList(targets, lang === 'ar' ? 'صوّت' : 'Vote', 'vote');
    }
    const tieNote = isRevote ? `<div class="narrator-line">${lang === 'ar' ? 'تعادل! أعيدوا التصويت بين المرشحين المتعادلين.' : "It's a tie! Revote between the tied candidates."}</div>` : '';
    box.innerHTML = `
      ${roleHeader(d.myRole)}
      <div class="demo-title">${isRevote ? (lang === 'ar' ? 'إعادة التصويت' : 'Revote') : lang === 'ar' ? 'التصويت السري' : 'Anonymous vote'} <span id="mafia-countdown" style="color:var(--accent);"></span></div>
      <div class="timer-bar"><div class="timer-bar-fill" id="mafia-timer-fill"></div></div>
      ${tieNote}
      ${progressLine}
      ${investigationLine(d)}
      ${body}
    `;
    bindTargetButtons();
    startCountdown(d.phaseEndsAt);
  }

  function renderFinished(d) {
    window.BahjahTimerBar.stop('mafia');
    document.body.classList.remove('night-mode');
    const lang = LANG_ATTR();
    const winnerLabel = d.winner === 'mafia' ? (lang === 'ar' ? 'فازت المافيا!' : 'Mafia wins!') : lang === 'ar' ? 'فازت القرية!' : 'Village wins!';
    const roles = d.allRoles || {};
    const myFinalRole = me ? roles[me.id] : null;
    const myTeamWon = myFinalRole && (d.winner === 'mafia' ? myFinalRole === 'mafia' : myFinalRole !== 'mafia');
    if (myTeamWon) window.BahjahSoundFx.win();
    const stats = d.stats || {};
    const detectiveTotal = Object.values(stats.detectiveFinds || {}).reduce((sum, n) => sum + n, 0);
    const myAccuracy = me && stats.votingAccuracy ? stats.votingAccuracy[me.id] : undefined;
    const survivors = (stats.survivors || []).map(nameFor).join(', ') || (lang === 'ar' ? 'لا أحد' : 'no one');

    const statsBlock = `
      <div class="final-stats">
        <div class="final-stat"><div class="stat-value">${stats.totalRounds ?? d.round}</div><div class="stat-label">${lang === 'ar' ? 'الجولات' : 'Rounds'}</div></div>
        <div class="final-stat"><div class="stat-value">${stats.playersEliminated ?? '—'}</div><div class="stat-label">${lang === 'ar' ? 'مُقصون' : 'Eliminated'}</div></div>
        <div class="final-stat"><div class="stat-value">${stats.mafiaEliminations ?? '—'}</div><div class="stat-label">${lang === 'ar' ? 'مافيا مُقصاة' : 'Mafia caught'}</div></div>
        <div class="final-stat"><div class="stat-value">${stats.doctorSaves ?? 0}</div><div class="stat-label">${lang === 'ar' ? 'إنقاذات الطبيب' : 'Doctor saves'}</div></div>
        <div class="final-stat"><div class="stat-value">${detectiveTotal}</div><div class="stat-label">${lang === 'ar' ? 'تحقيقات صحيحة' : 'Correct finds'}</div></div>
        <div class="final-stat"><div class="stat-value">${myAccuracy != null ? `${Math.round(myAccuracy * 100)}%` : '—'}</div><div class="stat-label">${lang === 'ar' ? 'دقة تصويتك' : 'Your accuracy'}</div></div>
      </div>
    `;

    const isHost = Boolean(me && latestRoom && latestRoom.members.some((m) => m.userId === me.id && m.isHost));
    const actions = isHost
      ? `<button class="btn btn-primary" id="mafia-restart-btn" style="width:100%; margin-top:14px;">${lang === 'ar' ? 'العب مجددًا' : 'Play again'}</button>`
      : `<p class="waiting-note">${lang === 'ar' ? 'بانتظار أن يبدأ المضيف لعبة جديدة…' : 'Waiting for the host to start a new game…'}</p>`;

    box.innerHTML = `
      <div class="result-banner"><h3>${winnerLabel}</h3></div>
      ${statsBlock}
      <div class="demo-sub">${lang === 'ar' ? 'الناجون النهائيون' : 'Final survivors'}: ${survivors}</div>
      <div class="suspect-list" style="margin-top:14px;">
        ${Object.keys(roles)
          .map(
            (userId) =>
              `<div class="suspect-row"><span class="suspect-who"><span class="suspect-avatar">${avatarHtml(userId)}</span><span class="suspect-name">${nameFor(userId)}</span></span><span>${roleLabel(roles[userId])}</span></div>`
          )
          .join('')}
      </div>
      <button class="btn btn-primary" id="mafia-share-btn" style="width:100%; margin-top:14px;">${lang === 'ar' ? 'شارك نتيجتك' : 'Share your result'}</button>
      ${actions}
      <p style="text-align:center; margin-top:10px;"><a class="back-link" href="mafia.html">${lang === 'ar' ? 'انضم إلى لعبة أخرى' : 'Join another game'}</a></p>
    `;
    const restartBtn = document.getElementById('mafia-restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        restartBtn.disabled = true;
        const socket = window.BahjahRoom && window.BahjahRoom.socket;
        if (socket) socket.emit('room:restart');
      });
    }
    const shareBtn = document.getElementById('mafia-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', () => shareResult(myTeamWon, myFinalRole));
  }

  function shareResult(won, myFinalRole) {
    const lang = LANG_ATTR();
    const shareBtn = document.getElementById('mafia-share-btn');
    const url = `${location.origin}/bahjah-landing.html`;
    const roleText = myFinalRole ? roleLabel(myFinalRole) : '';

    const headline = lang === 'ar'
      ? won ? 'لعبت للتو على بهجة وفزت!' : 'لعبت للتو على بهجة!'
      : won ? 'I just played on Bahjah and won!' : 'I just played on Bahjah!';
    const subline = lang === 'ar'
      ? `مافيا${roleText ? ` · ${roleText}` : ''}`
      : `Mafia${roleText ? ` · ${roleText}` : ''}`;
    const text = lang === 'ar'
      ? `${headline} لعبت مافيا على بهجة${roleText ? ` بدور ${roleText}` : ''}. 🎭`
      : `${headline} Played Mafia on Bahjah${roleText ? ` as ${roleText}` : ''}. 🎭`;

    if (window.BahjahShareCard) {
      window.BahjahShareCard.share({ gameId: 'mafia', lang, headline, subline, text, url, shareBtn });
      return;
    }
    if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
      return;
    }
    navigator.clipboard
      .writeText(`${text} ${url}`)
      .then(() => {
        if (!shareBtn) return;
        const original = shareBtn.textContent;
        shareBtn.textContent = lang === 'ar' ? 'تم النسخ!' : 'Copied!';
        setTimeout(() => (shareBtn.textContent = original), 1500);
      })
      .catch(() => {});
  }

  function renderSpectator(d) {
    const lang = LANG_ATTR();
    const spectatorLine = d.myRole
      ? lang === 'ar'
        ? 'لقد أُقصيت. أنت الآن تشاهد بقية اللعبة.'
        : "You've been eliminated. You're now watching the rest of the game."
      : lang === 'ar'
      ? 'هذه اللعبة قيد التقدم بالفعل. أنت تشاهد حتى تنتهي الجولة.'
      : 'This game is already in progress. You are spectating until it wraps up.';
    box.innerHTML = `
      ${roleHeader(d.myRole)}
      <div class="narrator-line">${spectatorLine}</div>
      <div class="demo-sub" id="mafia-countdown"></div>
      <div class="timer-bar"><div class="timer-bar-fill" id="mafia-timer-fill"></div></div>
    `;
    startCountdown(d.phaseEndsAt);
  }

  function render(state) {
    wrap.style.display = 'block';
    const d = state.data || {};
    renderHud(state.phase, d.round);

    if (state.phase === 'finished') {
      renderFinished(d);
      return;
    }

    if (state.phase !== 'role-reveal' && !d.myAlive) {
      document.body.classList.remove('night-mode');
      renderSpectator(d);
      return;
    }

    if (state.phase === 'role-reveal') {
      renderRoleReveal(d);
      return;
    }
    if (state.phase === 'briefing') {
      document.body.classList.remove('night-mode');
      renderBriefing(d);
      return;
    }
    if (state.phase === 'night') {
      renderNight(d);
      return;
    }
    if (state.phase === 'day') {
      renderDay(d);
      return;
    }
    if (state.phase === 'vote') {
      renderVote(d, false);
      return;
    }
    if (state.phase === 'revote') {
      renderVote(d, true);
    }
  }
})();
