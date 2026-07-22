// Host-only timers/mafia-count/tie-rule/role-toggle config panel for the
// Mafia lobby. Talks to assets/lobby-room.js only through the generic
// 'bahjah:lobby-update' event it dispatches -- this file owns everything
// mafia-specific so lobby-room.js stays reusable by trivia/knows-you-best.
(function () {
  const LANG_ATTR = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const panel = document.getElementById('mafia-config-panel');
  const readonly = document.getElementById('mafia-config-readonly');
  if (!panel) return; // not the mafia lobby

  const TIMER_STEP = 15;
  const TIMER_RANGES = {
    daySeconds: { min: 30, max: 300 },
    nightSeconds: { min: 30, max: 300 },
    voteSeconds: { min: 15, max: 180 },
  };
  const MAFIA_COUNT_MAX = 7;

  let code = null;
  let isHost = false;
  let memberCount = 0;
  let config = null; // { daySeconds, nightSeconds, voteSeconds, mafiaCountOverride, tieRule, revealEliminatedRole, includeDoctor, includeDetective, doctorCanProtectSelf }
  let saveError = '';
  let initialized = false;
  // Timers already default to sensible values (2:00 day, 2:00 night, 1:00
  // vote) -- the steppers stay collapsed behind "Edit Game Timers" so the
  // panel doesn't open on three timer rows before anything else, and only
  // hosts who actually want non-default timing need to open it.
  let timersExpanded = false;

  function authHeaders(json) {
    const token = BahjahSession.getToken();
    const headers = { Authorization: `Bearer ${token}` };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  function t(en, ar) {
    return LANG_ATTR() === 'ar' ? ar : en;
  }

  function formatSeconds(total) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    code = detail.code;
    isHost = Boolean(detail.isHost);
    memberCount = (detail.room && detail.room.members && detail.room.members.length) || 0;
    if (!initialized && code) {
      initialized = true;
      bootstrap();
    } else {
      render();
    }
  });

  document.addEventListener('bahjah:lang-change', () => {
    if (initialized) render();
  });

  async function bootstrap() {
    try {
      const res = await fetch(`/api/games/mafia/rooms/${encodeURIComponent(code)}/config`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        config = data.config;
      }
    } catch {
      // Network hiccup -- render() below falls back to a sane default so
      // the panel is still usable; saving will re-validate against the server.
    }
    if (!config) {
      config = {
        daySeconds: 120,
        nightSeconds: 120,
        voteSeconds: 60,
        mafiaCountOverride: null,
        tieRule: 'none',
        revealEliminatedRole: true,
        includeDoctor: true,
        includeDetective: true,
        doctorCanProtectSelf: true,
      };
    }
    render();
  }

  async function saveConfig() {
    if (!isHost || !code || !config) return;
    saveError = '';
    try {
      const res = await fetch(`/api/games/mafia/rooms/${encodeURIComponent(code)}/config`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const data = await res.json();
        saveError = (data.error && data.error.message) || t('Could not save.', 'تعذّر الحفظ.');
      }
    } catch {
      saveError = t('Network error saving config.', 'خطأ في الشبكة أثناء الحفظ.');
    }
    render();
  }

  function adjustTimer(key, delta) {
    const range = TIMER_RANGES[key];
    const next = Math.max(range.min, Math.min(range.max, config[key] + delta));
    if (next === config[key]) return;
    config[key] = next;
    saveConfig();
  }

  function setMafiaCount(value) {
    config.mafiaCountOverride = value;
    saveConfig();
  }

  function setTieRule(rule) {
    if (rule === config.tieRule) return;
    config.tieRule = rule;
    saveConfig();
  }

  function toggle(key) {
    config[key] = !config[key];
    saveConfig();
  }

  function render() {
    if (!isHost) {
      panel.style.display = 'none';
      if (readonly && config) {
        readonly.style.display = 'block';
        const tieLabel = {
          none: t('no elimination on a tie', 'لا إقصاء عند التعادل'),
          revote: t('revote on a tie', 'إعادة تصويت عند التعادل'),
          random: t('random pick on a tie', 'اختيار عشوائي عند التعادل'),
        }[config.tieRule];
        const mafiaLabel = config.mafiaCountOverride == null ? t('automatic Mafia count', 'عدد المافيا تلقائي') : t(`${config.mafiaCountOverride} Mafia`, `${config.mafiaCountOverride} من المافيا`);
        readonly.textContent = t(
          `Host picked: ${formatSeconds(config.daySeconds)} day · ${formatSeconds(config.nightSeconds)} night · ${formatSeconds(config.voteSeconds)} vote · ${mafiaLabel} · ${tieLabel}`,
          `اختار المضيف: ${formatSeconds(config.daySeconds)} نهار · ${formatSeconds(config.nightSeconds)} ليل · ${formatSeconds(config.voteSeconds)} تصويت · ${mafiaLabel} · ${tieLabel}`
        );
      }
      return;
    }
    if (readonly) readonly.style.display = 'none';
    panel.style.display = 'block';
    if (!config) return;

    const timerRow = (key, label) => `
      <div class="cfg-section-label">${label}</div>
      <div class="cfg-rounds-row">
        <button type="button" class="cfg-rounds-btn" data-timer-minus="${key}" ${config[key] <= TIMER_RANGES[key].min ? 'disabled' : ''}>−</button>
        <span class="cfg-rounds-value cfg-rounds-value-time">${formatSeconds(config[key])}</span>
        <button type="button" class="cfg-rounds-btn" data-timer-plus="${key}" ${config[key] >= TIMER_RANGES[key].max ? 'disabled' : ''}>+</button>
      </div>
    `;

    const timersSection = `
      <div class="cfg-collapsible">
        <div class="cfg-collapsible-head">
          <div>
            <div class="cfg-section-label" style="margin-bottom:2px;">${t('Game timers', 'مؤقتات اللعبة')}</div>
            <p class="cfg-hint" style="margin:0;">${formatSeconds(config.daySeconds)} ${t('day', 'نهار')} · ${formatSeconds(config.nightSeconds)} ${t('night', 'ليل')} · ${formatSeconds(config.voteSeconds)} ${t('vote', 'تصويت')}</p>
          </div>
          <button type="button" class="cfg-collapse-toggle" id="cfg-timers-toggle" aria-expanded="${timersExpanded}">
            ${timersExpanded ? t('Hide', 'إخفاء') : t('Edit Game Timers', 'تعديل مؤقتات اللعبة')}
          </button>
        </div>
        ${
          timersExpanded
            ? `<div class="cfg-collapsible-body">
                ${timerRow('daySeconds', t('Day discussion timer', 'مؤقت نقاش النهار'))}
                ${timerRow('nightSeconds', t('Night timer', 'مؤقت الليل'))}
                ${timerRow('voteSeconds', t('Voting timer', 'مؤقت التصويت'))}
              </div>`
            : ''
        }
      </div>
    `;

    const mafiaCountSection = (() => {
      if (memberCount <= 4) {
        return `
          <div class="cfg-section-label">${t('Mafia count', 'عدد المافيا')}</div>
          <p class="cfg-hint">${t('Automatic (1 Mafia) until more than 4 players join.', 'تلقائي (مافيا واحد) حتى ينضم أكثر من ٤ لاعبين.')}</p>
        `;
      }
      const maxAllowed = Math.min(MAFIA_COUNT_MAX, Math.floor((memberCount - 1) / 2));
      const options = [null, ...Array.from({ length: maxAllowed }, (_, i) => i + 1)];
      const chips = options
        .map((n) => {
          const active = config.mafiaCountOverride === n;
          const label = n === null ? t('Auto', 'تلقائي') : String(n);
          return `<button type="button" class="cfg-cat-chip ${active ? 'active' : ''}" data-mafia-count="${n === null ? '' : n}">${label}</button>`;
        })
        .join('');
      return `
        <div class="cfg-section-label">${t('Mafia count', 'عدد المافيا')}</div>
        <div class="cfg-cat-grid">${chips}</div>
      `;
    })();

    const tieButtons = [
      ['none', t('No elimination', 'لا إقصاء')],
      ['revote', t('Revote', 'إعادة تصويت')],
      ['random', t('Random', 'عشوائي')],
    ]
      .map(([value, label]) => `<button type="button" class="cfg-diff-btn ${config.tieRule === value ? 'active' : ''}" data-tie-rule="${value}">${label}</button>`)
      .join('');

    panel.innerHTML = `
      ${timersSection}
      ${mafiaCountSection}
      <div class="cfg-section-label">${t('If the vote ties', 'إذا تعادل التصويت')}</div>
      <div class="cfg-diff-row">${tieButtons}</div>
      <label class="cfg-toggle-row">
        <input type="checkbox" id="cfg-reveal-role" ${config.revealEliminatedRole ? 'checked' : ''}>
        ${t("Reveal an eliminated player's role", 'كشف دور اللاعب المُقصى')}
      </label>
      <label class="cfg-toggle-row">
        <input type="checkbox" id="cfg-include-doctor" ${config.includeDoctor ? 'checked' : ''}>
        ${t('Include the Doctor role', 'تضمين دور الطبيب')}
      </label>
      <label class="cfg-toggle-row">
        <input type="checkbox" id="cfg-include-detective" ${config.includeDetective ? 'checked' : ''}>
        ${t('Include the Detective role', 'تضمين دور المحقق')}
      </label>
      <label class="cfg-toggle-row">
        <input type="checkbox" id="cfg-doctor-self" ${config.doctorCanProtectSelf ? 'checked' : ''}>
        ${t('Doctor can protect themselves', 'يمكن للطبيب حماية نفسه')}
      </label>
      ${saveError ? `<div class="cfg-error">${saveError}</div>` : ''}
    `;

    const timersToggleEl = document.getElementById('cfg-timers-toggle');
    if (timersToggleEl) {
      timersToggleEl.addEventListener('click', () => {
        timersExpanded = !timersExpanded;
        render();
      });
    }
    panel.querySelectorAll('[data-timer-minus]').forEach((btn) => {
      btn.addEventListener('click', () => adjustTimer(btn.dataset.timerMinus, -TIMER_STEP));
    });
    panel.querySelectorAll('[data-timer-plus]').forEach((btn) => {
      btn.addEventListener('click', () => adjustTimer(btn.dataset.timerPlus, TIMER_STEP));
    });
    panel.querySelectorAll('[data-mafia-count]').forEach((btn) => {
      btn.addEventListener('click', () => setMafiaCount(btn.dataset.mafiaCount === '' ? null : Number(btn.dataset.mafiaCount)));
    });
    panel.querySelectorAll('[data-tie-rule]').forEach((btn) => {
      btn.addEventListener('click', () => setTieRule(btn.dataset.tieRule));
    });
    const revealEl = document.getElementById('cfg-reveal-role');
    if (revealEl) revealEl.addEventListener('change', () => toggle('revealEliminatedRole'));
    const doctorEl = document.getElementById('cfg-include-doctor');
    if (doctorEl) doctorEl.addEventListener('change', () => toggle('includeDoctor'));
    const detectiveEl = document.getElementById('cfg-include-detective');
    if (detectiveEl) detectiveEl.addEventListener('change', () => toggle('includeDetective'));
    const doctorSelfEl = document.getElementById('cfg-doctor-self');
    if (doctorSelfEl) doctorSelfEl.addEventListener('change', () => toggle('doctorCanProtectSelf'));
  }
})();
