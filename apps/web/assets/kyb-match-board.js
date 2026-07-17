// Shared rope-drag matching board for Knows You Best, used by both
// knows-you-best-play.js (always) and knows-you-best-host-console.js (only
// when the host opted in to play). Fully self-contained -- injects its own
// styles once, no dependency on the host page's CSS.
//
// Usage: window.BahjahKybMatchBoard.mount(container, {
//   names: [{userId, displayName}],       // left column, drag origin
//   answers: [{index, text}],             // right column, drop targets
//   labels: {submitBtn, waiting, hint},
//   onSubmit(matches),                    // matches: {answerIndex: userId}, called once, board locks after
// })
// Returns a handle: { getMatches(), destroy() }.
(function () {
  const ROPE_COLORS = ['#EF4444', '#22C55E', '#3B82F6', '#F59E0B', '#A855F7', '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#6366F1'];

  function injectStylesOnce() {
    if (document.getElementById('kmb-styles')) return;
    const style = document.createElement('style');
    style.id = 'kmb-styles';
    style.textContent = `
      .kmb-wrap{ width:100%; }
      .kmb-columns{ position:relative; display:flex; justify-content:space-between; gap:20%; padding-block:8px; }
      .kmb-svg{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
      .kmb-col{ display:flex; flex-direction:column; gap:14px; flex:1; min-width:0; z-index:1; }
      .kmb-chip{ touch-action:none; cursor:grab; user-select:none; border:2px solid var(--kmb-color,#888); border-radius:999px; padding:10px 16px; font-weight:700; font-size:14px; background:var(--surface,#222); color:var(--kmb-color,#888); text-align:center; transition:opacity .15s ease; }
      .kmb-chip.kmb-connected{ opacity:.55; }
      .kmb-chip.kmb-dragging{ opacity:1; cursor:grabbing; }
      .kmb-card{ touch-action:none; cursor:pointer; user-select:none; border:2px solid var(--line,#444); border-radius:10px; padding:10px 14px; font-size:13px; background:var(--surface,#222); color:inherit; min-height:20px; transition:border-color .15s ease, background .15s ease; }
      .kmb-card.kmb-connected{ border-color:var(--kmb-connected-color,#888); }
      .kmb-card.kmb-correct{ border-color:#22C55E !important; background:rgba(34,197,94,.15) !important; }
      .kmb-card.kmb-incorrect{ border-color:#EF4444 !important; background:rgba(239,68,68,.1) !important; opacity:.7; }
      .kmb-submit-btn{ display:block; width:100%; max-width:280px; margin:20px auto 0; }
      .kmb-hint{ text-align:center; font-size:12px; color:var(--muted,#999); margin-bottom:6px; }
    `;
    document.head.appendChild(style);
  }

  function mount(container, opts) {
    injectStylesOnce();
    const names = opts.names || [];
    const answersList = opts.answers || [];
    const labels = Object.assign({ submitBtn: 'Submit Matches', waiting: 'Waiting for other players…', hint: 'Drag a name onto the answer you think they wrote.' }, opts.labels || {});
    const onSubmit = opts.onSubmit || function () {};

    let matches = {}; // answerIndex(string) -> userId
    let locked = false;
    let submitted = false;
    let dragState = null; // { userId, tempPoint }
    const nameColor = {};
    names.forEach((n, i) => {
      nameColor[n.userId] = ROPE_COLORS[i % ROPE_COLORS.length];
    });

    let namesCol, answersCol, svg, submitBtn;
    let resizeHandler = null;

    function esc(id) {
      return window.CSS && CSS.escape ? CSS.escape(id) : id;
    }

    function connectedAnswerIndexFor(userId) {
      return Object.keys(matches).find((idx) => matches[idx] === userId) ?? null;
    }

    function anchorPoint(el, containerRect) {
      const r = el.getBoundingClientRect();
      const y = r.top + r.height / 2 - containerRect.top;
      const elCenterX = r.left + r.width / 2;
      const containerCenterX = containerRect.left + containerRect.width / 2;
      const x = elCenterX < containerCenterX ? r.right - containerRect.left : r.left - containerRect.left;
      return { x, y };
    }

    function ropePath(p1, p2) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const bow = 18;
      return `M ${p1.x} ${p1.y} Q ${midX} ${midY + bow} ${p2.x} ${p2.y}`;
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
        html += `<path d="${ropePath(p1, p2)}" stroke="${nameColor[userId]}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      }
      if (dragState && dragState.tempPoint) {
        const nameEl = namesCol.querySelector(`[data-user-id="${esc(dragState.userId)}"]`);
        if (nameEl) {
          const p1 = anchorPoint(nameEl, containerRect);
          const p2 = { x: dragState.tempPoint.x - containerRect.left, y: dragState.tempPoint.y - containerRect.top };
          html += `<path d="${ropePath(p1, p2)}" stroke="${nameColor[dragState.userId]}" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="6,5" opacity="0.85"/>`;
        }
      }
      svg.innerHTML = html;
    }

    function updateVisualState() {
      namesCol.querySelectorAll('.kmb-chip').forEach((el) => {
        const userId = el.dataset.userId;
        el.classList.toggle('kmb-connected', connectedAnswerIndexFor(userId) !== null);
        el.classList.toggle('kmb-dragging', Boolean(dragState && dragState.userId === userId));
      });
      answersCol.querySelectorAll('.kmb-card').forEach((el) => {
        const idx = el.dataset.answerIndex;
        const userId = matches[idx];
        el.classList.toggle('kmb-connected', Boolean(userId));
        el.style.setProperty('--kmb-connected-color', userId ? nameColor[userId] : '');
      });
      if (submitBtn) submitBtn.disabled = locked || submitted || answersList.length === 0 || Object.keys(matches).length < answersList.length;
      const waitingNote = container.querySelector('.kmb-waiting-note');
      if (waitingNote) waitingNote.style.display = submitted ? 'block' : 'none';
    }

    function setConnection(userId, answerIndexStr) {
      const priorAnswerIndex = connectedAnswerIndexFor(userId);
      if (priorAnswerIndex !== null) delete matches[priorAnswerIndex];
      // Reassigning an already-claimed answer bumps its previous name.
      delete matches[answerIndexStr];
      matches[answerIndexStr] = userId;
    }

    function removeConnection(userId) {
      const idx = connectedAnswerIndexFor(userId);
      if (idx !== null) delete matches[idx];
    }

    function findAnswerCardAt(clientX, clientY) {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      return el.closest('.kmb-card');
    }

    function onPointerMove(e) {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      dragState.tempPoint = { x: e.clientX, y: e.clientY };
      drawRopes();
    }

    function onPointerUp(e) {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      const userId = dragState.userId;
      const dropCard = findAnswerCardAt(e.clientX, e.clientY);
      dragState = null;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);

      if (dropCard && dropCard.dataset.answerIndex !== undefined) {
        setConnection(userId, dropCard.dataset.answerIndex);
      } else {
        // No valid drop target -- if this name was already connected,
        // treat the tap as "remove"; a genuine tap-without-drag lands back
        // on the chip itself, which never matches a .kmb-card, so this
        // naturally covers both "tap to remove" and "missed drop" cases.
        removeConnection(userId);
      }
      drawRopes();
      updateVisualState();
    }

    function attachNameHandlers(el) {
      el.addEventListener('pointerdown', (e) => {
        if (locked) return;
        e.preventDefault();
        dragState = { userId: el.dataset.userId, pointerId: e.pointerId, tempPoint: { x: e.clientX, y: e.clientY } };
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        updateVisualState();
      });
    }

    function attachAnswerHandlers(el) {
      el.addEventListener('click', () => {
        if (locked) return;
        const idx = el.dataset.answerIndex;
        if (matches[idx] !== undefined) {
          delete matches[idx];
          drawRopes();
          updateVisualState();
        }
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
            <div class="kmb-col kmb-names"></div>
            <svg class="kmb-svg"></svg>
            <div class="kmb-col kmb-answers"></div>
          </div>
          <button type="button" class="kmb-submit-btn btn btn-primary" disabled>${labels.submitBtn}</button>
          <p class="kmb-hint kmb-waiting-note" style="display:none;">${labels.waiting}</p>
        </div>
      `;
      namesCol = container.querySelector('.kmb-names');
      answersCol = container.querySelector('.kmb-answers');
      svg = container.querySelector('.kmb-svg');
      submitBtn = container.querySelector('.kmb-submit-btn');

      namesCol.innerHTML = names
        .map((n) => `<button type="button" class="kmb-chip" data-user-id="${n.userId}" style="--kmb-color:${nameColor[n.userId]}">${n.displayName}</button>`)
        .join('');
      answersCol.innerHTML = answersList.map((a) => `<div class="kmb-card" data-answer-index="${a.index}">${a.text}</div>`).join('');

      namesCol.querySelectorAll('.kmb-chip').forEach(attachNameHandlers);
      answersCol.querySelectorAll('.kmb-card').forEach(attachAnswerHandlers);
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
