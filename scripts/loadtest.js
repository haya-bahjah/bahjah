#!/usr/bin/env node
/**
 * Bahjah load test — how many concurrent players one instance actually holds.
 *
 * Simulates real players rather than bare sockets: each virtual player joins
 * a room over the REST API as a guest, opens a socket.io connection, joins
 * the room channel, and then answers questions for the length of a game. That
 * is the load that matters, because the cost here is not the connection — it
 * is the fan-out of every action to everyone else in the room.
 *
 * Usage:
 *   node scripts/loadtest.js --url https://bahjah-server-6bin.onrender.com \
 *                            --players 500 --room-size 10 --minutes 3
 *
 * Options:
 *   --url          Server base URL (required)
 *   --players      Total virtual players (default 500)
 *   --room-size    Players per room (default 10; trivia/mafia cap at 50)
 *   --minutes      How long to keep playing after everyone is connected (default 3)
 *   --ramp         Seconds to spread the connections over (default 60). Do not
 *                  set this to 0: a thundering herd measures your own laptop's
 *                  ability to open sockets, not the server's ability to hold them.
 *   --think        Seconds between one player's actions (default 8)
 *
 * Requires socket.io-client, which the server already depends on transitively:
 *   npm i -D socket.io-client
 *
 * Read the result as a ceiling, not a promise: this runs from one machine on
 * one network, so past a few thousand sockets you are measuring the client.
 * Run it from two or three boxes if you need a number you can defend.
 *
 * IMPORTANT: point this at staging, never at production. It creates real
 * guest accounts and real rooms.
 */
'use strict';

const { io } = require('socket.io-client');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg('url', '').replace(/\/$/, '');
const PLAYERS = Number(arg('players', 500));
const ROOM_SIZE = Number(arg('room-size', 10));
const MINUTES = Number(arg('minutes', 3));
const RAMP_S = Number(arg('ramp', 60));
const THINK_S = Number(arg('think', 8));

if (!BASE) {
  console.error('Missing --url. See the header of this file.');
  process.exit(1);
}

const ROOMS = Math.ceil(PLAYERS / ROOM_SIZE);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Everything the run is judged on. Latency is measured as the time between
// sending an action and the resulting game:state coming back -- which is the
// number a player actually feels.
const stats = {
  connected: 0, peakConnected: 0, connectFailed: 0, disconnected: 0,
  joined: 0, joinFailed: 0, actionsSent: 0, statesReceived: 0,
  rateLimited: 0, errors: new Map(), latencies: [],
};

function note(where, err) {
  const key = `${where}: ${String(err && err.message ? err.message : err).slice(0, 80)}`;
  stats.errors.set(key, (stats.errors.get(key) || 0) + 1);
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// One host account per room, so rooms can actually be created and started.
// Guests cannot host.
async function makeHost(i) {
  const email = `loadtest+host${i}.${Date.now()}@example.com`;
  const r = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      fullName: `Load Host ${i}`, email, countryCode: '+966',
      phone: `5${String(i).padStart(8, '0')}`, dob: '1995-01-01',
      password: 'loadtest-password', marketingOptIn: false,
    }),
  });
  if (!r.ok) throw new Error(`signup ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
  return r.body;
}

async function makeRoom(token, gameType) {
  const r = await api('/api/rooms', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ gameType, displayMode: 'phone' }),
  });
  if (!r.ok) throw new Error(`create room ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
  return r.body.room ? r.body.room.code : r.body.code;
}

async function joinAsGuest(code, nickname) {
  const r = await api(`/api/rooms/${code}/guest-join`, {
    method: 'POST',
    body: JSON.stringify({ nickname, avatar: null }),
  });
  if (!r.ok) {
    if (r.status === 429) stats.rateLimited++;
    throw new Error(`guest-join ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
  }
  return r.body;
}

function openSocket(token, code) {
  return new Promise((resolve) => {
    const socket = io(BASE, {
      auth: { token },
      transports: ['websocket'],   // skip the polling upgrade; phones get websocket anyway
      reconnection: false,         // a reconnect storm would flatter the numbers
      timeout: 20000,
    });

    let settled = false;
    const done = (ok) => { if (!settled) { settled = true; resolve(ok ? socket : null); } };

    socket.on('connect', () => {
      stats.connected++;
      stats.peakConnected = Math.max(stats.peakConnected, stats.connected);
      socket.emit('room:join', { code });
    });
    socket.on('room:update', () => { if (!settled) { stats.joined++; done(true); } });
    socket.on('game:state', () => {
      stats.statesReceived++;
      if (socket.__pending) {
        stats.latencies.push(Date.now() - socket.__pending);
        socket.__pending = null;
      }
    });
    socket.on('room:error', (e) => {
      if (e && e.code === 'RATE_LIMITED') stats.rateLimited++;
      else note('room:error', e && e.code);
    });
    socket.on('connect_error', (e) => { stats.connectFailed++; note('connect', e); done(false); });
    socket.on('disconnect', () => { stats.connected--; stats.disconnected++; });

    setTimeout(() => { if (!settled) { stats.joinFailed++; note('join', 'timeout'); done(false); } }, 25000);
  });
}

async function main() {
  console.log(`Target ${BASE}`);
  console.log(`${PLAYERS} players across ${ROOMS} rooms of ${ROOM_SIZE}, ramped over ${RAMP_S}s, playing ${MINUTES} min\n`);

  const sockets = [];
  const perRoomDelay = (RAMP_S * 1000) / Math.max(1, ROOMS);
  const started = Date.now();

  for (let r = 0; r < ROOMS; r++) {
    (async () => {
      let code;
      try {
        const host = await makeHost(r);
        code = await makeRoom(host.token, 'trivia');
      } catch (err) {
        note('room setup', err);
        return;
      }
      for (let p = 0; p < ROOM_SIZE; p++) {
        try {
          const guest = await joinAsGuest(code, `P${r}-${p}`);
          const socket = await openSocket(guest.token, code);
          if (socket) sockets.push(socket);
        } catch (err) {
          note('player', err);
        }
      }
    })();
    await sleep(perRoomDelay);
  }

  // Let the stragglers finish connecting before the play phase is timed.
  await sleep(10000);
  console.log(`connected ${stats.connected} of ${PLAYERS} after ${Math.round((Date.now() - started) / 1000)}s\n`);

  // Play: every socket sends an action every THINK_S seconds, jittered so the
  // load is a stream rather than a drumbeat.
  const until = Date.now() + MINUTES * 60000;
  const play = setInterval(() => {
    for (const socket of sockets) {
      if (!socket.connected || Math.random() > 1 / THINK_S) continue;
      socket.__pending = Date.now();
      socket.emit('game:action', { action: { type: 'answer', choiceIndex: Math.floor(Math.random() * 4) } });
      stats.actionsSent++;
    }
  }, 1000);

  const report = setInterval(() => {
    const l = stats.latencies.slice(-500).sort((a, b) => a - b);
    const p = (q) => (l.length ? l[Math.floor(l.length * q)] : 0);
    console.log(
      `live=${String(stats.connected).padStart(5)}  peak=${String(stats.peakConnected).padStart(5)}` +
      `  actions=${String(stats.actionsSent).padStart(6)}  states=${String(stats.statesReceived).padStart(7)}` +
      `  p50=${String(p(0.5)).padStart(5)}ms  p95=${String(p(0.95)).padStart(5)}ms` +
      `  dropped=${stats.disconnected}  429s=${stats.rateLimited}`
    );
  }, 5000);

  await sleep(Math.max(0, until - Date.now()));
  clearInterval(play);
  clearInterval(report);

  const all = stats.latencies.sort((a, b) => a - b);
  const q = (x) => (all.length ? all[Math.floor(all.length * x)] : 0);
  console.log('\n--- result ---');
  console.log(`peak concurrent sockets : ${stats.peakConnected}`);
  console.log(`joined rooms            : ${stats.joined}`);
  console.log(`failed to connect       : ${stats.connectFailed}`);
  console.log(`dropped mid-test        : ${stats.disconnected}`);
  console.log(`actions sent            : ${stats.actionsSent}`);
  console.log(`states received         : ${stats.statesReceived}`);
  console.log(`action -> state latency : p50 ${q(0.5)}ms  p95 ${q(0.95)}ms  p99 ${q(0.99)}ms`);
  console.log(`rate limited (429)      : ${stats.rateLimited}`);
  if (stats.errors.size) {
    console.log('\nerrors:');
    for (const [k, n] of [...stats.errors].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`  ${String(n).padStart(5)} x ${k}`);
    }
  }
  console.log('\nWhat good looks like: dropped ~0, 429s 0, p95 under ~500ms.');
  console.log('Sustained p95 above a second, or sockets dropping, is the ceiling.');

  for (const s of sockets) s.close();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
