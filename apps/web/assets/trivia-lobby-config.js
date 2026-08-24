// Host-only category/difficulty/custom-question config panel for the
// trivia lobby. Talks to assets/lobby-room.js only through the generic
// 'bahjah:lobby-update' event it dispatches -- this file owns everything
// trivia-specific so lobby-room.js stays reusable by mafia/knows-you-best.
(function () {
  const LANG_ATTR = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const panel = document.getElementById('trivia-config-panel');
  const readonly = document.getElementById('trivia-config-readonly');
  if (!panel) return; // not the trivia lobby

  const MIN_POOL = 10;
  // Must stay in step with MIN_ITEMS.trivia in the server's
  // questionPackSync.ts -- the threshold above which a custom category
  // is also auto-saved into the host's My Games.
  const PACK_MIN_QUESTIONS = 10;

  let code = null;
  let isHost = false;
  let bankCategories = []; // [{name, counts:{easy,medium,hard}}]
  let difficulty = 'medium';
  let selectedCategories = new Set();
  let customCategories = []; // [{name, questions:[{prompt, choices:[4], correctIndex}]}]
  let poolSize = null; // null = not yet validated
  let saveError = '';
  let initialized = false;
  let loadingConfig = false;

  function authHeaders(json) {
    const token = BahjahSession.getToken();
    const headers = { Authorization: `Bearer ${token}` };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  function t(en, ar) {
    return LANG_ATTR() === 'ar' ? ar : en;
  }

  const CATEGORY_LABELS_AR = {
    'General Knowledge': 'معلومات عامة',
    Geography: 'جغرافيا',
    History: 'تاريخ',
    Movies: 'أفلام',
    Science: 'علوم',
    Sports: 'رياضة',
    'Saudi National Day': 'اليوم الوطني السعودي',
  };

  function categoryLabel(name) {
    return LANG_ATTR() === 'ar' && CATEGORY_LABELS_AR[name] ? CATEGORY_LABELS_AR[name] : name;
  }

  // Saudi National Day seasonal theme: flips the whole lobby to the SND
  // palette (see trivia-lobby.html's [data-event-theme="national"] CSS)
  // whenever that category is among whatever's selected. It is a seeded
  // bank category with its own questions, so picking the chip is all a
  // host does. A host-authored custom category named the same thing still
  // triggers the theme, which is why both lists are checked.
  const SND_NAMES = new Set(['saudi national day', 'اليوم الوطني السعودي']);
  function isSndName(name) {
    return SND_NAMES.has(String(name || '').trim().toLowerCase());
  }
  // Set by bahjah-landing.html's SND banner when it creates a fresh room
  // (trivia-lobby.html?code=...&preset=snd) -- read once, only ever
  // matters for a room with no saved config yet (see bootstrap() below).
  function isSndPresetRequested() {
    return new URLSearchParams(location.search).get('preset') === 'snd';
  }
  function updateSndLockupSrc() {
    const el = document.getElementById('snd-lockup');
    if (!el) return;
    // White in both themes: the dark variant erases the wordmark (the art
    // carries its own dark box). See trivia-play.html's CSS note.
    el.src = 'assets/logos/snd-logo-horizontal.svg?v=20260823';
  }
  function applyEventTheme(categoryNames, customNames) {
    const isNational = (categoryNames || []).some(isSndName) || (customNames || []).some(isSndName);
    document.documentElement.setAttribute('data-event-theme', isNational ? 'national' : 'default');
    updateSndLockupSrc();
  }
  // The page's own light/dark toggle (inline script in trivia-lobby.html)
  // has no other hook into this file -- expose this so it can refresh the
  // lockup's white/dark-ink asset choice when the user flips theme.
  window.BahjahSndTheme = { refreshLockup: updateSndLockupSrc };

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
    // Whether the room already has a config saved server-side -- the real
    // signal for "this is a brand-new room that needs its defaults
    // persisted", since the server's poolSize is 0 (not null) for an
    // unsaved config and can't be used to distinguish that from "0
    // questions match the saved selection".
    let hasSavedConfig = false;
    try {
      const [catsRes, cfgRes] = await Promise.all([
        fetch('/api/games/trivia/categories', { headers: authHeaders() }),
        fetch(`/api/games/trivia/rooms/${encodeURIComponent(code)}/config`, { headers: authHeaders() }),
      ]);
      const catsData = await catsRes.json();
      bankCategories = catsData.categories || [];

      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        poolSize = cfgData.poolSize ?? 0;
        if (cfgData.config) {
          hasSavedConfig = true;
          difficulty = cfgData.config.difficulty;
          selectedCategories = new Set(cfgData.config.categories);
          if (cfgData.isHost && cfgData.customCategories) {
            customCategories = cfgData.customCategories;
          }
          // config.categories/customCategories are plain name arrays sent
          // to every room member (not just the host), unlike the
          // question-text payload above -- safe to use for theming.
          applyEventTheme(cfgData.config.categories, cfgData.config.customCategories);
        } else if (isHost) {
          // No config saved yet. Default to every built-in category at
          // medium difficulty (matches the server's own fallback), minus
          // Saudi National Day: it re-themes the entire game, so it is
          // opted into rather than swept in by "everything" -- unless this
          // room was just created by the SND banner (bahjah-landing.html's
          // startSndChallenge()), in which case that opt-in already
          // happened and SND alone is exactly what should be selected.
          selectedCategories = isSndPresetRequested()
            ? new Set(bankCategories.filter((c) => isSndName(c.name)).map((c) => c.name))
            : new Set(bankCategories.filter((c) => !isSndName(c.name)).map((c) => c.name));
          applyEventTheme([...selectedCategories], []);
        }
      }
    } catch {
      // Network hiccup -- fall back to "every category, medium" so the
      // panel is still usable; saving will re-validate against the server.
      selectedCategories = new Set(
        bankCategories.filter((c) => !isSndName(c.name)).map((c) => c.name)
      );
      applyEventTheme([...selectedCategories], []);
    }
    render();
    if (isHost && !hasSavedConfig) {
      saveConfig();
    }
  }

  function categoryCount(name) {
    const cat = bankCategories.find((c) => c.name === name);
    return cat ? cat.counts[difficulty] : 0;
  }

  async function saveConfig() {
    if (!isHost || !code) return;
    saveError = '';
    try {
      const res = await fetch(`/api/games/trivia/rooms/${encodeURIComponent(code)}/config`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({
          difficulty,
          categories: Array.from(selectedCategories),
          customCategories,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        saveError = (data.error && data.error.message) || t('Could not save.', 'تعذّر الحفظ.');
        poolSize = null;
      } else {
        poolSize = data.poolSize;
        applyEventTheme(data.config.categories, data.config.customCategories);
      }
    } catch {
      saveError = t('Network error saving config.', 'خطأ في الشبكة أثناء الحفظ.');
      poolSize = null;
    }
    render();
  }

  function toggleCategory(name) {
    if (selectedCategories.has(name)) selectedCategories.delete(name);
    else selectedCategories.add(name);
    saveConfig();
  }

  function setDifficulty(next) {
    if (next === difficulty) return;
    difficulty = next;
    saveConfig();
  }

  function removeCustomCategory(name) {
    customCategories = customCategories.filter((c) => c.name !== name);
    saveConfig();
  }

  function updateStartButtons() {
    const ready = isHost ? poolSize !== null && poolSize >= MIN_POOL : true;
    document.querySelectorAll('.start-btn').forEach((btn) => {
      btn.disabled = isHost && !ready;
    });
  }

  function poolBanner() {
    if (poolSize === null) {
      return `<div class="cfg-pool-banner bad">${saveError || t('Checking question pool…', 'جارٍ التحقق من الأسئلة…')}</div>`;
    }
    if (poolSize < MIN_POOL) {
      return `<div class="cfg-pool-banner bad">${t(
        `Only ${poolSize} question${poolSize === 1 ? '' : 's'} available — need at least ${MIN_POOL}.`,
        `${poolSize} سؤال فقط متاح -- يلزم ${MIN_POOL} على الأقل.`
      )}</div>`;
    }
    return `<div class="cfg-pool-banner ok">${t(`${poolSize} questions ready — game will play 10.`, `${poolSize} سؤال جاهز -- ستُلعب 10 أسئلة.`)}</div>`;
  }

  function render() {
    updateStartButtons();

    if (!isHost) {
      panel.style.display = 'none';
      if (readonly) {
        readonly.style.display = 'block';
        const diffLabel = { easy: t('Easy', 'سهل'), medium: t('Medium', 'متوسط'), hard: t('Hard', 'صعب') }[difficulty];
        const catList = Array.from(selectedCategories).map(categoryLabel).concat(customCategories.map((c) => c.name)).join(', ') || t('all categories', 'كل الفئات');
        readonly.textContent = t(`Host picked: ${diffLabel} · ${catList}`, `اختار المضيف: ${diffLabel} · ${catList}`);
      }
      return;
    }
    if (readonly) readonly.style.display = 'none';
    panel.style.display = 'block';

    const diffButtons = ['easy', 'medium', 'hard']
      .map(
        (d) =>
          `<button type="button" class="cfg-diff-btn ${d === difficulty ? 'active' : ''}" data-diff="${d}">${
            { easy: t('Easy', 'سهل'), medium: t('Medium', 'متوسط'), hard: t('Hard', 'صعب') }[d]
          }</button>`
      )
      .join('');

    // Saudi National Day is a real bank category now (seeded alongside the
    // other six), so it behaves like any other chip -- pick it and the round
    // pulls SND questions. It keeps its lead position and the horizontal
    // lockup, which is the only thing that still makes it a special case.
    const sndBank = bankCategories.find((c) => isSndName(c.name));
    const sndChip = sndBank
      ? `<button type="button" class="cfg-cat-chip cfg-cat-snd ${selectedCategories.has(sndBank.name) ? 'active' : ''}" data-cat="${sndBank.name}">
        <img class="cfg-cat-lockup" src="assets/logos/snd-logo-horizontal.svg?v=20260823" alt="">
        <span>${t('Saudi National Day', 'اليوم الوطني السعودي')}</span>
        <span class="cfg-cat-count">(${sndBank.counts[difficulty]})</span>
      </button>`
      : '';

    const catChips = sndChip + bankCategories
      .filter((c) => !isSndName(c.name))
      .map((c) => {
        const count = c.counts[difficulty];
        const active = selectedCategories.has(c.name);
        return `<button type="button" class="cfg-cat-chip ${active ? 'active' : ''} ${count === 0 ? 'empty' : ''}" data-cat="${c.name}">
          <span>${categoryLabel(c.name)}</span>
          <span class="cfg-cat-count">(${count})</span>
        </button>`;
      })
      .join('');

    const customCards = customCategories
      .map(
        (c) =>
          `<div class="cfg-custom-card"><span>${c.name} — ${c.questions.length} ${t('questions', 'أسئلة')}</span><button type="button" data-remove-custom="${c.name}">${t('Remove', 'إزالة')}</button></div>`
      )
      .join('');

    panel.innerHTML = `
      <div class="cfg-section-label">${t('Difficulty', 'الصعوبة')}</div>
      <div class="cfg-diff-row">${diffButtons}</div>
      <div class="cfg-section-label">${t('Categories', 'الفئات')}</div>
      <div class="cfg-cat-grid">${catChips}</div>
      ${customCards ? `<div class="cfg-custom-list">${customCards}</div>` : ''}
      <button type="button" class="cfg-add-btn" id="cfg-add-custom-btn">+ ${t('Add custom category', 'أضف فئة مخصصة')}</button>
      ${poolBanner()}
    `;

    panel.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => setDifficulty(btn.dataset.diff));
    });
    panel.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => toggleCategory(btn.dataset.cat));
    });
    panel.querySelectorAll('[data-remove-custom]').forEach((btn) => {
      btn.addEventListener('click', () => removeCustomCategory(btn.dataset.removeCustom));
    });
    const addBtn = document.getElementById('cfg-add-custom-btn');
    if (addBtn) addBtn.addEventListener('click', () => openCustomCategoryModal());
  }

  function openCustomCategoryModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'cfg-modal-backdrop';
    let questions = [{ prompt: '', choices: ['', '', '', ''], correctIndex: 0 }];
    let categoryName = '';

    function renderModal() {
      // The server only promotes a custom category into the host's My Games
      // once it has at least PACK_MIN_QUESTIONS (see questionPackSync.ts) --
      // below that it still works for this room, it just isn't reusable. That
      // rule was previously invisible here, so a short category looked like a
      // silent failure to save. Surface the progress instead.
      const packReady = questions.length >= PACK_MIN_QUESTIONS;
      const remaining = PACK_MIN_QUESTIONS - questions.length;
      const packHint = packReady
        ? t(
            `${questions.length} questions — this set will be saved to My Games.`,
            `${questions.length} أسئلة — ستُحفظ هذه المجموعة في ألعابي.`
          )
        : t(
            `${questions.length} of ${PACK_MIN_QUESTIONS} questions — add ${remaining} more to also save this set to My Games.`,
            `${questions.length} من ${PACK_MIN_QUESTIONS} أسئلة — أضف ${remaining} أخرى لحفظ هذه المجموعة في ألعابي أيضًا.`
          );
      backdrop.innerHTML = `
        <div class="cfg-modal">
          <h3>${t('New custom category', 'فئة مخصصة جديدة')}</h3>
          <input type="text" id="cfg-cat-name" placeholder="${t('Category name', 'اسم الفئة')}" maxlength="40" value="${categoryName.replace(/"/g, '&quot;')}">
          <div id="cfg-q-list"></div>
          <button type="button" class="cfg-add-btn" id="cfg-add-q-btn">+ ${t('Add question', 'أضف سؤالاً')}</button>
          <div class="cfg-save-hint${packReady ? ' is-ready' : ''}">${packHint}</div>
          <div class="cfg-error" id="cfg-modal-error"></div>
          <div class="cfg-modal-actions">
            <button type="button" class="cfg-btn-cancel" id="cfg-modal-cancel">${t('Cancel', 'إلغاء')}</button>
            <button type="button" class="cfg-btn-save" id="cfg-modal-save">${t('Save category', 'حفظ الفئة')}</button>
          </div>
        </div>
      `;
      document.getElementById('cfg-cat-name').addEventListener('input', (e) => (categoryName = e.target.value));
      const qList = document.getElementById('cfg-q-list');
      qList.innerHTML = questions
        .map(
          (q, qi) => `
        <div class="cfg-q-card" data-qi="${qi}">
          <input type="text" class="cfg-q-prompt" placeholder="${t('Question prompt', 'نص السؤال')}" value="${q.prompt.replace(/"/g, '&quot;')}" maxlength="300">
          ${q.choices
            .map(
              (choice, ci) => `
            <div class="cfg-choice-row">
              <input type="radio" name="correct-${qi}" ${q.correctIndex === ci ? 'checked' : ''} class="cfg-choice-correct" data-ci="${ci}">
              <input type="text" class="cfg-choice-text" data-ci="${ci}" placeholder="${t('Choice', 'خيار')} ${ci + 1}" value="${choice.replace(/"/g, '&quot;')}" maxlength="120">
            </div>`
            )
            .join('')}
        </div>`
        )
        .join('');

      backdrop.querySelectorAll('.cfg-q-card').forEach((card) => {
        const qi = Number(card.dataset.qi);
        card.querySelector('.cfg-q-prompt').addEventListener('input', (e) => (questions[qi].prompt = e.target.value));
        card.querySelectorAll('.cfg-choice-text').forEach((input) => {
          input.addEventListener('input', (e) => (questions[qi].choices[Number(e.target.dataset.ci)] = e.target.value));
        });
        card.querySelectorAll('.cfg-choice-correct').forEach((radio) => {
          radio.addEventListener('change', (e) => (questions[qi].correctIndex = Number(e.target.dataset.ci)));
        });
      });
      document.getElementById('cfg-add-q-btn').addEventListener('click', () => {
        questions.push({ prompt: '', choices: ['', '', '', ''], correctIndex: 0 });
        renderModal();
      });
      document.getElementById('cfg-modal-cancel').addEventListener('click', () => backdrop.remove());
      document.getElementById('cfg-modal-save').addEventListener('click', onSave);
    }

    function onSave() {
      const name = document.getElementById('cfg-cat-name').value.trim();
      const errEl = document.getElementById('cfg-modal-error');
      if (!name) {
        errEl.textContent = t('Category name is required.', 'اسم الفئة مطلوب.');
        return;
      }
      if (customCategories.some((c) => c.name === name)) {
        errEl.textContent = t('A custom category with that name already exists.', 'توجد فئة مخصصة بهذا الاسم بالفعل.');
        return;
      }
      for (const q of questions) {
        if (!q.prompt.trim() || q.choices.some((c) => !c.trim())) {
          errEl.textContent = t('Every question needs a prompt and 4 filled-in choices.', 'كل سؤال يحتاج نصاً وأربعة خيارات معبأة.');
          return;
        }
      }
      customCategories.push({ name, questions: questions.map((q) => ({ prompt: q.prompt.trim(), choices: q.choices.map((c) => c.trim()), correctIndex: q.correctIndex })) });
      backdrop.remove();
      saveConfig();
    }

    document.body.appendChild(backdrop);
    renderModal();
  }
})();
