// TV · TRUTH — the big screen's serial reveal of who said what.
//
// Port of match_truth_export/react/TvTruthScreen.jsx. Same 1280x720-derived
// canvas and the same two-row grid rule as TV MATCH, so MATCH -> TRUTH is a
// straight swap with no reflow.
//
// The reveal is STRICTLY SERIAL: every beat is a CSS animation-delay taken from
// KybData.revealTimeline(), so card k+1 never starts flipping until card k has
// finished its whole sequence (flip -> answer -> author sticker -> "n GOT IT"
// -> matcher pills). ~22s for 12 answers. Replay = rebuild the grid, which is
// what bumping runId does in the React port.
//
// As on MATCH, the tilt sits on a WRAPPER element -- kybFlipIn ends at
// rotate(0) and would cancel a tilt set on the card itself.
(function () {
  const kit = window.KybScreenKit;
  const h = kit.h;

  const PIXEL = { font: '400 13px var(--kyb-pixel)', letterSpacing: '.08em' };
  const BADGE = { border: '1px solid currentColor', borderRadius: '4px', padding: '3px 8px' };
  const FACE = {
    position: 'absolute', inset: '0', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    boxSizing: 'border-box', borderWidth: '3px', borderStyle: 'solid',
    borderRadius: '22px 12px 26px 13px/13px 27px 12px 22px',
  };

  const DEFAULT_LABELS = {
    status: 'THE TRUTH',
    answers: 'ANSWERS',
    players: 'PLAYERS',
    headline: "Here's who said what.",
    replay: 'Replay reveal',
    scoreboard: 'Scoreboard ▶',
    whose: 'WHOSE?',
  };

  function assign(target, source) {
    Object.keys(source).forEach((k) => { target[k] = source[k]; });
    return target;
  }

  function mount(props) {
    const host = kit.mountHost('tv-truth');
    let state = null;

    const statusEl = h('span', { style: assign(assign({}, PIXEL), assign(assign({}, BADGE), { color: 'var(--kyb-pink)' })) });
    const questionEl = h('span', { style: assign(assign({}, PIXEL), { color: 'var(--kyb-ink-40)' }) });
    const countEl = h('span', { style: assign(assign({}, PIXEL), { marginLeft: 'auto', color: 'var(--kyb-ink-40)' }) });
    const head = h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } }, [statusEl, questionEl, countEl]);

    const headline = h('h2', { style: { margin: '0', fontWeight: '800', fontSize: '34px' } });
    const grid = h('div', { style: { width: '100%', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', gap: '14px' } });
    const stage = h('div', {
      style: {
        flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '16px', minHeight: '0', width: '100%',
      },
    }, [headline, grid]);

    const replay = h('button', {
      style: {
        font: '400 12px var(--kyb-pixel)', letterSpacing: '.08em', color: 'var(--kyb-ink-64)',
        background: 'transparent', border: '2px dashed var(--kyb-line)', borderRadius: '8px',
        padding: '10px 16px', cursor: 'pointer',
      },
      on: { click: () => buildGrid() },
    });
    const scoreboard = h('button', {
      style: {
        marginLeft: 'auto', fontWeight: '700', fontSize: '16px', letterSpacing: '.14em',
        textTransform: 'uppercase', padding: '13px 28px', background: 'var(--kyb-yellow)',
        color: 'var(--kyb-on-accent)', border: '1px solid var(--kyb-yellow)', borderRadius: '8px', cursor: 'pointer',
      },
      on: { click: () => { if (state && state.onScoreboard) state.onScoreboard(); } },
    });
    const foot = h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } }, [replay, scoreboard]);

    const root = h('div', {
      style: {
        position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box',
        background: 'var(--kyb-page)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        padding: '26px 46px 30px', fontFamily: 'var(--kyb-display)', color: 'var(--kyb-ink)',
      },
    }, [head, stage, foot]);
    host.appendChild(root);

    function card(c, width) {
      const authorTag = h('div', {
        style: {
          alignSelf: 'flex-start', maxWidth: 'calc(100% + 12px)', margin: '-19px 0 0 -19px',
          display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 9px 4px 4px',
          background: c.owner.color, border: '2px solid var(--kyb-ink)',
          borderRadius: '13px 6px 14px 7px/7px 14px 6px 13px', boxShadow: '2px 2px 0 var(--kyb-ink)',
          animation: 'kybTagPop 480ms cubic-bezier(.2,1.5,.4,1) both', animationDelay: `${c.tagDelay}ms`,
        },
      }, [
        h('span', {
          style: {
            width: '22px', height: '22px', flex: 'none', borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', font: '400 10px var(--kyb-pixel)',
            background: 'var(--kyb-page)', color: c.owner.color,
          },
          text: c.owner.initial,
        }),
        h('span', {
          style: {
            fontWeight: '800', fontSize: '16.5px', color: 'var(--kyb-on-accent)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          },
          text: c.owner.name,
        }),
      ]);

      const text = h('p', {
        style: {
          margin: '0', flex: '1', minHeight: '0', overflow: 'hidden', display: 'flex',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: '700',
          fontSize: '19px', lineHeight: '1.24', textWrap: 'pretty',
          animation: 'kybRise 420ms ease-out both', animationDelay: `${c.textDelay}ms`,
        },
        text: c.text,
      });

      const pills = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '21px', alignContent: 'flex-start' } },
        c.matchers.map((m) => h('span', {
          style: {
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '2px 6px 2px 4px', background: 'var(--kyb-page)',
            border: `1.5px solid ${m.color}`, borderRadius: '9px 5px 10px 5px/5px 10px 5px 9px',
            animation: 'kybChipPop 340ms cubic-bezier(.2,1.5,.4,1) both',
            animationDelay: `${m.delay}ms`,
          },
        }, [
          h('span', { style: { width: '9px', height: '9px', flex: 'none', borderRadius: '50%', background: m.color } }),
          h('span', { style: { fontWeight: '700', fontSize: '12.5px', lineHeight: '1.2', whiteSpace: 'nowrap' }, text: m.name }),
        ])));

      const footer = h('div', { style: { borderTop: '2px dashed var(--kyb-line)', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '5px' } }, [
        h('span', {
          style: {
            font: '400 10px var(--kyb-pixel)', letterSpacing: '.08em', color: c.countColor,
            animation: 'kybRise 340ms ease-out both', animationDelay: `${c.labelDelay}ms`,
          },
          text: c.countLabel,
        }),
        pills,
      ]);

      const front = h('div', {
        style: assign(assign({}, FACE), {
          padding: '11px 11px 9px', background: c.cardBg, borderColor: c.owner.color,
          display: 'flex', flexDirection: 'column', gap: '7px',
        }),
      }, [authorTag, text, footer]);

      const back = h('div', {
        style: assign(assign({}, FACE), {
          transform: 'rotateY(180deg)', background: 'var(--kyb-card)', borderColor: c.owner.color,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }),
      }, [
        h('div', {
          style: {
            position: 'absolute', inset: '8px', border: `2px dashed ${c.owner.color}`,
            borderRadius: '18px 9px 21px 10px/10px 22px 9px 18px', opacity: '.4',
          },
        }),
        h('span', { style: { font: '400 40px var(--kyb-pixel)', color: c.owner.color }, text: '?' }),
        h('span', { style: { font: '400 9px var(--kyb-pixel)', letterSpacing: '.08em', color: 'var(--kyb-ink-40)' }, text: state.labels.whose }),
      ]);

      const faces = h('div', {
        style: {
          position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d',
          animation: 'kybFlipIn 540ms cubic-bezier(.3,1,.35,1) both', animationDelay: `${c.flipDelay}ms`,
        },
      }, [front, back]);

      // tilt + perspective on the wrapper; the flip lives on the inner face holder
      return h('div', {
        style: { flex: 'none', width: width, minWidth: '0', height: '100%', perspective: '1100px', transform: `rotate(${c.rot}deg)` },
      }, faces);
    }

    function buildGrid() {
      const data = window.KybData;
      const n = data.clampPlayers(state.players);
      const cards = data.revealTimeline(n);
      const topCols = Math.ceil(cards.length / 2) || 1;
      const w = `calc((100% - ${(topCols - 1) * 14}px) / ${topCols})`;
      const rows = [cards.slice(0, topCols), cards.slice(topCols)];

      grid.innerHTML = '';
      rows.forEach((row) => {
        grid.appendChild(h('div', { style: { flex: '1', minHeight: '0', display: 'flex', justifyContent: 'center', gap: '14px' } },
          row.map((c) => card(c, w))));
      });

      countEl.textContent = `${cards.length} ${state.labels.answers} · ${n} ${state.labels.players}`;
      replay.textContent = `${state.labels.replay} (≈${Math.round(data.revealDuration(n) / 1000)}s)`;
    }

    function update(next) {
      state = assign({ players: 12, question: '', onScoreboard: null, labels: {} }, next || {});
      state.labels = assign(assign({}, DEFAULT_LABELS), (next && next.labels) || {});

      statusEl.textContent = state.labels.status;
      questionEl.textContent = state.question;
      headline.textContent = state.labels.headline;
      scoreboard.textContent = state.labels.scoreboard;
      scoreboard.style.visibility = state.onScoreboard ? 'visible' : 'hidden';
      buildGrid();
    }

    update(props);

    return {
      update,
      // The reveal is a one-shot piece of choreography: re-running update()
      // would restart it, so callers refresh only when the round changes.
      destroy() { if (host.parentNode) host.parentNode.removeChild(host); },
    };
  }

  window.KybTvTruthScreen = { mount };
})();
