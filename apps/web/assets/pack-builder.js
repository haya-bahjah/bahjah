// My Games: the saved question packs a host builds once and reuses.
//
// This started life inline in bahjah-landing.html's signed-in dashboard. It
// moved here when My Games became its own page so the two never drift -- the
// page owns the chrome and the markup hooks, this owns the data and the modal.
//
// Mount with the element ids listed in mount(); every one is optional except
// the grid, so a page can offer the list without the create button.
(function () {
  const PACK_GAME_LABELS = {
    trivia: { en: 'Trivia', ar: 'سؤال و جواب' },
    'knows-you-best': { en: 'Knows You Best', ar: 'عارفكم' },
  };

  const TRASH_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="3 6 5 6 21 6"></polyline>' +
    '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
    '<line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';

  let packs = [];
  let els = {};

  function lang() {
    return document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  }
  function t(en, ar) {
    return lang() === 'ar' ? ar : en;
  }
  function netError() {
    BahjahRoomActions.showToast(t('Network error — please try again.', 'خطأ في الشبكة — حاول مرة أخرى.'));
  }

  // -- list -----------------------------------------------------------------

  function render() {
    if (!els.grid) return;
    const show = (el, on) => { if (el) el.style.display = on ? '' : 'none'; };

    if (packs.length === 0) {
      els.grid.innerHTML = '';
      show(els.grid, false);
      show(els.empty, true);
      return;
    }
    show(els.grid, true);
    show(els.empty, false);

    els.grid.innerHTML = packs.map((p) => {
      const label = PACK_GAME_LABELS[p.gameType] || { en: p.gameType, ar: p.gameType };
      const count = lang() === 'ar'
        ? `${p.itemCount} سؤال`
        : `${p.itemCount} question${p.itemCount === 1 ? '' : 's'}`;
      return `
        <div class="pack-card">
          <div class="pack-card-top">
            <span class="pack-card-name">${p.name}</span>
            <span class="pack-badge">${lang() === 'ar' ? label.ar : label.en}</span>
          </div>
          <span class="pack-card-count">${count}</span>
          <div class="pack-card-actions">
            <button type="button" class="bh-btn bh-btn--primary bh-btn--md" data-host-pack="${p.id}">${t('Host', 'استضف')}</button>
            <button type="button" class="pack-delete-btn" data-delete-pack="${p.id}" aria-label="${t('Delete pack', 'حذف الحزمة')}">${TRASH_ICON}</button>
          </div>
        </div>`;
    }).join('');
  }

  async function load() {
    const token = BahjahSession.getToken();
    if (!token) {
      packs = [];
      render();
      return;
    }
    try {
      const res = await fetch('/api/games/packs', { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : { packs: [] };
      packs = data.packs || [];
    } catch (err) {
      packs = [];
    }
    render();
  }

  async function hostFromPack(id) {
    const token = BahjahRoomActions.requireSignedIn();
    if (!token) return;
    try {
      const res = await fetch(`/api/games/packs/${encodeURIComponent(id)}/host`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        BahjahRoomActions.showToast(BahjahRoomActions.roomErrorMessage(data.error));
        if (data.error && data.error.code === 'TRIAL_EXPIRED') {
          setTimeout(() => { window.location.href = 'settings.html'; }, 1400);
        }
        return;
      }
      window.location.href = `${data.room.gameType}-lobby.html?code=${encodeURIComponent(data.room.code)}`;
    } catch (err) {
      netError();
    }
  }

  async function deletePack(id) {
    const confirmMsg = t('Delete this pack? This can’t be undone.', 'حذف هذه الحزمة؟ لا يمكن التراجع عن ذلك.');
    if (!window.confirm(confirmMsg)) return;
    const token = BahjahSession.getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/games/packs/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('delete failed');
      packs = packs.filter((p) => p.id !== id);
      render();
    } catch (err) {
      netError();
    }
  }

  // -- create modal ---------------------------------------------------------

  function emptyTriviaQuestion() { return { prompt: '', choices: ['', '', '', ''], correctIndex: 0 }; }
  function emptyKybPrompt() { return { text: '', textAr: '' }; }

  function openCreatePackModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'pk-modal-backdrop';
    let gameType = 'trivia';
    let name = '';
    let triviaQuestions = [emptyTriviaQuestion()];
    let kybPrompts = [emptyKybPrompt(), emptyKybPrompt(), emptyKybPrompt()];

    const esc = (s) => String(s || '').replace(/"/g, '&quot;');

    function renderModal() {
      const count = gameType === 'trivia' ? triviaQuestions.length : kybPrompts.length;
      const min = gameType === 'trivia' ? 10 : 3;
      const met = count >= min;
      const countLabel = gameType === 'trivia'
        ? t(`${count} of ${min} minimum questions`, `${count} من ${min} كحد أدنى للأسئلة`)
        : t(`${count} of ${min} minimum prompts`, `${count} من ${min} كحد أدنى للأسئلة`);

      backdrop.innerHTML = `
        <div class="pk-modal">
          <h3>${t('New pack', 'حزمة جديدة')}</h3>
          <div class="pk-type-row">
            <button type="button" class="pk-type-btn${gameType === 'trivia' ? ' active' : ''}" id="pk-type-trivia">${t('Trivia', 'سؤال و جواب')}</button>
            <button type="button" class="pk-type-btn${gameType === 'knows-you-best' ? ' active' : ''}" id="pk-type-kyb">${t('Knows You Best', 'عارفكم')}</button>
          </div>
          <input type="text" id="pk-name" placeholder="${t('Pack name', 'اسم الحزمة')}" maxlength="40" value="${esc(name)}">
          <div id="pk-item-list"></div>
          <button type="button" class="pk-add-btn" id="pk-add-btn">+ ${gameType === 'trivia' ? t('Add question', 'أضف سؤالاً') : t('Add prompt', 'أضف سؤالاً')}</button>
          <div class="pk-count-hint${met ? ' pk-count-met' : ''}">${countLabel}</div>
          <div class="pk-modal-error" id="pk-modal-error"></div>
          <div class="pk-modal-actions">
            <button type="button" class="pk-btn-cancel" id="pk-modal-cancel">${t('Cancel', 'إلغاء')}</button>
            <button type="button" class="pk-btn-save" id="pk-modal-save">${t('Save pack', 'حفظ الحزمة')}</button>
          </div>
        </div>`;

      document.getElementById('pk-name').addEventListener('input', (e) => { name = e.target.value; });
      document.getElementById('pk-type-trivia').addEventListener('click', () => { gameType = 'trivia'; renderModal(); });
      document.getElementById('pk-type-kyb').addEventListener('click', () => { gameType = 'knows-you-best'; renderModal(); });

      const list = document.getElementById('pk-item-list');
      if (gameType === 'trivia') {
        list.innerHTML = triviaQuestions.map((q, qi) => `
          <div class="pk-q-card" data-qi="${qi}">
            ${triviaQuestions.length > 1 ? `<button type="button" class="pk-q-remove" data-remove="${qi}">&times;</button>` : ''}
            <input type="text" class="pk-q-prompt" placeholder="${t('Question prompt', 'نص السؤال')}" value="${esc(q.prompt)}" maxlength="300">
            ${q.choices.map((choice, ci) => `
              <div class="pk-choice-row">
                <input type="radio" name="pk-correct-${qi}" ${q.correctIndex === ci ? 'checked' : ''} class="pk-choice-correct" data-ci="${ci}">
                <input type="text" class="pk-choice-text" data-ci="${ci}" placeholder="${t('Choice', 'خيار')} ${ci + 1}" value="${esc(choice)}" maxlength="120">
              </div>`).join('')}
          </div>`).join('');
        list.querySelectorAll('.pk-q-card').forEach((card) => {
          const qi = Number(card.dataset.qi);
          card.querySelector('.pk-q-prompt').addEventListener('input', (e) => { triviaQuestions[qi].prompt = e.target.value; });
          card.querySelectorAll('.pk-choice-text').forEach((input) => {
            input.addEventListener('input', (e) => { triviaQuestions[qi].choices[Number(e.target.dataset.ci)] = e.target.value; });
          });
          card.querySelectorAll('.pk-choice-correct').forEach((radio) => {
            radio.addEventListener('change', (e) => { triviaQuestions[qi].correctIndex = Number(e.target.dataset.ci); });
          });
          const removeBtn = card.querySelector('.pk-q-remove');
          if (removeBtn) removeBtn.addEventListener('click', () => { triviaQuestions.splice(qi, 1); renderModal(); });
        });
      } else {
        list.innerHTML = kybPrompts.map((p, pi) => `
          <div class="pk-q-card" data-pi="${pi}">
            ${kybPrompts.length > 1 ? `<button type="button" class="pk-q-remove" data-remove="${pi}">&times;</button>` : ''}
            <input type="text" class="pk-prompt-text" placeholder="${t('Prompt (English)', 'السؤال (إنجليزي)')}" value="${esc(p.text)}" maxlength="300">
            <input type="text" class="pk-prompt-ar" placeholder="${t('Prompt (Arabic, optional)', 'السؤال (عربي، اختياري)')}" value="${esc(p.textAr)}" maxlength="300">
          </div>`).join('');
        list.querySelectorAll('.pk-q-card').forEach((card) => {
          const pi = Number(card.dataset.pi);
          card.querySelector('.pk-prompt-text').addEventListener('input', (e) => { kybPrompts[pi].text = e.target.value; });
          card.querySelector('.pk-prompt-ar').addEventListener('input', (e) => { kybPrompts[pi].textAr = e.target.value; });
          const removeBtn = card.querySelector('.pk-q-remove');
          if (removeBtn) removeBtn.addEventListener('click', () => { kybPrompts.splice(pi, 1); renderModal(); });
        });
      }

      document.getElementById('pk-add-btn').addEventListener('click', () => {
        if (gameType === 'trivia') triviaQuestions.push(emptyTriviaQuestion());
        else kybPrompts.push(emptyKybPrompt());
        renderModal();
      });
      document.getElementById('pk-modal-cancel').addEventListener('click', () => backdrop.remove());
      document.getElementById('pk-modal-save').addEventListener('click', onSave);
    }

    async function onSave() {
      const errEl = document.getElementById('pk-modal-error');
      const trimmedName = name.trim();
      if (!trimmedName) {
        errEl.textContent = t('Pack name is required.', 'اسم الحزمة مطلوب.');
        return;
      }
      let items;
      if (gameType === 'trivia') {
        if (triviaQuestions.length < 10) {
          errEl.textContent = t('Trivia packs need at least 10 questions.', 'تحتاج حزم سؤال و جواب إلى ١٠ أسئلة على الأقل.');
          return;
        }
        for (const q of triviaQuestions) {
          if (!q.prompt.trim() || q.choices.some((c) => !c.trim())) {
            errEl.textContent = t('Every question needs a prompt and 4 filled-in choices.', 'كل سؤال يحتاج نصاً وأربعة خيارات معبأة.');
            return;
          }
        }
        items = triviaQuestions.map((q) => ({
          prompt: q.prompt.trim(),
          choices: q.choices.map((c) => c.trim()),
          correctIndex: q.correctIndex,
        }));
      } else {
        if (kybPrompts.length < 3) {
          errEl.textContent = t('Knows You Best packs need at least 3 prompts.', 'تحتاج حزم عارفكم إلى ٣ أسئلة على الأقل.');
          return;
        }
        for (const p of kybPrompts) {
          if (!p.text.trim()) {
            errEl.textContent = t('Every prompt needs English text.', 'كل سؤال يحتاج نصاً بالإنجليزية.');
            return;
          }
        }
        items = kybPrompts.map((p) => ({ text: p.text.trim(), textAr: p.textAr.trim() || null }));
      }

      const saveBtn = document.getElementById('pk-modal-save');
      saveBtn.disabled = true;
      const token = BahjahSession.getToken();
      try {
        const res = await fetch('/api/games/packs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ gameType, name: trimmedName, items }),
        });
        const data = await res.json();
        if (!res.ok) {
          errEl.textContent = (data.error && data.error.message) || t('Something went wrong — please try again.', 'حدث خطأ ما — حاول مرة أخرى.');
          saveBtn.disabled = false;
          return;
        }
        packs = [data.pack, ...packs];
        render();
        backdrop.remove();
      } catch (err) {
        errEl.textContent = t('Network error — please try again.', 'خطأ في الشبكة — حاول مرة أخرى.');
        saveBtn.disabled = false;
      }
    }

    document.body.appendChild(backdrop);
    renderModal();
  }

  // -- wiring ---------------------------------------------------------------

  function mount(opts) {
    const o = opts || {};
    els = {
      grid: document.getElementById(o.grid || 'packs-grid'),
      empty: document.getElementById(o.empty || 'packs-empty'),
    };
    const createBtn = document.getElementById(o.createBtn || 'create-pack-btn');
    if (createBtn) createBtn.addEventListener('click', (e) => { e.preventDefault(); openCreatePackModal(); });

    // Delegated, so the buttons can be re-rendered freely.
    document.addEventListener('click', (e) => {
      const host = e.target.closest('[data-host-pack]');
      if (host) { e.preventDefault(); hostFromPack(host.dataset.hostPack); return; }
      const del = e.target.closest('[data-delete-pack]');
      if (del) { e.preventDefault(); deletePack(del.dataset.deletePack); }
    });

    // Pack names and counts are language-sensitive, so redraw on a swap.
    document.addEventListener('bahjah:lang-change', render);

    return load();
  }

  window.BahjahPacks = { mount, reload: load, render, open: openCreatePackModal };
})();
