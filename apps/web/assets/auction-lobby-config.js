// The host's settings on auction-lobby.html, as the design's segmented
// controls: Rounds 3 / 5 / 7, Answer timer 45 / 60 / 90s, and which language
// the categories are in. The defaults (5 rounds, 60s) are already selected, so
// a host can open the bidding in two taps. Drawn into every [data-config] on
// the page -- the phone setup sheet and the television lobby -- and the
// one-line summary into [data-summary].
(function () {
  const U = window.AucUI;
  const { t, esc, num } = U;

  const ROUND_CHOICES = [3, 5, 7];
  const TIMER_CHOICES = [45, 60, 90];

  let code = null;
  let isHost = false;
  let inLobby = false;
  let config = null;
  let loaded = false;

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    code = detail.code;
    isHost = Boolean(detail.isHost);
    inLobby = Boolean(detail.room && detail.room.status === 'lobby');
    if (inLobby && !loaded && code && isHost) {
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
      const res = await fetch(`/api/games/auction/rooms/${encodeURIComponent(code)}/config`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      config = data.config;
      // A room nobody has set up yet plays in the host's own language.
      if (!config.language) return save({ ...config, language: U.lang() });
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
        config = (await res.json()).config;
        paint();
      }
    } catch {
      // The last saved config still stands.
    }
  }

  function seg(label, key, choices, fmt) {
    return `
      <div class="auc-group">
        <span class="auc-label">${esc(label)}</span>
        <div class="auc-seg" role="group" aria-label="${esc(label)}">
          ${choices.map((v) => `<button type="button" class="${config[key] === v ? 'is-on' : ''}" aria-pressed="${config[key] === v}" data-set="${key}" data-value="${v}">${esc(fmt(v))}</button>`).join('')}
        </div>
      </div>`;
  }

  function summary() {
    if (!config) return '';
    return t(
      `${config.rounds} lots · ${config.answerSeconds}s · ${config.language === 'ar' ? 'Arabic' : 'English'} categories`,
      `${num(config.rounds)} جولات · ${num(config.answerSeconds)} ث · فئات ${config.language === 'ar' ? 'عربية' : 'إنجليزية'}`
    );
  }

  function paint() {
    const panels = document.querySelectorAll('[data-config]');
    document.querySelectorAll('[data-summary]').forEach((el) => { el.textContent = inLobby && isHost ? summary() : ''; });
    if (!config || !isHost || !inLobby) {
      panels.forEach((p) => { p.innerHTML = ''; });
      return;
    }
    const html = [
      seg(t('Rounds', 'الجولات'), 'rounds', ROUND_CHOICES, (v) => num(v)),
      seg(t('Answer timer', 'وقت الإجابة'), 'answerSeconds', TIMER_CHOICES, (v) => t(`${v}s`, `${num(v)} ث`)),
      seg(t('Categories', 'لغة الفئات'), 'language', ['ar', 'en'], (v) => (v === 'ar' ? t('Arabic', 'العربية') : t('English', 'الإنجليزية'))),
    ].join('');
    panels.forEach((p) => {
      p.innerHTML = html;
      p.style.display = p.hasAttribute('data-compact') ? '' : 'flex';
      if (!p.hasAttribute('data-compact')) {
        p.style.flexDirection = 'column';
        p.style.gap = '16px';
      }
    });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-config] [data-set]');
    if (!b || !config) return;
    const key = b.dataset.set;
    const value = key === 'language' ? b.dataset.value : Number(b.dataset.value);
    if (config[key] === value) return;
    save({ ...config, [key]: value });
  });
})();
