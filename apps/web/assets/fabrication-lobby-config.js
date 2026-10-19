// The host's settings on fabrication-lobby.html: how many rounds, how hard,
// and which categories. Deliberately small -- the spec asks for the setup to
// stay light so a host can start quickly, so this is three controls and
// nothing else.
//
// The page has a settings slot in each of its layouts (the television and the
// phone), marked .fab-config; every one of them is painted, and only the one
// in the layout on screen is visible. Everyone else in the room sees the same
// settings read-only in .fab-config-readonly, so a player can tell what they
// are about to play without being able to change it. .fab-estimate gets the
// "6 rounds · about 20 minutes" line.
(function () {
  const U = window.FabUI;
  const t = U.t;
  const esc = U.esc;

  const ROUND_CHOICES = [3, 4, 5, 6, 7, 8];
  const DIFFICULTIES = [
    { id: 'any', en: 'Any', ar: 'أي' },
    { id: 'easy', en: 'Easy', ar: 'سهل' },
    { id: 'medium', en: 'Medium', ar: 'متوسط' },
    { id: 'hard', en: 'Hard', ar: 'صعب' },
  ];
  // A round is 15s reading, up to 60s writing, up to 30s voting and the
  // reveal at the room's own pace -- a little over three minutes in practice.
  const MINUTES_PER_ROUND = 10 / 3;

  let code = null;
  let isHost = false;
  let inLobby = false;
  let config = null;
  let categories = [];
  let poolSize = 0;
  let loaded = false;

  const panels = () => document.querySelectorAll('.fab-config');
  const readonlys = () => document.querySelectorAll('.fab-config-readonly');

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    code = detail.code;
    isHost = Boolean(detail.isHost);
    // Only in the lobby: once the game starts the console takes the screen.
    inLobby = Boolean(detail.room && detail.room.status === 'lobby');
    if (inLobby && !loaded && code) {
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

  function difficultyLabel(id) {
    const d = DIFFICULTIES.find((x) => x.id === id);
    return d ? t(d.en, d.ar) : '';
  }

  function estimateLine() {
    if (!config) return '';
    const minutes = Math.round(config.rounds * MINUTES_PER_ROUND);
    return t(
      `${config.rounds} rounds · about ${minutes} minutes`,
      `${U.count(config.rounds, 'round')} · حوالي ${U.num(minutes)} دقيقة`
    );
  }

  function paint() {
    document.querySelectorAll('.fab-estimate').forEach((el) => {
      el.textContent = inLobby ? estimateLine() : '';
    });
    if (!inLobby || !config) {
      panels().forEach((p) => (p.hidden = true));
      readonlys().forEach((p) => (p.hidden = true));
      return;
    }

    if (!isHost) {
      panels().forEach((p) => (p.hidden = true));
      readonlys().forEach((p) => {
        p.hidden = false;
        p.innerHTML = `
          <span class="fab-kicker">${t('This game', 'هذه اللعبة')}</span>
          <span class="cfg-readonly-line">${esc(estimateLine())} · ${esc(difficultyLabel(config.difficulty))}</span>`;
      });
      return;
    }

    readonlys().forEach((p) => (p.hidden = true));
    const picked = config.categories || [];
    const html = `
      <div class="cfg-grid">
        <div class="cfg-group">
          <span class="fab-kicker">${t('Rounds', 'الجولات')}</span>
          <div class="cfg-row">
            ${ROUND_CHOICES.map(
              (n) => `<button type="button" class="cfg-chip cfg-chip--num ${config.rounds === n ? 'active' : ''}" data-rounds="${n}">${U.num(n)}</button>`
            ).join('')}
          </div>
        </div>
        <div class="cfg-group">
          <span class="fab-kicker">${t('Difficulty', 'الصعوبة')}</span>
          <div class="cfg-row">
            ${DIFFICULTIES.map(
              (d) => `<button type="button" class="cfg-chip ${config.difficulty === d.id ? 'active' : ''}" data-difficulty="${d.id}">${esc(t(d.en, d.ar))}</button>`
            ).join('')}
          </div>
        </div>
      </div>
      <div class="cfg-group">
        <span class="fab-kicker">${t('Categories', 'الفئات')}</span>
        <div class="cfg-row">
          ${categories
            .map(
              (c) =>
                `<button type="button" class="cfg-chip ${picked.includes(c.name) ? 'active' : ''}" data-category="${esc(c.name)}">${esc(U.category(c.name))}</button>`
            )
            .join('')}
        </div>
        <span class="cfg-pool">${esc(t(`${poolSize} questions to draw from`, `${U.count(poolSize, 'question')} للاختيار منها`))}</span>
      </div>`;
    panels().forEach((p) => {
      p.hidden = false;
      p.innerHTML = html;
    });
  }

  document.addEventListener('click', (e) => {
    if (!isHost || !config) return;
    const rounds = e.target.closest('.fab-config [data-rounds]');
    if (rounds) return save({ ...config, rounds: Number(rounds.dataset.rounds) });
    const diff = e.target.closest('.fab-config [data-difficulty]');
    if (diff) return save({ ...config, difficulty: diff.dataset.difficulty });
    const cat = e.target.closest('.fab-config [data-category]');
    if (cat) {
      const name = cat.dataset.category;
      const current = config.categories || [];
      const next = current.includes(name) ? current.filter((c) => c !== name) : [...current, name];
      // Turning every category off would leave nothing to ask. The server
      // falls back to the whole bank in that case, so the panel says so by
      // simply refusing the last one rather than showing an empty game.
      if (next.length === 0) return;
      save({ ...config, categories: next });
    }
  });
})();
