// Host-only rounds/host-play/custom-question config panel for the Knows
// You Best lobby. Talks to assets/lobby-room.js only through the generic
// 'bahjah:lobby-update' event it dispatches -- this file owns everything
// KYB-specific so lobby-room.js stays reusable by trivia/mafia.
(function () {
  const LANG_ATTR = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const panel = document.getElementById('kyb-config-panel');
  const readonly = document.getElementById('kyb-config-readonly');
  if (!panel) return; // not the knows-you-best lobby

  const MIN_ROUNDS = 3;
  const MAX_ROUNDS = 10;

  const CATEGORY_LABELS_AR = {
    'Break the Ice': 'اكسروا الجليد',
    'Imagine If': 'تخيل لو',
    'Close Friends Only': 'للمقربين فقط',
  };

  let code = null;
  let isHost = false;
  let totalRounds = 5;
  let hostPlays = false;
  let useCustomQuestions = false;
  let bankCategories = []; // ['Break the Ice', 'Imagine If', 'Close Friends Only']
  let selectedCategories = new Set();
  let customPrompts = []; // [{text, textAr}]
  // Purely a save-time label -- when non-empty (and there are enough
  // prompts), the server auto-saves this set to the host's "My Games"
  // under this name. Never loaded back from the server since it isn't
  // stored on the room-scoped custom-prompt rows themselves.
  let customSetName = '';
  let setNameSaved = false;
  let saveError = '';
  let initialized = false;

  function authHeaders(json) {
    const token = BahjahSession.getToken();
    const headers = { Authorization: `Bearer ${token}` };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  function t(en, ar) {
    return LANG_ATTR() === 'ar' ? ar : en;
  }

  function categoryLabel(name) {
    return LANG_ATTR() === 'ar' && CATEGORY_LABELS_AR[name] ? CATEGORY_LABELS_AR[name] : name;
  }

  function escapeAttr(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    code = detail.code;
    isHost = Boolean(detail.isHost);
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
      const [catsRes, cfgRes] = await Promise.all([
        fetch('/api/games/knows-you-best/categories', { headers: authHeaders() }),
        fetch(`/api/games/knows-you-best/rooms/${encodeURIComponent(code)}/config`, { headers: authHeaders() }),
      ]);
      if (catsRes.ok) {
        const catsData = await catsRes.json();
        bankCategories = catsData.categories || [];
      }
      if (cfgRes.ok) {
        const data = await cfgRes.json();
        totalRounds = data.config.totalRounds;
        hostPlays = data.config.hostPlays;
        useCustomQuestions = data.config.useCustomQuestions;
        selectedCategories = new Set(data.config.categories);
        if (data.isHost && data.customPrompts) customPrompts = data.customPrompts;
      }
    } catch {
      // Network hiccup -- fall back to every built-in category so the
      // panel is still usable; saving will re-validate against the server.
      selectedCategories = new Set(bankCategories);
    }
    render();
  }

  async function saveConfig() {
    if (!isHost || !code) return;
    saveError = '';
    try {
      const res = await fetch(`/api/games/knows-you-best/rooms/${encodeURIComponent(code)}/config`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({ totalRounds, hostPlays, categories: Array.from(selectedCategories), useCustomQuestions }),
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

  async function saveCustomPrompts() {
    if (!isHost || !code) return;
    try {
      const res = await fetch(`/api/games/knows-you-best/rooms/${encodeURIComponent(code)}/custom-questions`, {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ prompts: customPrompts, packName: customSetName || undefined }),
      });
      if (res.ok && customSetName.trim()) {
        setNameSaved = true;
        render();
        setTimeout(() => { setNameSaved = false; render(); }, 2000);
      }
    } catch {
      // Best-effort -- the toggle/rounds save above is the one that gates
      // starting; a failed custom-prompt sync just means fewer prompts.
    }
  }

  function setRounds(next) {
    const clamped = Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, next));
    if (clamped === totalRounds) return;
    totalRounds = clamped;
    saveConfig();
  }

  function toggleHostPlays() {
    hostPlays = !hostPlays;
    saveConfig();
  }

  function toggleCategory(name) {
    if (selectedCategories.has(name)) selectedCategories.delete(name);
    else selectedCategories.add(name);
    saveConfig();
  }

  function toggleCustomQuestions() {
    useCustomQuestions = !useCustomQuestions;
    saveConfig();
  }

  function removeCustomPrompt(index) {
    customPrompts = customPrompts.filter((_, i) => i !== index);
    saveCustomPrompts();
    render();
  }

  function render() {
    if (!isHost) {
      panel.style.display = 'none';
      if (readonly) {
        readonly.style.display = 'block';
        const playLabel = hostPlays ? t('host is playing', 'المضيف يلعب أيضًا') : t('host is spectating', 'المضيف يراقب فقط');
        const catList = Array.from(selectedCategories).map(categoryLabel).join(', ') || t('all categories', 'كل الفئات');
        readonly.textContent = t(
          `Host picked: ${totalRounds} questions · ${catList} · ${playLabel}`,
          `اختار المضيف: ${totalRounds} أسئلة · ${catList} · ${playLabel}`
        );
      }
      return;
    }
    if (readonly) readonly.style.display = 'none';
    panel.style.display = 'block';

    const customCards = customPrompts
      .map(
        (p, i) =>
          `<div class="cfg-custom-card"><span>${p.text}</span><button type="button" data-remove-custom="${i}">${t('Remove', 'إزالة')}</button></div>`
      )
      .join('');

    const catChips = bankCategories
      .map((name) => {
        const active = selectedCategories.has(name);
        return `<button type="button" class="cfg-cat-chip ${active ? 'active' : ''}" data-cat="${name}">${categoryLabel(name)}</button>`;
      })
      .join('');

    panel.innerHTML = `
      <div class="cfg-section-label">${t('Number of questions', 'عدد الأسئلة')}</div>
      <div class="cfg-rounds-row">
        <button type="button" class="cfg-rounds-btn" id="cfg-rounds-minus" ${totalRounds <= MIN_ROUNDS ? 'disabled' : ''}>−</button>
        <span class="cfg-rounds-value">${totalRounds}</span>
        <button type="button" class="cfg-rounds-btn" id="cfg-rounds-plus" ${totalRounds >= MAX_ROUNDS ? 'disabled' : ''}>+</button>
      </div>
      <div class="cfg-section-label">${t('Categories', 'الفئات')}</div>
      <div class="cfg-cat-grid">${catChips}</div>
      <label class="cfg-toggle-row">
        <input type="checkbox" id="cfg-host-plays" ${hostPlays ? 'checked' : ''}>
        ${t('I want to play too', 'أريد أن ألعب أيضًا')}
      </label>
      <label class="cfg-toggle-row">
        <input type="checkbox" id="cfg-use-custom" ${useCustomQuestions ? 'checked' : ''}>
        ${t('Enable custom questions', 'تفعيل الأسئلة المخصصة')}
      </label>
      ${
        useCustomQuestions
          ? `
        <label class="cfg-set-name-label" for="cfg-set-name">${t('Set name (optional)', 'اسم المجموعة (اختياري)')}</label>
        <div class="cfg-set-name-row">
          <input type="text" class="cfg-set-name-input" id="cfg-set-name" maxlength="40" value="${escapeAttr(customSetName)}" placeholder="${t('Save this set under My Games', 'احفظ هذه المجموعة ضمن ألعابي')}">
          ${setNameSaved ? `<span class="cfg-set-name-saved">${t('Saved', 'تم الحفظ')}</span>` : ''}
        </div>
        ${customCards ? `<div class="cfg-custom-list">${customCards}</div>` : ''}
        <button type="button" class="cfg-add-btn" id="cfg-add-custom-btn">+ ${t('Add custom question', 'أضف سؤالاً مخصصًا')}</button>
      `
          : ''
      }
      ${saveError ? `<div class="cfg-error">${saveError}</div>` : ''}
    `;

    document.getElementById('cfg-rounds-minus').addEventListener('click', () => setRounds(totalRounds - 1));
    document.getElementById('cfg-rounds-plus').addEventListener('click', () => setRounds(totalRounds + 1));
    panel.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => toggleCategory(btn.dataset.cat));
    });
    document.getElementById('cfg-host-plays').addEventListener('change', toggleHostPlays);
    document.getElementById('cfg-use-custom').addEventListener('change', toggleCustomQuestions);
    panel.querySelectorAll('[data-remove-custom]').forEach((btn) => {
      btn.addEventListener('click', () => removeCustomPrompt(Number(btn.dataset.removeCustom)));
    });
    const addBtn = document.getElementById('cfg-add-custom-btn');
    if (addBtn) addBtn.addEventListener('click', openCustomPromptModal);
    const setNameEl = document.getElementById('cfg-set-name');
    if (setNameEl) {
      setNameEl.addEventListener('change', (e) => {
        customSetName = e.target.value;
        saveCustomPrompts();
      });
    }
  }

  function openCustomPromptModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'cfg-modal-backdrop';
    let text = '';
    let textAr = '';

    backdrop.innerHTML = `
      <div class="cfg-modal">
        <h3>${t('New custom question', 'سؤال مخصص جديد')}</h3>
        <input type="text" id="cfg-prompt-text" placeholder="${t('Question (English)', 'السؤال (إنجليزي)')}" maxlength="300">
        <input type="text" id="cfg-prompt-text-ar" placeholder="${t('Question in Arabic (optional)', 'السؤال بالعربية (اختياري)')}" maxlength="300">
        <div class="cfg-error" id="cfg-modal-error"></div>
        <div class="cfg-modal-actions">
          <button type="button" class="cfg-btn-cancel" id="cfg-modal-cancel">${t('Cancel', 'إلغاء')}</button>
          <button type="button" class="cfg-btn-save" id="cfg-modal-save">${t('Save question', 'حفظ السؤال')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    document.getElementById('cfg-prompt-text').addEventListener('input', (e) => (text = e.target.value));
    document.getElementById('cfg-prompt-text-ar').addEventListener('input', (e) => (textAr = e.target.value));
    document.getElementById('cfg-modal-cancel').addEventListener('click', () => backdrop.remove());
    document.getElementById('cfg-modal-save').addEventListener('click', () => {
      const trimmed = text.trim();
      const errEl = document.getElementById('cfg-modal-error');
      if (!trimmed) {
        errEl.textContent = t('A question is required.', 'السؤال مطلوب.');
        return;
      }
      customPrompts.push({ text: trimmed, textAr: textAr.trim() || undefined });
      backdrop.remove();
      saveCustomPrompts();
      render();
    });
  }
})();
