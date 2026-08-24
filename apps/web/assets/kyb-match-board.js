// Shared rope-drag matching board for Knows You Best, used by both
// knows-you-best-play.js (always) and knows-you-best-host-console.js (only
// when the host opted in to play). Fully self-contained -- injects its own
// styles once, no dependency on the host page's CSS.
//
// Matching works two ways, on both columns:
//   - Drag: pick up a name chip and drop it on an answer card, or pick up
//     an answer card and drop it on a name chip.
//   - Click: tap an item to arm it (a "pending" selection), then tap an
//     item in the other column to complete the match. Tapping the same
//     pending item again cancels the selection; tapping a different item
//     in the same column swaps which one is pending.
// Tapping an already-connected item (with nothing pending) disconnects it,
// same as before.
//
// Usage: window.BahjahKybMatchBoard.mount(container, {
//   names: [{userId, displayName}],       // left column
//   answers: [{index, text}],             // right column
//   labels: {submitBtn, waiting, hint},
//   onSubmit(matches),                    // matches: {answerIndex: userId}, called once, board locks after
// })
// Returns a handle: { getMatches(), destroy() }.
(function () {
  // One per player, straight off the handoff's accent table. Read from the
  // theme rather than hardcoded hex so light (paper) and dark both work --
  // this used to be a generic ten-colour set with reds and blues that are in
  // no KYB palette, which is what made the signature screen look imported
  // from another product.
  const ROPE_TOKENS = ['--kyb-yellow', '--kyb-green', '--kyb-pink', '--kyb-cyan', '--kyb-purple'];

  // Per-index tilt so neighbours never match, per the handoff's "rotate
  // (+/-0.8-2deg), varied per index" note.
  const TILTS = ['-1.4deg', '1.1deg', '-0.8deg', '1.7deg', '-1.9deg'];
  function tiltAt(i) {
    return TILTS[i % TILTS.length];
  }

  function accentAt(i) {
    const name = ROPE_TOKENS[i % ROPE_TOKENS.length];
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || `var(${name})`;
  }

  const CLICK_MOVE_THRESHOLD_PX = 6;

  function injectStylesOnce() {
    if (document.getElementById('kmb-styles')) return;
    const style = document.createElement('style');
    style.id = 'kmb-styles';
    style.textContent = `
      .kmb-wrap{ width:100%; }
      /* Two even columns -- answers to place on the left, the people they
         might belong to on the right -- with the connector layer spanning
         both. The handoff's phone board, at its own 30px gutter. */
      .kmb-columns{
        position:relative; display:grid; grid-template-columns:1fr 1fr;
        gap:30px; padding-block:8px; align-items:start;
      }
      .kmb-svg{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; grid-area:1/1/2/3; }
      .kmb-col{ display:flex; flex-direction:column; gap:8px; min-width:0; z-index:1; }
      /* Each column names itself, so neither side needs a legend. */
      .kmb-col::before{
        content:attr(data-col-label);
        font-family:var(--font-pixel); font-size:11px; letter-spacing:.08em;
        text-transform:uppercase; color:var(--kyb-ink-40);
      }
      /* Hand-drawn shapes: irregular corners plus a per-index tilt, so no two
         neighbours match -- the radius pattern is the handoff's own. */
      /* A player is a slot waiting to be filled, so it is drawn dashed until
         an answer lands on it -- the handoff's own distinction between the
         thing you move and the place it goes. */
      .kmb-chip{
        touch-action:none; cursor:grab; user-select:none;
        border:2px dashed var(--kyb-line);
        border-radius:16px 8px 18px 9px / 9px 18px 8px 16px;
        padding:7px 9px; font-weight:400; font-size:13.5px; min-height:56px;
        background:var(--kyb-card); color:var(--kyb-ink-40);
        text-align:start; transform:rotate(var(--kmb-tilt, 0deg));
        transition:opacity .15s ease, box-shadow .15s ease, border-color .15s ease;
        animation:kybPop .32s cubic-bezier(.22,.9,.28,1) both;
      }
      .kmb-chip{ display:flex; align-items:center; justify-content:flex-start; gap:8px; }
      .kmb-chip.kmb-connected{ border-style:solid; border-color:var(--kmb-color, var(--kyb-ink)); color:var(--kyb-ink); }
      .kmb-chip-av{
        width:26px; height:26px; flex-shrink:0; display:grid; place-items:center;
        overflow:hidden; background:var(--kmb-color, var(--kyb-line));
        border-radius:9px 5px 10px / 5px 10px 5px 9px;
      }
      .kmb-chip-av > *{ width:100%; height:100%; display:block; }
      .kmb-chip-name{ min-width:0; overflow:hidden; text-overflow:ellipsis; }
      .kmb-chip.kmb-dragging{ opacity:1; cursor:grabbing; }
      .kmb-chip.kmb-selected{ opacity:1; box-shadow:0 0 0 3px var(--kmb-color, var(--kyb-ink)); }
      .kmb-card{
        touch-action:none; cursor:grab; user-select:none;
        display:flex; align-items:center;
        border:2px solid var(--kmb-color, var(--kyb-ink));
        border-radius:16px 8px 18px 9px / 9px 18px 8px 16px;
        padding:8px 11px; font-size:14.5px; line-height:1.3;
        background:var(--kyb-card); color:var(--kyb-ink);
        min-height:56px; transform:rotate(var(--kmb-tilt, 0deg));
        transition:border-color .15s ease, background .15s ease, box-shadow .15s ease;
        animation:kybFlipIn .34s cubic-bezier(.22,.9,.28,1) both;
      }
      .kmb-card.kmb-connected{ border-color:var(--kmb-connected-color, var(--kyb-ink)); }
      .kmb-card.kmb-dragging{ cursor:grabbing; }
      .kmb-card.kmb-selected{ box-shadow:0 0 0 3px var(--kyb-accent); }
      .kmb-card.kmb-correct{ border-color:var(--kyb-green) !important; background:var(--kyb-tint-g) !important; }
      .kmb-card.kmb-incorrect{ border-color:var(--kyb-pink) !important; background:var(--kyb-tint-p) !important; opacity:.7; }
      /* Green is the handoff's confirm colour. */
      .kmb-submit-btn{
        display:block; width:100%; max-width:280px; margin:20px auto 0;
        background:var(--kyb-green); border-color:var(--kyb-green); color:var(--kyb-on-accent);
      }
      .kmb-submit-btn:hover:not(:disabled){ background:var(--kyb-green); border-color:var(--kyb-green); }
      .kmb-hint{ text-align:start; font-size:14px; line-height:1.55; color:var(--kyb-ink-40); margin:0 0 6px; }
      /* Connectors draw on rather than snapping in; pathLength=1 makes the
         dashoffset animation resolution-independent. */
      .kmb-rope{ animation:kybDrawLine .42s ease-out both; }
      .kmb-dot{ animation:kybDotPop .3s cubic-bezier(.22,.9,.28,1) both; transform-box:fill-box; transform-origin:center; }
      .kmb-ring{ animation:kybDotPop .38s cubic-bezier(.22,.9,.28,1) both; transform-box:fill-box; transform-origin:center; }
      @media (prefers-reduced-motion:reduce){
        .kmb-chip, .kmb-card, .kmb-rope, .kmb-dot, .kmb-ring{ animation:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function mount(container, opts) {
    injectStylesOnce();
    const names = opts.names || [];
    const answersList = opts.answers || [];
    const labels = Object.assign(
      {
        submitBtn: 'Submit Matches',
        waiting: 'Waiting for other players…',
        hint: 'Drag a name onto an answer (or an answer onto a name) -- or tap one, then tap the other to match them.',
      },
      opts.labels || {}
    );
    const onSubmit = opts.onSubmit || function () {};

    let matches = {}; // answerIndex(string) -> userId
    let locked = false;
    let submitted = false;
    let dragState = null; // { kind: 'name'|'answer', id, pointerId, startX, startY, tempPoint, moved }
    let pendingSelection = null; // { kind: 'name'|'answer', id } -- click-to-match's armed item
    const nameColor = {};
    names.forEach((n, i) => {
      nameColor[n.userId] = accentAt(i);
    });

    let namesCol, answersCol, svg, submitBtn;
    let resizeHandler = null;

    function esc(id) {
      return window.CSS && CSS.escape ? CSS.escape(id) : id;
    }

    function connectedAnswerIndexFor(userId) {
      return Object.keys(matches).find((idx) => matches[idx] === userId) ?? null;
    }

    function isConnected(kind, id) {
      return kind === 'name' ? connectedAnswerIndexFor(id) !== null : matches[id] !== undefined;
    }

    function setConnection(userId, answerIndexStr) {
      const priorAnswerIndex = connectedAnswerIndexFor(userId);
      if (priorAnswerIndex !== null) delete matches[priorAnswerIndex];
      // Reassigning an already-claimed answer bumps its previous name.
      delete matches[answerIndexStr];
      matches[answerIndexStr] = userId;
    }

    function connectPair(kindA, idA, kindB, idB) {
      const userId = kindA === 'name' ? idA : idB;
      const answerIndexStr = kindA === 'answer' ? idA : idB;
      setConnection(userId, answerIndexStr);
    }

    function disconnectItem(kind, id) {
      if (kind === 'name') {
        const idx = connectedAnswerIndexFor(id);
        if (idx !== null) delete matches[idx];
      } else {
        delete matches[id];
      }
    }

    function anchorPoint(el, containerRect) {
      const r = el.getBoundingClientRect();
      const y = r.top + r.height / 2 - containerRect.top;
      const elCenterX = r.left + r.width / 2;
      const containerCenterX = containerRect.left + containerRect.width / 2;
      const x = elCenterX < containerCenterX ? r.right - containerRect.left : r.left - containerRect.left;
      return { x, y };
    }

    function ropePath(p1, p2, bow) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      return `M ${p1.x} ${p1.y} Q ${midX} ${midY + (bow === undefined ? 18 : bow)} ${p2.x} ${p2.y}`;
    }

    // The handoff draws each connector as two strokes: a bold one, plus a
    // lighter sketch line on a slightly different bow so the pair reads as
    // pencil rather than a single clean curve.
    function ropeMarkup(p1, p2, color, opts) {
      const o = opts || {};
      const cls = o.animate ? ' class="kmb-rope"' : '';
      const extra = o.dash ? ` stroke-dasharray="6,5" opacity="0.85"` : '';
      let out =
        `<path${cls} pathLength="1" d="${ropePath(p1, p2)}" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round"${extra}/>` +
        `<path${cls} pathLength="1" d="${ropePath(p1, p2, 24)}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" opacity="${o.dash ? 0.3 : 0.42}"/>`;
      if (o.endpoints) {
        // Ink dot at the answer end, pop ring at the player end.
        out += `<circle class="kmb-dot" cx="${p2.x}" cy="${p2.y}" r="5" fill="${color}"/>`;
        out += `<circle class="kmb-ring" cx="${p1.x}" cy="${p1.y}" r="9" fill="none" stroke="${color}" stroke-width="2.5" opacity=".6"/>`;
      }
      return out;
    }

    function elForItem(kind, id) {
      return kind === 'name' ? namesCol.querySelector(`[data-user-id="${esc(id)}"]`) : answersCol.querySelector(`[data-answer-index="${id}"]`);
    }

    function drawRopes() {
      const containerRect = svg.getBoundingClientRect();
      svg.setAttribute('width', String(containerRect.width));
      svg.setAttribute('height', String(containerRect.height));
      let html = '';
      for (const [answerIndexStr, userId] of Object.entries(matches)) {
        const nameEl = namesCol.querySelector(`[data-user-id="${esc(userId)}"]`);
        const answerEl = answersCol.querySelector(`[data-answer-index="${answerIndexStr}"]`);
        if (!nameEl || !answerEl) continue;
        const p1 = anchorPoint(nameEl, containerRect);
        const p2 = anchorPoint(answerEl, containerRect);
        html += ropeMarkup(p1, p2, nameColor[userId], { animate: true, endpoints: true });
      }
      if (dragState && dragState.moved && dragState.tempPoint) {
        const el = elForItem(dragState.kind, dragState.id);
        if (el) {
          const p1 = anchorPoint(el, containerRect);
          const p2 = { x: dragState.tempPoint.x - containerRect.left, y: dragState.tempPoint.y - containerRect.top };
          const color = dragState.kind === 'name' ? nameColor[dragState.id] : nameColor[matches[dragState.id]] || 'var(--kyb-accent)';
          html += ropeMarkup(p1, p2, color, { dash: true });
        }
      }
      svg.innerHTML = html;
    }

    function updateVisualState() {
      namesCol.querySelectorAll('.kmb-chip').forEach((el) => {
        const userId = el.dataset.userId;
        el.classList.toggle('kmb-connected', connectedAnswerIndexFor(userId) !== null);
        el.classList.toggle('kmb-dragging', Boolean(dragState && dragState.moved && dragState.kind === 'name' && dragState.id === userId));
        el.classList.toggle('kmb-selected', Boolean(pendingSelection && pendingSelection.kind === 'name' && pendingSelection.id === userId));
      });
      answersCol.querySelectorAll('.kmb-card').forEach((el) => {
        const idx = el.dataset.answerIndex;
        const userId = matches[idx];
        el.classList.toggle('kmb-connected', Boolean(userId));
        el.style.setProperty('--kmb-connected-color', userId ? nameColor[userId] : '');
        el.classList.toggle('kmb-dragging', Boolean(dragState && dragState.moved && dragState.kind === 'answer' && dragState.id === idx));
        el.classList.toggle('kmb-selected', Boolean(pendingSelection && pendingSelection.kind === 'answer' && pendingSelection.id === idx));
      });
      if (submitBtn) submitBtn.disabled = locked || submitted || answersList.length === 0 || Object.keys(matches).length < answersList.length;
      const waitingNote = container.querySelector('.kmb-waiting-note');
      if (waitingNote) waitingNote.style.display = submitted ? 'block' : 'none';
    }

    function findDropTargetAt(clientX, clientY, wantKind) {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const target = wantKind === 'answer' ? el.closest('.kmb-card') : el.closest('.kmb-chip');
      if (!target) return null;
      return wantKind === 'answer' ? { kind: 'answer', id: target.dataset.answerIndex } : { kind: 'name', id: target.dataset.userId };
    }

    function handleItemClick(kind, id) {
      if (pendingSelection) {
        if (pendingSelection.kind === kind) {
          // Same column: tapping the armed item again cancels it; tapping a
          // different one in that column swaps which is armed.
          pendingSelection = pendingSelection.id === id ? null : { kind, id };
          return;
        }
        connectPair(pendingSelection.kind, pendingSelection.id, kind, id);
        pendingSelection = null;
        return;
      }
      if (isConnected(kind, id)) {
        disconnectItem(kind, id);
        return;
      }
      pendingSelection = { kind, id };
    }

    function onPointerMove(e) {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      dragState.tempPoint = { x: e.clientX, y: e.clientY };
      if (!dragState.moved) {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        if (Math.sqrt(dx * dx + dy * dy) > CLICK_MOVE_THRESHOLD_PX) dragState.moved = true;
      }
      drawRopes();
    }

    function onPointerUp(e) {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      const { kind, id, moved } = dragState;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      dragState = null;

      if (moved) {
        const target = findDropTargetAt(e.clientX, e.clientY, kind === 'name' ? 'answer' : 'name');
        if (target) {
          connectPair(kind, id, target.kind, target.id);
          pendingSelection = null;
        } else {
          disconnectItem(kind, id);
        }
      } else {
        handleItemClick(kind, id);
      }
      drawRopes();
      updateVisualState();
    }

    function attachDragAndClick(el, kind) {
      el.addEventListener('pointerdown', (e) => {
        if (locked) return;
        e.preventDefault();
        const id = kind === 'name' ? el.dataset.userId : el.dataset.answerIndex;
        dragState = { kind, id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, tempPoint: { x: e.clientX, y: e.clientY }, moved: false };
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        updateVisualState();
      });
    }

    function handleSubmit() {
      if (locked || submitted) return;
      submitted = true;
      locked = true;
      updateVisualState();
      onSubmit({ ...matches });
    }

    function render() {
      container.innerHTML = `
        <p class="kmb-hint">${labels.hint}</p>
        <div class="kmb-wrap">
          <div class="kmb-columns">
            <svg class="kmb-svg"></svg>
            <div class="kmb-col kmb-answers" data-col-label="${labels.answersCol || 'Answers'}"></div>
            <div class="kmb-col kmb-names" data-col-label="${labels.playersCol || 'Players'}"></div>
          </div>
          <button type="button" class="kmb-submit-btn bh-btn bh-btn--hot bh-btn--md" disabled>${labels.submitBtn}</button>
          <p class="kmb-hint kmb-waiting-note" style="display:none;">${labels.waiting}</p>
        </div>
      `;
      namesCol = container.querySelector('.kmb-names');
      answersCol = container.querySelector('.kmb-answers');
      svg = container.querySelector('.kmb-svg');
      submitBtn = container.querySelector('.kmb-submit-btn');

      namesCol.innerHTML = names
        .map((n, i) => {
          // Avatars come from the shared renderer, so a KYB character picked in
          // the lobby shows up here exactly as it does everywhere else.
          const av = window.BahjahAvatars && n.avatar !== undefined
            ? `<span class="kmb-chip-av">${window.BahjahAvatars.renderAvatarHtml(n.avatar, n.userId)}</span>`
            : '';
          return `<button type="button" class="kmb-chip" data-user-id="${n.userId}" style="--kmb-color:${nameColor[n.userId]}; --kmb-tilt:${tiltAt(i)}">${av}<span class="kmb-chip-name">${n.displayName}</span></button>`;
        })
        .join('');
      answersCol.innerHTML = answersList
        .map((a, i) => `<div class="kmb-card" data-answer-index="${a.index}" style="--kmb-color:${accentAt(i)}; --kmb-tilt:${tiltAt(i + 1)}; animation-delay:${i * 70}ms">${a.text}</div>`)
        .join('');

      namesCol.querySelectorAll('.kmb-chip').forEach((el) => attachDragAndClick(el, 'name'));
      answersCol.querySelectorAll('.kmb-card').forEach((el) => attachDragAndClick(el, 'answer'));
      submitBtn.addEventListener('click', handleSubmit);

      resizeHandler = () => drawRopes();
      window.addEventListener('resize', resizeHandler);

      drawRopes();
      updateVisualState();
    }

    render();

    return {
      getMatches() {
        return { ...matches };
      },
      destroy() {
        locked = true;
        if (resizeHandler) window.removeEventListener('resize', resizeHandler);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
      },
    };
  }

  window.BahjahKybMatchBoard = { mount };
})();
