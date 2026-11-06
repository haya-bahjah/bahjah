// The one place a Bahjah page opens its realtime connection to a room.
//
// Every game page used to build its own socket with `io({ auth: { token } })`
// and hope. Three things went wrong with that, and between them they account
// for the whole shape of the complaints -- players dropped from games for no
// reason they could see, and phones left sitting on a screen the rest of the
// room had already played past:
//
//  1. A handshake the SERVER refuses is final. socket.io retries a handshake
//     that failed to reach the server, but not one the server's own auth
//     middleware turned away: one connect_error and the manager goes idle for
//     good. A guest token is good for six hours, so a token that lapsed
//     mid-game killed the socket outright -- silently, because the token was
//     also captured once at page load and so every retry would have re-sent
//     the same dead token anyway.
//  2. Nothing watched the join. room:join is answered over the network and
//     can fail transiently (the server looks the membership up in the
//     database). When it did, the socket stayed happily connected while
//     belonging to no room: every room:update and game:state went straight
//     past it. No error, no retry, no way back -- exactly the frozen phone.
//  3. Nothing told the player. Pages had no connect_error handler at all,
//     so a connection that was down, retrying, or dead for good all looked
//     identical from the sofa: a screen that had stopped changing.
//
// So this module owns the connection and the join, and reports what it is
// doing. Pages add their own listeners to the socket exactly as before.
//
//   const socket = BahjahSocket.create({ code: 'ABCD' });
//   document.addEventListener('bahjah:connection', (e) => e.detail.state);
//
// `state` is one of:
//   'connecting' -- first attempt, nothing to show the player yet
//   'online'     -- connected AND confirmed in the room
//   'offline'    -- dropped, retrying by itself; worth showing after a beat
//   'expired'    -- the session is genuinely over; only rejoining helps
//   'rejected'   -- the room refused this player for good (ended, not a member)
(function (global) {
  'use strict';

  // Positive confirmation of the join is worth waiting a moment for, but not
  // forever: past this we assume the room:join was lost and send it again.
  var JOIN_CONFIRM_TIMEOUT_MS = 4000;
  var JOIN_MAX_ATTEMPTS = 6;

  // A join refused with NOT_A_MEMBER is usually final -- but not always. The
  // lobby pages join over the REST API and then connect, so a replica or a
  // busy database can briefly answer "no" to a membership that was just
  // written. A couple of retries covers that race; past it, the refusal is
  // taken at face value and handed to the page.
  var MEMBERSHIP_RACE_ATTEMPTS = 3;
  var TERMINAL_JOIN_ERRORS = { ROOM_NOT_FOUND: 1, ROOM_ENDED: 1, INVALID_CODE: 1, ROOM_NOT_JOINABLE: 1 };

  // socket.io's own reconnection handles the drops it considers the
  // network's fault. This ladder is for the two it gives up on: a handshake
  // the server refused, and a disconnect the server announced (a restart or
  // a deploy). It flattens out rather than growing without bound, because a
  // player sitting in front of a stalled game wants back in, and the server
  // coming back up is exactly the case being waited for.
  var RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 10000];

  // How many times a refused handshake is worth retrying before the player
  // is told their session is over. Retrying at all is only worth it because
  // the token may have been renewed in between -- by this socket moments
  // before it dropped, or by another tab. If it really has lapsed, no amount
  // of retrying fixes it, and saying so beats a spinner that never stops.
  var AUTH_RETRY_LIMIT = 3;

  // assets/session.js declares `const BahjahSession = ...` at the top level
  // of a classic script, which makes it script-scoped rather than a property
  // of `window` -- so `global.BahjahSession` is undefined even on a page that
  // loaded it. It has to be reached as a bare identifier, through the scope
  // chain, and guarded with `typeof` for the pages that do not load it.
  function session() {
    try {
      return typeof BahjahSession !== 'undefined' ? BahjahSession : null;
    } catch (e) {
      return null;
    }
  }

  function readToken() {
    try {
      var s = session();
      return s && s.getActiveToken ? s.getActiveToken() : null;
    } catch (e) {
      return null; // storage unavailable (private mode, blocked site data)
    }
  }

  function create(options) {
    var opts = options || {};
    var code = opts.code;
    // Each page keeps its own idea of the token for its REST calls; the
    // socket always asks for the freshest one instead, because `auth` as a
    // function is re-read on every single attempt (a literal object is not).
    var getToken = opts.getToken || readToken;

    var state = 'connecting';
    var joined = false;
    var joinAttempts = 0;
    var membershipRefusals = 0;
    var authRetries = 0;
    var retries = 0;
    var joinTimer = null;
    var retryTimer = null;
    var standDown = false;

    function cancelReconnect() {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    }

    // Used for the two drops socket.io will not retry on its own: a
    // handshake the server refused, and a disconnect the server announced.
    // Re-arms itself after each attempt, so a server that is still coming
    // back up is waited out rather than tried once and abandoned; a
    // successful 'connect' is what stops it.
    function scheduleReconnect() {
      if (standDown) return;
      cancelReconnect();
      var delay = RECONNECT_DELAYS_MS[Math.min(retries, RECONNECT_DELAYS_MS.length - 1)];
      retries += 1;
      retryTimer = setTimeout(function () {
        retryTimer = null;
        if (socket.connected) return;
        // The token is re-read through `auth` below, so one renewed in the
        // meantime is the one that goes out. A refused handshake comes back
        // through connect_error, which decides whether to keep trying.
        socket.connect();
        if (authRetries === 0) scheduleReconnect();
      }, delay);
    }

    function setState(next) {
      if (state === next) return;
      state = next;
      try {
        document.dispatchEvent(new CustomEvent('bahjah:connection', {
          detail: { state: next, code: code },
        }));
      } catch (e) { /* CustomEvent unsupported; status is advisory only */ }
    }

    var socket = global.io({
      auth: function (cb) { cb({ token: getToken() }); },

      // Ask for a websocket first and skip the HTTP long-polling handshake
      // that every connection used to begin with -- that handshake, and the
      // upgrade dance after it, is the delay players described at the start
      // of a game. `tryAllTransports` is what makes preferring websocket
      // safe: without it the client retries websocket forever and a player
      // behind a proxy that blocks websockets can never connect at all,
      // which would be far worse than slow. With it, polling is still tried
      // when websocket genuinely cannot be established.
      transports: ['websocket', 'polling'],
      tryAllTransports: true,
    });

    // ------------------------------------------------------------- joining
    function clearJoinTimer() {
      if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }
    }

    function sendJoin() {
      if (!code || joined || !socket.connected) return;
      if (joinAttempts >= JOIN_MAX_ATTEMPTS) { setState('offline'); return; }
      joinAttempts += 1;
      socket.emit('room:join', { code: code });
      clearJoinTimer();
      joinTimer = setTimeout(sendJoin, JOIN_CONFIRM_TIMEOUT_MS);
    }

    socket.on('connect', function () {
      // A fresh socket is in no rooms, and a recovered one is put back in
      // its own, but re-sending room:join is correct either way: it is how
      // presence is re-counted and how the page is caught up on a game that
      // moved on while it was away.
      joined = false;
      joinAttempts = 0;
      membershipRefusals = 0;
      authRetries = 0;
      retries = 0;
      cancelReconnect();
      sendJoin();
      if (!code) setState('online');
    });

    socket.on('room:joined', function () {
      joined = true;
      clearJoinTimer();
      setState('online');
    });

    // Watched, not consumed: the page keeps its own room:error handler and
    // sees every one of these too.
    socket.on('room:error', function (err) {
      var errCode = (err && err.code) || '';
      if (joined) return;
      if (TERMINAL_JOIN_ERRORS[errCode]) { clearJoinTimer(); setState('rejected'); return; }
      if (errCode === 'NOT_A_MEMBER') {
        membershipRefusals += 1;
        if (membershipRefusals >= MEMBERSHIP_RACE_ATTEMPTS) {
          clearJoinTimer();
          setState('rejected');
        }
        return;
      }
      // Anything else while joining -- INTERNAL_ERROR from a database that
      // hiccuped, RATE_LIMITED from a reconnect storm -- is transient, and
      // the pending timer will send room:join again.
    });

    // ------------------------------------------------- the renewed session
    // The server hands a guest a fresh token while they are still playing,
    // so that the six-hour limit on an idle session can never end a live
    // one. Banking it here is what makes the next reconnect survive.
    socket.on('session:token', function (payload) {
      var token = payload && payload.token;
      if (!token || typeof token !== 'string') return;
      try {
        var s = session();
        if (s && s.replaceGuestToken) s.replaceGuestToken(token);
      } catch (e) { /* storage unavailable; the current socket still works */ }
    });

    // ----------------------------------------------------------- the drops
    socket.on('disconnect', function (reason) {
      joined = false;
      clearJoinTimer();

      // The page closing the socket itself -- Mafia tearing down a removed
      // player, Saudi Home leaving a room -- is the one drop that must stay
      // dropped. Reviving it would drag somebody back into a room they were
      // taken out of.
      if (reason === 'io client disconnect') { standDown = true; setState('offline'); return; }

      setState('offline');

      // socket.io reconnects by itself after a drop it believes was the
      // network's fault, but not after one the SERVER announced: that is
      // reported as final and the manager stops. In production the server
      // never hangs up on a player deliberately, so in practice this means
      // a restart or a deploy -- after which every player's socket stayed
      // dead until they thought to reload the page, while the room they were
      // in carried on without them. There is nothing final about it from the
      // player's side, so reconnect.
      if (reason === 'io server disconnect') scheduleReconnect();
    });

    socket.on('connect_error', function (err) {
      var reason = (err && err.data && err.data.code) || '';
      var refusedByServer = reason === 'TOKEN_EXPIRED' || reason === 'UNAUTHENTICATED';
      if (!refusedByServer) {
        // The server was not reached. socket.io is already retrying.
        setState('offline');
        return;
      }
      // The server turned the handshake away, so socket.io has given up.
      // Unlike a dropped connection, this will not come back on its own.
      authRetries += 1;
      if (authRetries > AUTH_RETRY_LIMIT) {
        cancelReconnect();
        setState('expired');
        return;
      }
      setState('offline');
      scheduleReconnect();
    });

    // ------------------------------------------------- waking back up
    // A phone that was locked or backgrounded comes back with its timers
    // frozen mid-backoff, and on iOS the close may never have been
    // delivered at all -- so the page can sit "connected" to a socket the
    // server let go minutes ago. Whenever the player actually looks at the
    // page again, or the device says the network is back, stop waiting and
    // try now. This is the moment the player is watching the screen, so it
    // is the moment worth spending a reconnect on.
    function nudge() {
      if (document.hidden || standDown) return;
      if (state === 'rejected') return;
      cancelReconnect();
      if (!socket.connected) {
        // A fresh start: the player is here now, and a token that was dead
        // when they put the phone down may well have been replaced since.
        // This is also the only route out of 'expired', which is right --
        // it costs one handshake and it is the player's own prompt.
        retries = 0;
        authRetries = 0;
        socket.connect();
        return;
      }
      // Connected but never confirmed in the room: re-send the join.
      if (code && !joined) { joinAttempts = 0; sendJoin(); }
    }

    document.addEventListener('visibilitychange', nudge);
    global.addEventListener('online', nudge);
    global.addEventListener('pageshow', nudge);

    socket.bahjahConnectionState = function () { return state; };
    return socket;
  }

  global.BahjahSocket = { create: create };
})(window);
