// Phone · TRUTH — each answer slides to whoever said it.
//
// Port of match_truth_export/react/PhoneTruthScreen.jsx. Same canvas and
// geometry as phone MATCH (76px rows, 7px gaps, 83px stride, same headers and
// scroller) so the two swap without a jump.
//
// IMPLEMENTATION NOTE, from the handoff and non-negotiable: the rows are
// created ONCE, then each step mutates only transform / background /
// borderColor / opacity on the existing nodes. Re-rendering the list (a fresh
// innerHTML, or an unkeyed remount) kills every CSS transition and the reveal
// snaps instead of sliding.
//
// Beats: first answer at 350ms, one every 900ms. Per step the revealed answer
// slides 700ms cubic-bezier(.45,1.15,.4,1) level with its author's row, the
// answers still waiting reflow into the rows left over, the card colours in,
// the author fades in (+260ms), the check/cross badge pops (+300ms), and the
// matcher pills land opposite at 250 + row*800 + 430 ms.
(function () {
  const kit = window.KybScreenKit;
  const h = kit.h;

  const ROW_H = '76px', GAP = '7px', STRIDE = 83;   // 76 + 7 = 83px per row
  const FIRST = 350, STEP = 900;                    // first reveal at 350ms, one every 900ms
  const COL_LBL = { font: '400 11px var(--kyb-pixel)', letterSpacing: '.08em', color: 'var(--kyb-ink-40)', height: '14px' };
  const ROW_RADIUS = '15px 8px 17px 8px/8px 17px 8px 15px';

  const DEFAULT_LABELS = {
    status: 'THE TRUTH',
    answers: 'ANSWERS',
    players: 'PLAYERS',
    right: 'RIGHT',
    matchedIt: 'MATCHED IT',
    nobody: 'NOBODY GOT IT',
    hintIdle: 'Answers are about to find their owners.',
    hintRevealing: 'Each one slides to whoever said it.',
    hintDone: 'Green pills = who else nailed it.',
    replay: 'Replay reveal',
  };

  function assign(target, source) {
    Object.keys(source).forEach((k) => { target[k] = source[k]; });
    return target;
  }

  function mount(props) {
    const host = kit.mountHost('phone-truth');
    let state = null;
    let timers = [];
    let nodes = [];
    let buildKey = null;

    const statusEl = h('span', { style: { font: '400 12px var(--kyb-pixel)', letterSpacing: '.08em', color: 'var(--kyb-pink)' } });
    const scoreEl = h('span', { style: { fontWeight: '800', fontSize: '19px' } });
    const head = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [statusEl, scoreEl]);
    const hint = h('p', { style: { margin: '0', fontSize: '14px', color: 'var(--kyb-ink-40)', minHeight: '38px' } });

    const aCol = h('div', { style: { display: 'flex', flexDirection: 'column', gap: GAP } });
    const pCol = h('div', { style: { display: 'flex', flexDirection: 'column', gap: GAP } });
    const cols = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px', alignContent: 'start' } }, [aCol, pCol]);
    const scroller = h('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', overflowX: 'hidden', margin: '0 -5px', padding: '0 5px' } }, cols);

    const replay = h('button', {
      style: {
        width: '100%', font: '700 15px var(--kyb-display)', letterSpacing: '.14em',
        textTransform: 'uppercase', padding: '13px', background: 'transparent',
        color: 'var(--kyb-ink-64)', border: '2px dashed var(--kyb-line)', borderRadius: '8px', cursor: 'pointer',
      },
      on: { click: () => run() },
    });
    // The round loop needs a way forward off this screen, which the handoff's
    // TRUTH card does not carry: it ends on Replay alone. Rather than take the
    // designed control away, the continue gate sits under it in the same
    // footer, in the same shape, and only the scroller gives up the height.
    const advance = h('button', {
      style: {
        width: '100%', font: '700 15px var(--kyb-display)', letterSpacing: '.14em',
        textTransform: 'uppercase', padding: '13px', background: 'var(--kyb-green)',
        color: 'var(--kyb-on-accent)', border: '1px solid var(--kyb-green)', borderRadius: '8px', cursor: 'pointer',
      },
      on: { click: () => { if (state && state.onContinue && !advance.disabled) state.onContinue(); } },
    });
    // Stacked, not side by side: at 390px a half-width button wraps
    // "REPLAY REVEAL" onto two lines. Full width keeps the handoff's button
    // exactly as drawn and gives the gate the same shape underneath it.
    const foot = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [replay, advance]);

    const root = h('div', {
      style: {
        width: '100%', height: '100%', boxSizing: 'border-box', background: 'var(--kyb-page)',
        overflow: 'hidden', padding: '20px 18px 18px', display: 'flex', flexDirection: 'column', gap: '12px',
        fontFamily: 'var(--kyb-display)', color: 'var(--kyb-ink)',
      },
    }, [head, hint, scroller, foot]);
    host.appendChild(root);

    // Built ONCE per round. Every reveal step below only mutates these nodes.
    function build(n) {
      const data = window.KybData;
      const players = data.players(), answers = data.answers();
      const order = data.phoneOrder().filter((i) => i < n);
      aCol.innerHTML = '';
      pCol.innerHTML = '';
      nodes = [];

      aCol.appendChild(h('div', { style: assign({}, COL_LBL), text: state.labels.answers }));
      order.forEach((ai) => {
        const a = answers[ai], o = players[a.owner];
        const ok = state.guesses[a.id] === o.id;
        const owner = h('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: '5px', minWidth: '0',
            opacity: '0', transform: 'translateY(6px)', transition: 'all 300ms ease-out 260ms',
          },
        }, [
          h('span', {
            style: {
              width: '19px', height: '19px', flex: 'none', borderRadius: '7px 4px 8px 4px/4px 8px 4px 7px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: '400 9px var(--kyb-pixel)', color: 'var(--kyb-on-accent)', background: o.color,
            },
            text: o.initial,
          }),
          h('span', { style: { fontWeight: '800', fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, text: o.name }),
        ]);
        const badge = h('span', {
          style: {
            position: 'absolute', top: '-8px', right: '-8px', width: '22px', height: '22px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', font: '400 11px var(--kyb-pixel)',
            color: 'var(--kyb-on-accent)', background: ok ? 'var(--kyb-green)' : 'var(--kyb-pink)',
            border: '2px solid var(--kyb-page)', opacity: '0', transform: 'scale(.4)',
            transition: 'all 320ms cubic-bezier(.2,1.6,.4,1) 300ms',
          },
          text: ok ? '✓' : '✕',
        });
        const row = h('div', {
          style: {
            position: 'relative', height: ROW_H, flex: 'none', boxSizing: 'border-box',
            padding: '7px 9px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px',
            overflow: 'hidden', background: 'var(--kyb-card)', border: '2px solid var(--kyb-line)',
            borderRadius: ROW_RADIUS, zIndex: '10',
            transition: 'transform 700ms cubic-bezier(.45,1.15,.4,1),background 300ms ease-out,border-color 300ms ease-out',
          },
        }, [
          h('span', { style: { fontSize: '13px', lineHeight: '1.24' }, text: a.short }),
          owner,
          badge,
        ]);
        aCol.appendChild(row);
        nodes.push({ row, owner, badge, ai, ok, ownerIndex: a.owner });
      });

      pCol.appendChild(h('div', { style: assign({}, COL_LBL), text: state.labels.players }));
      players.slice(0, n).forEach((p, i) => {
        const a = answers.find((x) => x.owner === i);
        const ms = (a ? a.matchers : []).filter((j) => j < n).map((j) => players[j]);
        const got = h('span', {
          style: {
            marginLeft: 'auto', font: '400 7.5px var(--kyb-pixel)', letterSpacing: '.06em',
            color: ms.length ? 'var(--kyb-green)' : 'var(--kyb-pink)', opacity: '0',
            transition: 'opacity 380ms ease-out', whiteSpace: 'nowrap',
          },
          text: ms.length ? state.labels.matchedIt : state.labels.nobody,
        });
        const pills = h('div', {
          style: {
            display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: '3px', minHeight: '38px',
            overflow: 'hidden', opacity: '0', transition: 'opacity 380ms ease-out',
          },
        }, ms.map((m) => h('span', {
          style: {
            display: 'flex', alignItems: 'center', gap: '3px', padding: '1px 4px 1px 2px',
            background: 'var(--kyb-page)', border: `1.5px solid ${m.color}`,
            borderRadius: '8px 4px 9px 4px/4px 9px 4px 8px',
          },
        }, [
          h('span', { style: { width: '6px', height: '6px', flex: 'none', borderRadius: '50%', background: m.color } }),
          h('span', { style: { fontWeight: '700', fontSize: '9.5px', lineHeight: '1.2', whiteSpace: 'nowrap' }, text: m.name }),
        ])));
        const row = h('div', {
          style: {
            height: ROW_H, flex: 'none', boxSizing: 'border-box', padding: '6px 8px',
            display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden',
            background: 'var(--kyb-card)', border: `2px solid ${p.color}`, borderRadius: ROW_RADIUS,
          },
        }, [
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0' } }, [
            h('span', {
              style: {
                width: '21px', height: '21px', flex: 'none', borderRadius: '8px 4px 9px 5px/5px 9px 4px 8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', font: '400 10px var(--kyb-pixel)',
                color: 'var(--kyb-on-accent)', background: p.color,
              },
              text: p.initial,
            }),
            h('span', { style: { fontWeight: '800', fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, text: p.name }),
            got,
          ]),
          pills,
        ]);
        row.kybFades = [got, pills];
        pCol.appendChild(row);
      });
    }

    /* Reflow: revealed answers take their author's row; the ones still waiting fill
       the remaining rows in order, so nothing ever overlaps or crosses. */
    function slots(step) {
      const slot = {}, taken = {};
      nodes.forEach((nd, r) => { if (r < step) { slot[r] = nd.ownerIndex; taken[nd.ownerIndex] = 1; } });
      let free = 0;
      nodes.forEach((nd, r) => { if (slot[r] == null) { while (taken[free]) free++; slot[r] = free; taken[free] = 1; } });
      return slot;
    }

    function paint(step, phase) {
      const data = window.KybData;
      const n = data.clampPlayers(state.players);
      const players = data.players(), answers = data.answers();
      const slot = slots(step);
      nodes.forEach((nd, r) => {
        const on = r < step;
        nd.row.style.transform = `translateY(${(slot[r] - r) * STRIDE}px)`;
        nd.row.style.zIndex = String(on ? 30 - r : 10);
        nd.row.style.background = on ? (nd.ok ? 'var(--kyb-tint-g)' : 'var(--kyb-tint-p)') : 'var(--kyb-card)';
        nd.row.style.borderColor = on ? (nd.ok ? 'var(--kyb-green)' : 'var(--kyb-pink)') : 'var(--kyb-line)';
        nd.owner.style.opacity = on ? '1' : '0';
        nd.owner.style.transform = `translateY(${on ? 0 : 6}px)`;
        nd.badge.style.opacity = on ? '1' : '0';
        nd.badge.style.transform = `scale(${on ? 1 : 0.4})`;
      });

      // pills land just after their answer settles
      const rowOfOwner = {}; nodes.forEach((nd, r) => { rowOfOwner[nd.ownerIndex] = r; });
      Array.prototype.forEach.call(pCol.children, (row, idx) => {
        if (!row.kybFades) return;
        const i = idx - 1; // the column label is the first child
        const op = phase >= 1 ? '1' : '0';
        const delay = 250 + (rowOfOwner[i] || 0) * 800 + 430;
        row.kybFades.forEach((x) => {
          x.style.transitionDelay = delay + 'ms';
          x.style.opacity = op;
        });
      });

      const score = answers.slice(0, n).filter((a) => state.guesses[a.id] === players[a.owner].id).length;
      scoreEl.textContent = phase >= 2 ? `${score} / ${n} ${state.labels.right}` : '—';
      scoreEl.style.color = score >= n * 0.6 ? 'var(--kyb-green)' : score >= n * 0.35 ? 'var(--kyb-yellow)' : 'var(--kyb-pink)';
      hint.textContent = phase === 0 ? state.labels.hintIdle
        : phase === 1 ? state.labels.hintRevealing
        : state.labels.hintDone;
    }

    function run() {
      const data = window.KybData;
      const n = data.clampPlayers(state.players);
      const answers = data.answers();
      timers.forEach(clearTimeout); timers = [];
      build(n);
      paint(0, 0);
      scroller.scrollTop = 0;
      timers.push(setTimeout(() => paint(0, 1), 60));
      nodes.forEach((nd, r) => timers.push(setTimeout(() => {
        paint(r + 1, 1);
        scroller.scrollTo({ top: Math.max(0, answers[nd.ai].owner * STRIDE - 150), behavior: 'smooth' });
      }, FIRST + r * STEP)));
      timers.push(setTimeout(() => paint(nodes.length, 2), FIRST + n * STEP));
    }

    function paintFoot() {
      replay.textContent = state.labels.replay;
      const gated = Boolean(state.continueLabel);
      advance.style.display = gated ? '' : 'none';
      if (gated) {
        advance.textContent = state.continueLabel;
        advance.disabled = !state.onContinue;
        advance.style.opacity = state.onContinue ? '1' : '.55';
        advance.style.cursor = state.onContinue ? 'pointer' : 'default';
      }
    }

    function update(next) {
      state = assign({ players: 12, guesses: {}, labels: {}, continueLabel: '', onContinue: null }, next || {});
      state.labels = assign(assign({}, DEFAULT_LABELS), (next && next.labels) || {});

      const data = window.KybData;
      const key = `${data.clampPlayers(state.players)}|${state.labels.answers}|${data.answers().map((a) => a.id).join(',')}`;
      statusEl.textContent = state.labels.status;
      paintFoot();
      // Only a new round restarts the choreography. Everything else -- another
      // player pressing Next, a score arriving -- refreshes the footer alone,
      // because rebuilding the list mid-reveal would snap it.
      if (key !== buildKey) {
        buildKey = key;
        run();
      }
    }

    update(props);

    return {
      update,
      destroy() {
        timers.forEach(clearTimeout); timers = [];
        if (host.parentNode) host.parentNode.removeChild(host);
      },
    };
  }

  window.KybPhoneTruthScreen = { mount };
})();
