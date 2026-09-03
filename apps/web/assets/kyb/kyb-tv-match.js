// TV · MATCH — the big screen while the room is matching answers to people.
//
// Port of match_truth_export/react/TvMatchScreen.jsx. Layout rule: the cards
// always fill two centred rows, topCols = ceil(n/2), so 5 -> 3+2, 6 -> 3+3,
// 7 -> 4+3, 12 -> 6+6, every card the same width. The per-card tilt sits on a
// WRAPPER element on purpose: kybPop ends at rotate(0) and would cancel a tilt
// set on the card itself. Do not collapse the wrapper into the card.
//
// The grid is built once per player count -- the clock ticks through update()
// and must never restart the entrance stagger.
(function () {
  const kit = window.KybScreenKit;
  const h = kit.h;

  const PIXEL = { font: '400 13px var(--kyb-pixel)', letterSpacing: '.08em' };
  const BADGE = { border: '1px solid currentColor', borderRadius: '4px', padding: '3px 8px' };

  const DEFAULT_LABELS = {
    round: 'ROUND 1 OF 3',
    status: 'MATCHING',
    headline: 'Now — who said what?',
    matched: 'MATCHED',
    whose: 'WHOSE?',
    cta: 'Show the truth ▶',
  };

  function assign(target, source) {
    Object.keys(source).forEach((k) => { target[k] = source[k]; });
    return target;
  }

  function timerColorFor(seconds) {
    return seconds <= 5 ? 'var(--kyb-pink)' : seconds <= 10 ? 'var(--kyb-yellow)' : 'var(--kyb-green)';
  }

  function mount(props) {
    const host = kit.mountHost('tv-match');
    let state = null;
    let gridKey = null;

    const roundEl = h('span', { style: assign(assign({}, PIXEL), assign({ color: 'var(--kyb-cyan)' }, BADGE)) });
    const questionEl = h('span', { style: assign(assign({}, PIXEL), { color: 'var(--kyb-ink-40)' }) });
    const statusEl = h('span', { style: assign(assign({}, PIXEL), assign(assign({}, BADGE), { marginLeft: 'auto', color: 'var(--kyb-pink)' })) });
    const head = h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } }, [roundEl, questionEl, statusEl]);

    const headline = h('h2', { style: { margin: '0', fontWeight: '800', fontSize: '34px', textAlign: 'center' } });
    const grid = h('div', { style: { width: '100%', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', gap: '14px' } });
    const stage = h('div', {
      style: {
        flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '16px', minHeight: '0', width: '100%',
      },
    }, [headline, grid]);

    const fill = h('div', { style: { height: '100%', borderRadius: '8px', width: '0%', transition: 'width 900ms linear' } });
    const bar = h('div', {
      style: {
        width: '420px', height: '16px', boxSizing: 'border-box', background: 'var(--kyb-card)',
        border: '3px solid var(--kyb-line)', borderRadius: '12px 5px 12px 5px/5px 12px 5px 12px',
        overflow: 'hidden', padding: '2px',
      },
    }, fill);
    const matchedEl = h('span', { style: assign(assign({}, PIXEL), { color: 'var(--kyb-ink-40)' }) });
    const cta = h('button', {
      style: {
        marginLeft: 'auto', font: '700 16px var(--kyb-display)', letterSpacing: '.14em',
        textTransform: 'uppercase', padding: '13px 26px', background: 'var(--kyb-green)',
        color: 'var(--kyb-on-accent)', border: '1px solid var(--kyb-green)', borderRadius: '8px', cursor: 'pointer',
      },
      on: { click: () => { if (state && state.onShowTruth) state.onShowTruth(); } },
    });
    const foot = h('div', { style: { display: 'flex', alignItems: 'center', gap: '20px' } }, [bar, matchedEl, cta]);

    const root = h('div', {
      style: {
        position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box',
        background: 'var(--kyb-page)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        padding: '26px 46px 30px', fontFamily: 'var(--kyb-display)', color: 'var(--kyb-ink)',
      },
    }, [head, stage, foot]);
    host.appendChild(root);

    function buildGrid(n, wobble) {
      const data = window.KybData;
      const answers = data.answers();
      const rotations = data.rotations();
      const colors = data.COLORS;
      const topCols = Math.ceil(Math.min(n, answers.length) / 2) || 1;
      const w = `calc((100% - ${(topCols - 1) * 14}px) / ${topCols})`;
      // Type scales with how much width each card actually gets -- see
      // KybScreenKit.tvType. A twelve-player grid halves the card width of a
      // five-player one, so a single fixed size either overflows at twelve or
      // reads as lost at five.
      const type = kit.tvType(Math.min(n, answers.length));
      const cards = answers.slice(0, n).map((a, i) => ({
        key: a.id, text: a.text, doodle: a.doodle,
        tag: (i < 9 ? '0' : '') + (i + 1),
        color: colors[i % 5], rot: rotations[i] * wobble, delay: i * 60,
      }));
      const rows = [cards.slice(0, topCols), cards.slice(topCols)];

      grid.innerHTML = '';
      rows.forEach((row) => {
        const rowEl = h('div', { style: { flex: '1', minHeight: '0', display: 'flex', justifyContent: 'center', gap: '14px' } });
        row.forEach((a) => {
          const card = h('div', {
            style: {
              position: 'relative', boxSizing: 'border-box', width: '100%', height: '100%',
              overflow: 'hidden', padding: '13px 13px 11px',
              background: 'var(--kyb-card)', border: `3px solid ${a.color}`,
              borderRadius: '22px 12px 26px 13px/13px 27px 12px 22px',
              animation: 'kybPop 360ms cubic-bezier(.2,1.4,.4,1) both',
              animationDelay: `${a.delay}ms`,
              display: 'flex', flexDirection: 'column', gap: '8px',
            },
          }, [
            h('span', { style: { font: `400 ${kit.px(type.tag)} var(--kyb-pixel)`, letterSpacing: '.08em', color: a.color }, text: a.tag }),
            h('p', {
              style: {
                margin: '0', flex: '1', minHeight: '0', overflow: 'hidden', display: 'flex',
                alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                fontWeight: '700', fontSize: kit.px(type.answer), lineHeight: '1.24', textWrap: 'pretty',
              },
              text: a.text,
            }),
            h('div', {
              style: {
                borderTop: '2px dashed var(--kyb-line)', paddingTop: '8px', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between',
              },
            }, [
              h('span', { style: { font: '400 10.5px var(--kyb-pixel)', letterSpacing: '.08em', color: 'var(--kyb-ink-40)' }, text: state.labels.whose }),
              h('span', { style: { font: '400 13px var(--kyb-pixel)', color: a.color }, text: a.doodle }),
            ]),
          ]);
          // The tilt lives here, on the wrapper, not on the card.
          rowEl.appendChild(h('div', {
            style: { flex: 'none', width: w, minWidth: '0', height: '100%', transform: `rotate(${a.rot}deg)` },
          }, card));
        });
        grid.appendChild(rowEl);
      });
    }

    function update(next) {
      state = assign({
        players: 12, question: '', seconds: 20, total: 20, matched: 0,
        matchedTotal: null, wobble: 1, onShowTruth: null, labels: {},
      }, next || {});
      state.labels = assign(assign({}, DEFAULT_LABELS), (next && next.labels) || {});

      const n = window.KybData.clampPlayers(state.players);
      const key = `${n}|${state.wobble}|${state.labels.whose}|${window.KybData.answers().map((a) => a.id).join(',')}`;
      if (key !== gridKey) {
        gridKey = key;
        buildGrid(n, state.wobble);
      }

      roundEl.textContent = state.labels.round;
      questionEl.textContent = state.question;
      statusEl.textContent = state.labels.status;
      headline.textContent = state.labels.headline;

      const color = timerColorFor(state.seconds);
      fill.style.background = color;
      fill.style.width = `${Math.round((state.seconds / (state.total || 20)) * 100)}%`;
      const denominator = state.matchedTotal === null ? n : state.matchedTotal;
      matchedEl.textContent = `${state.matched} / ${denominator} ${state.labels.matched}`;
      cta.textContent = state.labels.cta;
      // The TV is a display: it only carries the CTA when the game loop gives
      // it something to do with it.
      cta.style.visibility = state.onShowTruth ? 'visible' : 'hidden';
    }

    update(props);

    return {
      update,
      destroy() { if (host.parentNode) host.parentNode.removeChild(host); },
    };
  }

  window.KybTvMatchScreen = { mount };
})();
