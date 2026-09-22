// The host's settings on auction-lobby.html: how many lots, how long the
// winner gets to answer, and which categories are in the sale. Kept light for
// the same reason فبركة's is -- the spec asks for a host to be able to start
// quickly rather than fill in a form.
(function () {
  const panel = document.getElementById('auc-config-panel');
  const readonly = document.getElementById('auc-config-readonly');
  if (!panel || !readonly) return;

  const LANG = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const t = (en, ar) => (LANG() === 'ar' ? ar : en);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ROUND_CHOICES = [3, 4, 5, 6, 7, 8];
  const TIMER_CHOICES = [45, 60, 90];

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
        fetch(`/api/games/auction/rooms/${encodeURIComponent(code)}/config`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/games/auction/categories', { headers: { Authorization: `Bearer ${token}` } }),
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
      // A panel that cannot load is not worth blocking a game over: the
      // server falls back to sensible defaults if nothing is saved.
    }
  }

  async function save(next) {
    const token = BahjahSession.getActiveToken();
    if (!token || !code) return;
    config = next;
    paint();
    try {
      const res = await fetch(`/api/games/auction/rooms/${encodeURIComponent(code)}/config`, {
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
      // The last saved config still stands.
    }
  }

  function categoryLabel(c) {
    return LANG() === 'ar' && c.nameAr ? c.nameAr : c.name;
  }

  function paint() {
    if (!config) return;
    if (!isHost) {
      panel.style.display = 'none';
      readonly.style.display = 'block';
      readonly.innerHTML = `
        <div class="cfg-section-label">${t('This game', 'هذه اللعبة')}</div>
        <div>${esc(t(`${config.rounds} lots · ${config.answerSeconds}s to answer`, `${config.rounds} قطع · ${config.answerSeconds} ثانية للإجابة`))}</div>`;
      return;
    }

    readonly.style.display = 'none';
    panel.style.display = 'block';
    // An empty selection means the whole list, which is also the default --
    // so every chip reads as picked until the host narrows it down.
    const picked = config.categoryIds || [];
    const allPicked = picked.length === 0;

    panel.innerHTML = `
      <div class="cfg-section-label">${t('Lots', 'عدد القطع')}</div>
      <div class="cfg-row">
        ${ROUND_CHOICES.map((n) => `<button type="button" class="cfg-chip ${config.rounds === n ? 'active' : ''}" data-rounds="${n}">${n}</button>`).join('')}
      </div>

      <div class="cfg-section-label">${t('Time to answer', 'وقت الإجابة')}</div>
      <div class="cfg-row">
        ${TIMER_CHOICES.map(
          (n) => `<button type="button" class="cfg-chip ${config.answerSeconds === n ? 'active' : ''}" data-timer="${n}">${n}s</button>`
        ).join('')}
      </div>

      <div class="cfg-section-label">${t('Categories', 'التصنيفات')}</div>
      <div class="cfg-row">
        ${categories
          .map(
            (c) =>
              `<button type="button" class="cfg-chip ${allPicked || picked.includes(c.id) ? 'active' : ''}" data-category="${esc(c.id)}">${esc(
                categoryLabel(c)
              )}</button>`
          )
          .join('')}
      </div>
      <p class="cfg-pool">${esc(t(`${poolSize} categories in the sale`, `${poolSize} تصنيفًا في المزاد`))}</p>`;

    panel.querySelectorAll('[data-rounds]').forEach((btn) =>
      btn.addEventListener('click', () => save({ ...config, rounds: Number(btn.dataset.rounds) }))
    );
    panel.querySelectorAll('[data-timer]').forEach((btn) =>
      btn.addEventListener('click', () => save({ ...config, answerSeconds: Number(btn.dataset.timer) }))
    );
    panel.querySelectorAll('[data-category]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.category;
        // The first tap on a full sale means "only this one", which is what
        // somebody narrowing a list of thirty actually wants.
        const current = allPicked ? categories.map((c) => c.id) : [...picked];
        const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
        // A sale needs at least as many categories as it has lots, or the
        // game runs out of things to auction.
        if (next.length < config.rounds) return;
        save({ ...config, categoryIds: next });
      })
    );
  }
})();
