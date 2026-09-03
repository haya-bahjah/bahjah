// Phone · MATCH — the player's board while they place answers on people.
//
// Port of match_truth_export/react/PhoneMatchScreen.jsx, following the export's
// own vanilla build for the connector layer: already-drawn wires are kept in a
// `drawn` map and only re-pointed, so a new link is the only thing that
// animates.
//
// Two input paths in the two-column mode, both live: DRAG an answer onto a
// player with a pointer (mouse, touch or pen), or TAP an answer then TAP a
// player. Assignment is exclusive both ways -- giving a player a new answer
// releases their old one.
//
// Geometry is shared with phone TRUTH (76px rows, 7px gaps, 26px column gap) so
// the two screens swap without a jump. Do not retune either alone.
//
// The handoff also draws a second mode (`phoneMatchDrop`): one card per answer
// with an owner picker under it. It is NOT reached by player count -- drag is
// the contract at every count. It ships only as the accessible fallback, for
// anyone who cannot drag, and has to be asked for by passing mode:'dropdown'.
(function () {
  const kit = window.KybScreenKit;
  const h = kit.h;

  const ROW_H = '76px', GAP = '7px';          // identical geometry to the phone TRUTH screen
  const MARKS = ['✦', '★', '●', '▲', '◆'];
  const COL_LBL = { font: '400 11px var(--kyb-pixel)', letterSpacing: '.08em', color: 'var(--kyb-ink-40)', height: '14px' };
  const ROW_RADIUS = '15px 8px 17px 8px/8px 17px 8px 15px';

  const DEFAULT_LABELS = {
    status: 'MATCH THEM UP',
    answers: 'ANSWERS',
    players: 'PLAYERS',
    hint: 'Drag an answer onto a player. Or tap, then tap.',
    hintArmed: 'Now tap who said it.',
    dropHere: 'drop here',
    submit: 'Submit anyway',
    submitDone: 'Lock in my matches',
    hintPick: 'Pick the owner for each answer.',
    choose: 'Choose…',
  };

  // Drag-to-match is THE phone matching behaviour, at every player count.
  //
  // This used to switch itself to the picker list from eight answers up, on
  // the reasoning that twelve 76px rows is a lot of dragging. The handoff is
  // unambiguous that drag is the current contract and lists `matchMode` only
  // as a prototype knob, so 'auto' now means columns and the room never
  // changes input model on you halfway up the player range -- which was its
  // own problem: a group that learned to drag at six players found a
  // different board at eight.
  //
  // 'dropdown' is still honoured when passed explicitly, as the accessible
  // fallback for anyone who cannot drag.
  function resolveMode(mode) {
    return mode === 'dropdown' ? 'dropdown' : 'columns';
  }

  function assign(target, source) {
    Object.keys(source).forEach((k) => { target[k] = source[k]; });
    return target;
  }

  function clockColor(seconds) {
    return seconds <= 5 ? 'var(--kyb-pink)' : seconds <= 10 ? 'var(--kyb-yellow)' : 'var(--kyb-green)';
  }

  function mount(props) {
    const host = kit.mountHost('phone-match');
    let state = null;
    let assignMap = {};   // answerId -> playerId
    let sel = null;       // tapped answer awaiting a player
    let drag = null;      // answer being dragged
    let drawn = {};       // link id -> <g>, so only NEW wires animate
    let dropNodes = [];   // dropdown mode: one entry per answer card
    let mode = 'columns';
    let buildKey = null;
    let submitted = false;

    const statusEl = h('span', { style: { font: '400 12px var(--kyb-pixel)', letterSpacing: '.08em', color: 'var(--kyb-pink)' } });
    const clockEl = h('span', { style: { fontWeight: '800', fontSize: '21px' } });
    const head = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [statusEl, clockEl]);

    const fill = h('div', { style: { height: '100%', borderRadius: '6px', width: '0%', transition: 'width 900ms linear, background 300ms ease-out' } });
    const bar = h('div', {
      style: {
        height: '10px', boxSizing: 'border-box', background: 'var(--kyb-card)',
        border: '2px solid var(--kyb-line)', borderRadius: '8px 3px 8px 3px/3px 8px 3px 8px',
        overflow: 'hidden', padding: '1px',
      },
    }, fill);

    const hint = h('p', { style: { margin: '0', fontSize: '14px', color: 'var(--kyb-ink-40)' } });

    const wires = kit.svg('svg', {}, {
      position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'visible',
      pointerEvents: 'none', zIndex: '3',
    });
    // The connector that follows the finger. Created ONCE and mutated in place
    // (setAttribute('d', ...)) for the life of the screen -- rebuilding it per
    // pointermove is what makes a drag feel sticky. Hidden until a drag starts.
    const tempPath = kit.svg('path', {
      fill: 'none', stroke: 'var(--kyb-cyan)', 'stroke-width': '3.5',
      'stroke-linecap': 'round', 'stroke-dasharray': '8 7',
    }, { display: 'none' });
    const tempDot = kit.svg('circle', { r: '5', fill: 'var(--kyb-cyan)' }, { display: 'none' });

    const aCol = h('div', { style: { display: 'flex', flexDirection: 'column', gap: GAP } });
    const pCol = h('div', { style: { display: 'flex', flexDirection: 'column', gap: GAP } });
    const cols = h('div', { style: { position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px' } }, [wires, aCol, pCol]);
    wires.appendChild(tempPath);
    wires.appendChild(tempDot);
    const scroller = h('div', {
      style: { flex: '1', minHeight: '0', overflowY: 'auto', overflowX: 'hidden', margin: '0 -5px', padding: '0 5px' },
      on: { scroll: () => drawWires() },
    }, cols);

    // The handoff's dropdown mode. It draws the cards in a plain flow; on a
    // phone twelve of them run past the bottom, so they get the same scroller
    // the two-column board uses -- nothing else about the card changes.
    const dropList = h('div', {
      style: { flex: '1', minHeight: '0', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px' },
    });

    const submit = h('button', {
      style: {
        width: '100%', fontWeight: '700', fontSize: '17px', letterSpacing: '.14em',
        textTransform: 'uppercase', padding: '15px', color: 'var(--kyb-on-accent)',
        borderWidth: '1px', borderStyle: 'solid', borderRadius: '8px', cursor: 'pointer',
      },
      on: {
        click: () => {
          if (submitted) return;
          submitted = true;
          submit.disabled = true;
          if (state && state.onSubmit) state.onSubmit(assignMap);
        },
      },
    });

    const root = h('div', {
      style: {
        width: '100%', height: '100%', boxSizing: 'border-box', background: 'var(--kyb-page)',
        overflow: 'hidden', padding: '20px 18px 18px', display: 'flex', flexDirection: 'column', gap: '12px',
        fontFamily: 'var(--kyb-display)', color: 'var(--kyb-ink)',
      },
    }, [head, bar, hint, scroller, dropList, submit]);
    host.appendChild(root);

    // ---------------------------------------------------------------
    // Drag-to-match, on POINTER events.
    //
    // This was HTML5 drag-and-drop (draggable + dragstart/dragover/drop),
    // which never fires on a touchscreen -- so on the phone this screen is
    // actually built for, the drag simply did not exist and tap-then-tap was
    // the only way through. Pointer events cover mouse, touch and pen from one
    // code path, which is why the handoff names them specifically.
    //
    // The rows keep `touch-action: pan-y`, so a vertical drag still scrolls
    // the list; only a horizontal move claims the gesture.
    // ---------------------------------------------------------------
    const DRAG_THRESHOLD = 10;   // px of horizontal travel before it is a drag
    // The board mirrors in the Arabic build: the answer column sits on the
    // right, so a connector leaves an answer by its LEFT edge and meets the
    // player by their RIGHT. Only these two endpoint edges change -- the arc
    // maths below already follows the sign of (x2 - x1), so it mirrors itself.
    // Read from the mounted host rather than the document so the screen and
    // its wires can never disagree about which way they are drawn.
    function isRtl() {
      return getComputedStyle(cols).direction === 'rtl';
    }

    let press = null;            // { aid, x, y, id, row, dragging }
    let hoverRow = null;         // player row currently under the finger
    let suppressClick = false;   // a completed drag must not also fire a tap

    function tempWireTo(clientX, clientY) {
      if (!press || !press.dragging) return;
      const box = cols.getBoundingClientRect();
      const ar = press.row.getBoundingClientRect();
      const rtl = isRtl();
      const x1 = (rtl ? ar.left - 2 : ar.right + 2) - box.left;
      const y1 = ar.top - box.top + ar.height / 2;
      const x2 = clientX - box.left;
      const y2 = clientY - box.top;
      const dir = x2 >= x1 ? 1 : -1;
      const span = Math.max(18, Math.abs(x2 - x1));
      const c1 = x1 + dir * span * 0.75, c2 = x2 - dir * span * 0.75;
      // Mutated in place, never re-created -- see the note by tempPath.
      tempPath.setAttribute('d', `M${x1} ${y1} C ${c1} ${y1 - 3}, ${c2} ${y2 + 3}, ${x2} ${y2}`);
      tempDot.setAttribute('cx', x2);
      tempDot.setAttribute('cy', y2);
    }

    function setHover(row) {
      if (hoverRow === row) return;
      if (hoverRow) { hoverRow.style.transform = ''; hoverRow.style.boxShadow = ''; }
      hoverRow = row;
      if (hoverRow) {
        const pid = hoverRow.getAttribute('data-p');
        const p = window.KybData.players().find((x) => x.id === pid);
        hoverRow.style.transform = 'scale(1.045)';
        hoverRow.style.boxShadow = `0 0 0 4px ${p ? p.color : 'var(--kyb-green)'}`;
      }
    }

    // Nearest player row under the finger, per the handoff's hit-test.
    function playerRowAt(clientX, clientY) {
      const el = document.elementFromPoint(clientX, clientY);
      const row = el && el.closest ? el.closest('[data-p]') : null;
      return row && pCol.contains(row) ? row : null;
    }

    function endDrag(commit) {
      if (!press) return;
      const row = press.row;
      const wasDragging = press.dragging;
      row.style.transform = '';
      row.style.boxShadow = '';
      row.style.zIndex = '';
      row.style.cursor = 'grab';
      tempPath.style.display = 'none';
      tempDot.style.display = 'none';
      const target = hoverRow;
      setHover(null);
      press = null;
      if (!wasDragging) return;
      suppressClick = true;
      if (commit && target) {
        assignTo(target.getAttribute('data-p'));
      } else {
        drag = null;
        paint();
      }
    }

    // Assigning is exclusive both ways: one answer per player.
    function assignTo(playerId) {
      const aid = drag || sel;
      if (!aid) return;
      const next = {};
      Object.keys(assignMap).forEach((k) => { if (assignMap[k] !== playerId) next[k] = assignMap[k]; });
      next[aid] = playerId;
      assignMap = next; sel = null; drag = null;
      paint();
    }

    function build(n) {
      // Rows are a fixed 76px and the list scrolls, so phone type scales on
      // the player count alone -- twelve names in a 76px row need less type
      // than five do. See KybScreenKit.phoneType.
      const type = kit.phoneType(n);
      const data = window.KybData;
      aCol.innerHTML = '';
      pCol.innerHTML = '';
      wires.innerHTML = '';
      dropList.innerHTML = '';
      dropNodes = [];
      assignMap = {}; sel = null; drag = null; drawn = {};
      submitted = false;
      submit.disabled = false;

      scroller.style.display = mode === 'columns' ? '' : 'none';
      dropList.style.display = mode === 'dropdown' ? '' : 'none';
      if (mode === 'dropdown') { buildDrop(n); return; }

      aCol.appendChild(h('div', { className: 'kyb-col-lbl', style: assign({}, COL_LBL) }));
      data.answers().slice(0, n).forEach((a) => {
        const row = h('div', {
          attrs: { 'data-a': a.id },
          style: {
            height: ROW_H, flex: 'none', boxSizing: 'border-box', padding: '8px 10px',
            display: 'flex', alignItems: 'center', overflow: 'hidden', fontSize: kit.px(type.answer), lineHeight: '1.28',
            cursor: 'grab', background: 'var(--kyb-card)', border: '2px solid var(--kyb-line)',
            borderRadius: ROW_RADIUS, transition: 'all 140ms cubic-bezier(.2,1.4,.4,1)',
            position: 'relative',
            // Vertical drags stay the scroller's; only horizontal ones are ours.
            touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
          },
          text: a.short,
          on: {
            pointerdown: (e) => {
              // Cleared here rather than in the click handler: a drag released
              // over a player row does not always deliver a click to this row,
              // and a flag left standing would swallow the next genuine tap.
              suppressClick = false;
              if (submitted || assignMap[a.id]) return;
              press = { aid: a.id, x: e.clientX, y: e.clientY, id: e.pointerId, row, dragging: false };
            },
            pointermove: (e) => {
              if (!press || press.aid !== a.id) return;
              const dx = e.clientX - press.x, dy = e.clientY - press.y;
              if (!press.dragging) {
                // Horizontal, and more horizontal than vertical: ours. Anything
                // else belongs to the scroller.
                if (Math.abs(dx) <= DRAG_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
                press.dragging = true;
                drag = a.id;
                sel = null;
                row.style.transform = 'scale(1.03) rotate(-1.2deg)';
                row.style.boxShadow = '0 7px 0 var(--kyb-shadow)';
                row.style.zIndex = '4';
                row.style.cursor = 'grabbing';
                tempPath.style.display = '';
                tempDot.style.display = '';
                try { row.setPointerCapture(press.id); } catch (err) { /* mouse on old engines */ }
                paint();   // player column switches to its drop-here state
              }
              e.preventDefault();
              tempWireTo(e.clientX, e.clientY);
              setHover(playerRowAt(e.clientX, e.clientY));
            },
            pointerup: (e) => {
              if (!press || press.aid !== a.id) return;
              if (press.dragging) setHover(playerRowAt(e.clientX, e.clientY));
              endDrag(true);
            },
            pointercancel: () => { if (press && press.aid === a.id) endDrag(false); },
            click: () => {
              // A drag that ended over a player already committed; the browser
              // still delivers the click, and acting on it would re-arm the row.
              if (suppressClick) return;
              if (assignMap[a.id]) return;
              sel = sel === a.id ? null : a.id;
              paint();
            },
          },
        });
        aCol.appendChild(row);
      });

      pCol.appendChild(h('div', { className: 'kyb-col-lbl', style: assign({}, COL_LBL) }));
      data.players().slice(0, n).forEach((p) => {
        const row = h('div', {
          attrs: { 'data-p': p.id },
          style: {
            height: ROW_H, flex: 'none', boxSizing: 'border-box', padding: '8px 9px',
            display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', cursor: 'pointer',
            background: 'var(--kyb-card)', border: '2px dashed var(--kyb-line)',
            borderRadius: ROW_RADIUS, transition: 'all 140ms cubic-bezier(.2,1.4,.4,1)',
          },
          on: {
            // The drop itself is handled by the dragging row's pointerup via
            // elementFromPoint -- pointer capture means this row never sees the
            // event. Tap-then-tap still lands here.
            click: () => { if (sel) assignTo(p.id); },
          },
        }, [
          h('span', {
            style: {
              width: '24px', height: '24px', flex: 'none', borderRadius: '9px 5px 10px 5px/5px 10px 5px 9px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', font: '400 11px var(--kyb-pixel)',
              color: 'var(--kyb-on-accent)', background: p.color,
            },
            text: p.initial,
          }),
          h('span', { className: 'kyb-slot', style: { flex: '1', minWidth: '0', fontSize: kit.px(type.slot), lineHeight: '1.2' } }),
        ]);
        pCol.appendChild(row);
      });
    }

    // One card per answer, an owner picker under it. The visible row is the
    // handoff's; a transparent native <select> sits over it so the tap opens
    // the platform picker -- the point of this mode is that it cannot fail.
    function buildDrop(n) {
      const data = window.KybData;
      dropList.innerHTML = '';
      dropNodes = [];
      const players = data.players().slice(0, n);

      data.answers().slice(0, n).forEach((a, i) => {
        const pickText = h('span');
        const select = h('select', {
          style: {
            position: 'absolute', inset: '0', width: '100%', height: '100%',
            opacity: '0', border: 'none', appearance: 'none', font: 'inherit', cursor: 'pointer',
          },
          on: {
            change: (e) => {
              const pid = e.target.value;
              const next = {};
              // Exclusive both ways, exactly as in the two-column mode.
              Object.keys(assignMap).forEach((k) => {
                if (k !== a.id && assignMap[k] !== pid) next[k] = assignMap[k];
              });
              if (pid) next[a.id] = pid;
              assignMap = next;
              paint();
            },
          },
        }, [h('option', { attrs: { value: '' } })].concat(
          players.map((p) => h('option', { attrs: { value: p.id }, text: p.name }))
        ));

        const picker = h('div', {
          style: {
            position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 11px', background: 'var(--kyb-page)', border: '2px dashed var(--kyb-line)',
            borderRadius: '12px 6px 13px 6px/6px 13px 6px 12px', fontSize: '14.5px',
          },
        }, [pickText, h('span', { style: { font: '400 12px var(--kyb-pixel)' }, text: '▼' }), select]);

        const card = h('div', {
          style: {
            flex: 'none', padding: '11px 13px', background: 'var(--kyb-card)',
            border: `2px solid ${data.COLORS[i % 5]}`,
            borderRadius: '18px 9px 20px 10px/10px 20px 9px 18px',
          },
        }, [
          h('div', { style: { fontSize: '15px', lineHeight: '1.35', marginBottom: '9px' }, text: a.text }),
          picker,
        ]);
        dropList.appendChild(card);
        dropNodes.push({ id: a.id, index: i, card, pickText, select });
      });
    }

    function paintDrop() {
      const data = window.KybData;
      const players = data.players();
      dropNodes.forEach((nd) => {
        const pid = assignMap[nd.id];
        const p = pid && players.find((x) => x.id === pid);
        nd.pickText.textContent = p ? p.name : state.labels.choose;
        nd.pickText.parentNode.style.color = p ? 'var(--kyb-yellow)' : 'var(--kyb-ink-40)';
        nd.card.style.borderColor = p ? 'var(--kyb-line)' : data.COLORS[nd.index % 5];
        if (nd.select.value !== (pid || '')) nd.select.value = pid || '';
      });
    }

    /* Hand-drawn connector: two offset bezier strokes (the second is the "sketch"
       double-line), a filled dot at the answer, a ring at the player, and a doodle
       mark at the midpoint -- stroke-drawn via kybDrawLine on pathLength="1". */
    function drawWires() {
      const box = cols.getBoundingClientRect();
      const rtl = isRtl();
      const players = window.KybData.players();
      const live = {};
      Object.keys(assignMap).forEach((aid, i) => {
        const pid = assignMap[aid];
        const an = aCol.querySelector(`[data-a="${aid}"]`), pn = pCol.querySelector(`[data-p="${pid}"]`);
        if (!an || !pn) return;
        const id = aid + '-' + pid;
        live[id] = 1;
        const player = players.find((p) => p.id === pid);
        if (!player) return;
        const color = player.color;
        const ar = an.getBoundingClientRect(), pr = pn.getBoundingClientRect();
        const x1 = (rtl ? ar.left - 2 : ar.right + 2) - box.left, y1 = ar.top - box.top + ar.height / 2;
        const x2 = (rtl ? pr.right + 3 : pr.left - 3) - box.left, y2 = pr.top - box.top + pr.height / 2;
        const dir = x2 >= x1 ? 1 : -1, span = Math.max(18, Math.abs(x2 - x1));
        const c1 = x1 + dir * span * 0.75, c2 = x2 - dir * span * 0.75;
        const d = `M${x1} ${y1} C ${c1} ${y1 - 3}, ${c2} ${y2 + 3}, ${x2} ${y2}`;
        const d2 = `M${x1} ${y1 + 3} C ${c1 + dir * 4} ${y1 + 6}, ${c2 - dir * 4} ${y2 - 5}, ${x2} ${y2 + 4}`;

        if (drawn[id]) {                       // existing wire: just re-point it, no re-animation
          const g = drawn[id];
          const paths = g.querySelectorAll('path');
          paths[0].setAttribute('d', d);
          paths[1].setAttribute('d', d2);
          const cs = g.querySelectorAll('circle');
          cs[0].setAttribute('cx', x1); cs[0].setAttribute('cy', y1);
          cs[1].setAttribute('cx', x2); cs[1].setAttribute('cy', y2);
          const tx = g.querySelector('text');
          tx.setAttribute('x', (x1 + x2) / 2 - 4); tx.setAttribute('y', (y1 + y2) / 2 - 9);
          return;
        }

        const g = kit.svg('g');
        const p1 = kit.svg('path', { d: d, pathLength: '1', fill: 'none', stroke: color, 'stroke-width': '3.5', 'stroke-linecap': 'round', 'stroke-dasharray': '1' },
          { animation: 'kybDrawLine 520ms cubic-bezier(.35,1,.35,1) forwards' });
        const p2 = kit.svg('path', { d: d2, pathLength: '1', fill: 'none', stroke: color, 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-dasharray': '1', opacity: '.45' },
          { animation: 'kybDrawLine 640ms cubic-bezier(.35,1,.35,1) 60ms forwards' });
        const dot = kit.svg('circle', { cx: x1, cy: y1, r: '4', fill: color },
          { transformBox: 'fill-box', transformOrigin: 'center', animation: 'kybDotPop 260ms cubic-bezier(.2,1.5,.4,1) forwards' });
        const ring = kit.svg('circle', { cx: x2, cy: y2, r: '5.5', fill: 'none', stroke: color, 'stroke-width': '3' },
          { transformBox: 'fill-box', transformOrigin: 'center', animation: 'kybDotPop 300ms cubic-bezier(.2,1.5,.4,1) 380ms both' });
        const mark = kit.svg('text', { x: (x1 + x2) / 2 - 4, y: (y1 + y2) / 2 - 9, fill: color },
          { font: '400 11px var(--kyb-pixel)', transformBox: 'fill-box', transformOrigin: 'center', animation: 'kybDotPop 280ms cubic-bezier(.2,1.5,.4,1) 420ms both' });
        mark.textContent = MARKS[i % 5];
        [p1, p2, dot, ring, mark].forEach((node) => g.appendChild(node));
        wires.appendChild(g);
        drawn[id] = g;
      });
      Object.keys(drawn).forEach((id) => { if (!live[id]) { drawn[id].remove(); delete drawn[id]; } });
    }

    function paint() {
      const data = window.KybData;
      const n = data.clampPlayers(state.players);
      const answers = data.answers();
      const players = data.players();
      const armed = !!(sel || drag);

      const done = Object.keys(assignMap).length === n;
      submit.textContent = done ? state.labels.submitDone : state.labels.submit;
      submit.style.background = done ? 'var(--kyb-green)' : 'var(--kyb-yellow)';
      submit.style.borderColor = done ? 'var(--kyb-green)' : 'var(--kyb-yellow)';

      if (mode === 'dropdown') {
        hint.textContent = state.labels.hintPick;
        paintDrop();
        return;
      }

      aCol.querySelectorAll('[data-a]').forEach((row, i) => {
        const aid = row.getAttribute('data-a'), used = !!assignMap[aid], isSel = sel === aid;
        row.style.opacity = used ? '.35' : '1';
        row.style.background = isSel ? 'var(--kyb-tint-c)' : 'var(--kyb-card)';
        row.style.borderColor = isSel ? 'var(--kyb-cyan)' : used ? 'var(--kyb-line)' : data.COLORS[i % 5];
      });

      pCol.querySelectorAll('[data-p]').forEach((row) => {
        const pid = row.getAttribute('data-p'), p = players.find((x) => x.id === pid);
        const aid = Object.keys(assignMap).find((k) => assignMap[k] === pid);
        const a = aid && answers.find((x) => x.id === aid);
        const slot = row.querySelector('.kyb-slot');
        slot.textContent = a ? a.short : (armed ? state.labels.dropHere : p.name);
        slot.style.color = a ? 'var(--kyb-ink)' : armed ? 'var(--kyb-green)' : 'var(--kyb-ink-40)';
        row.style.background = a ? 'var(--kyb-tint-n)' : armed ? 'var(--kyb-tint-g)' : 'var(--kyb-card)';
        row.style.borderColor = a ? p.color : armed ? 'var(--kyb-green)' : 'var(--kyb-line)';
        row.style.borderStyle = a ? 'solid' : 'dashed';
      });

      const aLbl = aCol.querySelector('.kyb-col-lbl'), pLbl = pCol.querySelector('.kyb-col-lbl');
      if (aLbl) aLbl.textContent = state.labels.answers;
      if (pLbl) pLbl.textContent = state.labels.players;
      hint.textContent = sel ? state.labels.hintArmed : state.labels.hint;
      drawWires();
    }

    function paintClock() {
      const color = clockColor(state.seconds);
      clockEl.textContent = `${state.seconds}s`;
      clockEl.style.color = color;
      fill.style.width = `${Math.round((state.seconds / (state.total || 20)) * 100)}%`;
      fill.style.background = color;
    }

    function update(next) {
      state = assign({ players: 12, seconds: 20, total: 20, mode: 'auto', onSubmit: null, labels: {} }, next || {});
      state.labels = assign(assign({}, DEFAULT_LABELS), (next && next.labels) || {});

      const data = window.KybData;
      const n = data.clampPlayers(state.players);
      // The board is built once per round. A game:state arrives every time
      // anybody else submits, and rebuilding here would tear a half-built board
      // out from under the player.
      mode = resolveMode(state.mode);
      const key = `${n}|${mode}|${data.answers().map((a) => a.id).join(',')}|${data.players().map((p) => p.id).join(',')}`;
      if (key !== buildKey) {
        buildKey = key;
        build(n);
      }
      statusEl.textContent = state.labels.status;
      paint();
      paintClock();
    }

    const onResize = () => drawWires();
    window.addEventListener('resize', onResize);

    update(props);

    return {
      update,
      destroy() {
        window.removeEventListener('resize', onResize);
        if (host.parentNode) host.parentNode.removeChild(host);
      },
    };
  }

  window.KybPhoneMatchScreen = { mount };
})();
