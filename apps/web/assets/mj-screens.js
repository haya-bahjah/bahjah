// مجلسك -- the screens more than one surface draws: a guest's answer screen
// for each of the five formats (the guest phone, the host's phone when they
// play too, and the builder's preview), and the shared screen's question.
// Pure HTML strings; the caller owns the draft answer and the events.
window.MjScreens = (function () {
  const UI = window.MjUI;
  const esc = UI.esc;

  // The draft answer a guest is building, per question id.
  const drafts = {};
  function draft(q) {
    if (!drafts[q.id]) drafts[q.id] = { choice: null, choices: [], pairs: q.lefts ? q.lefts.map(() => null) : [], pickedLeft: null, text: '', photoId: null, preview: null, uploading: false };
    return drafts[q.id];
  }
  // The answer to send, or null while it is incomplete.
  function value(q) {
    const dr = draft(q);
    switch (q.format) {
      case 'mc': return dr.choice === null ? null : { choice: dr.choice };
      case 'checklist': return dr.choices.length ? { choices: dr.choices.slice() } : null;
      case 'match': return dr.pairs.length && dr.pairs.every((p) => p !== null) ? { pairs: dr.pairs.slice() } : null;
      case 'text': return dr.text.trim() ? { text: dr.text.trim() } : null;
      case 'photo': return dr.photoId ? { photoId: dr.photoId } : null;
      default: return null;
    }
  }
  // Handles a tap inside an answer screen; returns true if it changed the draft.
  function onTap(q, target) {
    const dr = draft(q);
    const o = target.closest('[data-mj-opt]');
    if (o && !o.disabled) {
      const i = Number(o.dataset.mjOpt);
      if (q.format === 'mc') dr.choice = i;
      else if (q.format === 'checklist') dr.choices = dr.choices.includes(i) ? dr.choices.filter((x) => x !== i) : [...dr.choices, i].sort((a, b) => a - b);
      return true;
    }
    const l = target.closest('[data-mj-left]');
    if (l) {
      const i = Number(l.dataset.mjLeft);
      if (dr.pairs[i] !== null) { dr.pairs[i] = null; dr.pickedLeft = i; } else dr.pickedLeft = dr.pickedLeft === i ? null : i;
      return true;
    }
    const s = target.closest('[data-mj-slot]');
    if (s) {
      const i = Number(s.dataset.mjSlot);
      if (dr.pairs[i] !== null) dr.pairs[i] = null;
      else dr.pickedLeft = i;
      return true;
    }
    const r = target.closest('[data-mj-right]');
    if (r) {
      const j = Number(r.dataset.mjRight);
      let at = dr.pickedLeft;
      if (at === null) at = dr.pairs.findIndex((p) => p === null);
      if (at < 0) return false;
      dr.pairs[at] = j;
      dr.pickedLeft = dr.pairs.findIndex((p) => p === null);
      if (dr.pickedLeft < 0) dr.pickedLeft = null;
      return true;
    }
    return false;
  }

  // The answer area for one question. opts.locked shows a sent answer;
  // opts.reveal colours right and wrong (green / red), never before.
  function answerArea(q, opts = {}) {
    const t = UI.t();
    const sent = opts.sent || null;
    const dr = draft(q);
    const disabled = Boolean(sent) || opts.preview === 'static';
    const rv = opts.reveal || null;
    switch (q.format) {
      case 'mc':
      case 'checklist': {
        const picked = sent ? ('choice' in sent ? [sent.choice] : sent.choices || []) : q.format === 'mc' ? (dr.choice === null ? [] : [dr.choice]) : dr.choices;
        const rows = q.options.map((label, i) => {
          let cls = picked.includes(i) ? ' is-sel' : '';
          if (rv) cls = rv.correct.includes(i) ? ' is-ok' : picked.includes(i) ? ' is-no' : '';
          const box = q.format === 'checklist' ? `<span class="mj-box">${picked.includes(i) ? UI.icon('check', 14) : ''}</span>` : '';
          return `<button type="button" class="mj-opt${cls}" data-mj-opt="${i}"${disabled || rv ? ' disabled' : ''} aria-pressed="${picked.includes(i)}">${box}<span dir="auto">${esc(label)}</span></button>`;
        });
        const hint = q.format === 'checklist' ? `<span class="mj-small">${esc(t.pickAll)}</span>` : '';
        return `${hint}<div class="mj-opts" role="${q.format === 'mc' ? 'radiogroup' : 'group'}">${rows.join('')}</div>`;
      }
      case 'match': {
        const pairs = sent && sent.pairs ? sent.pairs : dr.pairs;
        const used = new Set(pairs.filter((p) => p !== null));
        const rows = q.lefts.map((left, i) => {
          const r = pairs[i];
          let slotCls = r !== null && r !== undefined ? ' is-filled' : '';
          if (rv) slotCls += rv.rightFor && rv.rightFor[i] === r ? ' is-ok' : ' is-no';
          return `<button type="button" class="mj-opt${dr.pickedLeft === i && !disabled ? ' is-sel' : ''}" data-mj-left="${i}"${disabled || rv ? ' disabled' : ''}><span dir="auto">${esc(left)}</span></button>
            <button type="button" class="mj-slot${slotCls}" data-mj-slot="${i}"${disabled || rv ? ' disabled' : ''}><span dir="auto">${r !== null && r !== undefined ? esc(q.rights[r]) : ''}</span></button>`;
        });
        const pills = q.rights.map((right, j) => (used.has(j) ? '' : `<button type="button" class="mj-pill" data-mj-right="${j}"${disabled ? ' disabled' : ''}><span dir="auto">${esc(right)}</span></button>`)).join('');
        return `<span class="mj-small">${esc(t.tapMatch)}</span><div class="mj-match">${rows.join('')}</div>${pills ? `<div class="mj-chips">${pills}</div>` : ''}`;
      }
      case 'text': {
        const text = sent ? sent.text : dr.text;
        return `<textarea class="mj-input" data-mj-text maxlength="${q.maxLength}" placeholder="${esc(t.typeAnswer)}" dir="auto"${disabled ? ' disabled' : ''}>${esc(text)}</textarea>
          <span class="mj-small" style="text-align:end" data-mj-count>${UI.d(text.length)} / ${UI.d(q.maxLength)}</span>`;
      }
      case 'photo': {
        const img = dr.preview ? `<img src="${esc(dr.preview)}" alt="">` : '';
        return `<label class="mj-drop"${disabled ? '' : ' data-mj-photo'}>${img || `${UI.icon('camera', 34)}<span class="mj-label">${esc(dr.uploading ? t.uploading : t.takePhoto)}</span>`}
          ${disabled ? '' : '<input type="file" accept="image/*" data-mj-file hidden>'}</label>
          <span class="mj-small">${esc(t.albumNote(opts.honoree || ''))}</span>`;
      }
      default:
        return '';
    }
  }

  // The guest phone's question screen: banner, number and timer, progress,
  // the prompt, the answer area and the lock-in button.
  function guestQuestion(s, x, opts = {}) {
    const t = UI.t();
    const q = x.question;
    const val = value(q);
    const cta = q.format === 'text' || q.format === 'photo' ? t.submit : t.lockIn;
    const progress = x.total ? Math.round(((x.index + 1) / x.total) * 100) : 0;
    const head = `${UI.art('banner', s)}<div class="mj-phone__body" style="padding-top:22px">
      <div class="mj-row"><span class="mj-label">${esc(t.qOf(x.index + 1, x.total))}</span>${UI.timer(x)}</div>
      <div class="mj-progress"><i style="width:${progress}%"></i></div>
      <h1 class="mj-q" dir="auto">${esc(q.prompt)}</h1>
      ${answerArea(q, { sent: x.myAnswer, preview: opts.preview, honoree: s.honoree })}</div>`;
    const foot = x.myAnswer || opts.preview === 'static' ? '' : `<div class="mj-phone__foot"><button type="button" class="mj-btn mj-btn--block" data-mj-send${val && !draft(q).uploading ? '' : ' disabled'}>${esc(cta)}</button></div>`;
    return head + foot;
  }

  // The shared screen's question (S2): banner with the event chip and the
  // timer pill, number, prompt, the options in a 2 x 2 grid, and how many
  // have answered.
  function tvQuestion(s, x) {
    const t = UI.t();
    const q = x.question;
    let body = '';
    if (q.format === 'mc' || q.format === 'checklist') {
      body = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${q.options.map((o) => `<div class="mj-opt" style="min-height:56px;font-size:21px;cursor:default" dir="auto">${esc(o)}</div>`).join('')}</div>`;
    } else if (q.format === 'match') {
      body = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="mj-opts">${q.lefts.map((l) => `<div class="mj-opt" style="font-size:20px;cursor:default" dir="auto">${esc(l)}</div>`).join('')}</div><div class="mj-opts">${q.rights.map((r) => `<div class="mj-opt" style="font-size:20px;cursor:default;border-style:dashed" dir="auto">${esc(r)}</div>`).join('')}</div></div>`;
    } else {
      body = `<div class="mj-sticker" style="padding:22px;display:flex;align-items:center;gap:14px;font:700 20px var(--font-display)">${UI.icon(q.format === 'photo' ? 'camera' : 'heart', 26)}${esc(q.format === 'photo' ? t.takePhoto : t.typeAnswer)}</div>`;
    }
    const pill = q.timerSec ? `<span style="position:absolute;inset-inline-end:28px;top:92px;z-index:3;background:var(--ink);color:var(--paper);border-radius:999px;padding:6px 14px">${UI.timer(x)}</span>` : '';
    return `<div class="mj-tv__screen" style="flex-direction:column">
      <div class="mj-art" style="height:130px;flex:none;background-image:url('${UI.themeUrl(s.themeId, s.themeImageId)}')"><span class="mj-event" style="top:12px;inset-inline-start:28px;height:30px;font-size:15px" dir="auto">${esc(s.title)}</span></div>${pill}
      <div style="padding:14px 36px 24px;display:flex;flex-direction:column;gap:14px;flex:1;min-height:0">
        <span class="mj-label" style="font-size:15px">${esc(t.qOf(x.index + 1, x.total))}</span>
        <h1 style="font:700 34px/1.3 var(--font-content);margin:0" dir="auto">${esc(q.prompt)}</h1>
        ${body}
        <div style="flex:1"></div><span class="mj-label" style="font-size:14px;color:var(--muted)">${esc(t.answered(x.answeredCount || 0, x.playerCount || 0))}</span></div></div>`;
  }

  return { draft, value, onTap, answerArea, guestQuestion, tvQuestion, drafts };
})();
