// The host's settings on insan-hayawan-jamad-lobby.html (wireframe 5d·03):
// how many rounds, how long to write, and which five categories the board is
// ruled with. Drawn into the settings sheet for the host, and summarised on a
// line or two of the lobby for everyone else.
//
// Exactly five categories, always. The board is five columns wide and a phone
// fits five boxes without scrolling during a timed round, so picking a sixth
// swaps one out rather than adding to it.
(function () {
  const panel = document.getElementById('ihj-config-panel');
  const sheet = document.getElementById('ihj-settings');
  if (!panel || !sheet) return;
  const Ink = window.IhjInk;

  const MIN_ROUNDS = 3;
  const MAX_ROUNDS = 8;
  const TIMER_CHOICES = [45, 60, 90];
  const CATEGORY_COUNT = 5;

  let code = null;
  let isHost = false;
  let config = null;
  let picked = [];
  let all = [];
  let loaded = false;
  // Only marks drawn by the tap just made write themselves in; everything
  // else on the sheet is redrawn already finished.
  let freshMark = null;

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    code = detail.code;
    isHost = Boolean(detail.isHost);
    if (!detail.room || detail.room.status !== 'lobby') {
      close();
      return;
    }
    if (!loaded && code) {
      loaded = true;
      load();
    } else {
      paint();
    }
  });

  document.addEventListener('bahjah:lang-change', paint);

  document.addEventListener('click', (e) => {
    if (e.target.closest('.ihj-open-settings')) open();
    else if (e.target.closest('#ihj-settings-done') || e.target === sheet) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) close();
  });

  function open() {
    if (!isHost) return;
    freshMark = null;
    paint();
    sheet.hidden = false;
  }

  function close() {
    sheet.hidden = true;
  }

  async function load() {
    const token = BahjahSession.getActiveToken();
    if (!token) return;
    try {
      const [cfgRes, listRes] = await Promise.all([
        fetch(`/api/games/insan-hayawan-jamad/rooms/${encodeURIComponent(code)}/config`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/games/insan-hayawan-jamad/categories', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cfgRes.ok) {
        const data = await cfgRes.json();
        config = data.config;
        // The server answers with the five that will actually be played, so
        // the sheet shows a real selection even for a room never configured.
        picked = (data.categories || []).map((c) => c.id);
      }
      if (listRes.ok) {
        const data = await listRes.json();
        all = data.categories || [];
      }
      paint();
    } catch {
      // A panel that cannot load is not worth blocking a game over.
    }
  }

  async function save(next, nextPicked) {
    const token = BahjahSession.getActiveToken();
    if (!token || !code) return;
    config = next;
    picked = nextPicked;
    paint();
    try {
      const res = await fetch(`/api/games/insan-hayawan-jamad/rooms/${encodeURIComponent(code)}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...next, categoryIds: nextPicked }),
      });
      if (res.ok) {
        const data = await res.json();
        config = data.config;
        picked = (data.categories || []).map((c) => c.id);
        paint();
      }
    } catch {
      // The last saved config still stands.
    }
  }

  function summary() {
    const t = Ink.t;
    const rounds = t(`${config.rounds} rounds`, `${Ink.num(config.rounds)} جولات`);
    const secs = t(`${config.answerSeconds} seconds a round`, `${Ink.num(config.answerSeconds)} ثانية للجولة`);
    const names = picked.map((id) => (all.find((c) => c.id === id) || {}).name).filter(Boolean);
    return { line: `${rounds} · ${secs}`, cats: names.join('، ') };
  }

  function paintSummary() {
    const { line, cats } = summary();
    const phone = document.getElementById('phone-config');
    const phoneCats = document.getElementById('phone-config-cats');
    const tv = document.getElementById('tv-config');
    if (phone) phone.textContent = line;
    if (phoneCats) {
      phoneCats.textContent = cats;
      phoneCats.setAttribute('dir', 'rtl');
    }
    if (tv) tv.textContent = cats ? `${line} · ${cats}` : line;
  }

  function paint() {
    if (!config) return;
    paintSummary();
    if (!isHost) return;
    const t = Ink.t;
    const fresh = (key) => ({ still: freshMark !== key });

    panel.innerHTML = `
      <div class="ihj-row ihj-row--2 ihj-title" id="ihj-settings-title">${t('Settings', 'الإعدادات')}</div>
      <div class="ihj-row ihj-row--split" style="font-size:16px;">
        <span>${t('Rounds', 'عدد الجولات')}</span>
        <span dir="ltr" style="display:flex; gap:6px; align-items:baseline; font-weight:700; font-size:18px;">
          <button type="button" class="ihj-tap" data-rounds="${config.rounds - 1}" ${config.rounds <= MIN_ROUNDS ? 'disabled' : ''} aria-label="${t('Fewer rounds', 'جولات أقل')}" style="font-weight:700; font-size:18px;">−</button>
          <span>${Ink.num(config.rounds)}</span>
          <button type="button" class="ihj-tap" data-rounds="${config.rounds + 1}" ${config.rounds >= MAX_ROUNDS ? 'disabled' : ''} aria-label="${t('More rounds', 'جولات أكثر')}" style="font-weight:700; font-size:18px;">+</button>
        </span>
      </div>
      <div class="ihj-row ihj-row--split" style="font-size:16px; padding-bottom:3px;">
        <span style="padding-bottom:3px;">${t('Time per round', 'الوقت لكل جولة')}</span>
        <span dir="ltr" style="display:flex; gap:4px; align-items:center; font-size:15px;">
          ${TIMER_CHOICES.map((n) => `
            <button type="button" class="ihj-tap" data-timer="${n}" style="position:relative; width:40px; height:32px; font-size:15px; font-weight:${config.answerSeconds === n ? 700 : 400};" aria-pressed="${config.answerSeconds === n}">
              ${Ink.num(n)}${config.answerSeconds === n ? Ink.ring(fresh('timer')) : ''}
            </button>`).join('')}
        </span>
      </div>
      <div class="ihj-row ihj-hand" style="font-size:20px;">${t('Categories', 'الفئات')}</div>
      <div style="display:flex; flex-wrap:wrap; column-gap:18px;" dir="rtl">
        ${all.map((c) => {
          const on = picked.includes(c.id);
          return `
            <button type="button" class="ihj-row" data-category="${Ink.esc(c.id)}" aria-pressed="${on}"
                    style="background:none; border:none; padding:0 0 6px; gap:5px; font-size:17px; font-weight:${on ? 500 : 400}; opacity:${on ? 1 : .55};">
              <span style="color:var(--ihj-pen); width:12px;">${on ? '✓' : ''}</span><span>${Ink.esc(c.name)}</span>
            </button>`;
        }).join('')}
      </div>
      <div class="ihj-row ihj-small ${picked.length === CATEGORY_COUNT ? '' : 'ihj-red'}">
        ${t(`${picked.length} of 5 — tap one to swap it`, `${Ink.num(picked.length)} من ٥ — اضغط على فئة لاستبدالها`)}
      </div>`;

    panel.querySelectorAll('[data-rounds]').forEach((btn) =>
      btn.addEventListener('click', () => save({ ...config, rounds: Number(btn.dataset.rounds) }, picked))
    );
    panel.querySelectorAll('[data-timer]').forEach((btn) =>
      btn.addEventListener('click', () => {
        freshMark = 'timer';
        save({ ...config, answerSeconds: Number(btn.dataset.timer) }, picked);
      })
    );
    panel.querySelectorAll('[data-category]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.category;
        if (picked.includes(id)) {
          // Deselecting leaves four, which is not a board. Held locally until
          // a fifth is chosen rather than sent to the server as an invalid
          // selection.
          picked = picked.filter((c) => c !== id);
          paint();
          return;
        }
        const next = [...picked, id];
        if (next.length > CATEGORY_COUNT) {
          // Already full: the new pick replaces the one chosen longest ago,
          // so a host can keep tapping and always end up with five.
          next.shift();
        }
        if (next.length === CATEGORY_COUNT) {
          save(config, next);
        } else {
          picked = next;
          paint();
        }
      })
    );
  }
})();
