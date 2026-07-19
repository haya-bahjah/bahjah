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
  let countdownTimer = null;
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

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
    // The host restarted the room ("Play again") -- follow everyone back
    // to the waiting room instead of sitting on a stale finished screen.
    if (e.detail.status === 'lobby') {
      window.location.href = `mafia-lobby.html?code=${encodeURIComponent(code)}`;
    }
  });

  document.addEventListener('bahjah:game-state', (e) => {
    const state = e.detail;
    if (state.gameType !== 'mafia') return;
    latestState = state;
    attachErrorListenerOnce();
    render(state);
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (latestState) render(latestState);
  });

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

  function fmtCountdown(endsAt) {
    if (!endsAt) return '';
    const secs = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function startCountdown(endsAt) {
    if (countdownTimer) clearInterval(countdownTimer);
    const el = document.getElementById('mafia-countdown');
    if (!el) return;
    const tick = () => {
      el.textContent = fmtCountdown(endsAt);
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
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
    const lang = LANG_ATTR();
    const rows = (messages || [])
      .map((m) => `<div class="narrator-line"><strong>${nameFor(m.userId)}:</strong> ${m.text.replace(/</g, '&lt;')}</div>`)
      .join('');
    return `
      <div class="demo-sub" style="margin-top:10px; font-weight:700;">${lang === 'ar' ? 'دردشة المافيا السرية' : 'Mafia secret chat'}</div>
      <div id="mafia-chat-log" style="max-height:140px; overflow-y:auto; margin-bottom:8px;">${rows || `<div class="demo-sub">${lang === 'ar' ? 'لا رسائل بعد.' : 'No messages yet.'}</div>`}</div>
      <div style="display:flex; gap:6px;">
        <input type="text" id="mafia-chat-input" maxlength="240" placeholder="${lang === 'ar' ? 'اكتب رسالة لفريقك...' : 'Message your team...'}" style="flex:1; padding:8px; border-radius:6px; border:1px solid var(--line); background:var(--surface-2); color:var(--text); font-family:inherit;">
        <button class="btn btn-text btn-sm" id="mafia-chat-send">${lang === 'ar' ? 'إرسال' : 'Send'}</button>
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
    const lang = LANG_ATTR();
    const saved = (localStorage.getItem(notesKey()) || '').replace(/</g, '&lt;');
    return `
      <div class="notes-label">${lang === 'ar' ? 'ملاحظاتك الخاصة (لن تُشارك أبدًا)' : "Your private notes (never shared)"}</div>
      <textarea class="notes-box" id="mafia-notes">${saved}</textarea>
    `;
  }
  function bindNotes() {
    const el = document.getElementById('mafia-notes');
    if (!el) return;
    el.addEventListener('input', () => localStorage.setItem(notesKey(), el.value));
  }

  function renderRoleReveal(d) {
    const lang = LANG_ATTR();
    box.innerHTML = `
      ${roleHeader(d.myRole)}
      <div class="ready-progress">${lang === 'ar' ? `${d.readyCount} من ${d.totalPlayers} جاهزون` : `${d.readyCount} of ${d.totalPlayers} ready`}</div>
      <div class="demo-footer">
        ${
          d.iAmReady
            ? `<span class="demo-sub">${lang === 'ar' ? 'بانتظار البقية...' : 'Waiting on the rest of the table…'}</span>`
            : `<button class="btn btn-primary" id="mafia-ready-btn">${lang === 'ar' ? 'أنا جاهز' : "I'm Ready"}</button>`
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
    const lang = LANG_ATTR();
    box.innerHTML = `
      ${roleHeader(d.myRole)}
      <div class="demo-title">${lang === 'ar' ? 'نقاش تعارف' : 'Getting-to-know-you discussion'} <span id="mafia-countdown" style="color:var(--accent);"></span></div>
      <div class="demo-sub">${lang === 'ar' ? 'تعرفوا على بعضكم قبل أن يحل الليل لأول مرة.' : 'Get a feel for the table before night falls for the first time.'}</div>
    `;
    startCountdown(d.phaseEndsAt);
  }

  function renderNight(d) {
    document.body.classList.add('night-mode');
    const lang = LANG_ATTR();
    let body = '';
    if (d.myRole === 'mafia') {
      const teammates = (d.mafiaTeammates || []).map(nameFor).join(', ') || (lang === 'ar' ? 'لا أحد غيرك' : 'none but you');
      const votesList = Object.entries(d.mafiaVotes || {})
        .map(([voter, target]) => `${nameFor(voter)} → ${nameFor(target)}`)
        .join(' · ');
      body = `
        <div class="demo-sub">${lang === 'ar' ? 'فريقك' : 'Your team'}: ${teammates}</div>
        ${votesList ? `<div class="narrator-line">${votesList}</div>` : ''}
      `;
      if (d.myKillVote) {
        body += `<div class="demo-sub">${lang === 'ar' ? 'اخترت' : 'You chose'}: ${nameFor(d.myKillVote)}. ${lang === 'ar' ? 'بانتظار البقية...' : 'Waiting on the rest of the team...'}</div>`;
      } else {
        const excluded = new Set((d.mafiaTeammates || []).concat(me ? [me.id] : []));
        const targets = d.players.filter((p) => p.alive && !excluded.has(p.userId));
        body += targetList(targets, lang === 'ar' ? 'اقتل' : 'Kill', 'mafia-kill');
      }
      body += mafiaChatBox(d.mafiaChat);
    } else if (d.myRole === 'detective') {
      if (d.actedThisRound) {
        body = `<div class="demo-sub">${lang === 'ar' ? 'حققت الليلة. بانتظار البقية...' : "You've investigated tonight. Waiting on the rest of the roles..."}</div>`;
      } else {
        const targets = d.players.filter((p) => p.alive && p.userId !== (me && me.id));
        body = targetList(targets, lang === 'ar' ? 'حقق' : 'Investigate', 'investigate');
      }
      body += investigationLine(d);
    } else if (d.myRole === 'doctor') {
      if (d.myProtection) {
        body = `<div class="demo-sub">${lang === 'ar' ? 'تحمي' : "You're protecting"}: ${nameFor(d.myProtection)}. ${lang === 'ar' ? 'بانتظار البقية...' : 'Waiting on the rest of the roles...'}</div>`;
      } else {
        const targets = d.players.filter((p) => p.alive);
        body = targetList(targets, lang === 'ar' ? 'احمِ' : 'Protect', 'protect');
      }
    } else {
      body = `<div class="demo-sub">${lang === 'ar' ? 'يحل الليل. القرية نائمة بينما يتصرف آخرون.' : 'Night falls. The village sleeps while others act.'}</div>`;
      body += villagerNotesBlock();
    }

    const hasVoteHappened = d.lastVoteTally !== undefined;
    const voteRecap =
      hasVoteHappened && Object.keys(d.lastVoteTally).length
        ? `<div class="narrator-line">${lang === 'ar' ? 'نتيجة تصويت اليوم' : "Today's vote"}: ${Object.entries(d.lastVoteTally)
            .map(([voter, target]) => `${nameFor(voter)} → ${nameFor(target)}`)
            .join(' · ')}</div>`
        : '';
    const voteElimLine = hasVoteHappened
      ? d.lastVoteEliminated
        ? eliminationLine(d.lastVoteEliminated, d.eliminatedRoles, 'was voted out today', 'أُقصي بالتصويت اليوم')
        : `<div class="narrator-line">${lang === 'ar' ? 'لم يُقصَ أحد بالتصويت اليوم.' : 'No one was voted out today.'}</div>`
      : '';

    box.innerHTML = `
      ${roleHeader(d.myRole)}
      <div class="demo-title">${lang === 'ar' ? `الليل — الجولة ${d.round}` : `Night — round ${d.round}`} <span id="mafia-countdown" style="color:var(--accent);"></span></div>
      ${voteElimLine}
      ${voteRecap}
      ${eliminatedRosterLine(d)}
      ${body}
    `;
    bindTargetButtons();
    bindMafiaChat();
    bindNotes();
    startCountdown(d.phaseEndsAt);
  }

  function renderDay(d) {
    document.body.classList.remove('night-mode');
    const lang = LANG_ATTR();
    const line = eliminationLine(d.lastNightEliminated, d.eliminatedRoles, 'was eliminated last night', 'أُقصي الليلة الماضية');
    box.innerHTML = `
      ${roleHeader(d.myRole)}
      <div class="demo-title">${lang === 'ar' ? 'نقاش الصباح' : 'Morning discussion'} <span id="mafia-countdown" style="color:var(--accent);"></span></div>
      ${line}
      ${eliminatedRosterLine(d)}
      ${investigationLine(d)}
      <div class="demo-sub">${lang === 'ar' ? 'ناقشوا من تشتبهون به قبل التصويت.' : 'Discuss who you suspect before the vote.'}</div>
    `;
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
      ${tieNote}
      ${progressLine}
      ${investigationLine(d)}
      ${body}
    `;
    bindTargetButtons();
    startCountdown(d.phaseEndsAt);
  }

  function renderFinished(d) {
    if (countdownTimer) clearInterval(countdownTimer);
    document.body.classList.remove('night-mode');
    const lang = LANG_ATTR();
    const winnerLabel = d.winner === 'mafia' ? (lang === 'ar' ? 'فازت المافيا!' : 'Mafia wins!') : lang === 'ar' ? 'فازت القرية!' : 'Village wins!';
    const roles = d.allRoles || {};
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
    `;
    startCountdown(d.phaseEndsAt);
  }

  function render(state) {
    wrap.style.display = 'block';
    const d = state.data || {};

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
