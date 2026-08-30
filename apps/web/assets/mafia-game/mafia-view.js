/* Mafia — view model + boot.
   `viewModel()` is a direct port of the design's `renderVals()`: every
   derived value the markup binds to is computed here, so the screens stay
   dumb templates and nothing about the language, phase or role is decided
   in markup. */
(function (global) {
  var A = global.MafiaScreensA, B = global.MafiaScreensB;

  function viewModel(g) {
    var s = g.state, T = g.L(), R = g.ROLE(), RING = g.RING(), yr = g.yourRole();
    var ar = g.lang() === 'ar';
    var me = s.players.filter(function (p) { return p.isYou; })[0] || { role: yr };
    var rm = R[me.role] || R.citizen;
    var alive = s.players.filter(function (p) { return p.alive; });
    var inGame = ['night', 'dawn', 'day', 'vote', 'elim'].indexOf(s.phase) >= 0;
    var segMap = { day: 0, vote: 1, elim: 1, night: 2, dawn: 3, end: 4 };
    var segIdx = segMap[s.phase] == null ? -1 : segMap[s.phase];
    var segs = T.segs.map(function (l, i) {
      return {
        label: l,
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
      return a;
    });

    var victim = s.killedId != null ? s.players.filter(function (p) { return p.id === s.killedId; })[0] : null;
    var vr = victim ? R[victim.role] : null;

    var voteCands = alive.filter(function (p) { return !p.isYou; }).map(function (p) {
      var dots = s.votes.filter(function (x) { return x.t === p.id; }).map(function (x) {
        var v = s.players.filter(function (q) { return q.id === x.v; })[0] || { ci: 4, ti: 0, name: '' };
        return { c: RING[v.ci], token: tok(v.ti), voter: v.isYou ? T.names.You : g.N(v.name) };
      });
      var isPick = s.youVoted && s.votes.length && s.votes.filter(function (x) { return x.v === 0 && x.t === p.id; })[0];
      var a = mkAvatar(p);
      a.dots = dots;
      a.border = isPick ? '#EE2D23' : dots.length ? 'var(--border-strong)' : 'var(--border-subtle)';
      a.shadow = isPick ? '0 0 26px rgba(238,45,35,.35)' : 'none';
      a.tag = isPick ? T.tags.yourVote : '';
      a.tagColor = '#EE2D23';
      return a;
    });

    var elim = s.elimId != null ? s.players.filter(function (p) { return p.id === s.elimId; })[0] : null;
    var er = elim ? R[elim.role] : null;
    var win = s.winner;
    var youWon = win ? ((win === 'mafia') === (me.role === 'mafia')) : false;
    var isNightScene = ['reveal', 'night'].indexOf(s.phase) >= 0 || s.sleeping;
    var isDayScene = ['day', 'vote'].indexOf(s.phase) >= 0 || s.phase === 'elim' || (s.phase === 'end' && win === 'village');
    var isDawnScene = s.phase === 'dawn';
    var ambient = ['landing', 'lobby'].indexOf(s.phase) >= 0;
    var youPlayer = s.players.filter(function (p) { return p.isYou; })[0] || { role: yr };

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
      aliveLabel: s.phase === 'lobby' ? T.joinedLbl(s.joined) : T.aliveLbl(alive.length),
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
      tChipMafia: T.chipMafia, tChipDoctor: T.chipDoctor, tChipSheriff: T.chipSheriff, tChipCitizen: T.chipCitizen,
      tPlayers: T.players, tWaiting: T.waiting, tHostNote: T.hostNote,
      jcSize: 64, joined: s.joined,
      lobbyPlayers: [
        { name: 'You', ci: 4, you: true }, { name: 'Omar', ci: 0 }, { name: 'Sara', ci: 1 },
        { name: 'Faisal', ci: 2 }, { name: 'Layla', ci: 3 }, { name: 'Khalid', ci: 4 },
        { name: 'Noura', ci: 5 }, { name: 'Dana', ci: 6 }
      ].slice(0, s.joined).map(function (p, i) {
        return { name: p.you ? T.names.You : g.N(p.name), ci: p.ci, you: !!p.you, token: g.TOKEN(i), ring: RING[p.ci] };
      }),
      emptySlots: Array.apply(null, { length: Math.max(0, 8 - s.joined) }).map(function (_, i) { return { i: i }; }),
      startDisabled: s.joined < 8,
      startLabel: s.joined < 8 ? T.waitMore(8 - s.joined) : T.startGame,
      flipped: s.flipped, notFlipped: !s.flipped,
      tNightFalls: T.nightFalls, tSecretNote: T.secretNote, tTapReveal: T.tapReveal, tSecretRole: T.secretRole,
      roleName: rm.name, roleColor: rm.color, roleDim: rm.dim, roleDesc: rm.desc, roleWin: rm.win, roleArt: rm.art,
      tBeginNight1: T.beginDay(1),
      tNightN: T.nightN(s.round),
      nightTitle: T.nightTitle[me.role], nightSub: T.nightSub[me.role],
      mafiaChat: me.role === 'mafia' && s.phase === 'night' && !s.sleeping,
      whispers: (s.whispers || []).map(function (w) {
        return { name: g.N(w.who).toUpperCase(), initial: g.N(w.who)[0], token: tokByName(w.who), text: T.whispers[w.k] };
      }),
      tWhisperHdr: T.whisperHdr,
      showNightPicker: me.role !== 'citizen' && !s.sheriffDone,
      citizenSleep: me.role === 'citizen',
      candidates: candidates,
      nightBtnVariant: me.role === 'mafia' ? 'hot' : me.role === 'doctor' ? 'primary' : 'secondary',
      nightConfirmDisabled: s.sel == null,
      nightConfirmLabel: T.confirm[me.role] || T.confirm.mafia,
      sheriffDone: s.sheriffDone, tInvResult: T.invResult, tCloseEyes: T.closeEyes,
      sheriffText: s.sheriffName ? (s.sheriffMafia ? T.isMafia(g.N(s.sheriffName)) : T.isClean(g.N(s.sheriffName))) : '',
      sheriffColor: s.sheriffMafia ? '#EE2D23' : '#AEB8C4',
      sheriffBorder: s.sheriffMafia ? 'rgba(238,45,35,.5)' : 'rgba(174,184,196,.4)',
      sheriffGlow: s.sheriffMafia ? 'rgba(238,45,35,.3)' : 'rgba(174,184,196,.25)',
      tTownSleeps: T.townSleeps, tKeepClosed: T.keepClosed, tSomethingMoves: T.somethingMoves,
      tDawnDay: T.dawnDay(s.round),
      dawnKilled: !!victim, dawnSaved: !victim,
      tFoundDead: victim ? T.foundDead(dispName(victim)) : '', tTheyWere: T.theyWere,
      victimInitial: victim ? g.N(victim.name)[0] : '',
      victimRoleName: vr ? vr.name.toUpperCase() : '', victimRoleColor: vr ? vr.color : '#E8EAF0',
      victimRoleDim: vr ? vr.dim : 'rgba(247,247,255,.2)', victimArt: g.artFor(victim),
      tEyesOpen: T.eyesOpen, tDoctorSaved: T.doctorSaved, tStartDay: T.startDay,
      tDayN: T.dayN(s.round), tDiscussion: T.discussion, tStartVote: T.startVote, tTheTown: T.theTown,
      messages: s.messages.map(function (m) {
        // A quick reply carries its index as the argument, and index 0 is
        // falsy: the prototype's `m.arg ? ... : undefined` drops it and
        // renders the first quick reply as an empty chat line. Tested
        // against `!= null` so all four lines say what their chip says.
        return {
          name: g.N(m.who).toUpperCase(), initial: g.N(m.who)[0], ring: RING[m.ci],
          token: tokByName(m.who), text: T.chat[m.k](m.arg != null ? (m.k === 'quick' ? m.arg : g.N(m.arg)) : undefined)
        };
      }),
      typing: s.typing, canVote: s.canVote,
      dayTimer: '0:' + String(s.dayLeft).padStart(2, '0'),
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
      voteStatus: !s.youVoted ? T.castVote : s.votesDone ? T.allVotes : T.waitVotes(alive.length - s.votes.length),
      votesDone: s.votesDone,
      tTownDecided: T.townDecided, tTheirRole: T.theirRole,
      tElimName: elim ? T.isOut(dispName(elim)) : '',
      elimRoleName: er ? er.name : '', elimColor: er ? er.color : '#E8EAF0',
      elimDim: er ? er.dim : 'rgba(247,247,255,.2)', elimArt: g.artFor(elim),
      elimFactionText: elim ? (elim.role === 'mafia' ? T.gotOne : T.innocent) : '',
      continueElimLabel: (function () {
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
        return { k: k, label: T.soc[k], icon: 'assets/mafia/social/' + k + '.svg' };
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
      '<div dir="' + v.dir + '" class="noir ' + v.rootCls + '" style="min-height:100vh;display:flex;flex-direction:column;font-family:var(--font-body);color:var(--text-primary);background:radial-gradient(1100px 620px at 50% -12%, rgba(11,29,58,.85), transparent 62%), #0B0B14">' +
        A.scenes(v) +
        '<div style="position:relative;z-index:1;display:flex;flex-direction:column;flex:1;min-height:100vh">' +
          A.hud(v) +
          (v.isLanding ? A.landing(v) : '') +
          (v.isLobby ? A.lobby(v) : '') +
          (v.isReveal ? A.reveal(v) : '') +
          (v.isNight ? A.night(v) : '') +
          (v.sleeping ? A.sleeping(v) : '') +
          (v.isDawn ? A.dawn(v) : '') +
          (v.isDay ? B.day(v) : '') +
          (v.isVote ? B.vote(v) : '') +
          (v.exitOpen ? B.exitDialog(v) : '') +
          (v.suspense ? B.suspense(v) : '') +
          (v.isElim ? B.elim(v) : '') +
          (v.tutOpen ? B.tutorial(v) : '') +
          (v.shareOpen ? B.share(v) : '') +
          (v.isEndMafia ? B.endMafia(v) : '') +
          (v.isEndVillage ? B.endVillage(v) : '') +
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
      join: function () {
        // The room code typed here (or carried in ?room=) is the room the
        // player joins, as the share link promises.
        var field = root.querySelector('input[data-role="code"]');
        var typed = field && field.value ? field.value.trim().toUpperCase() : '';
        if (typed) g.setState({ code: typed });
        g.enterLobby();
      },
      openTut: function () { g.openTut(); },
      start: function () { g.startGame(); },
      flip: function () { g.snd('reveal'); g.setState({ flipped: true }); },
      enterNight: function () { g.startDay(); },
      pickNight: function (id) { g.pickNight(+id); },
      confirmNight: function () { g.confirmNight(); },
      sheriffContinue: function () { g.sheriffContinue(); },
      startDay: function () { g.startDay(); },
      sayQuick: function (i) { g.sayQuick(+i); },
      startVote: function () { g.startVote(); },
      voteFor: function (id) { g.voteFor(+id); },
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
    var props = {
      // The design's own component props, surfaced on the URL so the
      // whole matrix stays reachable without editing code.
      yourRole: q.get('role') || 'mafia',
      language: q.get('lang') || 'en',
      quickPace: q.get('quickPace') === '1',
      scanlines: q.get('scanlines') === '1',
      code: (q.get('room') || '').trim().toUpperCase() || 'MF42'
    };

    var scheduled = false;
    var g = new global.MafiaEngine(props, function () {
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
    draw();
    var pre = q.get('room');
    if (pre) {
      var field = root.querySelector('input[data-role="code"]');
      if (field) field.value = pre.trim().toUpperCase();
    }
  };
})(window);
