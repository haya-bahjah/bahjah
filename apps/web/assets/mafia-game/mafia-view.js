/* Mafia — view model + boot.
   `viewModel()` is a direct port of the design's `renderVals()`: every
   derived value the markup binds to is computed here, so the screens stay
   dumb templates and nothing about the language, phase or role is decided
   in markup. */
(function (global) {
  var A = global.MafiaScreensA, B = global.MafiaScreensB;
  var TV = global.MafiaTV, C = global.MafiaChat;

  function viewModel(g) {
    var s = g.state, T = g.L(), R = g.ROLE(), RING = g.RING(), yr = g.yourRole();
    var ar = g.lang() === 'ar';
    var me = s.players.filter(function (p) { return p.isYou; })[0] || { role: yr };
    var rm = R[me.role] || R.citizen;
    var alive = s.players.filter(function (p) { return p.alive; });
    var inGame = ['night', 'dawn', 'day', 'vote', 'elim'].indexOf(s.phase) >= 0;
    // Indices into T.segs, which runs in the server's own order:
    // NIGHT, DAWN, DAY, VOTE, VERDICT. `elim` is the vote being resolved, so
    // it shares the VOTE segment; VERDICT is the finished game, which the
    // tracker never actually renders (see showTracker/inGame below) but which
    // stays on the strip as the end the round is heading towards.
    var segMap = { night: 0, dawn: 1, day: 2, vote: 3, elim: 3, end: 4 };
    var segIdx = segMap[s.phase] == null ? -1 : segMap[s.phase];
    // The first four segments are a loop the game goes round once per round;
    // VERDICT is terminal and always sits at the end. On a phone the strip is
    // rotated so the phase being played leads it and the ones still to come
    // follow, which is how the round actually reads from where the player is
    // standing. `ord` carries that position; only the phone stylesheet acts on
    // it (mafia-game.css), so wider screens keep the plain left-to-right cycle.
    var LOOP = 4;
    var segs = T.segs.map(function (l, i) {
      return {
        label: l,
        ord: (segIdx >= 0 && segIdx < LOOP && i < LOOP) ? (i - segIdx + LOOP) % LOOP : i,
        current: i === segIdx,
        bd: i === segIdx ? 'rgba(238,45,35,.55)' : 'var(--border-subtle)',
        fg: i === segIdx ? '#EE2D23' : i < segIdx ? 'var(--text-secondary)' : 'var(--text-muted)',
        bg: i === segIdx ? 'rgba(238,45,35,.1)' : 'transparent'
      };
    });
    var dispName = function (p) { return p.isYou ? T.names.You : g.N(p.name); };
    var tok = function (i) { return g.TOKEN(i); };
    var tokByName = function (n) { return tok(g.SEATS.indexOf(n)); };
    var mkAvatar = function (p) {
      return { id: p.id, name: dispName(p), initial: g.N(p.name)[0], ring: RING[p.ci], token: tok(p.ti) };
    };

    var nightPool = me.role === 'mafia'
      ? alive.filter(function (p) { return !p.isYou && p.role !== 'mafia'; })
      : me.role === 'doctor' ? alive
      : me.role === 'sheriff' ? alive.filter(function (p) { return !p.isYou; })
      : [];
    var candidates = nightPool.map(function (p) {
      var isSel = s.sel === p.id;
      var ac = me.role === 'mafia' ? '#EE2D23' : me.role === 'doctor' ? '#AEB8C4' : '#C8A94E';
      var a = mkAvatar(p);
      a.border = isSel ? ac : 'var(--border-subtle)';
      a.shadow = isSel ? ('0 0 26px ' + (me.role === 'mafia' ? 'rgba(238,45,35,.35)' : me.role === 'doctor' ? 'rgba(174,184,196,.3)' : 'rgba(200,169,78,.25)')) : 'none';
      a.tag = isSel ? (me.role === 'mafia' ? T.tags.target : me.role === 'doctor' ? T.tags.protectedT : T.tags.suspect) : '';
      a.tagColor = ac;
      // Investigated last round, so off-limits to both abilities this one.
      if (g.live && me.role === 'sheriff' && (s.blockedTargets || []).indexOf(p.id) >= 0) {
        a.blocked = true;
        a.tag = ar ? 'سبق التحقيق' : 'ALREADY SEEN';
        a.tagColor = 'var(--text-muted)';
        a.border = 'var(--border-subtle)';
        a.shadow = 'none';
      }
      return a;
    });

    // What tonight's deal will look like at the room's current size. The
    // same arithmetic the server uses (see defaultMafiaCount): one Mafia
    // per two players past the first two, one Doctor, one Sheriff, and
    // everyone left over a Citizen. Previewed against the minimum while the
    // room is still filling, since that is the deal they would get the
    // moment they can start.
    var dealSize = Math.max(g.live ? g.minPlayers() : 8, s.joined);
    var dealMafia = Math.max(1, Math.floor(dealSize / 2) - 1);
    var dealCitizens = Math.max(0, dealSize - dealMafia - 2);

    // ---- Television vs phone.
    // The host created the room and is never dealt a card (see the server's
    // playableMembers), so their screen is the television: narration only.
    var isTv = !!g.live && !!g.amHost && g.amHost();

    // The Mafia's shared channel is a conversation like any other, so it
    // gets an id that cannot collide with a player's.
    var TEAM = '@mafia';
    var myId = g.live && g.me ? g.me.id : null;
    var nameOfId = function (id) {
      for (var i = 0; i < s.players.length; i++) if (s.players[i].id === id) return dispName(s.players[i]);
      return '';
    };
    var chatOpen = s.openThread || null;
    var threadLinesFor = function (id) {
      if (!id) return [];
      return ((s.privateChats || {})[id] || []).map(function (m) {
        var mine = m.userId === myId;
        return { mine: mine, who: mine ? T.names.You.toUpperCase() : String(nameOfId(m.userId) || '').toUpperCase(), text: m.text };
      });
    };
    var teamLines = (s.whispers || []).map(function (w) {
      var text = w.text != null ? w.text : T.whispers[w.k];
      return {
        mine: !!w.mine,
        who: String(w.mine ? T.names.You : w.who || '').toUpperCase(),
        text: text,
        color: '#EE2D23'
      };
    });

    // The conversation list: the Mafia channel first if you have one, then
    // everyone still alive. The preview is the last thing said, which is
    // what tells you at a glance where something is happening.
    var lastOf = function (lines) { return lines.length ? lines[lines.length - 1].text : ''; };
    // At five players the Mafia is one person. A team channel with nobody
    // in it is a room you can only talk to yourself in, so there isn't one
    // -- and nothing on screen mentions a partner they haven't got.
    var hasPartner = !!(g.live && me.role === 'mafia' && alive.some(function (p) {
      return !p.isYou && p.role === 'mafia';
    }));
    var chatRows = [];
    if (hasPartner && me.alive !== false) {
      chatRows.push({
        id: TEAM, team: true, name: ar ? 'فريق المافيا' : 'MAFIA TEAM',
        token: tok(me.ti || 0), ring: '#EE2D23',
        badge: ar ? 'المافيا فقط' : 'MAFIA ONLY', badgeColor: '#EE2D23',
        preview: lastOf(teamLines) || (ar ? 'خططوا للضربة معًا.' : 'Plan the hit together.'),
        unread: false
      });
    }
    alive.forEach(function (p) {
      if (p.isYou) return;
      var lines = threadLinesFor(p.id);
      var a = mkAvatar(p);
      chatRows.push({
        id: p.id, team: false, name: a.name, token: a.token, ring: a.ring,
        badge: (g.live && me.role === 'mafia' && p.role === 'mafia') ? (ar ? 'شريكك' : 'PARTNER') : '',
        badgeColor: '#EE2D23',
        preview: lastOf(lines) || (ar ? 'لا رسائل بعد.' : 'No messages yet.'),
        // Something has been said and the last word was not yours.
        unread: lines.length > 0 && !lines[lines.length - 1].mine
      });
    });

    // What a Reveal came back with, as a sentence. Derived once: the result
    // card shows it, and so does the collapsed action card once the result
    // has been dismissed.
    var sheriffText = s.sheriffName
      ? (s.sheriffMafia ? T.isMafia(g.N(s.sheriffName)) : T.isClean(g.N(s.sheriffName)))
      : '';

    // Your night action, folded into the conversation list rather than
    // taking a screen of its own.
    var actionKick = { mafia: T.confirm.mafia, doctor: T.confirm.doctor, sheriff: T.confirm.sheriff };
    var actionCard = null;
    // The television holds no role, so it has no move to make -- and
    // me.role is undefined there, which would otherwise slip past the
    // citizen check below.
    if (!isTv && s.phase === 'night' && me.role && me.role !== 'citizen' && me.alive !== false) {
      var ac = me.role === 'mafia' ? '#EE2D23' : me.role === 'doctor' ? '#AEB8C4' : '#C8A94E';
      var pickedName = s.sel != null ? nameOfId(s.sel) : '';
      actionCard = {
        color: ac,
        kicker: (actionKick[me.role] || '').toUpperCase(),
        title: T.nightTitle[me.role],
        sub: T.nightSub[me.role],
        // What the card is asking the player to do, in their own role's terms.
        // The collapsed card used to end on a muted "OPEN", which named the
        // widget rather than the move and read as a label rather than
        // something to press.
        cta: (T.tapAction && T.tapAction[me.role]) || '',
        open: !!s.actionOpen,
        done: !!s.nightActed,
        // The Detective has investigated everyone still alive. There is
        // nothing left to pick, so the card says that instead of offering a
        // list of names it will refuse.
        spent: !!(me.role === 'sheriff' && s.noTargetsLeft && !s.nightActed),
        spentLabel: ar ? 'لم يتبق أحد' : 'NOBODY LEFT TO INVESTIGATE',
        spentSub: ar
          ? 'حققت مع كل من تبقى على قيد الحياة. تابع الليلة والمحادثات.'
          : "You have investigated everyone still alive. Sit the night out — you can still talk.",
        doneLabel: ar ? 'انتهى دورك الليلة' : 'YOUR MOVE IS IN',
        // Dismissing the result must not lose it. What the Detective
        // actually learned rides along on the collapsed card.
        doneTarget: (me.role === 'sheriff' && sheriffText) ? sheriffText : pickedName
      };
    }

    // Who voted for whom, published only once the vote has closed -- which
    // is exactly when the server first sends lastVoteTally.
    var tvTally = (function () {
      var t = (g.live && g.view && g.view.lastVoteTally) || null;
      if (!t) return [];
      return Object.keys(t).map(function (voterId) {
        return { voter: nameOfId(voterId) || '?', target: nameOfId(t[voterId]) || '?' };
      });
    })();

    // Dawn and elimination are reports the room reads together and then
    // moves on from -- every living person presses, and it goes when the
    // last of them has. Bots are never waited on.
    var reportDone = (g.live && g.view && g.view.readyCount) || 0;
    var reportTotal = (g.live && g.view && g.view.totalPlayers) || 0;
    var reportReady = !!(g.live && g.view && g.view.iAmReady);
    var reportRemaining = Math.max(0, reportTotal - reportDone);
    var reportWaiting = reportReady && reportRemaining > 0;

    var victim = s.killedId != null ? s.players.filter(function (p) { return p.id === s.killedId; })[0] : null;

    var voteCands = alive.filter(function (p) { return !p.isYou; }).map(function (p) {
      var dots = s.votes.filter(function (x) { return x.t === p.id; }).map(function (x) {
        var v = s.players.filter(function (q) { return q.id === x.v; })[0] || { ci: 4, ti: 0, name: '' };
        return { c: RING[v.ci], token: tok(v.ti), voter: v.isYou ? T.names.You : g.N(v.name) };
      });
      var myVoterId = g.live ? (g.me ? g.me.id : null) : 0;
      var isPick = !!(s.youVoted && s.votes.length && s.votes.filter(function (x) { return x.v === myVoterId && x.t === p.id; })[0]);
      // Pencilled in but not yet committed: shown clearly, but in the softer
      // amber the rest of the game uses for "chosen, not yet done".
      var isDraft = !s.youVoted && s.votePick === p.id;
      var a = mkAvatar(p);
      a.dots = dots;
      a.border = isPick ? '#EE2D23' : isDraft ? 'var(--arcade-yellow)' : dots.length ? 'var(--border-strong)' : 'var(--border-subtle)';
      a.shadow = isPick ? '0 0 26px rgba(238,45,35,.35)' : isDraft ? '0 0 22px rgba(200,169,78,.32)' : 'none';
      a.tag = isPick ? T.tags.yourVote : isDraft ? T.yourPick : '';
      a.tagColor = isPick ? '#EE2D23' : 'var(--arcade-yellow)';
      return a;
    });
    var votePickName = (function () {
      var p = s.votePick != null ? alive.filter(function (q) { return q.id === s.votePick; })[0] : null;
      return p ? dispName(p) : '';
    })();

    var elim = s.elimId != null ? s.players.filter(function (p) { return p.id === s.elimId; })[0] : null;
    var er = elim ? R[elim.role] : null;
    var win = s.winner;
    var youWon = win ? ((win === 'mafia') === (me.role === 'mafia')) : false;
    var isNightScene = ['reveal', 'night'].indexOf(s.phase) >= 0 || s.sleeping;
    var isDayScene = ['day', 'vote'].indexOf(s.phase) >= 0 || s.phase === 'elim' || (s.phase === 'end' && win === 'village');
    var isDawnScene = s.phase === 'dawn';
    var ambient = ['landing', 'lobby'].indexOf(s.phase) >= 0;
    var youPlayer = s.players.filter(function (p) { return p.isYou; })[0] || { role: yr };
    // A Read has its own result card; it must not fall through to Reveal's.
    var v_read = s.myRead || null;
    // A Read from an earlier night is history, not tonight's business.
    var v_readNow = !!(v_read && v_read.round === s.round);
    var v_readOpened = !!(v_readNow && v_read.openedIndex != null);
    // Two panels, never both: the list of conversations you turned up, and
    // then the one you chose to read.
    var v_showReadPicker = !!(g.live && v_readNow && !v_readOpened && s.phase === 'night' && !s.resultClosed);
    var v_showReadResult = !!(g.live && v_readOpened && s.phase === 'night' && !s.resultClosed);

    return {
      dir: ar ? 'rtl' : 'ltr', rootCls: ar ? 'ar' : '',
      stars: g.STARS(),
      nightOp: s.sleeping ? 1 : isNightScene ? 1 : (s.phase === 'end' && win === 'mafia') ? 1 : ambient ? 0.5 : 0,
      dayOp: isDayScene && !s.sleeping ? (s.phase === 'elim' ? 0.55 : 1) : 0,
      dawnOp: isDawnScene ? 1 : 0,
      isLanding: s.phase === 'landing', isLobby: s.phase === 'lobby', isReveal: s.phase === 'reveal',
      isNight: s.phase === 'night' && !s.sleeping, isDawn: s.phase === 'dawn', isDay: s.phase === 'day',
      isVote: s.phase === 'vote', isElim: s.phase === 'elim', isEnd: s.phase === 'end',
      sleeping: s.sleeping, scanCls: g.props.scanlines ? 'scanlines' : '',
      showTracker: inGame, showHud: s.phase !== 'landing', segs: segs, code: s.code,
      tBadge: T.badge, tRoom: T.room,
      aliveLabel: s.phase === 'lobby'
        ? T.joinedLbl(s.joined, g.live ? (s.joined < g.minPlayers() ? g.minPlayers() : 0) : 8)
        : T.aliveLbl(alive.length, g.live ? s.players.length : 8),
      // Who you are, kept on the header for the whole match. Every other
      // Bahjah game does this; Mafia gave a player no way to tell which of
      // the names on the table was theirs.
      showMe: !!(g.live && !isTv && g.myName && g.myName()),
      meName: g.live && g.myName ? g.myName() : '',
      meAvatarHtml: (function () {
        if (!g.live || isTv || !g.myAvatar) return '';
        var seed = (g.me && g.me.id) || 'me';
        try { return global.BahjahAvatars.renderAvatarHtml(g.myAvatar(), seed); } catch (e) { return ''; }
      })(),
      tYouAre: ar ? 'أنت' : 'YOU',
      langLabel: T.langBtn,
      sndLabel: s.sound ? T.sndOn : T.sndOff,
      sndColor: s.sound ? 'var(--pixel-green)' : 'var(--text-muted)',
      sndBorder: s.sound ? 'rgba(201,205,214,.35)' : 'var(--border-strong)',
      tKicker: T.kicker, tHeroA: T.heroA, tHeroRed: T.heroRed, tHeroB: T.heroB, tHeroSub: T.heroSub,
      tCreate: T.create, tJoin: T.join, tCodePh: T.codePh, tOr: T.or,
      tExit: T.exit, tExitTitle: T.exitTitle, tExitBody: T.exitBody, tExitStay: T.exitStay, tExitGo: T.exitGo,
      showExit: s.phase !== 'landing', exitOpen: s.exitOpen,
      roleCards: ['mafia', 'doctor', 'sheriff', 'citizen'].map(function (k) {
        return { name: R[k].name, desc: R[k].desc, art: R[k].art, color: R[k].color };
      }),
      tRoomCode: T.roomCode, tShare: T.share, tTonight: T.tonight,
      tChipMafia: T.chipMafia(dealMafia), tChipDoctor: T.chipDoctor(1),
      tChipSheriff: T.chipSheriff(1), tChipCitizen: T.chipCitizen(dealCitizens),
      tPlayers: T.players, tWaiting: T.waiting,
      // Only the host is told the game starts when the room fills; everyone
      // else is waiting on them. (This used to be one string for both, via
      // a ternary whose branches were identical.)
      tHostNote: !g.live || g.amHost() ? T.hostNote : T.playerNote,
      jcSize: 64, joined: s.joined,
      // The roster heading, same rule as the HUD: "3/5" while short, then
      // just the count. The design's fixed "/8" was the eight-seat table it
      // was drawn around, not a limit the game has.
      tPlayersCount: (g.live && s.joined < g.minPlayers())
        ? s.joined + '/' + g.minPlayers()
        : (g.live ? String(s.joined) : s.joined + '/8'),
      roomFull: !!(g.live && g.maxPlayers && s.joined >= g.maxPlayers()),
      tRoomFull: ar ? 'الغرفة ممتلئة' : 'ROOM IS FULL',
      // Only a real room has a QR to show; the demo table has no room.
      qrUrl: g.live && s.code ? '/api/rooms/' + encodeURIComponent(s.code) + '/qr.svg?target=game' : '',
      tScan: ar ? 'امسح للانضمام' : 'SCAN TO JOIN',
      // Practice bots. Not part of the supplied design -- it has no lobby
      // flow for a room that can't fill up -- so this is the one control
      // added to that screen, and only the host ever sees it.
      showAddBots: !!(g.live && g.amHost && g.amHost() && g.canAddBots && g.canAddBots()),
      showRemoveBots: !!(g.live && g.amHost && g.amHost() && g.botCount && g.botCount() > 0),
      tAddBots: g.live && g.botsNeeded ? (g.botsNeeded() > 0 ? T.addBots(g.botsNeeded()) : T.addOneBot) : '',
      tRemoveBots: T.removeBots,
      // Testing aid, offered to the first seat in a room with practice bots.
      showCallRole: !!(g.live && g.canCallRole && g.canCallRole()),
      tCallRole: ar ? 'للتجربة: العب بدور' : 'TEST: PLAY AS',
      callRoles: [
        { key: 'mafia', label: R.mafia.name, color: '#EE2D23' },
        { key: 'doctor', label: R.doctor.name, color: '#AEB8C4' },
        { key: 'detective', label: R.sheriff.name, color: '#C8A94E' },
        { key: 'villager', label: R.citizen.name, color: 'var(--text-secondary)' }
      ].map(function (r) {
        return { key: r.key, label: r.label, color: r.color, on: s.testRole === r.key };
      }),
      lobbyPlayers: g.live
        ? g.seatMembers().map(function (m, i) {
            var meId = g.me ? g.me.id : null;
            return { name: m.userId === meId ? T.names.You : m.displayName, ci: i % 7, you: m.userId === meId, token: g.TOKEN(i), ring: RING[i % 7], bot: !!m.isBot, tBot: T.botTag };
          })
        : [
        { name: 'You', ci: 4, you: true }, { name: 'Omar', ci: 0 }, { name: 'Sara', ci: 1 },
        { name: 'Faisal', ci: 2 }, { name: 'Layla', ci: 3 }, { name: 'Khalid', ci: 4 },
        { name: 'Noura', ci: 5 }, { name: 'Dana', ci: 6 }
      ].slice(0, s.joined).map(function (p, i) {
        return { name: p.you ? T.names.You : g.N(p.name), ci: p.ci, you: !!p.you, token: g.TOKEN(i), ring: RING[p.ci], bot: false, tBot: T.botTag };
      }),
      emptySlots: Array.apply(null, { length: Math.max(0, (g.live ? g.minPlayers() : 8) - s.joined) }).map(function (_, i) { return { i: i }; }),
      // Only the host can start, and only once the room can legally deal.
      startDisabled: g.live ? (!g.amHost() || s.joined < g.minPlayers()) : s.joined < 8,
      startLabel: s.joined < (g.live ? g.minPlayers() : 8)
        ? T.waitMore((g.live ? g.minPlayers() : 8) - s.joined)
        : T.startGame,
      netError: s.netError || '',
      needsName: !!g.live && !g.token(),
      tYourName: g.lang() === 'ar' ? 'اسمك' : 'YOUR NAME',
      // The pre-join panel: a face and a name before you take a seat, the
      // same two things Trivia and Knows You Best ask for.
      tPickAvatar: ar ? 'اضغط لاختيار صورة رمزية' : 'Tap to pick an avatar',
      guestAvatarHtml: (function () {
        if (!g.live) return '';
        try { return global.BahjahAvatars.renderAvatarHtml(s.guestAvatar || null, 'mafia-guest'); } catch (e) { return ''; }
      })(),
      // Arrived by QR into a real room. Gated on g.live as well as the flag so
      // the demo table (?demo=1), which has no room to join, always keeps the
      // full landing.
      invited: !!(g.live && s.invited),
      tInvitedTitle: T.invitedTitle, tInvitedSub: T.invitedSub, tInvitedJoin: T.invitedJoin,
      flipped: s.flipped, notFlipped: !s.flipped,
      tNightFalls: T.nightFalls, tSecretNote: T.secretNote, tTapReveal: T.tapReveal, tSecretRole: T.secretRole,
      roleName: rm.name, roleColor: rm.color, roleDim: rm.dim, roleDesc: rm.desc, roleWin: rm.win, roleArt: rm.art,
      tBeginNight1: g.live ? T.beginNight(1) : T.beginDay(1),
      tNightN: T.nightN(s.round),
      nightTitle: T.nightTitle[me.role],
      // "Your partner agrees with your pick" is a lie when you are the only
      // one; a lone Mafia is told they are working alone instead.
      nightSub: (g.live && me.role === 'mafia' && !hasPartner) ? T.nightSubSolo : T.nightSub[me.role],
      // The design's whisper panel, for the demo table and for any live
      // room where the Mafia actually have someone to whisper to.
      mafiaChat: me.role === 'mafia' && s.phase === 'night' && !s.sleeping && (!g.live || hasPartner),
      whispers: (s.whispers || []).map(function (w) {
        if (w.text != null) return { name: String(w.who || '').toUpperCase(), initial: '', token: tok(w.ci || 0), text: w.text };
        return { name: g.N(w.who).toUpperCase(), initial: g.N(w.who)[0], token: tokByName(w.who), text: T.whispers[w.k] };
      }),
      tWhisperHdr: T.whisperHdr,
      // Only in a real room -- the demo table's partner is scripted.
      canWhisper: hasPartner && s.phase === 'night' && !s.sleeping && me.alive !== false,
      // Mafia wake up knowing each other, so say who. Without this the only
      // hint you had was that one name was missing from the kill list.
      partnerLine: (function () {
        if (!g.live || me.role !== 'mafia') return '';
        var mates = s.players.filter(function (p) { return !p.isYou && p.role === 'mafia'; });
        if (!mates.length) return '';
        var names = mates.map(function (p) { return dispName(p).toUpperCase(); }).join(ar ? '، ' : ', ');
        return (ar ? (mates.length > 1 ? 'شركاؤك: ' : 'شريكك: ') : (mates.length > 1 ? 'YOUR PARTNERS: ' : 'YOUR PARTNER: ')) + names;
      })(),
      showNightPicker: me.role !== 'citizen' && !s.sheriffDone && !v_showReadResult,
      // The Detective chooses Reveal or Read before picking a target.
      showAbilities: !!g.live && me.role === 'sheriff' && !s.sheriffDone && !v_showReadResult,
      ability: s.ability || 'reveal',
      canRead: !!s.canRead,
      tReveal: ar ? 'كشف' : 'REVEAL',
      tRead: ar ? 'قراءة' : 'READ',
      showReadResult: v_showReadResult,
      showReadPicker: v_showReadPicker,
      tReadPick: ar ? 'اختر محادثة واحدة' : 'PICK ONE CONVERSATION',
      tReadPickSub: ar
        ? 'هذه كل محادثاته من الجولة الماضية. تقرأ واحدة فقط — كاملةً.'
        : 'Every conversation they had last round. You may open one, and you get all of it.',
      readOptions: (v_readNow ? (v_read.messageCounts || []) : []).map(function (count, i) {
        return {
          index: i,
          label: (ar ? 'محادثة ' : 'CONVERSATION ') + (i + 1),
          count: count,
          countLabel: count === 1 ? (ar ? 'رسالة واحدة' : '1 MESSAGE') : count + (ar ? ' رسائل' : ' MESSAGES')
        };
      }),
      // A Reveal answers immediately, in the night that spent it. The
      // messaging night screen replaced the design's, and this card did not
      // come across with it -- so a Detective who used Reveal was told
      // nothing at all.
      showRevealResult: !!(g.live && me.role === 'sheriff' && s.sheriffDone && !v_showReadResult && s.sheriffName && !s.resultClosed),
      tReadResult: ar ? 'ما قيل' : 'WHAT THEY SAID',
      tReadEmpty: ar ? 'لم يتحدث مع أحد في الجولة السابقة.' : 'They spoke to nobody last round.',
      readName: v_read ? (function () {
        for (var i = 0; i < s.players.length; i++) if (s.players[i].id === v_read.targetUserId) return s.players[i].name;
        return '';
      })() : '',
      readLines: v_readOpened ? (v_read.transcript || []).map(function (l) {
        return {
          isTarget: l.speaker === 'target',
          who: l.speaker === 'target' ? (ar ? 'اللاعب' : 'THEM') : (ar ? 'لاعب مجهول' : 'UNKNOWN PLAYER'),
          text: l.text
        };
      }) : [],
      // Every living player may talk privately at night, Mafia included.
      showPrivateChats: !!g.live && s.phase === 'night' && !s.sleeping && me.alive !== false,
      openThread: s.openThread || null,
      openThreadName: (function () {
        if (!s.openThread) return '';
        for (var i = 0; i < s.players.length; i++) if (s.players[i].id === s.openThread) return s.players[i].name;
        return '';
      })(),
      threadPeers: alive.filter(function (p) { return !p.isYou; }).map(function (p) {
        var a = mkAvatar(p);
        a.unread = !!((s.privateChats || {})[p.id] || []).length;
        return a;
      }),
      threadLines: (function () {
        if (!s.openThread) return [];
        var myId = g.live && g.me ? g.me.id : 0;
        return ((s.privateChats || {})[s.openThread] || []).map(function (m) {
          var mine = m.userId === myId;
          var who = mine ? T.names.You : '';
          if (!who) {
            for (var i = 0; i < s.players.length; i++) if (s.players[i].id === m.userId) who = s.players[i].name;
          }
          return { mine: mine, who: String(who).toUpperCase(), text: m.text };
        });
      })(),
      tPrivateHdr: ar ? 'محادثات خاصة' : 'PRIVATE CHATS',
      // ---- The phone as a messaging app, and the television as narration.
      // Which of the two you are is decided once, here: the host holds no
      // role and is looked at by the whole room, so it never sees a player
      // screen and never sees anything secret.
      isTv: isTv,
      // ?demo=1 keeps the supplied design's own night and day screens, so
      // the prototype stays reproducible pixel for pixel; the messaging
      // layout is for real rooms, which the design never had.
      live: !!g.live,
      chatTitle: s.phase === 'day' ? T.dayN(s.round) : T.nightN(s.round),
      tChats: ar ? 'المحادثات' : 'CONVERSATIONS',
      tOpen: ar ? 'افتح' : 'OPEN',
      tHide: ar ? 'إخفاء' : 'Hide',
      tBack: ar ? 'رجوع' : 'Back',
      tMafiaOnly: ar ? 'المافيا فقط' : 'MAFIA ONLY',
      chatOpen: chatOpen,
      chatOpenIsTeam: chatOpen === TEAM,
      chatOpenName: chatOpen === TEAM ? (ar ? 'فريق المافيا' : 'MAFIA TEAM') : nameOfId(chatOpen),
      chatOpenLines: chatOpen === TEAM ? teamLines : threadLinesFor(chatOpen),
      chatRows: chatRows,
      // Eliminated players stay in the room and keep watching, but the
      // server refuses everything they send -- so don't offer them a list of
      // conversations that would silently swallow every message.
      isOut: !!g.live && me.alive === false,
      tOut: ar ? 'خرجت من اللعبة' : "YOU'RE OUT",
      tOutSub: ar ? 'تابع بقية الجولة. لا يمكنك التحدث أو التصويت.' : 'Watch the rest of the round play out. You can no longer talk or vote.',
      actionCard: actionCard,
      dayLines: (s.messages || []).map(function (m) {
        // Anonymous unless it's yours -- the day discussion is a forum, and
        // the server has already stripped everyone else's name from it.
        return {
          mine: !!m.mine,
          who: m.mine ? T.names.You.toUpperCase() : (m.who ? String(m.who).toUpperCase() : T.anonymous),
          text: m.text,
          color: 'var(--text-muted)'
        };
      }),
      tDayAnon: T.dayAnonNote,
      // ---- Television
      tvTimer: s.dayLeft > 0 ? Math.floor(s.dayLeft / 60) + ':' + String(s.dayLeft % 60).padStart(2, '0') : '',
      tvEnding: s.dayLeft > 0 && s.dayLeft <= 15,
      tvTimerColor: s.dayLeft <= 15 ? '#EE2D23' : 'var(--cyber-cyan)',
      tvTimerBorder: s.dayLeft <= 15 ? 'rgba(238,45,35,.55)' : 'rgba(185,194,206,.3)',
      tTvEnding: ar ? 'على وشك الانتهاء' : 'ABOUT TO END',
      tTvOf: function (n) { return (ar ? 'من ' : 'OF ') + n; },
      tTvCheckPhone: ar ? 'انظروا إلى هواتفكم' : 'CHECK YOUR PHONES',
      tTvRolesDealt: ar ? 'وُزّعت الأدوار' : 'ROLES ARE DEALT',
      tTvRolesSub: ar
        ? 'كل لاعب يرى دوره على هاتفه. تبدأ الليلة عندما يستعد الجميع.'
        : 'Every player sees their role on their own phone. The night begins when everyone is ready.',
      tvReadyCount: (g.live && g.view && g.view.readyCount) || 0,
      tvTotal: (g.live && g.view && g.view.totalPlayers) || s.players.length,
      tTvNightTitle: ar ? 'المدينة نائمة' : 'THE TOWN SLEEPS',
      tTvNightSub: ar
        ? 'الهمسات على الهواتف. لا تقولوا شيئًا بصوت عالٍ.'
        : 'The whispering happens on the phones. Say nothing out loud.',
      tTvDayTitle: ar ? 'تحدثوا' : 'TALK IT OUT',
      tTvDaySub: ar
        ? 'اتهموا، دافعوا، واقنعوا الغرفة قبل أن ينتهي الوقت.'
        : 'Accuse, defend, and win the room over before the clock runs out.',
      tTvVoteTitle: ar ? 'الغرفة تصوّت' : 'THE ROOM IS VOTING',
      tTvVoteSub: ar
        ? 'الأصوات سرية حتى يصوّت الجميع.'
        : 'Who voted for whom stays sealed until every vote is in.',
      // Not s.votes: a phone only ever learns its own vote until the tally
      // is published, so that list is empty on the television all the way
      // through the vote. votedUserIds is the count the server sends
      // everyone -- who has committed, never to whom.
      tvVotesCast: ((g.live && g.view && g.view.votedUserIds) || []).length,
      tvVoteTotal: alive.length,
      tTvHowVoted: ar ? 'كيف صوّتت الغرفة' : 'HOW THE ROOM VOTED',
      tTvVotedFor: ar ? 'صوّت لـ' : 'VOTED',
      tvTally: tvTally,
      tNoMessages: ar ? 'لا رسائل بعد.' : 'No messages yet.',
      tSayPh: ar ? 'اكتب رسالة' : 'Say something',
      tSend: ar ? 'إرسال' : 'Send',
      citizenSleep: me.role === 'citizen',
      candidates: candidates,
      nightBtnVariant: me.role === 'mafia' ? 'hot' : me.role === 'doctor' ? 'primary' : 'secondary',
      nightConfirmDisabled: s.sel == null,
      nightConfirmLabel: T.confirm[me.role] || T.confirm.mafia,
      sheriffDone: s.sheriffDone, tInvResult: T.invResult, tCloseEyes: T.closeEyes,
      sheriffText: sheriffText,
      sheriffColor: s.sheriffMafia ? '#EE2D23' : '#AEB8C4',
      sheriffBorder: s.sheriffMafia ? 'rgba(238,45,35,.5)' : 'rgba(174,184,196,.4)',
      sheriffGlow: s.sheriffMafia ? 'rgba(238,45,35,.3)' : 'rgba(174,184,196,.25)',
      tTownSleeps: T.townSleeps, tKeepClosed: T.keepClosed, tSomethingMoves: T.somethingMoves,
      tDawnDay: T.dawnDay(s.round),
      dawnKilled: !!victim,
      // Three different mornings, not two. "Nobody died" used to always be
      // read as "the Doctor saved someone", so a night the Mafia skipped
      // got credited to a Doctor who had done nothing -- and in a room with
      // no Doctor at all it was simply a lie. The server already tells them
      // apart: dawnSaved is only true when a real attack was blocked.
      dawnSaved: !victim && !!s.savedNight,
      // Name them. "The Doctor saved a life" without saying whose left the
      // room with half a fact and nothing to talk about.
      tDoctorSaved: (function () {
        if (!s.savedNight || !s.savedId) return T.doctorSaved;
        for (var i = 0; i < s.players.length; i++) {
          if (s.players[i].id === s.savedId) return T.savedName(dispName(s.players[i]));
        }
        return T.doctorSaved;
      })(),
      dawnQuiet: !victim && !s.savedNight,
      // The clock picked for this Doctor because they didn't. Said to them
      // and nobody else, so they don't spend the day thinking they chose.
      tAutoProtected: (function () {
        if (!s.autoProtectedId) return '';
        for (var i = 0; i < s.players.length; i++) {
          if (s.players[i].id === s.autoProtectedId) return T.autoProtected(dispName(s.players[i]));
        }
        return '';
      })(),
      tNoKill: T.noKill, tNoKillSub: T.noKillSub,
      // "You was found dead." -- dispName returns "You" for yourself, and the
      // sentence was built as if it were always somebody else's name.
      tFoundDead: victim ? (victim.isYou ? T.youFoundDead : T.foundDead(dispName(victim))) : '',
      victimName: victim ? dispName(victim) : '',
      victimToken: victim ? tok(victim.ti) : '',
      tRoleUnknown: ar ? 'دوره يبقى سرًا' : 'THEIR ROLE STAYS BURIED',
      tEyesOpen: T.eyesOpen,
      // Dawn and the elimination card wait for the people in the room, each
      // pressing on their own phone. Once you've pressed, the button says
      // who is still being waited on rather than going quiet.
      tStartDay: reportWaiting ? T.waitingFor(reportRemaining) : T.startDay,
      reportReady: reportReady,
      reportWaiting: reportWaiting,
      // The television presses nothing, so it just reports the count.
      showReportCount: isTv && (s.phase === 'dawn' || s.phase === 'elim') && reportTotal > 0,
      tReportCount: reportDone + ' / ' + reportTotal,
      tReportCountLbl: ar ? 'جاهزون للمتابعة' : 'READY TO MOVE ON',
      tDayN: T.dayN(s.round), tDiscussion: T.discussion, tStartVote: T.startVote, tTheTown: T.theTown,
      messages: s.messages.map(function (m) {
        if (m.text != null) {
          return { name: String(m.who || '').toUpperCase(), initial: '', ring: RING[m.ci], token: tok(m.ci), text: m.text };
        }
        // A quick reply carries its index as the argument, and index 0 is
        // falsy: the prototype's `m.arg ? ... : undefined` drops it and
        // renders the first quick reply as an empty chat line. Tested
        // against `!= null` so all four lines say what their chip says.
        return {
          name: g.N(m.who).toUpperCase(), initial: g.N(m.who)[0], ring: RING[m.ci],
          token: tokByName(m.who), text: m.text != null ? m.text : T.chat[m.k](m.arg != null ? (m.k === 'quick' ? m.arg : g.N(m.arg)) : undefined)
        };
      }),
      typing: s.typing, canVote: s.canVote,
      dayTimer: Math.floor(s.dayLeft / 60) + ':' + String(s.dayLeft % 60).padStart(2, '0'),
      timerColor: s.dayLeft <= 10 ? '#EE2D23' : 'var(--cyber-cyan)',
      timerBorder: s.dayLeft <= 10 ? 'rgba(238,45,35,.5)' : 'rgba(185,194,206,.3)',
      quickReplies: T.quick.map(function (q, i) {
        var said = s.saidQuick.indexOf(i) >= 0;
        return { text: q, fg: said ? 'var(--text-muted)' : 'var(--text-secondary)', bd: said ? 'var(--border-subtle)' : 'var(--border-strong)' };
      }),
      suspense: s.suspense, tHoldsBreath: T.holdsBreath, tCountingVotes: T.countingVotes,
      roster: s.players.map(function (p) {
        var a = mkAvatar(p);
        a.op = p.alive ? 1 : 0.38;
        a.status = p.alive ? T.alive : T.dead;
        a.stColor = p.alive ? 'var(--pixel-green)' : '#EE2D23';
        a.ring = p.alive ? RING[p.ci] : 'rgba(247,247,255,.3)';
        return a;
      }),
      tTheVote: T.theVote, tWhoIsMafia: T.whoIsMafia, tRevealVerdict: T.revealVerdict,
      voteCands: voteCands,
      // s.votes only ever holds this phone's own vote during live play, so
      // the count of who is still out has to come from the server's tally
      // of who has committed.
      voteStatus: !s.youVoted
        ? (s.votePick != null ? T.pickThenLock : T.castVote)
        : s.votesDone ? T.allVotes : T.waitVotes(Math.max(0, alive.length - (g.live ? (s.votesCast || 0) : s.votes.length))),
      votesDone: s.votesDone,
      youVoted: s.youVoted,
      votePick: s.votePick != null ? s.votePick : null,
      canLockVote: !s.youVoted && s.votePick != null,
      tLockVote: s.votePick != null ? T.lockVoteFor(votePickName) : T.lockVote,
      tVoteLocked: T.voteLocked,
      tTownDecided: T.townDecided, tTheirRole: T.theirRole,
      // Same as tFoundDead: "You is out." when the town hangs you.
      tElimName: elim ? (elim.isYou ? T.youAreOut : T.isOut(dispName(elim))) : '',
      elimRoleName: er ? er.name : '', elimColor: er ? er.color : '#E8EAF0',
      elimDim: er ? er.dim : 'rgba(247,247,255,.2)', elimArt: g.artFor(elim),
      elimFactionText: elim ? (elim.role === 'mafia' ? T.gotOne : T.innocent) : '',
      continueElimLabel: reportWaiting ? T.waitingFor(reportRemaining) : (function () {
        var m = s.players.filter(function (p) { return p.alive && p.role === 'mafia'; }).length;
        var o = s.players.filter(function (p) { return p.alive && p.role !== 'mafia'; }).length;
        return (m === 0 || m >= o) ? T.seeResults : T.beginNight(s.round);
      })(),
      isEndMafia: s.phase === 'end' && win === 'mafia',
      isEndVillage: s.phase === 'end' && win === 'village',
      endTitle: win === 'mafia' ? T.endMafiaTitle : T.endVillageTitle,
      endKicker: win === 'mafia' ? T.endMafiaKicker : T.endVillageKicker,
      endWinners: s.players.filter(function (p) {
        return win === 'mafia' ? p.role === 'mafia' : p.role !== 'mafia';
      }).map(function (p) {
        var role = R[p.role] || R.citizen;
        return {
          name: dispName(p), initial: g.N(p.name)[0], token: tok(p.ci),
          roleName: role.name.toUpperCase(),
          roleColor: role.color === '#E8EAF0' ? '#0B1D3A' : role.color
        };
      }),
      statRounds: s.round,
      statMafia: s.players.filter(function (p) { return p.role === 'mafia'; }).length,
      statSurvivors: s.players.filter(function (p) { return p.alive; }).length,
      tStatRounds: T.statRounds, tStatMafia: T.statMafia, tStatSurvivors: T.statSurvivors, tStatSaved: T.statSaved,
      tGameOver: T.gameOver + ' · ' + T.rounds(s.round),
      winnerTitle: win === 'mafia' ? T.mafiaWins : T.villageWins,
      winnerColor: win === 'mafia' ? '#EE2D23' : 'var(--pixel-green)',
      winnerDim: win === 'mafia' ? 'rgba(238,45,35,.4)' : 'rgba(201,205,214,.3)',
      youWonText: youWon ? T.youWon : T.youLost,
      tutOpen: s.tutOpen, tutCanBack: s.tut > 0, tutIsFirst: s.tut === 0, tutIsLast: s.tut === T.tutSteps.length - 1,
      tutTitle: (T.tutSteps[s.tut] || {}).t, tutBody: (T.tutSteps[s.tut] || {}).b,
      tutCount: T.tutOf(String(s.tut + 1).padStart(2, '0'), String(T.tutSteps.length).padStart(2, '0')),
      tutDots: T.tutSteps.map(function (_, i) {
        return { w: i === s.tut ? 22 : 7, bg: i === s.tut ? '#EE2D23' : (i < s.tut ? 'rgba(238,45,35,.4)' : 'rgba(174,184,196,.28)') };
      }),
      tutNextLabel: s.tut === T.tutSteps.length - 1 ? T.tutStart : T.tutNext,
      tSkip: T.tutSkip, tBack: T.tutBack, tHow: T.tutHow,
      shareOpen: s.shareOpen, tShareBtn: T.shareBtn, tShareTitle: T.shareTitle, tShareClose: T.shareClose,
      tShareCopy: s.copied ? T.shareCopied : T.shareCopy, tShareRole: T.shareYourRole, tShareRoom: T.shareRoom,
      tShareTag: T.shareTag, tShareLink: T.shareLink, shareCode: s.code, tShareSocial: T.shareSocial, tShareMore: T.shareMore,
      tShareRematch: T.shareRematch,
      shareTargets: ['instagram', 'snapchat', 'whatsapp', 'x', 'tiktok'].map(function (k) {
        return { k: k, label: T.soc[k], icon: '/assets/mafia/social/' + k + '.svg' };
      }),
      shareToken: g.TOKEN(0),
      shareYouWon: (s.winner === 'mafia') === (youPlayer.role === 'mafia'),
      shareVerdict: ((s.winner === 'mafia') === (youPlayer.role === 'mafia')) ? T.shareVerdictWon : T.shareVerdictLost,
      shareWinKicker: s.winner === 'mafia' ? T.endMafiaKicker : T.endVillageKicker,
      shareWinColor: s.winner === 'mafia' ? '#EE2D23' : '#8FC5D1',
      shareBg: s.winner === 'mafia'
        ? 'radial-gradient(120% 80% at 50% 0%, #2A0A0D 0%, #0A0308 60%, #000 100%)'
        : 'radial-gradient(120% 80% at 50% 0%, #CFE7EF 0%, #2A5679 55%, #0B1D3A 100%)',
      shareFg: s.winner === 'mafia' ? '#F3F2EF' : '#08223D',
      shareMuted: s.winner === 'mafia' ? 'rgba(232,234,240,.6)' : 'rgba(8,34,61,.62)',
      shareBorder: s.winner === 'mafia' ? 'rgba(238,45,35,.35)' : 'rgba(255,255,255,.55)',
      sharePlayerName: T.names.You,
      shareRoleName: (R[youPlayer.role] || R.citizen).name,
      shareRoleArt: (R[youPlayer.role] || R.citizen).art,
      tPlayAgain: T.playAgain
    };
  }

  function html(v) {
    return '' +
      '<div dir="' + v.dir + '" class="noir mf-root ' + v.rootCls + '" style="display:flex;flex-direction:column;font-family:var(--font-body);color:var(--text-primary);background:radial-gradient(1100px 620px at 50% -12%, rgba(11,29,58,.85), transparent 62%), #0B0B14">' +
        A.scenes(v) +
        '<div style="position:relative;z-index:1;display:flex;flex-direction:column;flex:1;min-height:0">' +
          A.hud(v) +
          // Everything below the header scrolls inside the stage rather than
          // scrolling the page, so the header and the phase clock stay put.
          '<div class="mf-stage">' +
          (v.isLanding ? A.landing(v) : '') +
          (v.isLobby ? A.lobby(v) : '') +
          // The lobby, dawn, the elimination card and the verdicts are the
          // same on both surfaces -- they are already narration the whole
          // room reads together. Everything in between splits: the phone
          // plays, the television narrates.
          (v.isReveal ? (v.isTv ? TV.tvReveal(v) : A.reveal(v)) : '') +
          (v.isNight ? (v.isTv ? TV.tvNight(v) : v.live ? C.night(v) : A.night(v)) : '') +
          (v.sleeping && !v.isTv ? A.sleeping(v) : '') +
          (v.isDawn ? A.dawn(v) : '') +
          (v.isDay ? (v.isTv ? TV.tvDay(v) : v.live ? C.day(v) : B.day(v)) : '') +
          (v.isVote ? (v.isTv ? TV.tvVote(v) : B.vote(v)) : '') +
          (v.exitOpen ? B.exitDialog(v) : '') +
          (v.suspense ? B.suspense(v) : '') +
          (v.isElim ? B.elim(v) : '') +
          // The ballots are public the moment the vote closes, so this is
          // where the television is finally allowed to name names.
          (v.isElim && v.isTv ? TV.tvTally(v) : '') +
          (v.tutOpen ? B.tutorial(v) : '') +
          (v.shareOpen ? B.share(v) : '') +
          (v.isEndMafia ? B.endMafia(v) : '') +
          (v.isEndVillage ? B.endVillage(v) : '') +
          '</div>' +
          // The landing screen prints netError inline, but everywhere else a
          // rejected action used to fail in total silence -- picking your own
          // Mafia partner and pressing Confirm looked exactly like a dead
          // button. Anywhere past the lobby, say what the server said.
          (v.netError && !v.isLanding && !v.isLobby ? A.toast(v) : '') +
        '</div>' +
      '</div>';
  }

  /* Actions the markup names via data-a, matching the design's handlers. */
  function actions(g, root) {
    return {
      toggleLang: function () {
        g.snd('click');
        g.setState(function (x) {
          var cur = x.lang != null ? x.lang : (g.props.language || 'en');
          return { lang: cur === 'ar' ? 'en' : 'ar' };
        });
      },
      toggleSound: function () { g.setState(function (x) { return { sound: !x.sound }; }, function () { g.snd('click'); }); },
      exitAsk: function () { g.snd('click'); g.setState({ exitOpen: true }); },
      exitStay: function () { g.snd('click'); g.setState({ exitOpen: false }); },
      exitGo: function () { g.setState({ exitOpen: false }, function () { g.playAgain(); }); },
      create: function () { g.enterLobby(); },
      pickAvatar: function () { if (g.pickAvatar) g.pickAvatar(); },
      // Only the live engine has a room to put bots in; the demo table is
      // already full.
      addBots: function () { if (g.addBots) g.addBots(); },
      removeBots: function () { if (g.removeBots) g.removeBots(); },
      callRole: function (role) { if (g.callRole) g.callRole(role); },
      join: function () {
        // The room code typed here (or carried in ?room=) is the room the
        // player joins, as the share link promises.
        var field = root.querySelector('input[data-role="code"]');
        var typed = field && field.value ? field.value.trim().toUpperCase() : '';
        if (g.live) {
          var nameField = root.querySelector('input[data-role="nickname"]');
          g.joinRoom(typed || g.state.code, nameField && nameField.value ? nameField.value.trim() : '');
          return;
        }
        if (typed) g.setState({ code: typed });
        g.enterLobby();
      },
      openTut: function () { g.openTut(); },
      start: function () { g.startGame(); },
      flip: function () { g.snd('reveal'); g.setState({ flipped: true }); },
      // The design's reveal button. In the demo it opens day; in a real
      // room it tells the server this player has seen their card.
      enterNight: function () { if (g.live) g.enterNight(); else g.startDay(); },
      // Demo seats are numbered; a real player's id is a uuid, so only the
      // demo's ids may be coerced to a number.
      pickNight: function (id) {
        if (g.live && (g.state.blockedTargets || []).indexOf(id) >= 0) return;
        g.pickNight(g.live ? id : +id);
      },
      confirmNight: function () { g.confirmNight(); },
      sheriffContinue: function () { g.sheriffContinue(); },
      setAbility: function (mode) { if (g.live) g.setAbility(mode); },
      openThread: function (id) { if (g.live) { g.setState({ actionOpen: false }); g.openThread(id); } },
      openRead: function (i) { if (g.live && g.openRead) g.openRead(i); },
      closeThread: function () { if (g.live) g.closeThread(); },
      sendPrivate: function () {
        var f = root.querySelector('input[data-role="pm"]');
        var text = f && f.value ? f.value.trim() : '';
        if (!text) return;
        f.value = '';
        g.sendPrivate(text);
      },
      sendWhisper: function () {
        var f = root.querySelector('input[data-role="wm"]');
        var text = f && f.value ? f.value.trim() : '';
        if (!text) return;
        f.value = '';
        g.sendWhisper(text);
      },
      sendDay: function () {
        var f = root.querySelector('input[data-role="dm"]');
        var text = f && f.value ? f.value.trim() : '';
        if (!text) return;
        f.value = '';
        g.sendDay(text);
      },
      openAction: function () { g.snd('click'); g.setState({ actionOpen: true, openThread: null }); },
      closeAction: function () { g.snd('click'); g.setState({ actionOpen: false }); },
      startDay: function () { g.startDay(); },
      sayQuick: function (i) { g.sayQuick(+i); },
      startVote: function () { g.startVote(); },
      voteFor: function (id) { g.voteFor(g.live ? id : +id); },
      submitVote: function () { g.submitVote(); },
      revealVerdict: function () { g.revealVerdict(); },
      continueElim: function () { g.continueElim(); },
      tutNext: function () { g.tutGo(1); },
      tutBack: function () { g.tutGo(-1); },
      tutSkip: function () { g.tutDone(); },
      share: function () { g.openShare(); },
      closeShare: function () { g.closeShare(); },
      copyShare: function () { g.copyShare(); },
      shareTo: function (k) { g.shareTo(k); },
      playAgain: function () { g.playAgain(); }
    };
  }

  global.bootMafia = function (root) {
    var q = new URLSearchParams(location.search);
    // A room code on the URL means the player did not come to this page to
    // start something -- they scanned a host's QR (the lobby and the host
    // screen both encode /mafia?room=CODE) or followed a share link. Either
    // way they arrived holding one specific room, so the landing screen shows
    // them the way into it and nothing else. Note this cannot be inferred
    // from props.code, which falls back to the demo table's code when the URL
    // carries none.
    var invitedCode = (q.get('room') || '').trim().toUpperCase();
    var props = {
      // The design's own component props, surfaced on the URL so the
      // whole matrix stays reachable without editing code.
      yourRole: q.get('role') || 'mafia',
      language: q.get('lang') || 'en',
      quickPace: q.get('quickPace') === '1',
      scanlines: q.get('scanlines') === '1',
      code: invitedCode || 'MF42',
      invited: !!invitedCode
    };

    var scheduled = false;
    var Ctor = (q.get('demo') === '1' || !global.MafiaLiveEngine) ? global.MafiaEngine : global.MafiaLiveEngine;
    var g = new Ctor(props, function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; draw(); });
    });
    var acts = actions(g, root);

    function draw() {
      var v = viewModel(g);
      global.mafiaMorph(root, html(v));
      document.documentElement.setAttribute('lang', g.lang());
    }

    root.addEventListener('keydown', function (ev) {
      // Elements carrying role="button" are divs doing a button's job, so the
      // keys a real button answers to have to be wired by hand. Checked before
      // the message-box shortcuts below, which are keyed off data-role.
      var btn = ev.target.closest && ev.target.closest('[data-a][role="button"]');
      if (btn && root.contains(btn) && (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar')) {
        ev.preventDefault();
        var act = acts[btn.getAttribute('data-a')];
        if (act) act(btn.getAttribute('data-id'));
        return;
      }
      if (ev.key !== 'Enter') return;
      var t = ev.target;
      var role = t && t.getAttribute('data-role');
      if (role !== 'pm' && role !== 'wm' && role !== 'dm') return;
      ev.preventDefault();
      var fn = role === 'wm' ? acts.sendWhisper : role === 'dm' ? acts.sendDay : acts.sendPrivate;
      if (fn) fn();
    });

    root.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-a]');
      if (!el || !root.contains(el)) return;
      var fn = acts[el.getAttribute('data-a')];
      if (!fn) return;
      ev.preventDefault();
      fn(el.getAttribute('data-id'));
    });

    // A room code arriving on the share link prefills the join field so a
    // tap-through lands on a rematch, per the design's share URL.
    // The host runs the room. Until the dedicated TV console exists, expose
    // the advance so the room can be moved on from the host's screen.
    if (g.live) global.__mafiaHostAdvance = function () { if (g.amHost()) g.act({ type: 'advance' }); };
    draw();
    var pre = q.get('room');
    if (pre) {
      var field = root.querySelector('input[data-role="code"]');
      if (field) field.value = pre.trim().toUpperCase();
    }
  };
})(window);
