// Phone · MATCH — the player's board while they place answers on people.
//
// Port of match_truth_export/react/PhoneMatchScreen.jsx, following the export's
// own vanilla build for the connector layer: already-drawn wires are kept in a
// `drawn` map and only re-pointed, so a new link is the only thing that
// animates.
//
// Two input paths, both live: DRAG an answer onto a player, or TAP an answer
// then TAP a player. Assignment is exclusive both ways -- giving a player a new
// answer releases their old one.
//
// Geometry is shared with phone TRUTH (76px rows, 7px gaps, 26px column gap) so
// the two screens swap without a jump. Do not retune either alone.
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
  };

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
    const aCol = h('div', { style: { display: 'flex', flexDirection: 'column', gap: GAP } });
    const pCol = h('div', { style: { display: 'flex', flexDirection: 'column', gap: GAP } });
    const cols = h('div', { style: { position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px' } }, [wires, aCol, pCol]);
    const scroller = h('div', {
      style: { flex: '1', minHeight: '0', overflowY: 'auto', overflowX: 'hidden', margin: '0 -5px', padding: '0 5px' },
      on: { scroll: () => drawWires() },
    }, cols);

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
    }, [head, bar, hint, scroller, submit]);
    host.appendChild(root);

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
      const data = window.KybData;
      aCol.innerHTML = '';
      pCol.innerHTML = '';
      wires.innerHTML = '';
      assignMap = {}; sel = null; drag = null; drawn = {};
      submitted = false;
      submit.disabled = false;

      aCol.appendChild(h('div', { className: 'kyb-col-lbl', style: assign({}, COL_LBL) }));
      data.answers().slice(0, n).forEach((a) => {
        const row = h('div', {
          attrs: { 'data-a': a.id, draggable: 'true' },
          style: {
            height: ROW_H, flex: 'none', boxSizing: 'border-box', padding: '8px 10px',
            display: 'flex', alignItems: 'center', overflow: 'hidden', fontSize: '13.5px', lineHeight: '1.28',
            cursor: 'grab', background: 'var(--kyb-card)', border: '2px solid var(--kyb-line)',
            borderRadius: ROW_RADIUS, transition: 'all 140ms cubic-bezier(.2,1.4,.4,1)',
          },
          text: a.short,
          on: {
            dragstart: () => { drag = a.id; paint(); },
            dragend: () => { drag = null; paint(); },
            click: () => { sel = sel === a.id ? null : a.id; paint(); },
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
            dragover: (e) => e.preventDefault(),
            drop: (e) => { e.preventDefault(); assignTo(p.id); },
            click: () => assignTo(p.id),
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
          h('span', { className: 'kyb-slot', style: { flex: '1', minWidth: '0', fontSize: '12.5px', lineHeight: '1.2' } }),
        ]);
        pCol.appendChild(row);
      });
    }

    /* Hand-drawn connector: two offset bezier strokes (the second is the "sketch"
       double-line), a filled dot at the answer, a ring at the player, and a doodle
       mark at the midpoint -- stroke-drawn via kybDrawLine on pathLength="1". */
    function drawWires() {
      const box = cols.getBoundingClientRect();
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
        const x1 = ar.right + 2 - box.left, y1 = ar.top - box.top + ar.height / 2;
        const x2 = pr.left - 3 - box.left, y2 = pr.top - box.top + pr.height / 2;
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

      aCol.querySelector('.kyb-col-lbl').textContent = state.labels.answers;
      pCol.querySelector('.kyb-col-lbl').textContent = state.labels.players;
      hint.textContent = sel ? state.labels.hintArmed : state.labels.hint;
      const done = Object.keys(assignMap).length === n;
      submit.textContent = done ? state.labels.submitDone : state.labels.submit;
      submit.style.background = done ? 'var(--kyb-green)' : 'var(--kyb-yellow)';
      submit.style.borderColor = done ? 'var(--kyb-green)' : 'var(--kyb-yellow)';
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
      state = assign({ players: 12, seconds: 20, total: 20, onSubmit: null, labels: {} }, next || {});
      state.labels = assign(assign({}, DEFAULT_LABELS), (next && next.labels) || {});

      const data = window.KybData;
      const n = data.clampPlayers(state.players);
      // The board is built once per round. A game:state arrives every time
      // anybody else submits, and rebuilding here would tear a half-built board
      // out from under the player.
      const key = `${n}|${data.answers().map((a) => a.id).join(',')}|${data.players().map((p) => p.id).join(',')}`;
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
