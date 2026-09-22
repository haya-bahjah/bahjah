// The host's settings on insan-hayawan-jamad-lobby.html: how many rounds, how
// long to write, and which five categories the board is ruled with.
//
// Exactly five, always. The board is five columns wide and a phone fits five
// boxes without scrolling during a timed round, so picking a sixth swaps one
// out rather than adding to it -- which is also why there is no proposal flow
// here: the host chooses from a list and the game starts.
(function () {
  const panel = document.getElementById('ihj-config-panel');
  const readonly = document.getElementById('ihj-config-readonly');
  if (!panel || !readonly) return;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arNum = (n) => Number(n || 0).toLocaleString('ar-EG');

  const ROUND_CHOICES = [3, 4, 5, 6, 7, 8];
  const TIMER_CHOICES = [45, 60, 90];
  const CATEGORY_COUNT = 5;

  let code = null;
  let isHost = false;
  let config = null;
  let picked = [];
  let all = [];
  let loaded = false;

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    code = detail.code;
    isHost = Boolean(detail.isHost);
    if (!detail.room || detail.room.status !== 'lobby') {
      panel.style.display = 'none';
      readonly.style.display = 'none';
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
        // the panel shows a real selection even for a room never configured.
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

  function paint() {
    if (!config) return;
    const names = picked.map((id) => (all.find((c) => c.id === id) || {}).name).filter(Boolean);

    if (!isHost) {
      panel.style.display = 'none';
      readonly.style.display = 'block';
      readonly.innerHTML = `
        <div class="cfg-section-label">هذه اللعبة</div>
        <div dir="rtl">${arNum(config.rounds)} جولات · ${arNum(config.answerSeconds)} ثانية</div>
        <div dir="rtl" style="margin-top:6px;">${esc(names.join(' · '))}</div>`;
      return;
    }

    readonly.style.display = 'none';
    panel.style.display = 'block';
    panel.innerHTML = `
      <div class="cfg-section-label">عدد الجولات</div>
      <div class="cfg-row" dir="rtl">
        ${ROUND_CHOICES.map((n) => `<button type="button" class="cfg-chip ${config.rounds === n ? 'active' : ''}" data-rounds="${n}">${arNum(n)}</button>`).join('')}
      </div>

      <div class="cfg-section-label">وقت الكتابة</div>
      <div class="cfg-row" dir="rtl">
        ${TIMER_CHOICES.map((n) => `<button type="button" class="cfg-chip ${config.answerSeconds === n ? 'active' : ''}" data-timer="${n}">${arNum(n)} ث</button>`).join('')}
      </div>

      <div class="cfg-section-label">التصنيفات (اختر ٥)</div>
      <div class="cfg-row" dir="rtl">
        ${all
          .map(
            (c) => `<button type="button" class="cfg-chip ${picked.includes(c.id) ? 'active' : ''}" data-category="${esc(c.id)}">${esc(c.name)}</button>`
          )
          .join('')}
      </div>
      <p class="cfg-pool" dir="rtl">${arNum(picked.length)} من ٥ — اضغط على تصنيف مختار لاستبداله</p>`;

    panel.querySelectorAll('[data-rounds]').forEach((btn) =>
      btn.addEventListener('click', () => save({ ...config, rounds: Number(btn.dataset.rounds) }, picked))
    );
    panel.querySelectorAll('[data-timer]').forEach((btn) =>
      btn.addEventListener('click', () => save({ ...config, answerSeconds: Number(btn.dataset.timer) }, picked))
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
