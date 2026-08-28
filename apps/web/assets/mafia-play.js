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

  // The tracker follows the order the game is actually played in -- night
  // first, then the report, then the floor -- rather than the day-first order
  // it carried before dawn and elimination became phases of their own.
  const HUD_SEGMENTS = ['night', 'dawn', 'talk', 'vote', 'out'];
  const PHASE_TO_SEGMENT = {
    night: 'night', dawn: 'dawn', day: 'talk',
    vote: 'vote', revote: 'vote', elim: 'out', finished: 'out',
  };

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
    const elimEl = document.getElementById('mf-elim-overlay');
    if (elimEl) elimEl.style.display = 'none';
    const dawnEl = document.getElementById('mf-dawn-overlay');
    if (dawnEl) dawnEl.style.display = 'none';
    const shareEl = document.getElementById('mf-share-overlay');
    if (shareEl) shareEl.style.display = 'none';
    const lang = LANG_ATTR();
    box.innerHTML = `
      <div class="demo-sub" style="text-align:center; font-size:16px; color:var(--text-primary); font-weight:700;">${lang === 'ar' ? `أنهى المضيف هذه اللعبة (الرمز: ${code})` : `Host has ended this game (code: ${code})`}</div>
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
      const errEl = document.createElement('div');
      errEl.className = 'demo-sub';
      errEl.style.color = 'var(--mafia-red)';
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
    const m = memberFor(userId);
    return m ? m.displayName : userId;
  }

  // The handoff gives every player a noir identity token (fedora, revolver,
  // cigar, ...) assigned by join order, and that token follows them from the
  // lobby into the chat, the vote grid and the verdict -- it is how you
  // recognise someone across the whole match. The lobby already does this
  // (mafia-lobby-config.js applyIdentityTokens); this is the same rule for
  // every in-game screen. An avatar the player chose themselves still wins,
  // exactly as it does in the lobby and everywhere else on the site.
  function memberFor(userId) {
    const members = (latestRoom && latestRoom.members) || [];
    return members.find((x) => x.userId === userId) || null;
  }

  function avatarHtml(userId) {
    const m = memberFor(userId);
    if (!m || !m.avatar) {
      const members = (latestRoom && latestRoom.members) || [];
      if (members.length && window.BahjahMafiaIdentity) {
        const src = window.BahjahMafiaIdentity.tokenFor(members, userId);
        return `<img src="${src}" alt="" class="mf-token">`;
      }
    }
    if (!window.BahjahAvatars) return '';
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

  // Target picker shared by night actions (mafia-kill/investigate/protect)
  // and the vote/revote candidate grid.
  function targetGrid(targets, label, actionType) {
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

  // ---- the phone as a controller -------------------------------------
  // The design's night and vote screens are pick-then-confirm, not tap-to-
  // fire: you choose a name, look at it, and commit. A misfire on a single
  // tap is unrecoverable in this game -- the vote is locked and the night is
  // spent -- so the second step is the point, not ceremony.
  let phoneSel = null;
  let phoneSelKey = null;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function pickerGrid(targets) {
    if (!targets.length) {
      return `<p class="mfp-empty">${t('Nobody to choose from.', 'لا أحد للاختيار منه.')}</p>`;
    }
    return `<div class="mfp-pick">${targets.map((p) => `
      <button type="button" class="mfp-pick-btn${phoneSel === p.userId ? ' is-on' : ''}" data-pick="${esc(p.userId)}">
        <span class="mfp-pick-face">${avatarHtml(p.userId)}</span>
        <span class="mfp-pick-name">${esc(nameFor(p.userId))}</span>
      </button>`).join('')}</div>`;
  }

  // One button, three states: nothing picked, picked and ready, already sent.
  function confirmRow(actionType, idleLabel) {
    if (!phoneSel) {
      return `<button type="button" class="mfp-confirm" id="mfp-confirm" data-act="${esc(actionType)}" disabled>${esc(idleLabel)}</button>`;
    }
    return `<button type="button" class="mfp-confirm is-ready" id="mfp-confirm" data-act="${esc(actionType)}">${
      t('Confirm', 'أكّد')
    }</button>`;
  }

  function bindPicker() {
    box.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        phoneSel = btn.dataset.pick;
        window.BahjahSoundFx.click && window.BahjahSoundFx.click();
        if (latestState) render(latestState);
      });
    });
    const confirm = document.getElementById('mfp-confirm');
    if (confirm && !confirm.disabled) {
      confirm.addEventListener('click', () => {
        if (!phoneSel) return;
        confirm.disabled = true;
        box.querySelectorAll('[data-pick]').forEach((b) => (b.disabled = true));
        act({ type: confirm.dataset.act, targetUserId: phoneSel });
      });
    }
  }

  // The design's phone header for an action screen: the role's kicker, what
  // it is being asked to do, and one line of why.
  function actHead(kicker, title, sub, color) {
    return `
      <div class="mfp-head">
        <span class="mfp-kicker"${color ? ` style="color:${color}"` : ''}>${esc(kicker)}</span>
        <h2 class="mfp-title">${esc(title)}</h2>
        <p class="mfp-sub">${esc(sub)}</p>
      </div>`;
  }

  // A locked state: your move is in, and the phone stops asking.
  function lockedPanel(title, sub) {
    return `
      <div class="mfp-locked">
        <span class="mfp-locked-mark" aria-hidden="true">&#10003;</span>
        <span class="mfp-locked-title">${esc(title)}</span>
        <span class="mfp-locked-sub">${esc(sub)}</span>
      </div>`;
  }

  // Dawn and elimination on the phone. The design keeps these read-only --
  // the card comes up on the TV, and the phone tells you what it means for
  // you, including that you are out of it.
  function renderReport(d, kind) {
    const lang = LANG_ATTR();
    const isDawn = kind === 'dawn';
    const who = isDawn
      ? (d.dawnKilledUserId != null ? d.dawnKilledUserId : d.lastNightEliminated)
      : (d.elimUserId != null ? d.elimUserId : d.lastVoteEliminated);
    const role = isDawn
      ? (d.dawnKilledRole || (d.eliminatedRoles || {})[who])
      : (d.elimRole || (d.eliminatedRoles || {})[who]);
    const isMe = Boolean(me && who === me.id);

    let kicker;
    let title;
    let sub;
    if (isDawn) {
      kicker = lang === 'ar' ? `الفجر — الجولة ${d.round || 1}` : `Dawn — round ${d.round || 1}`;
      title = who
        ? (isMe ? t('You were killed', 'قُتلت') : t(`${nameFor(who)} is dead`, `${nameFor(who)} مات`))
        : t('Nobody died', 'لم يمت أحد');
      sub = who
        ? t('The Doctor was somewhere else. Look at who is left.', 'كان الطبيب في مكان آخر. انظر إلى من تبقّى.')
        : t('The Doctor got there first. The Mafia wasted a night.', 'وصل الطبيب أولًا. أضاعت المافيا ليلة.');
    } else {
      kicker = t('Eliminated', 'أُقصي');
      title = who
        ? (isMe ? t('You were hanged', 'شُنقت') : t(`${nameFor(who)} is out`, `${nameFor(who)} خرج`))
        : t('Nobody out', 'لم يخرج أحد');
      sub = who
        ? (role === 'mafia'
            ? t('The town got one right. One less killer.', 'أصابت المدينة. قاتل أقل.')
            : t('Innocent. The Mafia is still at the table.', 'بريء. المافيا ما زالت على الطاولة.'))
        : t('A tie. Everyone lives.', 'تعادل. الجميع ينجو.');
    }

    const art = who && role && window.BahjahMafiaIdentity
      ? window.BahjahMafiaIdentity.roleArt(role, who)
      : '';

    box.innerHTML = `
      <div class="mfp-report">
        <span class="mfp-kicker"${isDawn ? ' style="color:var(--mafia-red)"' : ''}>${esc(kicker)}</span>
        <h2 class="mfp-report-title">${esc(title)}</h2>
        ${art ? `<span class="mfp-report-card" role="img" aria-label="${esc(roleLabel(role))}" style="background-image:url('${esc(art)}')"></span>` : ''}
        <p class="mfp-sub">${esc(sub)}</p>
        ${!d.myAlive ? `<span class="mfp-out">${t("You're out — watch the TV", 'أنت خارج اللعبة — تابع الشاشة')}</span>` : ''}
      </div>`;
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

  // Plays a soft cue when a NEW message from someone else arrives, without
  // replaying on every re-render (lang toggle, other players' actions) or
  // misfiring when the array resets to [] at the start of a fresh
  // night/day (len shrinking is silently resynced, not treated as new).
  let lastMafiaChatLen = 0;
  function maybeWhisperMafia(messages) {
    const len = (messages || []).length;
    if (len > lastMafiaChatLen) {
      const last = messages[messages.length - 1];
      if (last && last.userId !== (me && me.id)) window.BahjahSoundFx.whisper();
    }
    lastMafiaChatLen = len;
  }
  // Guards heart() so it only plays when the doctor's protection target
  // actually changes, not on every re-render while it's already set.
  let lastProtectionTarget = null;

  let lastDayChatLen = 0;
  function maybeWhisperDay(messages) {
    const len = (messages || []).length;
    if (len > lastDayChatLen) {
      const last = messages[messages.length - 1];
      if (last && last.userId !== (me && me.id)) window.BahjahSoundFx.whisper();
    }
    lastDayChatLen = len;
  }

  function mafiaChatBox(messages) {
    maybeWhisperMafia(messages);
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

  // Plays once per game (role-reveal only ever happens at game start, and
  // this module is torn down on every full page load/restart) -- guarded
  // so re-renders from OTHER players' ready-count updates don't replay it.
  // Role reveal. The design makes this the one deliberate, private act on the
  // phone: a face-down card you tap, cupped in your hand. Showing the role
  // straight away would put it on screen while somebody is still looking over
  // your shoulder from the lobby.
  let roleFlipped = false;
  function renderRoleReveal(d) {
    const role = d.myRole || 'villager';
    const lang = LANG_ATTR();
    const ident = window.BahjahMafiaIdentity;
    const art = ident ? ident.roleArt(role, me ? me.id : role) : roleArt(role, me ? me.id : role);
    const name = ident ? ident.roleName(role, lang) : roleLabel(role);
    const desc = ident ? ident.roleDesc(role, lang) : '';
    const color = ident ? ident.roleColor(role) : 'var(--text-primary)';

    if (!roleFlipped) {
      box.innerHTML = `
        <div class="mfp-flip">
          <span class="mfp-kicker" style="color:var(--mafia-red)">${t('Night falls', 'يحل الليل')}</span>
          <button type="button" class="mfp-cardback" id="mfp-flip-btn">
            <span class="mfp-cardback-mark" aria-hidden="true"></span>
            <span class="mfp-cardback-label">${t('Tap to reveal', 'اضغط للكشف')}</span>
          </button>
          <p class="mfp-sub">${t('Shield your screen. Nobody else sees this.', 'احمِ شاشتك. لا أحد غيرك يرى هذا.')}</p>
        </div>`;
      const flip = document.getElementById('mfp-flip-btn');
      if (flip) {
        flip.addEventListener('click', () => {
          roleFlipped = true;
          window.BahjahSoundFx.reveal();
          if (latestState) render(latestState);
        });
      }
      return;
    }

    box.innerHTML = `
      <div class="mfp-flip">
        <span class="mfp-rolecard" role="img" aria-label="${esc(name)}" style="background-image:url('${esc(art)}')"></span>
        <h2 class="mfp-rolename" style="color:${color}">${esc(name)}</h2>
        <p class="mfp-sub">${esc(desc)}</p>
        <div class="mfp-ready">
          <span class="mfp-wait">${
            lang === 'ar' ? `${d.readyCount} من ${d.totalPlayers} جاهزون` : `${d.readyCount} of ${d.totalPlayers} ready`
          }</span>
          ${
            d.iAmReady
              ? `<span class="mfp-locked-sub">${t('Waiting on the rest of the table…', 'بانتظار البقية...')}</span>`
              : `<button type="button" class="mfp-confirm is-ready" id="mafia-ready-btn">${t("I'm ready", 'أنا جاهز')}</button>`
          }
        </div>
      </div>`;
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
          <div class="timer-bar"><div class="timer-bar-fill" id="mafia-timer-fill"></div></div>
          <span class="mf-timer-count" id="mafia-countdown"></span>
        </div>
      </div>
    `;
    startCountdown(d.phaseEndsAt);
  }

  // Night, on the phone. The design splits this in two: an action screen for
  // the roles that act, and a sleep screen for everyone else. Which one you
  // get is the only thing on this phone that tells you what you are, so it
  // never leaks onto the big screen.
  function renderNight(d) {
    document.body.classList.add('night-mode');
    maybeShowNightTransition(d.round);
    const lang = LANG_ATTR();
    const role = d.myRole;
    const color = window.BahjahMafiaIdentity ? window.BahjahMafiaIdentity.roleColor(role) : '';
    const roundLabel = lang === 'ar' ? `الليلة ${d.round}` : `Night ${d.round}`;

    // Citizens have no night move, and neither does anybody already out.
    if (role !== 'mafia' && role !== 'doctor' && role !== 'detective') {
      box.innerHTML = `
        <div class="mfp-sleep">
          <span class="mfp-sleep-ring" aria-hidden="true">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg>
          </span>
          <h2 class="mfp-title">${t('You sleep', 'أنت نائم')}</h2>
          <p class="mfp-sub">${t('Citizens have no night action. Your power is your voice tomorrow.', 'لا فعل ليلي للمواطنين. قوتك صوتك غدًا.')}</p>
          <span class="mfp-wait">${t('Waiting for the others', 'بانتظار البقية')}</span>
          ${villagerNotesBlock()}
        </div>`;
      bindNotes();
      startCountdown(d.phaseEndsAt);
      return;
    }

    let head;
    let targets = [];
    let actionType;
    let idleLabel = t('Pick a target', 'اختر هدفًا');
    let locked = null;
    let extra = '';

    if (role === 'mafia') {
      head = actHead(
        `${t('Mafia', 'المافيا')} — ${roundLabel}`,
        t('Choose tonight', 'اختر الليلة'),
        t('One name. Agree it with your team.', 'اسم واحد. اتفقوا عليه مع فريقك.'),
        color
      );
      const teammates = d.mafiaTeammates || [];
      const excluded = new Set(teammates.concat(me ? [me.id] : []));
      targets = d.players.filter((p) => p.alive && !excluded.has(p.userId));
      actionType = 'mafia-kill';
      if (d.myKillVote) {
        locked = lockedPanel(
          t(`You chose ${nameFor(d.myKillVote)}`, `اخترت ${nameFor(d.myKillVote)}`),
          t('Waiting on the rest of the team…', 'بانتظار بقية الفريق...')
        );
      }
      // The whisper channel: the one place the family can talk, and the
      // reason the mafia screen is taller than the others.
      extra = mafiaChatBox(d.mafiaChat);
    } else if (role === 'doctor') {
      head = actHead(
        `${t('Doctor', 'الطبيب')} — ${roundLabel}`,
        t('Save a life', 'أنقذ حياة'),
        t('Guess who the Mafia wants.', 'خمّن من تريده المافيا.'),
        color
      );
      targets = d.players.filter((p) => p.alive);
      actionType = 'protect';
      if (d.myProtection) {
        if (d.myProtection !== lastProtectionTarget) window.BahjahSoundFx.heart();
        lastProtectionTarget = d.myProtection;
        locked = lockedPanel(
          t(`You're protecting ${nameFor(d.myProtection)}`, `تحمي ${nameFor(d.myProtection)}`),
          t('Waiting on the rest of the roles…', 'بانتظار بقية الأدوار...')
        );
      }
    } else {
      head = actHead(
        `${t('Sheriff', 'العمدة')} — ${roundLabel}`,
        t('Run a check', 'تحقّق من اسم'),
        t('One name. The badge tells you mafia or not.', 'اسم واحد. الشارة تخبرك: مافيا أم لا.'),
        color
      );
      targets = d.players.filter((p) => p.alive && p.userId !== (me && me.id));
      actionType = 'investigate';
      if (d.actedThisRound) {
        locked = lockedPanel(
          t("You've checked tonight", 'تحققت الليلة'),
          t('Waiting on the rest of the roles…', 'بانتظار بقية الأدوار...')
        );
      }
      extra = badgeResult(d);
    }

    box.innerHTML = `
      <div class="mfp-act" data-role-scope="${role}">
        ${head}
        ${extra}
        ${locked || pickerGrid(targets)}
        ${locked ? '' : confirmRow(actionType, idleLabel)}
        <div class="mfp-clock"><div class="timer-bar"><div class="timer-bar-fill" id="mafia-timer-fill"></div></div><span id="mafia-countdown"></span></div>
      </div>`;
    if (!locked) bindPicker();
    bindMafiaChat();
    startCountdown(d.phaseEndsAt);
  }

  // The design's "BADGE SAYS" panel -- the sheriff's one piece of hard
  // information, and the only thing on any phone that names another player's
  // role before the end.
  function badgeResult(d) {
    const inv = d.myInvestigation;
    if (!inv) return '';
    const color = inv.isMafia ? 'var(--mafia-red)' : 'var(--role-citizen)';
    const text = inv.isMafia
      ? t(`${nameFor(inv.targetUserId)} is Mafia.`, `${nameFor(inv.targetUserId)} من المافيا.`)
      : t(`${nameFor(inv.targetUserId)} is clean.`, `${nameFor(inv.targetUserId)} نظيف.`);
    return `
      <div class="mfp-badge" style="border-color:${color}">
        <span class="mfp-badge-kicker">${t('Badge says', 'الشارة تقول')}</span>
        <span class="mfp-badge-text" style="color:${color}">${esc(text)}</span>
      </div>`;
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
    maybeWhisperDay(messages);
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
      chip.addEventListener('click', () => {
        window.BahjahSoundFx.click();
        send(chip.dataset.quick);
      });
    });
  }

  // Day, on the phone. The design calls this table talk: the clock you are
  // arguing against, the transcript the TV is mirroring, and a box to say
  // your piece. The prototype offered canned one-use lines because it had no
  // real opponents -- a live room types, so the input stays.
  function renderDay(d) {
    document.body.classList.remove('night-mode');
    box.innerHTML = `
      <div class="mfp-chat">
        <div class="mfp-chat-head">
          <div class="mfp-head">
            <span class="mfp-kicker" style="color:var(--mafia-red)">${t('Table talk', 'حديث الطاولة')}</span>
            <h2 class="mfp-title">${t('Make your case', 'ادفع عن نفسك')}</h2>
          </div>
          <span class="mfp-chat-clock" id="mafia-countdown"></span>
        </div>
        <div class="timer-bar"><div class="timer-bar-fill" id="mafia-timer-fill"></div></div>
        ${investigationLine(d)}
        ${dayChatBox(d.dayChat)}
        ${dayRoster(d.players)}
      </div>
    `;
    bindDayChat();
    startCountdown(d.phaseEndsAt);
  }

  // One-shot "time to vote" overlay, shown once per vote/revote instance
  // (keyed by phase+round so a revote after a tie gets its own beat too).
  let lastVoteTransitionKey = null;
  function maybeShowVoteTransition(phaseKey) {
    if (phaseKey === lastVoteTransitionKey) return;
    lastVoteTransitionKey = phaseKey;
    const el = document.getElementById('mf-vote-transition');
    if (!el) return;
    el.style.display = 'flex';
    window.BahjahSoundFx.riser();
    setTimeout(() => {
      el.style.display = 'none';
    }, 1400);
  }

  // Vote, on the phone: pick a name, look at it, commit. One vote, and no
  // changing it once it is in -- which is exactly why it is two taps.
  function renderVote(d, isRevote) {
    document.body.classList.remove('night-mode');
    maybeShowVoteTransition(`${isRevote ? 'revote' : 'vote'}-${d.round}`);
    const votedCount = (d.votedUserIds || []).length;
    const totalAlive = d.players.filter((p) => p.alive).length;
    const lang = LANG_ATTR();

    let body;
    if (d.myVote) {
      body = lockedPanel(
        t(`You voted for ${nameFor(d.myVote)}`, `صوّت لصالح ${nameFor(d.myVote)}`),
        t('Results stay hidden until everyone has voted.', 'ستظل النتيجة سرية حتى يصوّت الجميع.')
      );
    } else {
      const candidateIds = isRevote ? new Set(d.revoteCandidates || []) : null;
      const targets = d.players.filter(
        (p) => p.alive && p.userId !== (me && me.id) && (!candidateIds || candidateIds.has(p.userId))
      );
      body = pickerGrid(targets) + confirmRow('vote', t('Pick a name', 'اختر اسمًا'));
    }

    box.innerHTML = `
      <div class="mfp-act">
        ${actHead(
          isRevote
            ? `${t('Revote', 'إعادة التصويت')} — ${lang === 'ar' ? `الجولة ${d.round}` : `Round ${d.round}`}`
            : `${t('Vote', 'التصويت')} — ${lang === 'ar' ? `الجولة ${d.round}` : `Round ${d.round}`}`,
          t('Point a finger', 'وجّه أصابع الاتهام'),
          isRevote
            ? t('A tie. Choose between the names still standing.', 'تعادل. اختر بين الأسماء المتبقية.')
            : t("One vote. No changing it once it's in.", 'صوت واحد. لا تغيير بعد إرساله.'),
          'var(--mafia-red)'
        )}
        ${investigationLine(d)}
        ${body}
        <span class="mfp-wait">${
          lang === 'ar' ? `${votedCount} من ${totalAlive} صوّتوا` : `${votedCount} of ${totalAlive} voted`
        }</span>
        <div class="mfp-clock"><div class="timer-bar"><div class="timer-bar-fill" id="mafia-timer-fill"></div></div><span id="mafia-countdown"></span></div>
      </div>`;
    if (!d.myVote) bindPicker();
    startCountdown(d.phaseEndsAt);
  }

  // Client-side elimination interstitial: shown once, on the vote/revote ->
  // night or vote/revote -> finished transition. Preemptible -- a fresh
  // token per show() call means a stale setTimeout from an earlier call
  // can never hide a newer overlay, and a brand new state always wins.
  let lastPhaseForElim = null;
  let elimToken = 0;
  function maybeShowEliminationInterstitial(phase, d) {
    const prevPhase = lastPhaseForElim;
    lastPhaseForElim = phase;
    const cameFromVote = prevPhase === 'vote' || prevPhase === 'revote';
    if (!cameFromVote || (phase !== 'night' && phase !== 'finished')) return;
    const el = document.getElementById('mf-elim-overlay');
    const card = document.getElementById('mf-elim-card');
    if (!el || !card) return;
    elimToken += 1;
    const myToken = elimToken;
    const userId = d.lastVoteEliminated;
    if (!userId) {
      card.innerHTML = `
        <div class="mf-elim-kicker">${t('Vote result', 'نتيجة التصويت')}</div>
        <div class="mf-elim-name">${t('No one eliminated', 'لم يُقصَ أحد')}</div>
      `;
    } else {
      const role = d.eliminatedRoles[userId];
      card.innerHTML = `
        <div class="mf-elim-avatar">${avatarHtml(userId)}</div>
        <div class="mf-elim-kicker">${t('Voted out', 'أُقصي بالتصويت')}</div>
        <div class="mf-elim-name">${nameFor(userId)}</div>
        ${role ? `<div class="mf-elim-role">${roleLabel(role)}</div>` : ''}
      `;
    }
    el.style.display = 'flex';
    window.BahjahSoundFx.stinger();
    setTimeout(() => {
      if (myToken === elimToken) el.style.display = 'none';
    }, 2200);
  }

  // Dawn interstitial: one shot, on the night -> day transition. Three
  // variants: killed (lastNightEliminated truthy), saved (doctor blocked
  // the kill -- lastNightSaved truthy), or nothing happened (neither, e.g.
  // mafia never voted in time). Same preemptible-token pattern as the
  // elimination interstitial above.
  let lastPhaseForDawn = null;
  let dawnToken = 0;
  function maybeShowDawnInterstitial(phase, d) {
    const prevPhase = lastPhaseForDawn;
    lastPhaseForDawn = phase;
    if (prevPhase !== 'night' || phase !== 'day') return;
    const el = document.getElementById('mf-dawn-overlay');
    const card = document.getElementById('mf-dawn-card');
    if (!el || !card) return;
    dawnToken += 1;
    const myToken = dawnToken;
    window.BahjahSoundFx.day();
    if (d.lastNightEliminated) {
      const userId = d.lastNightEliminated;
      const role = d.eliminatedRoles[userId];
      card.innerHTML = `
        <div class="mf-dawn-avatar">${avatarHtml(userId)}</div>
        <div class="mf-dawn-kicker">${t('Dawn breaks', 'يطلع الفجر')}</div>
        <div class="mf-dawn-name">${nameFor(userId)}</div>
        <div class="mf-dawn-sub">${role ? t(`was eliminated. They were ${roleLabel(role)}.`, `أُقصي. كان ${roleLabel(role)}.`) : t('was eliminated overnight.', 'أُقصي بين عشية وضحاها.')}</div>
      `;
      window.BahjahSoundFx.kill();
    } else if (d.lastNightSaved) {
      const userId = d.lastNightSaved;
      card.innerHTML = `
        <div class="mf-dawn-avatar">${avatarHtml(userId)}</div>
        <div class="mf-dawn-kicker">${t('Dawn breaks', 'يطلع الفجر')}</div>
        <div class="mf-dawn-name">${nameFor(userId)}</div>
        <div class="mf-dawn-sub">${t('was attacked in the night — and survived.', 'تعرّض لهجوم في الليل — ونجا.')}</div>
      `;
      window.BahjahSoundFx.save();
    } else {
      card.innerHTML = `
        <div class="mf-dawn-kicker">${t('Dawn breaks', 'يطلع الفجر')}</div>
        <div class="mf-dawn-name">${t('A quiet night', 'ليلة هادئة')}</div>
        <div class="mf-dawn-sub">${t('No one was harmed.', 'لم يُصب أحد بأذى.')}</div>
      `;
    }
    el.style.display = 'flex';
    setTimeout(() => {
      if (myToken === dawnToken) el.style.display = 'none';
    }, 2200);
  }

  function cardFan(roles, winner) {
    const cap = winner === 'mafia' ? 3 : 4;
    const winningIds = Object.entries(roles)
      .filter(([, role]) => (winner === 'mafia' ? role === 'mafia' : role !== 'mafia'))
      .map(([userId]) => userId)
      .slice(0, cap);
    if (!winningIds.length) return '';
    return `<div class="mf-card-fan">${winningIds.map((userId) => `<img src="${roleArt(roles[userId], userId)}" alt="">`).join('')}</div>`;
  }

  function renderFinished(d) {
    window.BahjahTimerBar.stop('mafia');
    document.body.classList.remove('night-mode');
    const winnerLabel = d.winner === 'mafia' ? t('Mafia wins!', 'فازت المافيا!') : t('Village wins!', 'فازت القرية!');
    const roles = d.allRoles || {};
    const myFinalRole = me ? roles[me.id] : null;
    const myTeamWon = myFinalRole && (d.winner === 'mafia' ? myFinalRole === 'mafia' : myFinalRole !== 'mafia');
    if (myFinalRole) {
      if (myTeamWon) window.BahjahSoundFx.win();
      else window.BahjahSoundFx.lose();
    }
    const stats = d.stats || {};
    const detectiveTotal = Object.values(stats.detectiveFinds || {}).reduce((sum, n) => sum + n, 0);
    const myAccuracy = me && stats.votingAccuracy ? stats.votingAccuracy[me.id] : undefined;
    const survivors = (stats.survivors || []).map(nameFor).join(', ') || t('no one', 'لا أحد');

    const statsBlock = `
      <div class="final-stats">
        <div class="final-stat"><div class="stat-value">${stats.totalRounds ?? d.round}</div><div class="stat-label">${t('Rounds', 'الجولات')}</div></div>
        <div class="final-stat"><div class="stat-value">${stats.playersEliminated ?? '—'}</div><div class="stat-label">${t('Eliminated', 'مُقصون')}</div></div>
        <div class="final-stat"><div class="stat-value">${stats.mafiaEliminations ?? '—'}</div><div class="stat-label">${t('Mafia caught', 'مافيا مُقصاة')}</div></div>
        <div class="final-stat"><div class="stat-value">${stats.doctorSaves ?? 0}</div><div class="stat-label">${t('Doctor saves', 'إنقاذات الطبيب')}</div></div>
        <div class="final-stat"><div class="stat-value">${detectiveTotal}</div><div class="stat-label">${t('Correct finds', 'تحقيقات صحيحة')}</div></div>
        <div class="final-stat"><div class="stat-value">${myAccuracy != null ? `${Math.round(myAccuracy * 100)}%` : '—'}</div><div class="stat-label">${t('Your accuracy', 'دقة تصويتك')}</div></div>
      </div>
    `;

    const isHost = Boolean(me && latestRoom && latestRoom.members.some((m) => m.userId === me.id && m.isHost));
    const actions = isHost
      ? `<button type="button" class="bh-btn bh-btn--hot bh-btn--md" id="mafia-restart-btn" style="width:100%; margin-top:14px;">${t('Play again', 'العب مجددًا')}</button>`
      : `<p class="waiting-note">${t('Waiting for the host to start a new game…', 'بانتظار أن يبدأ المضيف لعبة جديدة…')}</p>`;

    const outcomeLine = myFinalRole
      ? `<div class="mf-verdict-outcome ${myTeamWon ? 'is-win' : 'is-loss'}">${myTeamWon ? t('You won', 'لقد فزت') : t('You lost', 'لقد خسرت')} — ${roleLabel(myFinalRole)}</div>`
      : '';

    box.innerHTML = `
      <div class="mf-verdict-box ${d.winner === 'mafia' ? 'mf-victory-mafia' : 'mf-victory-village'}" data-winner="${d.winner}">
        <div class="mf-verdict-kicker">${t('Verdict', 'الحكم')}</div>
        <div class="mf-verdict-title">${winnerLabel}</div>
        ${cardFan(roles, d.winner)}
      </div>
      ${outcomeLine}
      ${statsBlock}
      <div class="demo-sub">${t('Final survivors', 'الناجون النهائيون')}: ${survivors}</div>
      <div class="suspect-list" style="margin-top:14px;">
        ${Object.keys(roles)
          .map(
            (userId) =>
              `<div class="suspect-row"><span class="suspect-who"><span class="suspect-avatar">${avatarHtml(userId)}</span><span class="suspect-name">${nameFor(userId)}</span></span><span>${roleLabel(roles[userId])}</span></div>`
          )
          .join('')}
      </div>
      <button type="button" class="bh-btn bh-btn--ghost bh-btn--md" id="mafia-share-btn" style="width:100%; margin-top:14px;">${t('Share your result', 'شارك نتيجتك')}</button>
      ${actions}
      <p style="text-align:center; margin-top:10px;"><a class="back-link" href="mafia.html">${t('Join another game', 'انضم إلى لعبة أخرى')}</a></p>
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
    if (shareBtn) shareBtn.addEventListener('click', () => openShareSheet(d, myTeamWon, myFinalRole));
  }

  // Share sheet: a 340x476 in-page result-card preview plus 5 platform
  // targets. X and WhatsApp get real web share-intent deep links; Instagram/
  // Snapchat/TikTok have no such web intent for arbitrary content, so those
  // three (and the native OS share button on mobile) go through
  // BahjahShareCard's existing image-generation + navigator.share flow,
  // which already lets the visitor pick any installed app themselves.
  function openShareSheet(d, won, myFinalRole) {
    const overlay = document.getElementById('mf-share-overlay');
    const preview = document.getElementById('mf-share-preview');
    if (!overlay || !preview) return;
    const url = `${location.origin}/bahjah-landing.html`;
    const roleText = myFinalRole ? roleLabel(myFinalRole) : '';
    const headline = won ? t('I just played Mafia on Bahjah and won!', 'لعبت مافيا للتو على بهجة وفزت!') : t('I just played Mafia on Bahjah!', 'لعبت مافيا للتو على بهجة!');
    const text = `${headline}${roleText ? ` (${roleText})` : ''} 🎭`;
    const art = myFinalRole ? roleArt(myFinalRole, me ? me.id : myFinalRole) : null;

    preview.className = `mf-share-preview ${d.winner === 'mafia' ? 'mf-share-mafia-bg' : 'mf-share-village-bg'}`;
    preview.innerHTML = `
      <div class="mf-share-preview-kicker">BAHJAH · MAFIA</div>
      ${art ? `<img class="mf-share-preview-art" src="${art}" alt="">` : ''}
      <div class="mf-share-preview-title">${d.winner === 'mafia' ? t('Mafia wins', 'فازت المافيا') : t('Village wins', 'فازت القرية')}</div>
      <div class="mf-share-preview-sub">${won ? t('I won as', 'فزت بدور') : t('I played as', 'لعبت بدور')} ${roleText}</div>
    `;

    document.getElementById('mf-share-copy').textContent = t('Copy link', 'انسخ الرابط');
    document.getElementById('mf-share-close').textContent = t('Close', 'إغلاق');
    document.getElementById('mf-share-copy').onclick = () => {
      navigator.clipboard
        .writeText(`${text} ${url}`)
        .then(() => {
          const btn = document.getElementById('mf-share-copy');
          const original = btn.textContent;
          btn.textContent = t('Copied!', 'تم النسخ!');
          setTimeout(() => (btn.textContent = original), 1500);
        })
        .catch(() => {});
    };

    document.querySelectorAll('#mf-share-icons .mf-share-icon-btn').forEach((btn) => {
      btn.onclick = () => {
        window.BahjahSoundFx.pick();
        const target = btn.dataset.target;
        if (target === 'whatsapp') {
          window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
        } else if (target === 'x') {
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
        } else if (window.BahjahShareCard) {
          window.BahjahShareCard.share({ gameId: 'mafia', lang: LANG_ATTR(), headline, subline: `Mafia${roleText ? ` · ${roleText}` : ''}`, text, url });
        }
      };
    });

    overlay.style.display = 'flex';
  }

  function dayChatReadOnly(messages) {
    maybeWhisperDay(messages);
    const rows = (messages || [])
      .map((m) => `<div class="mf-day-chat-msg"><strong>${nameFor(m.userId)}:</strong> ${m.text.replace(/</g, '&lt;')}</div>`)
      .join('');
    return `<div class="mf-day-chat-log">${rows || `<div class="mf-day-chat-empty">${t('No messages yet.', 'لا رسائل بعد.')}</div>`}</div>`;
  }

  function renderSpectator(d, phase) {
    const spectatorLine = d.myRole
      ? t("You've been eliminated. You're now watching the rest of the game.", 'لقد أُقصيت. أنت الآن تشاهد بقية اللعبة.')
      : t('This game is already in progress. You are spectating until it wraps up.', 'هذه اللعبة قيد التقدم بالفعل. أنت تشاهد حتى تنتهي الجولة.');
    const dayPart =
      phase === 'day'
        ? `
      <div class="mf-day-layout">
        ${dayRoster(d.players)}
        ${dayChatReadOnly(d.dayChat)}
      </div>`
        : '';
    box.innerHTML = `
      ${roleHeader(d.myRole)}
      <div class="mf-spectator-badge">${t('Spectating', 'مشاهدة')}</div>
      <div class="narrator-line">${spectatorLine}</div>
      <div class="demo-sub" id="mafia-countdown"></div>
      <div class="timer-bar"><div class="timer-bar-fill" id="mafia-timer-fill"></div></div>
      ${dayPart}
    `;
    startCountdown(d.phaseEndsAt);
  }

  function render(state) {
    wrap.style.display = 'block';
    const d = state.data || {};
    renderHud(state.phase, d.round);
    maybeShowEliminationInterstitial(state.phase, d);
    maybeShowDawnInterstitial(state.phase, d);
    // A selection belongs to one phase of one round. Carrying it across
    // would mean a confirm tap on the vote screen sending last night's pick.
    const selKey = `${state.phase}-${d.round}`;
    if (selKey !== phoneSelKey) {
      phoneSelKey = selKey;
      phoneSel = null;
    }

    if (state.phase === 'finished') {
      renderFinished(d);
      return;
    }

    // Dawn and elimination are read-only on the phone: the reveal belongs to
    // the big screen, and a player who is out watches from here.
    if (state.phase === 'dawn') {
      document.body.classList.add('night-mode');
      renderReport(d, 'dawn');
      return;
    }
    if (state.phase === 'elim') {
      document.body.classList.remove('night-mode');
      renderReport(d, 'elim');
      return;
    }

    if (state.phase !== 'role-reveal' && !d.myAlive) {
      document.body.classList.remove('night-mode');
      renderSpectator(d, state.phase);
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
