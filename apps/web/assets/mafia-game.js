// Renders the live mafia game into #mafia-live-box, driven entirely by
// 'bahjah:game-state' events dispatched by assets/lobby.js. Only active
// when the page has a #mafia-live container (mafia.html). Reuses the
// existing demo-* / role-reveal / suspect-list CSS classes already defined
// on this page for the marketing walkthrough, so the real game matches it.
(function () {
  const LANG = document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  const wrap = document.getElementById('mafia-live');
  const box = document.getElementById('mafia-live-box');
  if (!wrap || !box) return;

  const me = BahjahSession.getUser();
  let latestRoom = null;
  let countdownTimer = null;

  const ROLE_INFO = {
    mafia: { en: ['Mafia', "Choose a target with your team each night. Don't get caught."], ar: ['مافيا', 'اختر هدفًا مع فريقك كل ليلة. لا تُكتشف.'] },
    detective: { en: ['Detective', 'Investigate one player each night to learn if they are Mafia.'], ar: ['محقق', 'حقّق مع لاعب واحد كل ليلة لتعرف إن كان من المافيا.'] },
    doctor: { en: ['Doctor', 'Protect one player each night from elimination.'], ar: ['طبيب', 'احمِ لاعبًا واحدًا كل ليلة من الإقصاء.'] },
    villager: { en: ['Villager', 'No special power. Survive the night and vote wisely by day.'], ar: ['قروي', 'لا قدرة خاصة. انجُ من الليل وصوّت بحكمة نهارًا.'] },
  };

  document.addEventListener('bahjah:room-update', (e) => {
    latestRoom = e.detail;
  });

  document.addEventListener('bahjah:game-state', (e) => {
    const state = e.detail;
    if (state.gameType !== 'mafia') return;
    render(state);
  });

  function nameFor(userId) {
    const m = latestRoom && latestRoom.members.find((x) => x.userId === userId);
    return m ? m.displayName : userId;
  }

  function fmtCountdown(endsAt) {
    if (!endsAt) return '';
    const secs = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function roleLabel(role) {
    const info = ROLE_INFO[role] || ROLE_INFO.villager;
    return info[LANG === 'ar' ? 'ar' : 'en'][0];
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

  function act(action) {
    const socket = window.BahjahRoom && window.BahjahRoom.socket;
    if (!socket) return;
    socket.emit('game:action', { action });
  }

  function targetList(targets, label, actionType) {
    return `<div class="suspect-list">${targets
      .map(
        (t) => `
      <div class="suspect-row">
        <span class="suspect-name">${nameFor(t.userId)}</span>
        <button class="btn btn-text btn-sm" data-target="${t.userId}" data-action="${actionType}">${label}</button>
      </div>`
      )
      .join('')}</div>`;
  }

  function bindTargetButtons() {
    box.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        act({ type: btn.dataset.action, targetUserId: btn.dataset.target });
      });
    });
  }

  function eliminatedRosterLine(d) {
    const dead = d.players.filter((p) => !p.alive);
    if (dead.length === 0) return '';
    const items = dead
      .map((p) => {
        const role = d.eliminatedRoles[p.userId];
        return `${nameFor(p.userId)} (${role ? roleLabel(role) : LANG === 'ar' ? 'مجهول الدور بعد' : 'role unknown yet'})`;
      })
      .join(', ');
    return `<div class="demo-sub" id="mafia-eliminated-roster">${LANG === 'ar' ? 'أُقصوا حتى الآن' : 'Eliminated so far'}: ${items}</div>`;
  }

  function eliminationLine(userId, eliminatedRoles, verbEn, verbAr) {
    if (!userId) return '';
    const role = eliminatedRoles[userId];
    if (role) {
      return `<div class="narrator-line">${LANG === 'ar' ? `${nameFor(userId)} (${roleLabel(role)}) ${verbAr}` : `${nameFor(userId)} (${roleLabel(role)}) ${verbEn}`}</div>`;
    }
    return `<div class="narrator-line">${LANG === 'ar' ? `${nameFor(userId)} ${verbAr}. سيُكشف دوره لاحقًا.` : `${nameFor(userId)} ${verbEn}. Their role will be revealed later.`}</div>`;
  }

  function mafiaChatBox(messages) {
    const rows = (messages || [])
      .map(
        (m) => `<div class="narrator-line"><strong>${nameFor(m.userId)}:</strong> ${m.text.replace(/</g, '&lt;')}</div>`
      )
      .join('');
    return `
      <div class="demo-sub" style="margin-top:10px; font-weight:700;">${LANG === 'ar' ? 'دردشة المافيا السرية' : 'Mafia secret chat'}</div>
      <div id="mafia-chat-log" style="max-height:140px; overflow-y:auto; margin-bottom:8px;">${rows || `<div class="demo-sub">${LANG === 'ar' ? 'لا رسائل بعد.' : 'No messages yet.'}</div>`}</div>
      <div style="display:flex; gap:6px;">
        <input type="text" id="mafia-chat-input" maxlength="240" placeholder="${LANG === 'ar' ? 'اكتب رسالة لفريقك...' : 'Message your team...'}" style="flex:1; padding:8px; border-radius:6px; border:1px solid var(--line); background:var(--surface-2); color:var(--text); font-family:inherit;">
        <button class="btn btn-text btn-sm" id="mafia-chat-send">${LANG === 'ar' ? 'إرسال' : 'Send'}</button>
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
    const verdict = d.myInvestigation.isMafia ? (LANG === 'ar' ? 'من المافيا' : 'is Mafia') : LANG === 'ar' ? 'ليس من المافيا' : 'not Mafia';
    return `<div class="narrator-line">${LANG === 'ar' ? 'آخر تحقيق' : 'Last investigation'}: ${nameFor(d.myInvestigation.targetUserId)} — ${verdict}</div>`;
  }

  function roleHeader(role) {
    const info = ROLE_INFO[role] || ROLE_INFO.villager;
    const [name, desc] = LANG === 'ar' ? info.ar : info.en;
    return `
      <div class="role-reveal">
        <span class="tag-role">${LANG === 'ar' ? 'دورك' : 'Your role'}: ${name}</span>
        <p>${desc}</p>
      </div>`;
  }

  function render(state) {
    wrap.style.display = 'block';
    const d = state.data || {};

    if (state.phase === 'finished') {
      if (countdownTimer) clearInterval(countdownTimer);
      const winnerLabel =
        d.winner === 'mafia' ? (LANG === 'ar' ? 'فازت المافيا!' : 'Mafia wins!') : LANG === 'ar' ? 'فازت القرية!' : 'Village wins!';
      const roles = d.allRoles || {};
      box.innerHTML = `
        <div class="demo-title">${winnerLabel}</div>
        <div class="suspect-list">
          ${Object.keys(roles)
            .map((userId) => `<div class="suspect-row"><span class="suspect-name">${nameFor(userId)}</span><span>${(ROLE_INFO[roles[userId]] || ROLE_INFO.villager)[LANG === 'ar' ? 'ar' : 'en'][0]}</span></div>`)
            .join('')}
        </div>
      `;
      return;
    }

    if (!d.myAlive) {
      // A player who was actually assigned a role and died is "eliminated";
      // someone who joined after the game started was never in it at all,
      // so myRole is null for them — different message for each case.
      const spectatorLine = d.myRole
        ? (LANG === 'ar' ? 'لقد أُقصيت. أنت الآن تشاهد بقية اللعبة.' : "You've been eliminated. You're now watching the rest of the game.")
        : (LANG === 'ar' ? 'هذه اللعبة قيد التقدم بالفعل. أنت تشاهد حتى تنتهي الجولة.' : 'This game is already in progress. You are spectating until it wraps up.');
      box.innerHTML = `
        ${d.myRole ? roleHeader(d.myRole) : ''}
        <div class="narrator-line">${spectatorLine}</div>
        <div class="demo-sub" id="mafia-countdown"></div>
      `;
      startCountdown(d.phaseEndsAt);
      return;
    }

    if (state.phase === 'night') {
      let body = '';
      if (d.myRole === 'mafia') {
        const teammates = (d.mafiaTeammates || []).map(nameFor).join(', ') || (LANG === 'ar' ? 'لا أحد غيرك' : 'none but you');
        const votesList = Object.entries(d.mafiaVotes || {})
          .map(([voter, target]) => `${nameFor(voter)} → ${nameFor(target)}`)
          .join(' · ');
        body = `
          <div class="demo-sub">${LANG === 'ar' ? 'فريقك' : 'Your team'}: ${teammates}</div>
          ${votesList ? `<div class="narrator-line">${votesList}</div>` : ''}
        `;
        if (d.myKillVote) {
          body += `<div class="demo-sub">${LANG === 'ar' ? 'اخترت' : 'You chose'}: ${nameFor(d.myKillVote)}. ${LANG === 'ar' ? 'بانتظار البقية...' : 'Waiting on the rest of the team...'}</div>`;
        } else {
          const targets = d.players.filter((p) => p.alive && !(d.mafiaTeammates || []).concat(me ? [me.id] : []).includes(p.userId));
          body += targetList(targets, LANG === 'ar' ? 'اقتل' : 'Kill', 'mafia-kill');
        }
        body += mafiaChatBox(d.mafiaChat);
      } else if (d.myRole === 'detective') {
        if (d.actedThisRound) {
          body = `<div class="demo-sub">${LANG === 'ar' ? 'حققت الليلة. بانتظار البقية...' : "You've investigated tonight. Waiting on the rest of the roles..."}</div>`;
        } else {
          const targets = d.players.filter((p) => p.alive && p.userId !== (me && me.id));
          body = targetList(targets, LANG === 'ar' ? 'حقق' : 'Investigate', 'investigate');
        }
        body += investigationLine(d);
      } else if (d.myRole === 'doctor') {
        if (d.myProtection) {
          body = `<div class="demo-sub">${LANG === 'ar' ? 'تحمي' : "You're protecting"}: ${nameFor(d.myProtection)}. ${LANG === 'ar' ? 'بانتظار البقية...' : 'Waiting on the rest of the roles...'}</div>`;
        } else {
          const targets = d.players.filter((p) => p.alive);
          body = targetList(targets, LANG === 'ar' ? 'احمِ' : 'Protect', 'protect');
        }
      } else {
        body = `<div class="demo-sub">${LANG === 'ar' ? 'يحل الليل. القرية نائمة بينما يتصرف آخرون.' : 'Night falls. The village sleeps while others act.'}</div>`;
      }

      const voteRecap = d.lastVoteTally && Object.keys(d.lastVoteTally).length
        ? `<div class="narrator-line">${LANG === 'ar' ? 'نتيجة تصويت اليوم' : "Today's vote"}: ${Object.entries(d.lastVoteTally)
            .map(([voter, target]) => `${nameFor(voter)} → ${nameFor(target)}`)
            .join(' · ')}</div>`
        : '';
      const voteElimLine = d.lastVoteEliminated
        ? eliminationLine(d.lastVoteEliminated, d.eliminatedRoles, 'was voted out today', 'أُقصي بالتصويت اليوم')
        : `<div class="narrator-line">${LANG === 'ar' ? 'لم يُقصَ أحد بالتصويت اليوم.' : 'No one was voted out today.'}</div>`;

      box.innerHTML = `
        ${roleHeader(d.myRole)}
        <div class="demo-title">${LANG === 'ar' ? `الليل — الجولة ${d.round}` : `Night — round ${d.round}`} <span id="mafia-countdown" style="float:inline-end; color:var(--accent);"></span></div>
        ${voteElimLine}
        ${voteRecap}
        ${eliminatedRosterLine(d)}
        ${body}
      `;
      bindTargetButtons();
      bindMafiaChat();
      startCountdown(d.phaseEndsAt);
      return;
    }

    if (state.phase === 'day') {
      const elim = d.lastNightEliminated;
      const line = elim
        ? eliminationLine(elim, d.eliminatedRoles, 'was eliminated last night', 'أُقصي الليلة الماضية')
        : `<div class="narrator-line">${LANG === 'ar' ? 'لم يُقصَ أحد الليلة الماضية — الطبيب نجح في الحماية.' : 'No one was eliminated last night — the Doctor made a save.'}</div>`;
      box.innerHTML = `
        ${roleHeader(d.myRole)}
        <div class="demo-title">${LANG === 'ar' ? 'نقاش الصباح' : 'Morning discussion'} <span id="mafia-countdown" style="float:inline-end; color:var(--accent);"></span></div>
        ${line}
        ${eliminatedRosterLine(d)}
        ${investigationLine(d)}
        <div class="demo-sub">${LANG === 'ar' ? 'ناقشوا من تشتبهون به قبل التصويت.' : 'Discuss who you suspect before the vote.'}</div>
      `;
      startCountdown(d.phaseEndsAt);
      return;
    }

    if (state.phase === 'vote') {
      const votedCount = (d.votedUserIds || []).length;
      const totalAlive = d.players.filter((p) => p.alive).length;
      const progressLine = `<div class="demo-sub">${LANG === 'ar' ? `${votedCount} من ${totalAlive} صوّتوا` : `${votedCount} of ${totalAlive} have voted`}</div>`;
      let body;
      if (d.myVote) {
        body = `<div class="demo-sub">${LANG === 'ar' ? 'صوّت لصالح' : 'You voted for'}: ${nameFor(d.myVote)}. ${LANG === 'ar' ? 'ستظل النتيجة سرية حتى يصوّت الجميع.' : 'Results stay hidden until everyone has voted.'}</div>`;
      } else {
        const targets = d.players.filter((p) => p.alive);
        body = targetList(targets, LANG === 'ar' ? 'صوّت' : 'Vote', 'vote');
      }
      box.innerHTML = `
        ${roleHeader(d.myRole)}
        <div class="demo-title">${LANG === 'ar' ? 'التصويت السري' : 'Anonymous vote'} <span id="mafia-countdown" style="float:inline-end; color:var(--accent);"></span></div>
        ${progressLine}
        ${investigationLine(d)}
        ${body}
      `;
      bindTargetButtons();
      startCountdown(d.phaseEndsAt);
    }
  }
})();
