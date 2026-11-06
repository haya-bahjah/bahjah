// Drives the deployed staging server the way a player's phone does, and
// checks the realtime behaviour is the fixed one. Run by
// .github/workflows/staging-smoke.yml, which has the network this session
// does not.
//
// Each check names the fault it is guarding against, so a failure here says
// what regressed rather than just that something did.
import { io as ioc } from 'socket.io-client';

const BASE = process.env.BASE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, pass, detail) {
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        ${detail}` : ''}`);
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 300) };
}

// Opens a socket the way apps/web/assets/room-socket.js does, and resolves
// with everything the checks need to look at.
function connect(token, { code, timeoutMs = 25000 } = {}) {
  return new Promise((resolve) => {
    const events = [];
    const socket = ioc(BASE, {
      auth: (cb) => cb({ token }),
      transports: ['websocket', 'polling'],
      tryAllTransports: true,
    });
    let settled = false;
    const finish = (extra) => {
      if (settled) return;
      settled = true;
      resolve({ socket, events, ...extra });
    };
    socket.on('connect', () => {
      events.push('connect');
      if (code) socket.emit('room:join', { code });
      else finish({ outcome: 'connected' });
    });
    socket.on('room:joined', () => { events.push('room:joined'); finish({ outcome: 'joined' }); });
    socket.on('room:update', () => events.push('room:update'));
    socket.on('room:error', (e) => events.push(`room:error:${e?.code}`));
    socket.on('connect_error', (err) => {
      events.push(`connect_error:${err?.message}`);
      finish({ outcome: 'refused', refusalCode: err?.data?.code ?? null });
    });
    setTimeout(() => finish({ outcome: 'timeout' }), timeoutMs);
  });
}

const stamp = Date.now();

// ---------------------------------------------------------------- set-up
const signup = await api('/api/auth/signup', {
  method: 'POST',
  body: {
    fullName: 'Staging Smoke',
    email: `staging-smoke+${stamp}@bahjah.com`,
    countryCode: '+966',
    phone: '500000000',
    dob: '1990-01-01',
    password: 'smoke-test-password',
    marketingOptIn: false,
  },
});
if (!signup.ok) {
  console.log(`FAIL  could not create a test account (${signup.status})\n        ${signup.text}`);
  process.exit(1);
}
const hostToken = signup.json.token;

const created = await api('/api/rooms', {
  method: 'POST',
  token: hostToken,
  body: { gameType: 'trivia', displayMode: 'tv' },
});
if (!created.ok) {
  console.log(`FAIL  could not create a room (${created.status})\n        ${created.text}`);
  process.exit(1);
}
const code = created.json.room.code;
console.log(`room ${code} created\n`);

const guest = await api(`/api/rooms/${code}/guest-join`, {
  method: 'POST',
  body: { nickname: 'Smoke', avatar: null },
});
if (!guest.ok) {
  console.log(`FAIL  guest could not join (${guest.status})\n        ${guest.text}`);
  process.exit(1);
}
const guestToken = guest.json.token;

// ---------------------------------------------------------------- checks

// The join confirmation is new. Its presence is also the clearest proof the
// deploy actually carries the fix, since the old server never sent it.
const a = await connect(guestToken, { code });
check('a join is confirmed with room:joined (was: a lost join froze the page silently)',
  a.outcome === 'joined', `outcome=${a.outcome} events=${JSON.stringify(a.events)}`);

check('the connection is a websocket, not an HTTP long-polling handshake',
  a.socket.io?.engine?.transport?.name === 'websocket',
  `transport=${a.socket.io?.engine?.transport?.name}`);

// A blip: kill the transport underneath and see it come back and re-join.
if (a.outcome === 'joined') {
  const after = [];
  a.socket.on('room:joined', () => after.push('room:joined'));
  a.socket.on('connect', () => after.push('connect'));
  a.socket.io.engine.close();
  for (let i = 0; i < 40 && !after.includes('room:joined'); i += 1) await sleep(500);
  check('a dropped socket reconnects and re-joins the room by itself',
    after.includes('room:joined'), `events after the drop=${JSON.stringify(after)}`);
}
a.socket?.close();

// The typed refusal is what lets a client tell "replace the token and retry"
// from "this will never work". The old server sent a bare error with no code.
const bad = await connect('not-a-real-token', { code, timeoutMs: 15000 });
check('a refused handshake says WHY, on err.data.code (was: an untyped error the client could not act on)',
  bad.outcome === 'refused' && bad.refusalCode === 'UNAUTHENTICATED',
  `outcome=${bad.outcome} code=${bad.refusalCode} events=${JSON.stringify(bad.events)}`);
bad.socket?.close();

// A valid token with no room still has to connect: the host console opens a
// socket before it has joined anything.
const plain = await connect(hostToken, { timeoutMs: 15000 });
check('an account token connects cleanly',
  plain.outcome === 'connected', `outcome=${plain.outcome} events=${JSON.stringify(plain.events)}`);
plain.socket?.close();

console.log(`\n${failures ? `${failures} check(s) failed` : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
