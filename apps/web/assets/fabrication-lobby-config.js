// The host's settings panel on fabrication-lobby.html: how many rounds, how
// hard, and which categories. Deliberately small -- the spec asks for the
// setup to stay light so a host can start quickly, so this is three controls
// and nothing else.
//
// Everyone else in the room sees the same settings read-only, so a player can
// tell what they are about to play without being able to change it.
(function () {
  const panel = document.getElementById('fab-config-panel');
  const readonly = document.getElementById('fab-config-readonly');
  if (!panel || !readonly) return;

  const LANG = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const t = (en, ar) => (LANG() === 'ar' ? ar : en);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ROUND_CHOICES = [3, 4, 5, 6, 7, 8];
  const DIFFICULTIES = [
    { id: 'any', en: 'Any', ar: 'الكل' },
    { id: 'easy', en: 'Easy', ar: 'سهل' },
    { id: 'medium', en: 'Medium', ar: 'متوسط' },
    { id: 'hard', en: 'Hard', ar: 'صعب' },
  ];

  let code = null;
  let isHost = false;
  let config = null;
  let categories = [];
  let poolSize = 0;
  let loaded = false;

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    code = detail.code;
    isHost = Boolean(detail.isHost);
    // Only in the lobby: once the game starts the console takes the screen.
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
      const [cfgRes, catRes] = await Promise.all([
        fetch(`/api/games/fabrication/rooms/${encodeURIComponent(code)}/config`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/games/fabrication/categories', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cfgRes.ok) {
        const data = await cfgRes.json();
        config = data.config;
        poolSize = data.poolSize || 0;
      }
      if (catRes.ok) {
        const data = await catRes.json();
        categories = data.categories || [];
      }
      paint();
    } catch {
      // A settings panel that cannot load is not worth blocking a game over:
      // the server falls back to sensible defaults if nothing is ever saved.
    }
  }

  async function save(next) {
    const token = BahjahSession.getActiveToken();
    if (!token || !code) return;
    config = next;
    paint();
    try {
      const res = await fetch(`/api/games/fabrication/rooms/${encodeURIComponent(code)}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        const data = await res.json();
        config = data.config;
        poolSize = data.poolSize || 0;
        paint();
      }
    } catch {
      // Same reasoning as above -- the last saved config still stands.
    }
  }

  function paint() {
    if (!config) return;
    if (!isHost) {
      panel.style.display = 'none';
      readonly.style.display = 'block';
      const diff = DIFFICULTIES.find((d) => d.id === config.difficulty);
      readonly.innerHTML = `
        <div class="cfg-section-label">${t('This game', 'هذه اللعبة')}</div>
        <div>${esc(t(`${config.rounds} rounds`, `${config.rounds} جولات`))} · ${esc(diff ? (LANG() === 'ar' ? diff.ar : diff.en) : '')}</div>`;
      return;
    }

    readonly.style.display = 'none';
    panel.style.display = 'block';
    const picked = config.categories || [];
    panel.innerHTML = `
      <div class="cfg-section-label">${t('Rounds', 'عدد الجولات')}</div>
      <div class="cfg-row" id="fab-rounds">
        ${ROUND_CHOICES.map(
          (n) => `<button type="button" class="cfg-chip ${config.rounds === n ? 'active' : ''}" data-rounds="${n}">${n}</button>`
        ).join('')}
      </div>

      <div class="cfg-section-label">${t('Difficulty', 'الصعوبة')}</div>
      <div class="cfg-row" id="fab-difficulty">
        ${DIFFICULTIES.map(
          (d) =>
            `<button type="button" class="cfg-chip ${config.difficulty === d.id ? 'active' : ''}" data-difficulty="${d.id}">${esc(
              LANG() === 'ar' ? d.ar : d.en
            )}</button>`
        ).join('')}
      </div>

      <div class="cfg-section-label">${t('Categories', 'التصنيفات')}</div>
      <div class="cfg-row" id="fab-categories">
        ${categories
          .map(
            (c) =>
              `<button type="button" class="cfg-chip ${picked.includes(c.name) ? 'active' : ''}" data-category="${esc(c.name)}">${esc(
                c.name
              )}</button>`
          )
          .join('')}
      </div>
      <p class="cfg-pool">${esc(t(`${poolSize} questions available`, `${poolSize} سؤالاً متاحًا`))}</p>`;

    panel.querySelectorAll('[data-rounds]').forEach((btn) =>
      btn.addEventListener('click', () => save({ ...config, rounds: Number(btn.dataset.rounds) }))
    );
    panel.querySelectorAll('[data-difficulty]').forEach((btn) =>
      btn.addEventListener('click', () => save({ ...config, difficulty: btn.dataset.difficulty }))
    );
    panel.querySelectorAll('[data-category]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const name = btn.dataset.category;
        const current = config.categories || [];
        const next = current.includes(name) ? current.filter((c) => c !== name) : [...current, name];
        // Turning every category off would leave nothing to ask. The server
        // falls back to the whole bank in that case, so the panel says so by
        // simply refusing the last one rather than showing an empty game.
        if (next.length === 0) return;
        save({ ...config, categories: next });
      })
    );
  }
})();
