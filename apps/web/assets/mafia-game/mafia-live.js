/* Mafia — the live game.
   The design's screens, driven by a real room instead of simulated players.

   This extends MafiaEngine rather than replacing it: every table the design
   defines (roles, tokens, seats, translations, sound cues, star field) is
   inherited unchanged, so the screens render from exactly the same view
   model. What is replaced is where state comes from — `game:state` off the
   socket instead of local timers — and what the buttons do: a night pick
   sends `mafia-kill`, a vote sends `vote`, a quick reply sends `day-chat`.

   Room model, per the product decision: the TV/creator hosts and is never
   dealt a card; everybody plays from their own phone. That is what the
   server already does (mafia's playableMembers() drops the host), so the
   host runs the lobby and watches, and phones are the players.

   Phase order follows the server, which opens on night. */
(function (global) {
  var Engine = global.MafiaEngine;

  // session.js declares `const BahjahSession`, which is script-scoped rather
  // than a property of window, so it has to be reached by bare name.
  function session() {
    try { return typeof BahjahSession !== 'undefined' ? BahjahSession : null; } catch (e) { return null; }
  }

  // Server role vocabulary -> the design's.
  var ROLE_MAP = { mafia: 'mafia', doctor: 'doctor', detective: 'sheriff', villager: 'citizen' };
  // Server phase -> the design's screen. `briefing` has no screen of its own
  // in the design; it is the beat between the card and the first night, so
  // the card stays up and its button carries the player into night.
  // `briefing` is the beat between the last card being seen and the night
  // opening. The design has no briefing screen, but it does have the one
  // that belongs here: the "town sleeps" overlay. So briefing renders as
  // night-with-the-overlay-up, and the overlay lifts when night actually
  // opens. The same overlay covers a player who has seen their card while
  // the rest of the table is still looking at theirs.
  var PHASE_MAP = {
    'role-reveal': 'reveal', briefing: 'night', night: 'night', dawn: 'dawn',
    day: 'day', vote: 'vote', revote: 'vote', elim: 'elim', finished: 'end'
  };

  function LiveEngine(props, onChange) {
    Engine.call(this, props, onChange);
    this.live = true;
    this.socket = null;
    this.me = null;
    this.room = null;
    this.view = null;
    this.serverPhase = null;
    this.state.phase = 'landing';
    this.state.connecting = false;
    this.state.netError = '';
  }
  LiveEngine.prototype = Object.create(Engine.prototype);
  LiveEngine.prototype.constructor = LiveEngine;

  /* ---- Session. A player joining from a phone should not have to hold an
     account, so the room's guest join is used when there is no signed-in
     token; the host creating the room signs in as themselves. ---- */
  LiveEngine.prototype.token = function () {
    var S = session();
    if (!S) return null;
    return S.getActiveToken ? S.getActiveToken() : S.getToken();
  };
  LiveEngine.prototype.user = function () {
    var S = session();
    if (!S) return null;
    return S.getActiveUser ? S.getActiveUser() : S.getUser();
  };

  LiveEngine.prototype.api = function (path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var t = this.token();
    if (t && !opts.anonymous) headers.Authorization = 'Bearer ' + t;
    return fetch('/api/' + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error((j.error && j.error.message) || 'Something went wrong.');
        return j;
      });
    });
  };

  LiveEngine.prototype.fail = function (msg) {
    this.setState({ connecting: false, netError: String(msg || 'Something went wrong.') });
  };

  /* ---- Creating and joining ---- */
  LiveEngine.prototype.enterLobby = function () {
    // The design's Create room. The creator hosts from this screen and is
    // not dealt a card; players arrive on their phones with the code.
    var self = this;
    this.snd('click');
    if (!this.token()) {
      this.fail('Sign in to create a room — or enter a room code to join one.');
      return;
    }
    this.setState({ connecting: true, netError: '' });
    this.api('rooms', { method: 'POST', body: { gameType: 'mafia', displayMode: 'tv' } })
      .then(function (res) {
        var room = res.room || res;
        self.me = self.user();
        self.setState({ code: room.code, connecting: false });
        self.connect(room.code);
      })
      .catch(function (e) { self.fail(e.message); });
  };

  LiveEngine.prototype.joinRoom = function (code, nickname) {
    var self = this;
    this.snd('click');
    if (!code) { this.fail('Enter the room code.'); return; }
    this.setState({ connecting: true, netError: '', code: code });
    if (this.token()) {
      this.api('rooms/' + encodeURIComponent(code) + '/join', { method: 'POST' })
        .then(function () { self.me = self.user(); self.setState({ connecting: false }); self.connect(code); })
        .catch(function (e) { self.fail(e.message); });
      return;
    }
    this.api('rooms/' + encodeURIComponent(code) + '/guest-join', {
      method: 'POST', anonymous: true,
      body: { nickname: nickname || 'Player', avatar: null }
    }).then(function (res) {
      var S = session();
      if (S && S.saveGuest) S.saveGuest(res.token, res.user);
      self.me = res.user;
      self.setState({ connecting: false });
      self.connect(code);
    }).catch(function (e) { self.fail(e.message); });
  };

  LiveEngine.prototype.connect = function (code) {
    var self = this;
    if (!global.io) { this.fail('Realtime connection unavailable.'); return; }
    this.clearT();
    this.socket = global.io({ auth: { token: this.token() } });
    this.socket.on('connect', function () { self.socket.emit('room:join', { code: code }); });
    this.socket.on('room:update', function (room) {
      self.room = room;
      self.applyRoom();
    });
    this.socket.on('game:state', function (payload) { self.applyGameState(payload); });
    this.socket.on('room:error', function (err) { self.fail(err && err.message); });
    this.socket.on('disconnect', function () { self.setState({ netError: 'Disconnected. Reconnecting…' }); });
  };

  LiveEngine.prototype.minPlayers = function () { return 4; };

  LiveEngine.prototype.amHost = function () {
    if (!this.room || !this.me) return false;
    for (var i = 0; i < this.room.members.length; i++) {
      if (this.room.members[i].userId === this.me.id) return this.room.members[i].isHost;
    }
    return false;
  };

  /* Players in join order — the design assigns a token by join order and a
     player keeps that identity all game. The host is not a player. */
  LiveEngine.prototype.seatMembers = function () {
    if (!this.room) return [];
    return this.room.members.filter(function (m) { return !m.isHost; });
  };

  LiveEngine.prototype.applyRoom = function () {
    var seats = this.seatMembers();
    if (this.state.phase === 'landing' || this.state.phase === 'lobby') {
      this.setState({ phase: 'lobby', code: this.room.code, joined: seats.length, netError: '' });
    } else {
      this.setState({ code: this.room.code });
    }
  };

  /* ---- Server state -> the design's state ---- */
  LiveEngine.prototype.applyGameState = function (payload) {
    var v = payload && payload.data ? payload.data : {};
    var self = this;
    var seats = this.seatMembers();
    var myId = this.me ? this.me.id : null;

    var alive = {};
    (v.players || []).forEach(function (p) { alive[p.userId] = p.alive; });
    var revealed = v.allRoles || v.eliminatedRoles || {};

    // The engine's own players array is the authority on who is in the game
    // and in what order; the room's member list only supplies display names.
    // Keying off the room list instead meant an id the engine had never seen
    // could reach it, and every vote came back "Invalid vote target".
    var nameById = {};
    seats.forEach(function (m) { nameById[m.userId] = m.displayName; });
    var roster = (v.players && v.players.length)
      ? v.players.map(function (p) { return p.userId; })
      : seats.map(function (m) { return m.userId; });

    var players = roster.map(function (userId, i) {
      var serverRole = revealed[userId] || (userId === myId ? v.myRole : null);
      return {
        id: userId,
        name: nameById[userId] || 'Player',
        isYou: userId === myId,
        role: ROLE_MAP[serverRole] || 'citizen',
        roleKnown: !!serverRole,
        alive: alive[userId] !== false,
        ci: i % 7,
        ti: i
      };
    });

    var phase = PHASE_MAP[payload.phase] || 'lobby';
    this.serverPhase = payload.phase;
    this.view = v;

    var patch = {
      players: players,
      phase: phase,
      round: v.round || 1,
      killedId: v.dawnKilledUserId != null ? v.dawnKilledUserId : null,
      savedNight: !!v.dawnSaved,
      elimId: v.elimUserId != null ? v.elimUserId : null,
      winner: v.winner || null,
      votes: this.mapVotes(v),
      youVoted: v.myVote != null,
      votesDone: !!(v.votedUserIds && v.players && v.votedUserIds.length >= v.players.filter(function (p) { return p.alive; }).length),
      sel: this.selectionFor(v),
      sheriffDone: !!(v.myInvestigation && v.myInvestigation.targetUserId),
      sheriffMafia: !!(v.myInvestigation && v.myInvestigation.isMafia),
      sheriffName: this.nameOf(v.myInvestigation && v.myInvestigation.targetUserId, players),
      messages: this.mapChat(v, players),
      whispers: this.mapWhispers(v, players),
      typing: false,
      canVote: false,
      dayLeft: this.secondsLeft(v),
      netError: ''
    };
    // The card stays face down until this player flips it, exactly as designed.
    if (phase !== 'reveal') patch.flipped = true;
    // Waiting for the table, and the run-up to night, both sleep.
    patch.sleeping = payload.phase === 'briefing' || (payload.phase === 'role-reveal' && !!v.iAmReady);
    this.setState(patch);
    this.startCountdown();
    void self;
  };

  LiveEngine.prototype.nameOf = function (userId, players) {
    if (!userId) return '';
    for (var i = 0; i < players.length; i++) if (players[i].id === userId) return players[i].name;
    return '';
  };

  LiveEngine.prototype.selectionFor = function (v) {
    if (v.myKillVote) return v.myKillVote;
    if (v.myProtection) return v.myProtection;
    if (v.myInvestigation && v.myInvestigation.targetUserId) return v.myInvestigation.targetUserId;
    if (v.myVote) return v.myVote;
    return null;
  };

  // The design draws a token per voter under each candidate. Who voted is
  // public during the vote; for whom only becomes public once the tally is
  // released, so before that every vote is drawn against the voter alone.
  LiveEngine.prototype.mapVotes = function (v) {
    var out = [];
    if (v.lastVoteTally) {
      Object.keys(v.lastVoteTally).forEach(function (voter) {
        out.push({ v: voter, t: v.lastVoteTally[voter] });
      });
      return out;
    }
    if (v.myVote) out.push({ v: this.me ? this.me.id : null, t: v.myVote });
    return out;
  };

  LiveEngine.prototype.mapChat = function (v, players) {
    var self = this;
    return (v.dayChat || []).map(function (m) {
      return {
        who: self.nameOf(m.userId, players) || 'Player',
        ci: self.ciOf(m.userId, players), k: 'raw', arg: null, text: m.text
      };
    });
  };
  LiveEngine.prototype.mapWhispers = function (v, players) {
    var self = this;
    return (v.mafiaChat || []).map(function (m) {
      return {
        who: self.nameOf(m.userId, players) || 'Player',
        k: 'raw', text: m.text, ci: self.ciOf(m.userId, players)
      };
    });
  };
  LiveEngine.prototype.ciOf = function (userId, players) {
    for (var i = 0; i < players.length; i++) if (players[i].id === userId) return players[i].ci;
    return 4;
  };

  LiveEngine.prototype.secondsLeft = function (v) {
    if (!v.phaseEndsAt) return 0;
    return Math.max(0, Math.round((v.phaseEndsAt - Date.now()) / 1000));
  };

  // One local ticker so the design's countdown keeps moving between server
  // updates. The server remains the authority on when a phase actually ends.
  LiveEngine.prototype.startCountdown = function () {
    var self = this;
    clearInterval(this._tick);
    if (!this.view || !this.view.phaseEndsAt) return;
    this._tick = setInterval(function () {
      var left = self.secondsLeft(self.view);
      if (left !== self.state.dayLeft) self.setState({ dayLeft: left });
      if (left <= 0) clearInterval(self._tick);
    }, 1000);
  };

  LiveEngine.prototype.alive = function () {
    return !this.view || this.view.myAlive !== false;
  };

  LiveEngine.prototype.act = function (action) {
    if (!this.socket) return;
    // An eliminated player watches the rest of the round; the server rejects
    // their actions, so don't send them and don't flash an error at someone
    // who is simply out.
    if (!this.alive() && action.type !== 'advance') return;
    this.socket.emit('game:action', { action: action });
  };

  /* ---- What the design's buttons do in a live room ---- */
  LiveEngine.prototype.startGame = function () { this.snd('night'); this.socket && this.socket.emit('room:start'); };
  LiveEngine.prototype.pickNight = function (id) { this.snd('pick'); this.setState({ sel: id }); };
  LiveEngine.prototype.confirmNight = function () {
    var sel = this.state.sel;
    if (sel == null) return;
    this.snd('click');
    var role = this.view ? this.view.myRole : null;
    if (role === 'mafia') this.act({ type: 'mafia-kill', targetUserId: sel });
    else if (role === 'doctor') this.act({ type: 'protect', targetUserId: sel });
    else if (role === 'detective') this.act({ type: 'investigate', targetUserId: sel });
  };
  LiveEngine.prototype.sheriffContinue = function () { this.snd('click'); };
  LiveEngine.prototype.voteFor = function (id) {
    if (this.state.youVoted) return;
    this.snd('pick');
    this.act({ type: 'vote', targetUserId: id });
  };
  LiveEngine.prototype.sayQuick = function (i) {
    if (this.state.saidQuick.indexOf(i) >= 0) return;
    this.snd('tick');
    var text = this.L().quick[i];
    this.setState(function (s) { return { saidQuick: s.saidQuick.concat([i]) }; });
    this.act({ type: 'day-chat', text: text });
  };
  // The server drives every phase change; the host may nudge it along.
  LiveEngine.prototype.startDay = function () { if (this.amHost()) this.act({ type: 'advance' }); };
  LiveEngine.prototype.startVote = function () { if (this.amHost()) this.act({ type: 'advance' }); };
  LiveEngine.prototype.revealVerdict = function () { if (this.amHost()) this.act({ type: 'advance' }); };
  LiveEngine.prototype.continueElim = function () { if (this.amHost()) this.act({ type: 'advance' }); };
  // The design's reveal button: this player has seen their card.
  LiveEngine.prototype.enterNight = function () {
    if (this.view && this.view.iAmReady) return;
    this.snd('click');
    this.act({ type: 'ready' });
  };

  LiveEngine.prototype.playAgain = function () {
    clearInterval(this._tick);
    if (this.socket) { try { this.socket.disconnect(); } catch (e) {} this.socket = null; }
    this.room = null; this.view = null; this.serverPhase = null;
    Engine.prototype.playAgain.call(this);
  };

  global.MafiaLiveEngine = LiveEngine;
})(window);
