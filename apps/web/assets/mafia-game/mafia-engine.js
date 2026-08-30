/* Mafia — game state machine.
   A direct port of the supplied design's component logic
   (Mafia Game.dc.html): same state shape, same phase graph, same timer
   pacing, same win checks, same sound cue per event. The only change is
   the host: setState/render instead of React.

   Phases: landing -> lobby -> reveal -> day -> vote -> elim -> night ->
   dawn -> day ... -> end. */
(function (global) {
  var ASSETS = 'assets/mafia/';

  function Engine(props, onChange) {
    this.props = props;
    this.onChange = onChange;
    this.t = [];
    var seen = false;
    try { seen = localStorage.getItem('bahjah_mafia_tut_v2') === '1'; } catch (e) {}
    this.state = {
      phase: 'landing', code: props.code || 'MF42', joined: 1, players: [], round: 1, sel: null,
      sleeping: false, tutOpen: !seen, tut: 0, shareOpen: false, copied: false,
      killedId: null, savedNight: false, sheriffDone: false, sheriffMafia: false, sheriffName: '',
      messages: [], typing: false, canVote: false, votes: [], youVoted: false, votesDone: false,
      elimId: null, winner: null, flipped: false, whispers: [], whisperReacted: false,
      lang: null, sound: true, dayLeft: 0, suspense: false, saidQuick: [], exitOpen: false,
      nightPlayed: false
    };
  }

  Engine.prototype.setState = function (patch, cb) {
    var next = typeof patch === 'function' ? patch(this.state) : patch;
    for (var k in next) if (Object.prototype.hasOwnProperty.call(next, k)) this.state[k] = next[k];
    this.onChange();
    if (cb) cb();
  };

  Engine.prototype.after = function (ms, fn) {
    var f = this.props.quickPace ? 0.45 : 1;
    this.t.push(setTimeout(fn, ms * f));
  };
  Engine.prototype.clearT = function () { this.t.forEach(clearTimeout); this.t = []; };

  Engine.prototype.lang = function () {
    return this.state.lang != null ? this.state.lang : (this.props.language || 'en');
  };
  Engine.prototype.L = function () {
    return this.lang() === 'ar' ? global.MafiaStrings.ar : global.MafiaStrings.en;
  };
  Engine.prototype.N = function (key) { var T = this.L(); return T.names[key] || key; };

  /* ---- Audio cues. One cue per event, exactly as the design maps them. ---- */
  Engine.prototype.snd = function (k) {
    if (!this.state.sound) return;
    try {
      var A = this.ac || (this.ac = new (window.AudioContext || window.webkitAudioContext)());
      if (A.state === 'suspended') A.resume();
      var t = A.currentTime;
      var tone = function (f0, f1, dur, type, vol, dl) {
        var o = A.createOscillator(), g = A.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t + dl);
        o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dl + dur);
        g.gain.setValueAtTime(0.0001, t + dl);
        g.gain.exponentialRampToValueAtTime(vol, t + dl + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dl + dur);
        o.connect(g); g.connect(A.destination);
        o.start(t + dl); o.stop(t + dl + dur + 0.06);
      };
      var S = {
        click: function () { tone(520, 520, 0.08, 'square', 0.05, 0); },
        tick: function () { tone(880, 880, 0.05, 'square', 0.04, 0); },
        pick: function () { tone(620, 940, 0.1, 'triangle', 0.07, 0); },
        whisper: function () { tone(230, 170, 0.2, 'sine', 0.05, 0); },
        reveal: function () { tone(300, 900, 0.35, 'sawtooth', 0.04, 0); tone(600, 1200, 0.3, 'triangle', 0.05, 0.08); },
        kill: function () { tone(220, 60, 0.6, 'sawtooth', 0.08, 0); tone(110, 50, 0.7, 'sine', 0.07, 0.05); },
        save: function () { tone(440, 660, 0.2, 'triangle', 0.06, 0); tone(660, 880, 0.25, 'triangle', 0.06, 0.16); },
        night: function () { tone(330, 110, 0.8, 'sine', 0.06, 0); },
        day: function () { tone(392, 392, 0.12, 'triangle', 0.06, 0); tone(523, 523, 0.12, 'triangle', 0.06, 0.13); tone(659, 659, 0.22, 'triangle', 0.06, 0.26); },
        win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, f, 0.16, 'square', 0.055, i * 0.14); }); },
        lose: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, f, 0.2, 'square', 0.055, i * 0.16); }); },
        heart: function () { tone(70, 52, 0.16, 'sine', 0.11, 0); tone(64, 48, 0.14, 'sine', 0.09, 0.24); },
        riser: function () { tone(90, 700, 2.2, 'sawtooth', 0.035, 0); tone(60, 58, 2.2, 'sine', 0.05, 0); },
        stinger: function () { tone(880, 880, 0.05, 'square', 0.05, 0); tone(140, 70, 0.5, 'sawtooth', 0.08, 0.06); }
      };
      (S[k] || S.click)();
    } catch (e) {}
  };

  /* ---- Role / identity tables ---- */
  Engine.prototype.yourRole = function () {
    var r = this.props.yourRole || 'mafia';
    return ['mafia', 'doctor', 'sheriff', 'citizen'].indexOf(r) >= 0 ? r : 'mafia';
  };
  Engine.prototype.ROLE = function () {
    var T = this.L();
    return {
      mafia: { name: T.roles.mafia, color: '#EE2D23', dim: 'rgba(238,45,35,.28)', art: ASSETS + 'cards/mafia-boss.svg', desc: T.descs.mafia, win: T.wins.mafia },
      doctor: { name: T.roles.doctor, color: '#AEB8C4', dim: 'rgba(174,184,196,.26)', art: ASSETS + 'cards/doctor.svg', desc: T.descs.doctor, win: T.wins.village },
      sheriff: { name: T.roles.sheriff, color: '#C8A94E', dim: 'rgba(200,169,78,.22)', art: ASSETS + 'cards/sheriff.svg', desc: T.descs.sheriff, win: T.wins.village },
      citizen: { name: T.roles.citizen, color: '#E8EAF0', dim: 'rgba(247,247,255,.2)', art: ASSETS + 'cards/citizen-m.svg', desc: T.descs.citizen, win: T.wins.village }
    };
  };
  Engine.prototype.artFor = function (p) {
    var R = this.ROLE();
    if (!p) return R.citizen.art;
    if (p.role === 'citizen' && ['Sara', 'Layla', 'Noura', 'Dana'].indexOf(p.name) >= 0) return ASSETS + 'cards/citizen-f.svg';
    return (R[p.role] || R.citizen).art;
  };
  Engine.prototype.RING = function () { return ['#B9BEC9', '#8E96A4', '#C8A94E', '#A2A9B6', '#E8EAF0', '#7E8794', '#AEB8C4']; };
  Engine.prototype.STARS = function () {
    if (this._stars) return this._stars;
    var a = [], f = function (x) { return x - Math.floor(x); };
    for (var i = 0; i < 34; i++) {
      var r = Math.sin(i * 127.1) * 43758.5453;
      a.push({
        x: Math.round(f(r) * 97 + 1), y: Math.round(f(r * 1.7) * 55 + 2),
        s: 1 + Math.round(f(r * 2.3) * 2),
        d: (2 + f(r * 3.1) * 3).toFixed(1), dl: (f(r * 4.7) * 4).toFixed(1)
      });
    }
    this._stars = a;
    return a;
  };
  Engine.prototype.SEATS = ['You', 'Omar', 'Sara', 'Faisal', 'Layla', 'Khalid', 'Noura', 'Dana'];
  Engine.prototype.TOKENS = ['fedora', 'revolver', 'cigar', 'lipstick', 'watch', 'dice', 'shoe', 'briefcase'];
  Engine.prototype.TOKEN = function (i) { return ASSETS + 'tokens/' + this.TOKENS[((i < 0 ? 0 : i) || 0) % 8] + '.svg'; };

  Engine.prototype.makePlayers = function () {
    var yr = this.yourRole(), pool = [], i;
    for (i = 0; i < (yr === 'mafia' ? 1 : 2); i++) pool.push('mafia');
    if (yr !== 'doctor') pool.push('doctor');
    if (yr !== 'sheriff') pool.push('sheriff');
    while (pool.length < 7) pool.push('citizen');
    for (i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var names = ['Omar', 'Sara', 'Faisal', 'Layla', 'Khalid', 'Noura', 'Dana'];
    var ps = [{ id: 0, name: 'You', isYou: true, role: yr, alive: true, ci: 4, ti: 0 }];
    names.forEach(function (n, k) {
      ps.push({ id: k + 1, name: n, isYou: false, role: pool[k], alive: true, ci: k === 4 ? 0 : k % 7, ti: k + 1 });
    });
    return ps;
  };

  /* ---- Phase transitions ---- */
  Engine.prototype.enterLobby = function () {
    var self = this;
    this.clearT(); this.snd('click');
    this.setState({ phase: 'lobby', joined: 1 });
    for (var i = 2; i <= 8; i++) {
      (function (n) {
        self.after(500 + (n - 1) * 620, function () {
          self.snd('tick');
          self.setState(function (s) { return { joined: Math.max(s.joined, n) }; });
        });
      })(i);
    }
  };

  Engine.prototype.startGame = function () {
    this.clearT(); this.snd('night');
    this.setState({ players: this.makePlayers(), phase: 'reveal', flipped: false, round: 1, nightPlayed: false });
  };

  Engine.prototype.startNight = function () {
    var self = this;
    this.clearT(); this.snd('night');
    this.setState({ phase: 'night', sel: null, sleeping: false, sheriffDone: false, killedId: null, savedNight: false, whispers: [], whisperReacted: false });
    var me = this.state.players.filter(function (p) { return p.isYou; })[0];
    if (me && me.role === 'citizen') this.after(3000, function () { self.resolveNight(null, null); });
    if (me && me.role === 'mafia') {
      var partner = this.state.players.filter(function (p) { return p.role === 'mafia' && !p.isYou && p.alive; })[0];
      if (partner) {
        this.after(900, function () {
          self.snd('whisper');
          self.setState(function (s) { return { whispers: s.whispers.concat([{ who: partner.name, k: 'w1' }]) }; });
        });
        this.after(2400, function () {
          self.snd('whisper');
          self.setState(function (s) { return { whispers: s.whispers.concat([{ who: partner.name, k: 'w2' }]) }; });
        });
      }
    }
  };

  Engine.prototype.pickNight = function (id) {
    var self = this;
    if (this.state.sheriffDone) return;
    this.snd('pick'); this.setState({ sel: id });
    var me = this.state.players.filter(function (p) { return p.isYou; })[0];
    if (me && me.role === 'mafia' && !this.state.whisperReacted) {
      var partner = this.state.players.filter(function (p) { return p.role === 'mafia' && !p.isYou && p.alive; })[0];
      if (partner) {
        this.after(600, function () {
          self.snd('whisper');
          self.setState(function (s) { return { whisperReacted: true, whispers: s.whispers.concat([{ who: partner.name, k: 'w3' }]) }; });
        });
      }
    }
  };

  Engine.prototype.confirmNight = function () {
    var self = this, yr = this.yourRole(), sel = this.state.sel;
    if (sel == null) return;
    this.snd('click');
    if (yr === 'mafia') { this.sleepThen(function () { self.resolveNight(sel, null); }); }
    else if (yr === 'doctor') { this.sleepThen(function () { self.resolveNight(null, sel); }); }
    else if (yr === 'sheriff') {
      var t = this.state.players.filter(function (p) { return p.id === sel; })[0];
      this.snd(t.role === 'mafia' ? 'kill' : 'save');
      this.setState({ sheriffDone: true, sheriffMafia: t.role === 'mafia', sheriffName: t.name });
    }
  };

  Engine.prototype.sheriffContinue = function () {
    var self = this;
    this.sleepThen(function () { self.resolveNight(null, null); });
  };

  Engine.prototype.sleepThen = function (fn) {
    var self = this;
    this.snd('night');
    this.setState({ sleeping: true });
    this.after(700, function () { self.snd('heart'); });
    this.after(1600, function () { self.snd('heart'); });
    this.after(2600, fn);
  };

  Engine.prototype.rand = function (a) { return a[Math.floor(Math.random() * a.length)]; };

  Engine.prototype.resolveNight = function (mafTarget, docSave) {
    var ps = this.state.players.map(function (p) { var c = {}; for (var k in p) c[k] = p[k]; return c; });
    var target = mafTarget;
    if (target == null) {
      var cands = ps.filter(function (p) { return p.alive && !p.isYou && p.role !== 'mafia'; });
      target = cands.length ? this.rand(cands).id : null;
    }
    var save = docSave;
    if (save == null) {
      var doc = ps.filter(function (p) { return p.role === 'doctor' && p.alive && !p.isYou; })[0];
      if (doc) { var c = ps.filter(function (p) { return p.alive; }); save = this.rand(c).id; }
    }
    var saved = target != null && save === target;
    if (target != null && !saved) ps.filter(function (p) { return p.id === target; })[0].alive = false;
    this.snd(saved || target == null ? 'save' : 'kill');
    this.setState({ players: ps, killedId: saved ? null : target, savedNight: saved || target == null, sleeping: false, phase: 'dawn', nightPlayed: true });
  };

  Engine.prototype.tickDay = function () {
    var self = this;
    this.after(1000, function () {
      if (self.state.phase !== 'day') return;
      // The design reads dayLeft *before* the update lands (React batches
      // setState), which is what gives 0:00 its one-second beat on screen
      // before voting opens. Snapshot it so the pacing matches.
      var prevLeft = self.state.dayLeft;
      self.setState(function (s) {
        var left = Math.max(0, s.dayLeft - 1);
        if (left <= 5 && left > 0) self.snd('tick');
        return { dayLeft: left, canVote: s.canVote || left === 0 };
      });
      if (prevLeft > 0) self.tickDay();
      else if (self.state.phase === 'day') self.startVote();
    });
  };

  Engine.prototype.sayQuick = function (i) {
    if (this.state.saidQuick.indexOf(i) >= 0) return;
    this.snd('tick');
    this.setState(function (s) {
      return { saidQuick: s.saidQuick.concat([i]), messages: s.messages.concat([{ who: 'You', ci: 4, k: 'quick', arg: i }]) };
    });
  };

  Engine.prototype.startDay = function () {
    var self = this;
    var ps = this.state.players;
    var mf = ps.filter(function (p) { return p.alive && p.role === 'mafia'; }).length;
    var ot = ps.filter(function (p) { return p.alive && p.role !== 'mafia'; }).length;
    var you = ps.filter(function (p) { return p.isYou; })[0] || { role: this.yourRole() };
    if (ps.length && mf === 0) { this.snd(you.role !== 'mafia' ? 'win' : 'lose'); this.setState({ phase: 'end', winner: 'village' }); return; }
    if (ps.length && mf >= ot) { this.snd(you.role === 'mafia' ? 'win' : 'lose'); this.setState({ phase: 'end', winner: 'mafia' }); return; }
    this.clearT(); this.snd('day');
    this.setState(function (s) { return { round: s.phase === 'dawn' ? s.round + 1 : s.round }; });
    this.setState({ phase: 'day', messages: [], typing: true, canVote: false, dayLeft: 45, saidQuick: [] });
    this.tickDay();
    var st = this.state;
    var bots = st.players.filter(function (p) { return p.alive && !p.isYou; });
    var v = st.killedId != null ? st.players.filter(function (p) { return p.id === st.killedId; })[0] : null;
    var a = bots[0], b = bots[1 % bots.length], c = bots[2 % bots.length], d = bots[3 % bots.length];
    var lines = [
      { p: a, k: st.nightPlayed ? (v ? 'kill' : 'save') : 'open', arg: v ? v.name : null },
      { p: b, k: 'distrust', arg: c.name },
      { p: c, k: 'deflect', arg: b.name },
      { p: d, k: 'warn', arg: null }
    ];
    lines.forEach(function (l, i) {
      self.after(1000 + i * 1400, function () {
        self.snd('tick');
        self.setState(function (s) {
          return {
            messages: s.messages.concat([{ who: l.p.name, ci: l.p.ci, k: l.k, arg: l.arg }]),
            typing: i < lines.length - 1,
            canVote: i === lines.length - 1
          };
        });
      });
    });
  };

  Engine.prototype.startVote = function () {
    this.clearT(); this.snd('click');
    this.setState({ phase: 'vote', votes: [], youVoted: false, votesDone: false, typing: false });
  };

  Engine.prototype.voteFor = function (id) {
    var self = this;
    if (this.state.youVoted) return;
    this.snd('pick');
    this.setState({ votes: [{ v: 0, t: id }], youVoted: true });
    var bots = this.state.players.filter(function (p) { return p.alive && !p.isYou; });
    bots.forEach(function (b, i) {
      self.after(650 * (i + 1), function () {
        self.snd('tick');
        self.setState(function (s) {
          var alive = s.players.filter(function (p) { return p.alive && !p.isYou && p.id !== b.id; });
          var pool = b.role === 'mafia' ? alive.filter(function (p) { return p.role !== 'mafia'; }) : alive;
          if (!pool.length) pool = alive;
          var t;
          var counts = {};
          s.votes.forEach(function (x) { counts[x.t] = (counts[x.t] || 0) + 1; });
          var leaders = Object.keys(counts).filter(function (k) {
            return +k !== b.id && +k !== 0 && pool.some(function (p) { return p.id === +k; });
          }).sort(function (x, y) { return counts[y] - counts[x]; });
          if (leaders.length && Math.random() < 0.55) t = +leaders[0]; else t = self.rand(pool).id;
          var votes = s.votes.concat([{ v: b.id, t: t }]);
          return { votes: votes, votesDone: votes.length >= s.players.filter(function (p) { return p.alive; }).length };
        });
      });
    });
  };

  Engine.prototype.revealVerdict = function () {
    var self = this;
    this.clearT();
    this.snd('riser');
    this.setState({ suspense: true });
    this.after(600, function () { self.snd('heart'); });
    this.after(1400, function () { self.snd('heart'); });
    this.after(2100, function () { self.snd('heart'); });
    this.after(2700, function () { self.snd('stinger'); self.doVerdict(); });
  };

  Engine.prototype.doVerdict = function () {
    var s = this.state, counts = {};
    s.votes.forEach(function (x) { counts[x.t] = (counts[x.t] || 0) + 1; });
    var top = null, max = -1;
    Object.keys(counts).forEach(function (k) { if (counts[k] > max) { max = counts[k]; top = +k; } });
    var ps = s.players.map(function (p) {
      if (p.id !== top) return p;
      var c = {}; for (var k in p) c[k] = p[k]; c.alive = false; return c;
    });
    this.setState({ players: ps, elimId: top, phase: 'elim', suspense: false });
  };

  Engine.prototype.continueElim = function () {
    var ps = this.state.players;
    var m = ps.filter(function (p) { return p.alive && p.role === 'mafia'; }).length;
    var o = ps.filter(function (p) { return p.alive && p.role !== 'mafia'; }).length;
    var me = ps.filter(function (p) { return p.isYou; })[0] || { role: this.yourRole() };
    if (m === 0) { this.snd(me.role !== 'mafia' ? 'win' : 'lose'); this.setState({ phase: 'end', winner: 'village' }); }
    else if (m >= o) { this.snd(me.role === 'mafia' ? 'win' : 'lose'); this.setState({ phase: 'end', winner: 'mafia' }); }
    else { this.startNight(); }
  };

  /* ---- Tutorial ---- */
  Engine.prototype.tutGo = function (d) {
    var T = this.L(), n = this.state.tut + d;
    if (n < 0) return;
    if (n >= T.tutSteps.length) return this.tutDone();
    this.snd('click'); this.setState({ tut: n });
  };
  Engine.prototype.tutDone = function () {
    this.snd('click');
    try { localStorage.setItem('bahjah_mafia_tut_v2', '1'); } catch (e) {}
    this.setState({ tutOpen: false, tut: 0 });
  };
  Engine.prototype.openTut = function () { this.snd('click'); this.setState({ tutOpen: true, tut: 0 }); };

  /* ---- Share ---- */
  Engine.prototype.openShare = function () { this.snd('click'); this.setState({ shareOpen: true, copied: false }); };
  Engine.prototype.closeShare = function () { this.snd('click'); this.setState({ shareOpen: false }); };
  Engine.prototype.shareText = function () {
    var T = this.L(), s = this.state, R = this.ROLE();
    var you = s.players.filter(function (p) { return p.isYou; })[0] || { role: this.yourRole() };
    var won = (s.winner === 'mafia') === (you.role === 'mafia');
    return [
      T.badge + ' · ' + T.rounds(s.round),
      T.names.You,
      (s.winner === 'mafia' ? T.endMafiaKicker : T.endVillageKicker).toUpperCase(),
      T.shareYourRole + ': ' + (R[you.role] || R.citizen).name,
      won ? T.youWon : T.youLost,
      '',
      T.shareTag + ' ' + T.shareLink
    ].join('\n');
  };
  Engine.prototype.shareUrl = function () { return 'https://bahjah.com/mafia?room=' + this.state.code; };
  Engine.prototype.shareTo = function (k) {
    var t = this.shareText(), u = this.shareUrl();
    this.snd('click');
    var enc = encodeURIComponent;
    var map = {
      whatsapp: 'https://wa.me/?text=' + enc(t + '\n' + u),
      x: 'https://twitter.com/intent/tweet?text=' + enc(t) + '&url=' + enc(u),
      snapchat: 'https://www.snapchat.com/scan?attachmentUrl=' + enc(u),
      instagram: null, tiktok: null
    };
    var url = map[k];
    if (url) { try { window.open(url, '_blank', 'noopener'); } catch (e) {} return; }
    if (navigator.share) { navigator.share({ title: 'Bahjah Mafia', text: t, url: u }).catch(function () {}); return; }
    this.copyShare();
  };
  Engine.prototype.nativeShare = function () {
    var t = this.shareText(), u = this.shareUrl();
    this.snd('click');
    if (navigator.share) navigator.share({ title: 'Bahjah Mafia', text: t, url: u }).catch(function () {});
    else this.copyShare();
  };
  Engine.prototype.copyShare = function () {
    var self = this;
    var t = this.shareText() + '\n' + this.shareUrl();
    try { navigator.clipboard.writeText(t); } catch (e) {}
    this.snd('click');
    this.setState({ copied: true });
    clearTimeout(this._ct);
    this._ct = setTimeout(function () { self.setState({ copied: false }); }, 1800);
  };

  Engine.prototype.playAgain = function () {
    this.clearT(); this.snd('click');
    this.setState({
      phase: 'landing', joined: 1, players: [], round: 1, sel: null, sleeping: false,
      killedId: null, savedNight: false, sheriffDone: false, messages: [], typing: false,
      canVote: false, votes: [], youVoted: false, votesDone: false, elimId: null,
      winner: null, flipped: false, whispers: [], whisperReacted: false
    });
  };

  global.MafiaEngine = Engine;
})(window);
