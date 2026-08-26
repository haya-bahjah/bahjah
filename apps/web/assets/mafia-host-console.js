// The Mafia big screen, mounted into #host-console on mafia-lobby.html.
//
// The host runs the room and is never dealt a card (GAME_HOST_PLAYS.mafia is
// false), so lobby-room.js keeps them on this page for the whole match
// instead of sending them to mafia-play.html with everyone else. Driven by
// the same 'bahjah:lobby-update' / 'bahjah:game-state' events every other
// per-game host console on this page uses.
//
// This screen is the public record of the match: it shows what the room is
// allowed to know and nothing more. No roles, no targets, no votes in
// flight -- the phones hold every secret, and the server only ever sends
// this viewer the redacted view anyway.
(function () {
  const LANG_ATTR = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const mount = document.getElementById('host-console');
  if (!mount) return; // not the mafia lobby

  const gate = document.getElementById('lobby-gate');
  const main = document.getElementById('lobby-main');

  let latestRoom = null;
  let latestState = null;
  let code = null;
  let socket = null;
  let active = false;

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
    if (state.gameType !== 'mafia') return;
    latestState = state;
    if (active) render();
  });

  document.addEventListener('bahjah:lang-change', () => { if (active) render(); });

  document.addEventListener('click', (e) => {
    if (e.target.closest('#mh-restart')) { if (socket) socket.emit('room:restart'); }
    if (e.target.closest('#mh-end')) { if (socket) socket.emit('room:end'); }
  });

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function players() {
    // The host is in room.members but never in the game, so every roster on
    // this screen is the non-host members.
    return latestRoom ? latestRoom.members.filter((m) => !m.isHost) : [];
  }

  function nameOf(userId) {
    const m = players().find((p) => p.userId === userId);
    return m ? m.displayName : '';
  }

  const ROLE_LABEL = {
    mafia: { en: 'Mafia', ar: 'مافيا' },
    doctor: { en: 'Doctor', ar: 'طبيب' },
    detective: { en: 'Detective', ar: 'محقق' },
    villager: { en: 'Citizen', ar: 'مواطن' },
  };
  // The theme's own role colours (assets/mafia-theme.css), so the big screen
  // names a role in exactly the shade the phones do.
  const ROLE_COLOR = {
    mafia: 'var(--role-mafia)', doctor: 'var(--role-doctor)',
    detective: 'var(--role-sheriff)', villager: 'var(--role-citizen)',
  };
  function roleLabel(role) {
    const entry = ROLE_LABEL[role];
    return entry ? entry[LANG_ATTR()] : '';
  }

  // The frame every phase sits in: the phase kicker and round on one side,
  // the alive count and the End room control on the other.
  function shell(kicker, bodyHtml, footHtml) {
    const lang = LANG_ATTR();
    const d = (latestState && latestState.data) || {};
    const alive = players().filter((p) => !isDead(d, p.userId)).length;
    return `
      <div class="mh-stage">
        <div class="mh-hud">
          <span class="mh-kicker">${esc(kicker)}</span>
          <div class="mh-hud-r">
            <span class="mh-alive">${
              lang === 'ar' ? `${alive} على قيد الحياة` : `${alive} alive`
            }</span>
            <button type="button" id="mh-end" class="mh-btn mh-btn--ghost">${
              lang === 'ar' ? 'أنهِ الغرفة' : 'End room'
            }</button>
          </div>
        </div>
        <div class="mh-body">${bodyHtml}</div>
        ${footHtml || ''}
      </div>
    `;
  }

  function isDead(d, userId) {
    const row = (d.players || []).find((p) => p.userId === userId);
    // Unknown ids default to alive: a roster that has not arrived yet should
    // not render the whole table as dead.
    return row ? !row.alive : false;
  }

  // A name chip, used on the lobby roster and the discussion floor.
  function chip(m, d) {
    const dead = isDead(d, m.userId);
    return `<span class="mh-chip ${dead ? 'is-out' : ''}">
      <span class="mh-chip-av">${
        window.BahjahAvatars ? window.BahjahAvatars.renderAvatarHtml(m.avatar, m.userId) : ''
      }</span>
      <span class="mh-chip-name">${esc(m.displayName)}</span>
    </span>`;
  }

  function render() {
    if (!latestRoom) return;
    const lang = LANG_ATTR();

    if (latestRoom.status === 'ended') {
      mount.innerHTML = shell(
        lang === 'ar' ? 'انتهت' : 'Ended',
        `<p class="mh-sub">${
          lang === 'ar' ? `أنهيت هذه اللعبة (الرمز: ${esc(code)}).` : `You ended this game (code: ${esc(code)}).`
        }</p>`
      );
      return;
    }
    if (!latestState) {
      mount.innerHTML = shell(lang === 'ar' ? 'استعدّوا' : 'Get ready', '');
      return;
    }

    const d = latestState.data || {};
    const phase = latestState.phase;

    if (phase === 'briefing') return renderReveal(d, lang);
    if (phase === 'night') return renderNight(d, lang);
    if (phase === 'day') return renderDay(d, lang);
    if (phase === 'vote' || phase === 'revote') return renderVote(d, lang, phase === 'revote');
    if (phase === 'finished') return renderEnd(d, lang);
  }

  // Roles dealt. The TV says only "look at your phone" -- the cards
  // themselves are the one thing that must never appear here.
  function renderReveal(d, lang) {
    const ready = d.readyCount || 0;
    const total = d.totalPlayers || players().length;
    mount.innerHTML = shell(
      lang === 'ar' ? 'وُزّعت الأدوار' : 'Roles dealt',
      `<h2 class="mh-title">${lang === 'ar' ? 'انظروا إلى هواتفكم' : 'Check your phones'}</h2>
       <p class="mh-sub">${
         lang === 'ar'
           ? 'دورك لك وحدك. لا تقله بصوت عالٍ، ولا تُرِ أحدًا شاشتك.'
           : "Your role is yours alone. Don't say it out loud, don't show the screen."
       }</p>
       <div class="mh-cardfan">${[0, 1, 2, 3, 4].map((i) => `<span class="mh-cardback" style="--i:${i}"></span>`).join('')}</div>
       <span class="mh-count is-go">${
         lang === 'ar' ? `${ready} من ${total} جاهزون` : `${ready} of ${total} ready`
       }</span>`
    );
  }

  // Night. The four acting roles show as a checklist -- but only whether an
  // action has landed, never whose or on whom.
  function renderNight(d, lang) {
    const acted = new Set(d.nightActedRoles || []);
    const alive = players().filter((p) => !isDead(d, p.userId));
    const actors = [
      { key: 'mafia', label: lang === 'ar' ? 'المافيا' : 'Mafia' },
      { key: 'doctor', label: lang === 'ar' ? 'الطبيب' : 'Doctor' },
      { key: 'detective', label: lang === 'ar' ? 'المحقق' : 'Detective' },
      { key: 'villager', label: lang === 'ar' ? 'المواطنون' : 'Citizens' },
    ];
    // Citizens have no night action at all, so they are never "pending".
    acted.add('villager');
    mount.innerHTML = shell(
      lang === 'ar' ? `الليل ${d.round || 1}` : `Night ${d.round || 1}`,
      `<h2 class="mh-title">${lang === 'ar' ? 'المدينة نائمة' : 'The town sleeps'}</h2>
       <p class="mh-sub">${
         lang === 'ar'
           ? 'أغمضوا أعينكم. ضعوا الهواتف عند الانتهاء. الشاشة لا تخبركم بشيء الليلة.'
           : "Eyes closed. Phones down when you're done. The screen tells you nothing tonight."
       }</p>
       <div class="mh-actors">
         ${actors.map((a) => `
           <div class="mh-actor ${acted.has(a.key) ? 'is-in' : ''}" data-role="${a.key}">
             <span class="mh-actor-mark">${acted.has(a.key) ? '&#10003;' : '&hellip;'}</span>
             <span class="mh-actor-label">${esc(a.label)}</span>
           </div>`).join('')}
       </div>
       <span class="mh-count">${
         lang === 'ar' ? `${alive.length} على قيد الحياة` : `${alive.length} still in`
       }</span>`
    );
  }

  // Day. Dawn's outcome leads, then the live town feed -- the same messages
  // the phones are sending, which is the whole point of the big screen.
  function renderDay(d, lang) {
    const killed = d.lastNightEliminated;
    const saved = d.lastNightSaved;
    let dawnTitle;
    let dawnSub;
    if (killed) {
      dawnTitle = lang === 'ar' ? `${nameOf(killed)} مات` : `${nameOf(killed)} is dead`;
      dawnSub = lang === 'ar'
        ? 'وُجد عند أول ضوء. الطبيب كان في مكان آخر.'
        : 'Found at first light. The Doctor was somewhere else.';
    } else {
      dawnTitle = lang === 'ar' ? 'لم يمت أحد' : 'Nobody died';
      dawnSub = saved
        ? (lang === 'ar' ? 'الطبيب خمّن صحيحًا. المافيا أضاعت ليلة.' : 'The Doctor guessed right. The Mafia wasted a night.')
        : (lang === 'ar' ? 'مرّت الليلة بهدوء.' : 'The night passed quietly.');
    }

    const feed = (d.dayChat || []).slice(-5);
    const alive = players().filter((p) => !isDead(d, p.userId));
    mount.innerHTML = shell(
      lang === 'ar' ? 'النقاش' : 'Discussion',
      `<span class="mh-dawn-kicker">${
        lang === 'ar' ? `الفجر — الجولة ${d.round || 1}` : `Dawn — round ${d.round || 1}`
      }</span>
       <h2 class="mh-title">${esc(dawnTitle)}</h2>
       <p class="mh-sub">${esc(dawnSub)}</p>
       <div class="mh-feed">
         ${feed.length
           ? feed.map((m) => `
             <div class="mh-feed-line">
               <span class="mh-feed-name">${esc(nameOf(m.userId) || m.displayName || '')}</span>
               <span class="mh-feed-text">${esc(m.text)}</span>
             </div>`).join('')
           : `<span class="mh-feed-empty">${
               lang === 'ar' ? 'لم يتكلم أحد بعد' : 'Nobody has spoken yet'
             }</span>`}
       </div>
       <div class="mh-floor">${alive.map((m) => chip(m, d)).join('')}</div>`
    );
  }

  // Vote. Who has voted is public; who they voted for is not, until the
  // server publishes the tally on resolution.
  function renderVote(d, lang, isRevote) {
    const votedIds = new Set(d.votedUserIds || []);
    const alive = players().filter((p) => !isDead(d, p.userId));
    const candidates = d.revoteCandidates && d.revoteCandidates.length
      ? alive.filter((p) => d.revoteCandidates.includes(p.userId))
      : alive;
    mount.innerHTML = shell(
      isRevote ? (lang === 'ar' ? 'إعادة التصويت' : 'Revote') : (lang === 'ar' ? 'التصويت' : 'Voting'),
      `<h2 class="mh-title mh-title--day">${lang === 'ar' ? 'من يُشنق؟' : 'Who hangs?'}</h2>
       <div class="mh-tally">
         ${candidates.map((m) => `
           <div class="mh-tally-row">
             <span class="mh-tally-name">${esc(m.displayName)}</span>
             <span class="mh-tally-bar"><span class="mh-tally-fill" style="width:0%"></span></span>
             <span class="mh-tally-state">${votedIds.has(m.userId) ? '&#10003;' : ''}</span>
           </div>`).join('')}
       </div>
       <span class="mh-count">${
         lang === 'ar' ? `${votedIds.size} من ${alive.length} صوّتوا` : `${votedIds.size} of ${alive.length} voted`
       }</span>`
    );
  }

  function renderEnd(d, lang) {
    const mafiaWon = d.winner === 'mafia';
    const roles = d.allRoles || d.eliminatedRoles || {};
    mount.innerHTML = shell(
      lang === 'ar' ? 'انتهت اللعبة' : 'Game over',
      `<h2 class="mh-title" style="color:${mafiaWon ? 'var(--role-mafia)' : 'var(--role-citizen)'}">${
        mafiaWon
          ? (lang === 'ar' ? 'المافيا تسيطر على المدينة' : 'The Mafia takes the town')
          : (lang === 'ar' ? 'المدينة نظيفة' : 'The town is clean')
      }</h2>
       <p class="mh-sub">${
         mafiaWon
           ? (lang === 'ar' ? 'فاقوكم عددًا وحديثًا. العائلة تحكم المكان الآن.' : 'Outnumbered and outtalked. The family runs this place now.')
           : (lang === 'ar' ? 'كل قاتل سُمّي وشُنق. الفجر صامد.' : 'Every killer named and hanged. Dawn holds.')
       }</p>
       <div class="mh-final">
         ${players().map((m) => {
           const role = roles[m.userId];
           return `<div class="mh-final-p">
             <span class="mh-final-av">${
               window.BahjahAvatars ? window.BahjahAvatars.renderAvatarHtml(m.avatar, m.userId) : ''
             }</span>
             <span class="mh-final-name">${esc(m.displayName)}</span>
             <span class="mh-final-role" style="color:${ROLE_COLOR[role] || 'var(--text-muted)'}">${esc(roleLabel(role))}</span>
           </div>`;
         }).join('')}
       </div>`,
      `<div class="mh-foot">
         <button type="button" id="mh-restart" class="mh-btn mh-btn--go">${
           lang === 'ar' ? 'العب مجددًا' : 'Play again'
         }</button>
       </div>`
    );
  }
})();
