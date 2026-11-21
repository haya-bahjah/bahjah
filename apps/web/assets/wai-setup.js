// مين أنا؟ -- the session setup (wireframe 01, "New session"): pack, clue
// reveal, seconds per clue, identities, the points ladder and "Host controls
// on TV". Opened as a sheet from the TV's host bar or the host panel; every
// change saves at once (PATCH /api/games/who-am-i/rooms/:code/config).
window.WaiSetup = (function () {
  const UI = window.WaiUI;
  const esc = UI.esc;
  let code = '';
  let state = { config: null, packs: [] };
  let open = false;
  let busy = false;
  const listeners = new Set();

  // session.js declares BahjahSession at the top level, not on window.
  const token = () => (typeof BahjahSession !== 'undefined' && (BahjahSession.getToken() || BahjahSession.getGuestToken())) || '';
  async function call(method, body) {
    const res = await fetch(`/api/games/who-am-i/rooms/${encodeURIComponent(code)}/config`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { UI.toast(UI.errorText(data.error), 'wrong'); return null; }
    state = { config: data.config, packs: data.packs || state.packs };
    listeners.forEach((fn) => fn(state.config));
    return data;
  }

  function init(roomCode) {
    if (code === roomCode && state.config) return Promise.resolve(state.config);
    code = roomCode;
    return call('GET').then(() => state.config);
  }
  const refresh = () => (code ? call('GET').then(() => state.config) : Promise.resolve(null));
  const config = () => state.config;
  const onChange = (fn) => listeners.add(fn);

  // "Timed · 15s", "5 identities" -- the lobby's settings badges.
  function badges() {
    const t = UI.t();
    const c = state.config;
    if (!c) return '';
    const mode = c.reveal === 'timed' ? `${t.timed} · ${t.sShort(c.seconds)}` : t.hostClicks;
    return `${UI.badge(mode)}${UI.badge(t.identitiesN(c.count))}${UI.badge(t.packs[c.pack] || c.pack)}${c.hostOnTv ? UI.badge(t.hostOnTv) : ''}`;
  }

  function html() {
    const t = UI.t();
    const c = state.config || { pack: 'mixed', reveal: 'timed', seconds: 15, count: 5, hostOnTv: false };
    const opts = (state.packs.length ? state.packs : [{ id: c.pack, size: 0 }])
      .map((p) => `<option value="${esc(p.id)}"${p.id === c.pack ? ' selected' : ''}>${esc(t.packs[p.id] || p.id)} (${UI.d(p.size)})</option>`).join('');
    return `<div role="dialog" aria-modal="true" aria-label="${esc(t.newSession)}">
      <div class="w-row"><h2 class="w-h1" style="font-size:26px">${esc(t.newSession)}</h2>${UI.emblem(36)}</div>
      <label class="w-field"><span class="w-label">${esc(t.pack)}</span><select class="w-input" data-setup="pack">${opts}</select></label>
      <div class="w-field"><span class="w-label">${esc(t.clueReveal)}</span>
        <div class="w-seg" role="radiogroup"><button type="button" role="radio" aria-checked="${c.reveal === 'timed'}" class="${c.reveal === 'timed' ? 'is-on' : ''}" data-setup-reveal="timed">${UI.icon('timer', 15)}${esc(t.timed)}</button><button type="button" role="radio" aria-checked="${c.reveal === 'host'}" class="${c.reveal === 'host' ? 'is-on' : ''}" data-setup-reveal="host">${UI.icon('pointer', 15)}${esc(t.hostClicks)}</button></div></div>
      ${c.reveal === 'timed' ? `<div class="w-row"><span class="w-label">${esc(t.perClue)}</span><span class="w-stepper"><button type="button" data-setup-step="seconds:-5" aria-label="-">${UI.icon('minus', 16)}</button><output>${UI.d(c.seconds)}<small>${UI.isAr() ? 'ث' : 's'}</small></output><button type="button" data-setup-step="seconds:5" aria-label="+">${UI.icon('plus', 16)}</button></span></div>` : ''}
      <div class="w-row"><span class="w-label">${esc(t.identities)}</span><span class="w-stepper"><button type="button" data-setup-step="count:-1" aria-label="-">${UI.icon('minus', 16)}</button><output>${UI.d(c.count)}</output><button type="button" data-setup-step="count:1" aria-label="+">${UI.icon('plus', 16)}</button></span></div>
      <div class="w-field"><span class="w-label">${esc(t.points)}</span>${UI.ladder()}</div>
      <button type="button" class="w-switchrow" role="switch" aria-checked="${c.hostOnTv}" data-setup-switch><span>${esc(t.hostOnTv)}<br><span class="w-small w-muted">${esc(t.hostOnTvSub)}</span></span><span class="w-switch${c.hostOnTv ? ' is-on' : ''}"></span></button>
      <button type="button" class="w-btn w-btn--lg w-btn--block" data-setup-close>${UI.icon('check', 18)}${esc(t.save)}</button>
    </div>`;
  }

  let mount = null;
  function paint() {
    if (!open) { if (mount) mount.remove(); mount = null; return; }
    if (!mount) {
      mount = document.createElement('div');
      mount.className = 'w-sheet';
      document.body.appendChild(mount);
      mount.addEventListener('click', onClick);
      mount.addEventListener('change', onChange_);
    }
    mount.innerHTML = html();
  }
  function show() { open = true; paint(); }
  function hide() { open = false; paint(); }

  async function patch(body) {
    if (busy) return;
    busy = true;
    try { await call('PATCH', body); } finally { busy = false; }
    paint();
  }
  function onChange_(e) {
    const sel = e.target.closest('[data-setup="pack"]');
    if (sel) patch({ pack: sel.value });
  }
  function onClick(e) {
    if (e.target === mount || e.target.closest('[data-setup-close]')) { hide(); return; }
    const c = state.config;
    if (!c) return;
    const r = e.target.closest('[data-setup-reveal]');
    if (r) { patch({ reveal: r.dataset.setupReveal }); return; }
    const s = e.target.closest('[data-setup-step]');
    if (s) {
      const [what, by] = s.dataset.setupStep.split(':');
      if (what === 'seconds') patch({ seconds: Math.max(10, Math.min(30, c.seconds + Number(by))) });
      else patch({ count: Math.max(1, Math.min(10, c.count + Number(by))) });
      return;
    }
    if (e.target.closest('[data-setup-switch]')) patch({ hostOnTv: !c.hostOnTv });
  }
  document.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') hide(); });
  document.addEventListener('bahjah:lang-change', () => { if (open) paint(); });

  return { init, refresh, config, onChange, badges, show, hide, isOpen: () => open };
})();
