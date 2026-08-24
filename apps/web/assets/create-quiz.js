// "Create Your Own Quiz" -- the Name -> Editor -> Saved flow reached from the
// Trivia landing page's second hero CTA.
//
// Saving goes through the existing POST /api/games/packs, the same endpoint
// My Games already lists/hosts/deletes from, so a finished quiz shows up there
// with no separate save path to keep in sync. That endpoint's schema is the
// contract this editor is built to: exactly 4 choices per question, one
// correct index, and at least MIN_QUESTIONS items.
//
// The design's Themes step (default + a paid Saudi National Day theme) is
// deliberately not built yet -- every quiz uses the default theme until the
// paid-theme work lands, which is why the wizard reads "of 2" rather than
// "of 3".
(function () {
  const nameScreen = document.getElementById('qz-name');
  if (!nameScreen) return; // not the create-quiz page

  // Mirrors createPackSchema in the server's dashboardRoutes.ts. A trivia pack
  // needs >= 10 so a room hosted from it always clears MIN_POOL_SIZE.
  const MIN_QUESTIONS = 10;
  const CHOICE_KEYS = ['A', 'B', 'C', 'D'];

  const els = {
    name: nameScreen,
    editor: document.getElementById('qz-editor'),
    saved: document.getElementById('qz-saved'),
    form: document.getElementById('qz-name-form'),
    input: document.getElementById('qz-name-input'),
    hint: document.getElementById('qz-name-hint'),
    next: document.getElementById('qz-name-next'),
    wiz2: document.getElementById('qz-wiz2'),
    title: document.getElementById('qz-title'),
    count: document.getElementById('qz-count'),
    list: document.getElementById('qz-list'),
    empty: document.getElementById('qz-empty'),
    foot: document.getElementById('qz-foot'),
    progress: document.getElementById('qz-progress'),
    error: document.getElementById('qz-error'),
    save: document.getElementById('qz-save'),
    back: document.getElementById('qz-back'),
    another: document.getElementById('qz-another'),
    savedName: document.getElementById('qz-saved-name'),
    savedCount: document.getElementById('qz-saved-count'),
  };

  let screen = 'name';
  let quizName = '';
  let questions = [];
  let saving = false;
  let dragFrom = null;

  function lang() {
    return document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  }
  function t(en, ar) {
    return lang() === 'ar' ? ar : en;
  }
  function nextId() {
    return 'q' + Date.now().toString(36) + Math.floor(Math.random() * 999).toString(36);
  }
  function emptyQuestion() {
    return { id: nextId(), text: '', choices: ['', '', '', ''], correct: 0 };
  }
  // A question counts toward the save minimum only once it is actually
  // usable in a round: a prompt plus all four choices filled in.
  function isComplete(q) {
    return !!q.text.trim() && q.choices.every((c) => c.trim());
  }

  function show(next) {
    screen = next;
    [['name', els.name], ['editor', els.editor], ['saved', els.saved]].forEach(([key, el]) => {
      el.classList.toggle('is-active', key === next);
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // -- name -----------------------------------------------------------------

  function syncName() {
    const value = els.input.value.trim();
    els.next.disabled = value.length === 0;
    els.hint.textContent = value.length
      ? ''
      : t('Enter a name to continue', 'أدخل اسمًا للمتابعة');
    if (els.wiz2) els.wiz2.classList.toggle('on', value.length > 0);
  }

  els.input.addEventListener('input', syncName);
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = els.input.value.trim();
    if (!value) return;
    quizName = value;
    if (questions.length === 0) questions.push(emptyQuestion());
    renderEditor();
    show('editor');
  });

  els.back.addEventListener('click', () => {
    els.input.value = quizName;
    syncName();
    show('name');
  });

  // -- editor ---------------------------------------------------------------

  function renderEditor() {
    els.title.textContent = quizName;

    const done = questions.filter(isComplete).length;
    els.count.textContent = lang() === 'ar'
      ? `${questions.length} سؤال`
      : `${questions.length} question${questions.length === 1 ? '' : 's'}`;

    const remaining = MIN_QUESTIONS - done;
    els.progress.textContent = remaining > 0
      ? t(
          `${done} of ${MIN_QUESTIONS} complete — ${remaining} more to save.`,
          `${done} من ${MIN_QUESTIONS} مكتملة — ${remaining} أخرى للحفظ.`
        )
      : t(`${done} questions ready to save.`, `${done} أسئلة جاهزة للحفظ.`);

    els.save.textContent = saving ? t('Saving…', 'جارٍ الحفظ…') : t('Save game', 'احفظ اللعبة');
    els.save.disabled = saving || done < MIN_QUESTIONS;

    els.empty.style.display = questions.length ? 'none' : '';
    els.foot.style.display = questions.length ? '' : 'none';

    els.list.innerHTML = questions.map((q, i) => `
      <div class="qz-q" data-qi="${i}" draggable="true">
        <div class="qz-q-top">
          <span class="qz-grip" aria-hidden="true" title="${t('Drag to reorder', 'اسحب لإعادة الترتيب')}">&#10287;</span>
          <span class="qz-num">${i + 1}</span>
          <input class="qz-q-text" data-qz-text value="${escapeAttr(q.text)}" maxlength="300"
                 placeholder="${t('Write the question…', 'اكتب السؤال…')}">
          <div class="qz-q-tools">
            <button type="button" class="qz-icon-btn" data-qz-up aria-label="${t('Move up', 'نقل لأعلى')}" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
            <button type="button" class="qz-icon-btn" data-qz-down aria-label="${t('Move down', 'نقل لأسفل')}" ${i === questions.length - 1 ? 'disabled' : ''}>&#9660;</button>
            <button type="button" class="qz-icon-btn qz-icon-btn--danger" data-qz-del aria-label="${t('Delete question', 'حذف السؤال')}">&#10005;</button>
          </div>
        </div>
        <div class="qz-choices">
          ${q.choices.map((choice, ci) => `
            <div class="qz-choice${q.correct === ci ? ' is-correct' : ''}">
              <button type="button" class="qz-choice-pick" data-qz-pick="${ci}"
                      aria-label="${t('Mark correct', 'حدد الإجابة الصحيحة')}"
                      aria-pressed="${q.correct === ci}">${q.correct === ci ? '&#10003;' : '&#9675;'}</button>
              <span class="qz-choice-key">${CHOICE_KEYS[ci]}</span>
              <input class="qz-choice-text" data-qz-choice="${ci}" value="${escapeAttr(choice)}" maxlength="120"
                     placeholder="${t('Answer choice', 'خيار الإجابة')}">
            </div>`).join('')}
        </div>
      </div>`).join('');
  }

  function escapeAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function move(from, to) {
    if (to < 0 || to >= questions.length || from === to) return;
    const [row] = questions.splice(from, 1);
    questions.splice(to, 0, row);
    renderEditor();
  }

  // Typing is handled without a re-render so the caret never jumps; only
  // structural changes (add/delete/reorder/correct-answer) redraw the list.
  els.list.addEventListener('input', (e) => {
    const card = e.target.closest('[data-qi]');
    if (!card) return;
    const q = questions[Number(card.dataset.qi)];
    if (!q) return;
    if (e.target.matches('[data-qz-text]')) q.text = e.target.value;
    const ci = e.target.getAttribute('data-qz-choice');
    if (ci !== null) q.choices[Number(ci)] = e.target.value;
    // Only the counters and the save button depend on this.
    const done = questions.filter(isComplete).length;
    const remaining = MIN_QUESTIONS - done;
    els.progress.textContent = remaining > 0
      ? t(
          `${done} of ${MIN_QUESTIONS} complete — ${remaining} more to save.`,
          `${done} من ${MIN_QUESTIONS} مكتملة — ${remaining} أخرى للحفظ.`
        )
      : t(`${done} questions ready to save.`, `${done} أسئلة جاهزة للحفظ.`);
    els.save.disabled = saving || done < MIN_QUESTIONS;
    els.error.textContent = '';
  });

  els.list.addEventListener('click', (e) => {
    const card = e.target.closest('[data-qi]');
    if (!card) return;
    const i = Number(card.dataset.qi);
    const q = questions[i];
    if (!q) return;
    const pick = e.target.closest('[data-qz-pick]');
    if (pick) { q.correct = Number(pick.dataset.qzPick); renderEditor(); return; }
    if (e.target.closest('[data-qz-up]')) { move(i, i - 1); return; }
    if (e.target.closest('[data-qz-down]')) { move(i, i + 1); return; }
    if (e.target.closest('[data-qz-del]')) {
      questions.splice(i, 1);
      els.error.textContent = '';
      renderEditor();
    }
  });

  els.list.addEventListener('dragstart', (e) => {
    const card = e.target.closest('[data-qi]');
    if (!card) return;
    dragFrom = Number(card.dataset.qi);
    card.classList.add('is-dragging');
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });
  els.list.addEventListener('dragover', (e) => {
    const card = e.target.closest('[data-qi]');
    if (!card || dragFrom === null) return;
    e.preventDefault();
    if (Number(card.dataset.qi) !== dragFrom) card.classList.add('is-over');
  });
  els.list.addEventListener('dragleave', (e) => {
    const card = e.target.closest('[data-qi]');
    if (card) card.classList.remove('is-over');
  });
  els.list.addEventListener('drop', (e) => {
    const card = e.target.closest('[data-qi]');
    if (!card || dragFrom === null) return;
    e.preventDefault();
    move(dragFrom, Number(card.dataset.qi));
    dragFrom = null;
  });
  els.list.addEventListener('dragend', () => {
    dragFrom = null;
    els.list.querySelectorAll('.is-dragging,.is-over')
      .forEach((el) => el.classList.remove('is-dragging', 'is-over'));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-qz-add]')) return;
    e.preventDefault();
    questions.push(emptyQuestion());
    renderEditor();
    const last = els.list.lastElementChild;
    if (last) last.querySelector('[data-qz-text]').focus();
  });

  // -- save -----------------------------------------------------------------

  els.save.addEventListener('click', async () => {
    if (saving) return;
    const complete = questions.filter(isComplete);
    if (complete.length < MIN_QUESTIONS) {
      els.error.textContent = t(
        `Add ${MIN_QUESTIONS - complete.length} more complete question(s) — each needs a prompt and all four choices.`,
        `أضف ${MIN_QUESTIONS - complete.length} سؤالًا مكتملًا آخر — كل سؤال يحتاج نصًا وأربعة خيارات.`
      );
      return;
    }
    const token = BahjahRoomActions.requireSignedIn();
    if (!token) return;

    saving = true;
    els.error.textContent = '';
    renderEditor();
    try {
      const res = await fetch('/api/games/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          gameType: 'trivia',
          name: quizName,
          items: complete.map((q) => ({
            prompt: q.text.trim(),
            choices: q.choices.map((c) => c.trim()),
            correctIndex: q.correct,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.error.textContent = (data.error && data.error.message)
          || t('Could not save — please try again.', 'تعذّر الحفظ — حاول مرة أخرى.');
        return;
      }
      els.savedName.textContent = quizName;
      els.savedCount.textContent = String(complete.length);
      show('saved');
    } catch (err) {
      els.error.textContent = t('Network error — please try again.', 'خطأ في الشبكة — حاول مرة أخرى.');
    } finally {
      saving = false;
      renderEditor();
    }
  });

  els.another.addEventListener('click', () => {
    quizName = '';
    questions = [];
    els.input.value = '';
    els.error.textContent = '';
    syncName();
    show('name');
  });

  // Every visible string here is built in JS, so a language swap has to
  // redraw rather than rely on the page's generic .lang-fade pass.
  document.addEventListener('bahjah:lang-change', () => {
    syncName();
    if (screen === 'editor') renderEditor();
  });

  syncName();
})();
