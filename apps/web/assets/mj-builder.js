// مجلسك -- the host's side before a session (wireframes part 1): home with
// My games, the four creation steps (details, theme, questions with the
// question editor, preview & publish), launching a session, and the album.
// Saved to the server as the host goes (a draft until published).
(function () {
  const app = document.getElementById('app');
  if (!app) return;
  const UI = window.MjUI;
  const S = window.MjScreens;
  const esc = UI.esc;
  const signedIn = () => Boolean(typeof BahjahSession !== 'undefined' && BahjahSession.getToken());

  let view = 'home';
  let games = null;
  let game = null; // the game being edited
  let dirty = false;
  let editing = null; // { index, q } in the question editor sheet
  let previewMode = 'phone';
  let previewIndex = 0;
  let themePreview = 'phone';
  let hostPlays = false;
  let busy = false;
  let album = null;
  let code = '';

  const blank = () => ({ title: '', occasion: 'graduation', honoree: '', description: '', language: UI.isAr() ? 'ar' : 'en', themeId: 'graduation', themeImageId: null, questions: [], status: 'draft' });
  const newId = () => `q-${Math.random().toString(36).slice(2, 10)}`;
  const newQuestion = (format = 'mc') => ({ id: newId(), format, prompt: '', options: format === 'mc' || format === 'checklist' ? ['', ''] : [], correct: [], pairs: format === 'match' ? [{ left: '', right: '' }, { left: '', right: '' }] : [], accepted: [], maxLength: 120, scored: format === 'mc' || format === 'match', points: 100, timerSec: format === 'mc' || format === 'checklist' || format === 'match' ? 20 : null });

  // --- Saving ------------------------------------------------------------------
  async function save() {
    const body = { title: game.title, occasion: game.occasion, honoree: game.honoree, description: game.description, language: game.language, themeId: game.themeId, themeImageId: game.themeImageId, questions: game.questions };
    const res = game.id ? await UI.api('PATCH', `/games/${game.id}`, body) : await UI.api('POST', '/games', body);
    game = { ...game, ...res.game };
    dirty = false;
    return game;
  }
  async function guarded(fn) {
    if (busy) return;
    busy = true;
    try { await fn(); } catch (e) { UI.toast(UI.errorText(e), 'no'); } finally { busy = false; render(); }
  }

  // --- Views ---------------------------------------------------------------------
  function shell(body, foot, opts = {}) {
    const t = UI.t();
    const head = opts.back ? `<div class="mj-phone__head"><button type="button" class="mj-back" data-go="${opts.back}">${UI.icon(UI.back(), 16)}${esc(t.back)}</button>${opts.step ? `<span class="mj-small">${esc(t.stepOf(opts.step))}</span>` : '<span></span>'}</div>` : '';
    app.innerHTML = `<div class="mj-phone">${head}<div class="mj-phone__body">${body}</div>${foot ? `<div class="mj-phone__foot">${foot}</div>` : ''}</div>`;
  }

  function vHome() {
    const t = UI.t();
    const list = games === null ? `<p class="mj-small">…</p>` : games.length ? `<div class="mj-list">${games.map((g) => `<button type="button" class="mj-item" style="border:0;cursor:pointer;text-align:start;color:var(--ink)" data-open="${esc(g.id)}"><span class="mj-thumb" style="background-image:url('${UI.themeUrl(g.themeId, g.themeImageId)}')"></span><span class="grow mj-label" dir="auto">${esc(g.title || t.details)}</span><span class="mj-badge mj-badge--${g.status === 'published' ? 'pub' : 'draft'}">${esc(g.status === 'published' ? t.published : t.draft)}</span></button>`).join('')}</div>` : `<p class="mj-small">${esc(t.noGames)}</p>`;
    shell(`<div style="display:flex;justify-content:center;padding:8px 0 4px">${UI.logo()}</div>
      <button type="button" class="mj-btn mj-btn--block" data-create>${UI.icon('plus', 18)}${esc(t.createGame)}</button>
      <button type="button" class="mj-btn mj-btn--secondary mj-btn--block" data-go="join">${esc(t.joinCode)}</button>
      ${signedIn() ? `<span class="mj-label" style="margin-top:8px">${esc(t.myGames)}</span>${list}` : ''}`);
  }

  function vGameMenu() {
    const t = UI.t();
    shell(`<div class="mj-art mj-art--full" style="height:200px;margin:-14px -20px 0;background-image:url('${UI.themeUrl(game.themeId, game.themeImageId)}')"><span class="mj-event" dir="auto">${esc(game.title)}</span></div>
      <h1 class="mj-title" dir="auto">${esc(game.title)}</h1><span class="mj-badge mj-badge--${game.status === 'published' ? 'pub' : 'draft'}" style="align-self:flex-start">${esc(game.status === 'published' ? t.published : t.draft)}</span>
      <p class="mj-small">${esc(t.questions)} · ${UI.d(game.questions.length)}</p>`,
      `<button type="button" class="mj-btn mj-btn--block" data-go="preview">${UI.icon('play', 16)}${esc(t.launch)}</button>
       <button type="button" class="mj-btn mj-btn--secondary mj-btn--block" data-go="details">${esc(t.edit)}</button>
       <button type="button" class="mj-btn mj-btn--secondary mj-btn--block" data-album>${UI.icon('image', 16)}${esc(t.album)}</button>`, { back: 'home' });
  }

  function vJoin() {
    const t = UI.t();
    shell(`<div style="display:flex;justify-content:center">${UI.logo(true)}</div><h1 class="mj-title">${esc(t.enterCode)}</h1>
      <div class="mj-code-boxes">${[0, 1, 2, 3].map((i) => `<input class="mj-code-box" data-code-box="${i}" maxlength="1" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder=" " value="${esc(code[i] || '')}" aria-label="${i + 1}">`).join('')}</div>
      <span class="mj-small" style="text-align:center">${esc(t.codeHint)}</span>`,
      `<button type="button" class="mj-btn mj-btn--block" data-join${code.length === 4 ? '' : ' disabled'}>${esc(t.next)}</button>`, { back: 'home' });
  }

  function vDetails() {
    const t = UI.t();
    const occ = ['graduation', 'bridal', 'farewell', 'baby', 'custom'];
    shell(`<h1 class="mj-title">${esc(t.details)}</h1>
      <label class="mj-field"><span class="mj-label">${esc(t.eventTitle)}</span><input class="mj-input" data-f="title" maxlength="60" placeholder="${esc(t.eventTitlePh)}" value="${esc(game.title)}" dir="auto"></label>
      <div class="mj-field"><span class="mj-label">${esc(t.occasion)}</span><div class="mj-chips">${occ.map((o) => `<button type="button" class="mj-chip${game.occasion === o ? ' is-on' : ''}${o === 'custom' ? ' mj-chip--dashed' : ''}" data-occ="${o}" aria-pressed="${game.occasion === o}">${esc(t.occasions[o])}</button>`).join('')}</div></div>
      <label class="mj-field"><span class="mj-label">${esc(t.whoCelebrating)}</span><input class="mj-input" data-f="honoree" maxlength="40" placeholder="${esc(t.honoreePh)}" value="${esc(game.honoree)}" dir="auto"></label>
      <label class="mj-field"><span class="mj-label">${esc(t.description)}</span><input class="mj-input" data-f="description" maxlength="200" value="${esc(game.description)}" dir="auto"></label>
      <div class="mj-field"><span class="mj-label">${esc(t.gameLang)}</span><div class="mj-seg">${['ar', 'en', 'both'].map((l) => `<button type="button" class="${game.language === l ? 'is-on' : ''}" data-lang-pick="${l}">${esc(t.langs[l])}</button>`).join('')}</div></div>`,
      `<button type="button" class="mj-btn mj-btn--block" data-next="theme"${game.title.trim() && game.honoree.trim() ? '' : ' disabled'}>${esc(t.nextTheme)}</button>`, { back: game.id ? 'menu' : 'home', step: 1 });
  }

  function vTheme() {
    const t = UI.t();
    const s = { title: game.title, themeId: game.themeId, themeImageId: game.themeImageId };
    const tile = (id) => {
      const on = game.themeId === id;
      return `<button type="button" data-theme-pick="${id}" style="background:none;border:0;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--ink)"><span style="width:100%;aspect-ratio:1;border-radius:12px;background:url('${UI.themeUrl(id)}') center/cover;${on ? 'border:2.5px solid var(--ink);box-shadow:3px 3px 0 var(--ink)' : 'border:1.5px solid var(--hair)'}"></span><span class="mj-small" style="color:var(--ink)">${esc(t.themes[id])}</span></button>`;
    };
    const custom = game.themeImageId
      ? `<button type="button" data-theme-pick="custom" style="background:none;border:0;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--ink)"><span style="width:100%;aspect-ratio:1;border-radius:12px;background:url('${UI.themeUrl('custom', game.themeImageId)}') center/cover;${game.themeId === 'custom' ? 'border:2.5px solid var(--ink);box-shadow:3px 3px 0 var(--ink)' : 'border:1.5px solid var(--hair)'}"></span><span class="mj-small" style="color:var(--ink)">${esc(t.themes.custom)}</span></button>`
      : `<label class="mj-dash" style="aspect-ratio:1;flex-direction:column;min-height:0">${UI.icon('upload', 18)}<span class="mj-small" style="color:var(--ink)">${esc(t.upload)}</span><input type="file" accept="image/jpeg,image/png" data-theme-file hidden></label>`;
    const previewCard = themePreview === 'phone'
      ? `<div class="mj-art" style="height:180px;border-radius:20px;overflow:hidden;background-image:url('${UI.themeUrl(s.themeId, s.themeImageId)}')"><span style="position:absolute;bottom:14px;inset-inline:0;text-align:center;z-index:2"><span class="mj-h2" dir="auto">${esc(game.title)}</span><br><span class="mj-small">${esc(t.livePreview)}</span></span></div>`
      : `<div style="position:relative;height:180px;border-radius:16px;overflow:hidden;border:1.5px solid var(--hair);background:var(--paper)"><div class="mj-side-art" style="background-image:url('${UI.themeUrl(s.themeId, s.themeImageId)}')"></div><div style="position:relative;padding:22px 18px;display:flex;flex-direction:column;gap:6px;width:55%"><span class="mj-small">${esc(t.welcomeTo)}</span><span class="mj-h2" dir="auto">${esc(game.title)}</span><span class="mj-code" style="font-size:24px;letter-spacing:4px">K7Q4</span></div></div>`;
    shell(`<h1 class="mj-title">${esc(t.pickTheme)}</h1>${previewCard}
      <div class="mj-seg"><button type="button" class="${themePreview === 'phone' ? 'is-on' : ''}" data-tp="phone">${esc(t.phone)}</button><button type="button" class="${themePreview === 'tv' ? 'is-on' : ''}" data-tp="tv">${esc(t.shared)}</button></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${UI.THEMES.map(tile).join('')}${custom}</div>
      ${game.themeImageId ? `<button type="button" class="mj-btn mj-btn--ghost mj-btn--sm" data-remove-image style="align-self:flex-start">${UI.icon('trash', 14)}${esc(t.removeImage)}</button>` : ''}
      <p class="mj-small">${esc(t.uploadNote)}</p>`,
      `<button type="button" class="mj-btn mj-btn--block" data-next="questions">${esc(t.nextQuestions)}</button>`, { back: 'details', step: 2 });
  }

  function qBadge(q) {
    const t = UI.t();
    const scored = q.scored && q.format !== 'photo' && !(q.format === 'text' && !q.accepted.some((a) => a.trim()));
    return `${esc(t.formats[q.format])} · ${esc(scored ? t.ptsBadge(q.points) : t.unscored)}`;
  }
  function vQuestions() {
    const t = UI.t();
    const rows = game.questions.map((q, i) => `<div class="mj-item"><span style="color:var(--muted);display:inline-flex">${UI.icon('grip', 16)}</span>
      <button type="button" class="grow" data-edit-q="${i}" style="background:none;border:0;text-align:start;cursor:pointer;color:var(--ink);font:700 14px/1.3 var(--font-content);padding:0" dir="auto">${esc(q.prompt || '…')}</button>
      <span class="mj-badge${q.format === 'photo' || !q.scored ? '' : ' mj-badge--draft'}">${qBadge(q)}</span>
      <span style="display:flex;flex-direction:column"><button type="button" class="mj-btn mj-btn--ghost mj-btn--sm mj-btn--icon" style="height:22px" data-move="${i}:-1" aria-label="${esc(t.moveUp)}"${i ? '' : ' disabled'}>${UI.icon('up', 14)}</button><button type="button" class="mj-btn mj-btn--ghost mj-btn--sm mj-btn--icon" style="height:22px" data-move="${i}:1" aria-label="${esc(t.moveDown)}"${i < game.questions.length - 1 ? '' : ' disabled'}>${UI.icon('down', 14)}</button></span></div>`).join('');
    shell(`<h1 class="mj-title">${esc(t.questions)}</h1>${rows ? `<div class="mj-list">${rows}</div>` : `<p class="mj-small">${esc(t.noQuestions)}</p>`}
      ${game.questions.length < 30 ? `<button type="button" class="mj-dash" data-add-q>${UI.icon('plus', 16)}${esc(t.addQuestion)}</button>` : ''}`,
      `<button type="button" class="mj-btn mj-btn--block" data-next="preview"${game.questions.length ? '' : ' disabled'}>${esc(t.nextPreview)}</button>`, { back: 'theme', step: 3 });
    if (editing) paintEditor();
  }

  // --- The question editor sheet ------------------------------------------------------
  let sheet = null;
  function paintEditor() {
    const t = UI.t();
    const q = editing.q;
    if (!sheet) { sheet = document.createElement('div'); sheet.className = 'mj-sheet'; document.body.appendChild(sheet); sheet.addEventListener('click', onSheetClick); sheet.addEventListener('input', onSheetInput); }
    const fmts = ['mc', 'text', 'checklist', 'match', 'photo'];
    let fields = '';
    if (q.format === 'mc' || q.format === 'checklist') {
      fields = `<span class="mj-small">${esc(t.markCorrect)}</span><div class="mj-list">${q.options.map((o, i) => `<div style="display:flex;gap:8px;align-items:center"><button type="button" class="mj-box" style="cursor:pointer;${q.correct.includes(i) ? 'background:var(--ok-bg);border-color:var(--ok-border)' : ''}" data-correct="${i}" aria-pressed="${q.correct.includes(i)}" aria-label="✓">${q.correct.includes(i) ? UI.icon('check', 14) : ''}</button>
        <input class="mj-input" style="${q.correct.includes(i) ? 'background:var(--ok-bg);border-color:var(--ok-border)' : ''}" data-opt="${i}" maxlength="60" placeholder="${esc(t.option(i + 1))}" value="${esc(o)}" dir="auto">
        ${q.options.length > (q.format === 'mc' ? 2 : 1) ? `<button type="button" class="mj-btn mj-btn--ghost mj-btn--icon mj-btn--sm" data-del-opt="${i}" aria-label="x">${UI.icon('x', 14)}</button>` : ''}</div>`).join('')}</div>
        ${q.options.length < 6 ? `<button type="button" class="mj-btn mj-btn--ghost mj-btn--sm" style="align-self:flex-start;color:var(--brand)" data-add-opt>${esc(t.addOption)}</button>` : ''}`;
    } else if (q.format === 'match') {
      fields = `<div class="mj-list">${q.pairs.map((p, i) => `<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center"><input class="mj-input" data-left="${i}" maxlength="40" placeholder="${esc(t.leftPh)}" value="${esc(p.left)}" dir="auto"><input class="mj-input" data-right="${i}" maxlength="40" placeholder="${esc(t.rightPh)}" value="${esc(p.right)}" dir="auto">${q.pairs.length > 2 ? `<button type="button" class="mj-btn mj-btn--ghost mj-btn--icon mj-btn--sm" data-del-pair="${i}" aria-label="x">${UI.icon('x', 14)}</button>` : '<span></span>'}</div>`).join('')}</div>
        ${q.pairs.length < 5 ? `<button type="button" class="mj-btn mj-btn--ghost mj-btn--sm" style="align-self:flex-start;color:var(--brand)" data-add-pair>${esc(t.addPair)}</button>` : ''}`;
    } else if (q.format === 'text') {
      fields = `<label class="mj-field"><span class="mj-label">${esc(t.accepted)}</span>${[0, 1, 2].map((i) => `<input class="mj-input" data-acc="${i}" maxlength="60" placeholder="${esc(t.acceptedPh)}" value="${esc(q.accepted[i] || '')}" dir="auto">`).join('')}</label>
        <div class="mj-row"><span class="mj-label">${esc(t.maxLen)}</span><span style="display:flex;gap:6px">${[60, 120, 200].map((n) => `<button type="button" class="mj-chip${q.maxLength === n ? ' is-on' : ''}" data-maxlen="${n}">${UI.d(n)}</button>`).join('')}</span></div><span class="mj-small">${esc(t.textNote)}</span>`;
    } else {
      fields = `<span class="mj-small">${esc(t.photoNote)}</span>`;
    }
    const scoreable = q.format !== 'photo';
    sheet.innerHTML = `<div role="dialog" aria-modal="true" aria-label="${esc(t.questionEditor)}">
      <span class="mj-label">${esc(t.format)}</span><div class="mj-chips">${fmts.map((f) => `<button type="button" class="mj-chip${q.format === f ? ' is-on' : ''}" data-fmt="${f}">${esc(t.formats[f])}</button>`).join('')}</div>
      <input class="mj-input" data-prompt maxlength="200" placeholder="${esc(t.promptPh)}" value="${esc(q.prompt)}" dir="auto" aria-label="${esc(t.prompt)}">
      ${fields}
      <div class="mj-row">${scoreable ? `<label style="display:flex;align-items:center;gap:8px;cursor:pointer" class="mj-label"><input type="checkbox" data-scored${q.scored ? ' checked' : ''}> ${esc(t.scored)}</label>${q.scored ? `<span style="display:flex;gap:4px">${[50, 100, 200].map((n) => `<button type="button" class="mj-chip${q.points === n ? ' is-on' : ''}" data-pts="${n}">${UI.d(n)}</button>`).join('')}</span>` : ''}` : '<span></span>'}</div>
      <div class="mj-row"><span class="mj-label">${esc(t.timer)}</span><span style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${[null, 10, 20, 30, 60].map((n) => `<button type="button" class="mj-chip${q.timerSec === n ? ' is-on' : ''}" data-timer="${n === null ? '' : n}">${esc(n === null ? t.noTimer : t.secs(n))}</button>`).join('')}</span></div>
      <button type="button" class="mj-btn mj-btn--block" data-save-q>${esc(t.saveQuestion)}</button>
      ${editing.index !== null ? `<button type="button" class="mj-btn mj-btn--danger mj-btn--block" data-del-q>${UI.icon('trash', 15)}${esc(t.deleteQuestion)}</button>` : ''}</div>`;
  }
  function closeEditor() { editing = null; if (sheet) { sheet.remove(); sheet = null; } }
  function onSheetInput(e) {
    const q = editing.q;
    const el = e.target;
    if (el.matches('[data-prompt]')) q.prompt = el.value;
    else if (el.matches('[data-opt]')) q.options[Number(el.dataset.opt)] = el.value;
    else if (el.matches('[data-left]')) q.pairs[Number(el.dataset.left)].left = el.value;
    else if (el.matches('[data-right]')) q.pairs[Number(el.dataset.right)].right = el.value;
    else if (el.matches('[data-acc]')) { const a = q.accepted.slice(); a[Number(el.dataset.acc)] = el.value; q.accepted = a.map((x) => x || '').filter((x, i, arr) => x || i < arr.length - 1); }
    else if (el.matches('[data-scored]')) { q.scored = el.checked; paintEditor(); }
  }
  function onSheetClick(e) {
    const q = editing.q;
    if (e.target === sheet) { closeEditor(); return; }
    const f = e.target.closest('[data-fmt]');
    if (f && f.dataset.fmt !== q.format) {
      const fresh = newQuestion(f.dataset.fmt);
      editing.q = { ...fresh, id: q.id, prompt: q.prompt, timerSec: q.timerSec === null && fresh.timerSec ? fresh.timerSec : q.timerSec };
      paintEditor(); return;
    }
    const c = e.target.closest('[data-correct]');
    if (c) { const i = Number(c.dataset.correct); q.correct = q.format === 'mc' ? [i] : q.correct.includes(i) ? q.correct.filter((x) => x !== i) : [...q.correct, i]; if (!q.scored) q.scored = true; paintEditor(); return; }
    if (e.target.closest('[data-add-opt]')) { q.options.push(''); paintEditor(); return; }
    const dOpt = e.target.closest('[data-del-opt]');
    if (dOpt) { const i = Number(dOpt.dataset.delOpt); q.options.splice(i, 1); q.correct = q.correct.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)); paintEditor(); return; }
    if (e.target.closest('[data-add-pair]')) { q.pairs.push({ left: '', right: '' }); paintEditor(); return; }
    const dPair = e.target.closest('[data-del-pair]');
    if (dPair) { q.pairs.splice(Number(dPair.dataset.delPair), 1); paintEditor(); return; }
    const ml = e.target.closest('[data-maxlen]');
    if (ml) { q.maxLength = Number(ml.dataset.maxlen); paintEditor(); return; }
    const p = e.target.closest('[data-pts]');
    if (p) { q.points = Number(p.dataset.pts); paintEditor(); return; }
    const tm = e.target.closest('[data-timer]');
    if (tm) { q.timerSec = tm.dataset.timer ? Number(tm.dataset.timer) : null; paintEditor(); return; }
    if (e.target.closest('[data-save-q]')) {
      if (editing.index === null) game.questions.push(q); else game.questions[editing.index] = q;
      dirty = true; closeEditor(); guarded(save); return;
    }
    if (e.target.closest('[data-del-q]')) {
      game.questions.splice(editing.index, 1); dirty = true; closeEditor(); guarded(save);
    }
  }

  // --- Preview & publish --------------------------------------------------------------
  function asGuestView(q, i) {
    return {
      question: { ...q, lefts: q.pairs.map((p) => p.left), rights: q.pairs.map((p) => p.right).reverse(), options: q.options.filter((o) => o.trim()) },
      index: i, total: game.questions.length, phaseEndsAt: null, paused: false, myAnswer: null, answeredCount: 9, playerCount: 12,
    };
  }
  function vPreview() {
    const t = UI.t();
    const s = { title: game.title, honoree: game.honoree, themeId: game.themeId, themeImageId: game.themeImageId };
    const q = game.questions[Math.min(previewIndex, game.questions.length - 1)];
    let frame = '';
    if (q) {
      const x = asGuestView(q, previewIndex);
      frame = previewMode === 'phone'
        ? `<div style="border:2px solid var(--ink);border-radius:28px;overflow:hidden;background:var(--paper);pointer-events:none">${S.guestQuestion(s, x, { preview: 'static' })}</div>`
        : `<div style="position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:12px"><div class="mj-tv" id="mj-preview-tv" style="position:absolute;left:0;top:0;transform-origin:top left">${S.tvQuestion(s, x)}</div></div>`;
    }
    const problems = game.problems || [];
    const list = problems.map((p) => `<li>${esc(p.index === null ? t.problems[p.code] : t.qProblem(p.index + 1, t.problems[p.code]))}</li>`).join('');
    shell(`<h1 class="mj-title">${esc(t.preview)}</h1>
      <div class="mj-seg"><button type="button" class="${previewMode === 'phone' ? 'is-on' : ''}" data-pm="phone">${esc(t.guestPhone)}</button><button type="button" class="${previewMode === 'tv' ? 'is-on' : ''}" data-pm="tv">${esc(t.shared)}</button></div>
      ${frame}
      <div class="mj-row" style="justify-content:center"><button type="button" class="mj-btn mj-btn--ghost mj-btn--sm mj-btn--icon" data-pq="-1" aria-label="‹"${previewIndex ? '' : ' disabled'}>${UI.icon(UI.isAr() ? 'right' : 'left', 16)}</button><span class="mj-label">${esc(t.qOf(previewIndex + 1, game.questions.length))}</span><button type="button" class="mj-btn mj-btn--ghost mj-btn--sm mj-btn--icon" data-pq="1" aria-label="›"${previewIndex < game.questions.length - 1 ? '' : ' disabled'}>${UI.icon(UI.isAr() ? 'left' : 'right', 16)}</button></div>
      ${list ? `<ul class="mj-err" style="margin:0;padding-inline-start:18px">${list}</ul>` : ''}
      <button type="button" class="mj-btn mj-btn--ghost" style="justify-content:space-between;height:auto;padding:6px 0;text-align:start" data-hostplays role="switch" aria-checked="${hostPlays}"><span><span class="mj-label">${esc(t.hostPlays)}</span><br><span class="mj-small">${esc(t.hostPlaysSub)}</span></span><span class="mj-box" style="border-radius:999px;width:26px;height:26px">${hostPlays ? UI.icon('check', 14) : ''}</span></button>
      <p class="mj-small">${esc(t.editsNote)}</p>`,
      `<button type="button" class="mj-btn mj-btn--secondary mj-btn--block" data-save-draft>${esc(t.saveDraft)}</button>
       <button type="button" class="mj-btn mj-btn--block" data-launch${problems.length ? ' disabled' : ''}>${esc(t.publishLaunch)}</button>`, { back: 'questions', step: 4 });
    const tv = document.getElementById('mj-preview-tv');
    if (tv) tv.style.transform = `scale(${tv.parentElement.clientWidth / 960})`;
  }

  function vAlbum() {
    const t = UI.t();
    if (!album) { shell('<p class="mj-small">…</p>', '', { back: 'menu' }); return; }
    const link = `${location.origin}/majlisak-album.html?t=${album.token}`;
    shell(`<h1 class="mj-title" dir="auto">${esc(t.albumTitle(album.honoree))}</h1>
      ${album.photos.length || album.notes.length ? '' : `<p class="mj-small">${esc(t.albumEmpty)}</p>`}
      ${album.photos.length ? `<span class="mj-label">${esc(t.photos)} · ${UI.d(album.photos.length)}</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${album.photos.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener" style="display:block;aspect-ratio:1;border-radius:14px;background:url('${esc(p.url)}') center/cover;border:1.5px solid var(--hair)" title="${esc(p.author)}"></a>`).join('')}</div>` : ''}
      ${album.notes.length ? `<span class="mj-label">${esc(t.notes)} · ${UI.d(album.notes.length)}</span><div class="mj-list">${album.notes.map((n) => `<div class="mj-card"><span dir="auto" style="font:600 15px/1.5 var(--font-content)">${esc(n.text)}</span><span class="mj-small">${esc(t.from(n.authorName))}</span></div>`).join('')}</div>` : ''}
      <p class="mj-small">${esc(t.albumPrivate)}</p>`,
      `<button type="button" class="mj-btn mj-btn--block" data-share-album="${esc(link)}">${UI.icon('link', 16)}${esc(t.shareAlbum)}</button>`, { back: 'menu' });
  }

  function render() {
    switch (view) {
      case 'home': return vHome();
      case 'join': return vJoin();
      case 'menu': return vGameMenu();
      case 'details': return vDetails();
      case 'theme': return vTheme();
      case 'questions': return vQuestions();
      case 'preview': return vPreview();
      case 'album': return vAlbum();
      default: return vHome();
    }
  }
  function go(v) { view = v; window.scrollTo(0, 0); render(); }

  async function loadGames() {
    if (!signedIn()) { games = []; return; }
    try { games = (await UI.api('GET', '/games')).games; } catch (_) { games = []; }
  }

  // --- Events -------------------------------------------------------------------------
  app.addEventListener('input', (e) => {
    const f = e.target.closest('[data-f]');
    if (f && game) { game[f.dataset.f] = f.value; dirty = true; const n = app.querySelector('[data-next]'); if (n && view === 'details') n.disabled = !(game.title.trim() && game.honoree.trim()); }
    const box = e.target.closest('[data-code-box]');
    if (box) {
      box.value = box.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
      const boxes = [...app.querySelectorAll('[data-code-box]')];
      code = boxes.map((b) => b.value).join('');
      if (box.value) { const nx = boxes[Number(box.dataset.codeBox) + 1]; if (nx) nx.focus(); }
      app.querySelector('[data-join]').disabled = code.length !== 4;
    }
  });
  app.addEventListener('keydown', (e) => {
    const box = e.target.closest('[data-code-box]');
    if (box && e.key === 'Backspace' && !box.value) { const pv = app.querySelector(`[data-code-box="${Number(box.dataset.codeBox) - 1}"]`); if (pv) pv.focus(); }
  });
  app.addEventListener('paste', (e) => {
    if (!e.target.closest('[data-code-box]')) return;
    const text = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (!text) return;
    e.preventDefault(); code = text; render();
  });
  app.addEventListener('change', async (e) => {
    const file = e.target.closest('[data-theme-file]');
    if (!file || !file.files[0]) return;
    await guarded(async () => {
      const blob = await UI.shrinkImage(file.files[0], 1600, 500 * 1024);
      const res = await UI.api('POST', '/images', undefined, blob);
      game.themeImageId = res.id; game.themeId = 'custom';
      await save();
    });
  });
  app.addEventListener('click', async (e) => {
    const t = UI.t();
    const g = e.target.closest('[data-go]');
    if (g) {
      if (dirty && game && ['details', 'theme', 'questions'].includes(view)) await guarded(save);
      if (g.dataset.go === 'home') { game = null; await loadGames(); }
      go(g.dataset.go); return;
    }
    if (e.target.closest('[data-create]')) {
      if (!signedIn()) { location.href = `auth.html?next=${encodeURIComponent('majlisak.html?create=1')}`; return; }
      game = blank(); go('details'); return;
    }
    const open = e.target.closest('[data-open]');
    if (open) { await guarded(async () => { game = (await UI.api('GET', `/games/${open.dataset.open}`)).game; }); go('menu'); return; }
    if (e.target.closest('[data-join]')) { location.href = `majlisak-lobby.html?code=${encodeURIComponent(code)}`; return; }
    const occ = e.target.closest('[data-occ]');
    if (occ) { game.occasion = occ.dataset.occ; if (game.themeId !== 'custom' && !game.id) game.themeId = UI.OCCASION_THEME[occ.dataset.occ]; dirty = true; render(); return; }
    const lp = e.target.closest('[data-lang-pick]');
    if (lp) { game.language = lp.dataset.langPick; dirty = true; render(); return; }
    const nx = e.target.closest('[data-next]');
    if (nx) { await guarded(save); if (game.id) go(nx.dataset.next); return; }
    const tp = e.target.closest('[data-tp]');
    if (tp) { themePreview = tp.dataset.tp; render(); return; }
    const th = e.target.closest('[data-theme-pick]');
    if (th) { game.themeId = th.dataset.themePick; dirty = true; render(); return; }
    if (e.target.closest('[data-remove-image]')) { game.themeImageId = null; if (game.themeId === 'custom') game.themeId = UI.OCCASION_THEME[game.occasion] || 'bridal'; dirty = true; await guarded(save); return; }
    if (e.target.closest('[data-add-q]')) { editing = { index: null, q: newQuestion('mc') }; paintEditor(); return; }
    const eq = e.target.closest('[data-edit-q]');
    if (eq) { const i = Number(eq.dataset.editQ); editing = { index: i, q: JSON.parse(JSON.stringify(game.questions[i])) }; paintEditor(); return; }
    const mv = e.target.closest('[data-move]');
    if (mv) { const [i, by] = mv.dataset.move.split(':').map(Number); const j = i + by; [game.questions[i], game.questions[j]] = [game.questions[j], game.questions[i]]; dirty = true; await guarded(save); return; }
    const pm = e.target.closest('[data-pm]');
    if (pm) { previewMode = pm.dataset.pm; render(); return; }
    const pq = e.target.closest('[data-pq]');
    if (pq) { previewIndex = Math.max(0, Math.min(game.questions.length - 1, previewIndex + Number(pq.dataset.pq))); render(); return; }
    if (e.target.closest('[data-hostplays]')) { hostPlays = !hostPlays; render(); return; }
    if (e.target.closest('[data-save-draft]')) { await guarded(save); UI.toast(t.saved); return; }
    if (e.target.closest('[data-launch]')) {
      await guarded(async () => {
        if (dirty) await save();
        const res = await UI.api('POST', `/games/${game.id}/launch`, { hostPlays });
        location.href = `majlisak-lobby.html?code=${encodeURIComponent(res.room.code)}`;
      });
      return;
    }
    if (e.target.closest('[data-album]')) { album = null; go('album'); await guarded(async () => { album = (await UI.api('GET', `/games/${game.id}/album`)).album; }); return; }
    const sa = e.target.closest('[data-share-album]');
    if (sa) { UI.shareOrCopy(t.albumTitle(album.honoree), sa.dataset.shareAlbum); }
  });
  document.addEventListener('bahjah:lang-change', () => { render(); if (editing) paintEditor(); });
  window.addEventListener('resize', () => { if (view === 'preview') render(); });

  UI.initLang();
  render();
  loadGames().then(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('create') === '1' && signedIn()) { history.replaceState(null, '', 'majlisak.html'); game = blank(); go('details'); return; }
    if (params.get('join') === '1') { go('join'); return; }
    render();
  });
})();
