// TV · TRUTH — the big screen's reveal of who said what, one answer at a time.
//
// The first build put every answer on screen at once and lit them up in
// sequence. With six players that is six cards, six author stickers and a
// scatter of matcher pills competing for attention, and the room could not
// tell which one it was meant to be looking at.
//
// So the reveal is now a spotlight. One answer holds the whole stage:
//
//   1. the card flips up from its "?" back
//   2. the answer rises
//   3. the author sticker pops -- who actually wrote it
//   4. "n GOT IT" lands, then the matcher pills, one every 130ms
//   5. the card zooms out and flies to the rail down the left, where it stays
//      small for the rest of the round
//
// ...and the next answer takes the stage. The beats inside a card are the
// handoff's, unchanged, and still come from KybData.revealTimeline(); what
// changed is that only one card is ever mid-reveal, and a finished one shrinks
// out of the way instead of staying full size.
//
// The tilt sits on a WRAPPER element: kybFlipIn ends at rotate(0) and would
// cancel a tilt set on the card itself. The demote flight reuses that same
// wrapper transform, so the card keeps its angle as it shrinks.
(function () {
  const kit = window.KybScreenKit;
  const h = kit.h;

  const PIXEL = { font: '400 13px var(--kyb-pixel)', letterSpacing: '.08em' };
  const BADGE = { border: '1px solid currentColor', borderRadius: '4px', padding: '3px 8px' };
  const CARD_RADIUS = '22px 12px 26px 13px/13px 27px 12px 22px';
  const MINI_RADIUS = '15px 8px 17px 8px/8px 17px 8px 15px';
  const FACE = {
    position: 'absolute', inset: '0', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    boxSizing: 'border-box', borderWidth: '3px', borderStyle: 'solid', borderRadius: CARD_RADIUS,
  };

  // The handoff's beats were written for a grid where every card ran at once,
  // so they are brisk. Spotlit one at a time on a television, across a room,
  // they read as a blur -- PACE stretches every delay and every duration
  // inside a card by the same factor, so the choreography keeps its shape and
  // simply has room to breathe.
  const PACE = 1.6;
  const ms = (n) => `${Math.round(n * PACE)}ms`;

  // How long a finished card lingers at full size before it flies to the rail,
  // and how long that flight takes. The dwell is the whole point of the
  // rewrite: it is the beat where the room reads who got it.
  const DWELL = 1100;
  const DEMOTE = 620;
  // How long the headline holds the stage on its own before the first card.
  const HEADLINE_HOLD = 1500;

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

  // The last thing that happens inside one card, relative to its own start:
  // the final matcher pill, or the "nobody got it" label when there are none.
  function cardSpan(c) {
    const base = c.flipDelay;
    const last = c.matchers.length
      ? c.matchers[c.matchers.length - 1].delay + 340
      : c.labelDelay + 340;
    return Math.round(Math.max(1490, last - base) * PACE);
  }

  function mount(props) {
    const host = kit.mountHost('tv-truth');
    let state = null;
    let timers = [];
    let cards = [];

    const statusEl = h('span', { style: assign(assign({}, PIXEL), assign(assign({}, BADGE), { color: 'var(--kyb-pink)' })) });
    const questionEl = h('span', { style: assign(assign({}, PIXEL), { color: 'var(--kyb-ink-40)' }) });
    const countEl = h('span', { style: assign(assign({}, PIXEL), { marginLeft: 'auto', color: 'var(--kyb-ink-40)' }) });
    const head = h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } }, [statusEl, questionEl, countEl]);

    // Cards that have had their moment. They shrink to share the column, so
    // five players read as a deliberate stack and twelve still fit.
    const rail = h('div', {
      style: {
        width: '208px', flex: 'none', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', gap: '8px', minHeight: '0',
      },
    });
    const headline = h('h2', { style: { margin: '0', fontWeight: '800', fontSize: '34px', textAlign: 'center', opacity: '0', transition: 'opacity 400ms ease-out' } });
    // The spotlight. One card at a time, centred, as big as the stage allows.
    const hero = h('div', {
      style: {
        flex: '1', minWidth: '0', height: '100%', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      },
    }, headline);
    const stage = h('div', {
      style: { flex: '1', minHeight: '0', width: '100%', display: 'flex', alignItems: 'stretch', gap: '26px' },
    }, [rail, hero]);

    const replay = h('button', {
      style: {
        font: '400 12px var(--kyb-pixel)', letterSpacing: '.08em', color: 'var(--kyb-ink-64)',
        background: 'transparent', border: '2px dashed var(--kyb-line)', borderRadius: '8px',
        padding: '10px 16px', cursor: 'pointer',
      },
      on: { click: () => runReveal() },
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
        gap: '18px', padding: '26px 46px 30px', fontFamily: 'var(--kyb-display)', color: 'var(--kyb-ink)',
      },
    }, [head, stage, foot]);
    host.appendChild(root);

    // ---------------------------------------------------------------------
    // The hero card. Same anatomy as the handoff's reveal card; the beats are
    // the timeline's, shifted so each card's own flip is time zero.
    // ---------------------------------------------------------------------
    function heroCard(c, type) {
      const base = c.flipDelay;
      const authorTag = h('div', {
        style: {
          alignSelf: 'flex-start', maxWidth: 'calc(100% + 14px)', margin: '-24px 0 0 -24px',
          display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 13px 5px 5px',
          background: c.owner.color, border: '2px solid var(--kyb-ink)',
          borderRadius: '13px 6px 14px 7px/7px 14px 6px 13px', boxShadow: '2px 2px 0 var(--kyb-ink)',
          animation: `kybTagPop ${ms(480)} cubic-bezier(.2,1.5,.4,1) both`, animationDelay: ms(c.tagDelay - base),
        },
      }, [
        h('span', {
          style: {
            width: kit.px(type.disc), height: kit.px(type.disc), flex: 'none', borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            font: `400 ${kit.px(type.disc * 0.38)} var(--kyb-pixel)`,
            background: 'var(--kyb-page)', color: c.owner.color,
          },
          text: c.owner.initial,
        }),
        h('span', {
          style: {
            fontWeight: '800', fontSize: kit.px(type.name), color: 'var(--kyb-on-accent)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          },
          text: c.owner.name,
        }),
      ]);

      const text = h('p', {
        style: {
          margin: '0', flex: '1', minHeight: '0', overflow: 'hidden', display: 'flex',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: '700',
          fontSize: kit.px(type.truth), lineHeight: '1.24', textWrap: 'pretty',
          animation: `kybRise ${ms(420)} ease-out both`, animationDelay: ms(c.textDelay - base),
        },
        text: c.text,
      });

      const pills = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '9px', minHeight: '38px', alignContent: 'flex-start' } },
        c.matchers.map((m) => h('span', {
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 15px 6px 10px', background: 'var(--kyb-page)',
            border: `1.5px solid ${m.color}`, borderRadius: '9px 5px 10px 5px/5px 10px 5px 9px',
            animation: `kybChipPop ${ms(340)} cubic-bezier(.2,1.5,.4,1) both`,
            animationDelay: ms(m.delay - base),
          },
        }, [
          h('span', { style: { width: '15px', height: '15px', flex: 'none', borderRadius: '50%', background: m.color } }),
          h('span', { style: { fontWeight: '700', fontSize: kit.px(type.pill), lineHeight: '1.2', whiteSpace: 'nowrap' }, text: m.name }),
        ])));

      const footer = h('div', { style: { borderTop: '2px dashed var(--kyb-line)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '11px' } }, [
        h('span', {
          style: {
            font: `400 ${kit.px(type.gotIt)} var(--kyb-pixel)`, letterSpacing: '.08em', color: c.countColor,
            animation: `kybRise ${ms(340)} ease-out both`, animationDelay: ms(c.labelDelay - base),
          },
          text: c.countLabel,
        }),
        pills,
      ]);

      const front = h('div', {
        style: assign(assign({}, FACE), {
          padding: '24px 28px 22px', background: c.cardBg, borderColor: c.owner.color,
          display: 'flex', flexDirection: 'column', gap: '16px',
        }),
      }, [authorTag, text, footer]);

      const back = h('div', {
        style: assign(assign({}, FACE), {
          transform: 'rotateY(180deg)', background: 'var(--kyb-card)', borderColor: c.owner.color,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }),
      }, [
        h('div', {
          style: {
            position: 'absolute', inset: '10px', border: `2px dashed ${c.owner.color}`,
            borderRadius: '18px 9px 21px 10px/10px 22px 9px 18px', opacity: '.4',
          },
        }),
        h('span', { style: { font: '400 96px var(--kyb-pixel)', color: c.owner.color }, text: '?' }),
        h('span', { style: { font: '400 13px var(--kyb-pixel)', letterSpacing: '.08em', color: 'var(--kyb-ink-40)' }, text: state.labels.whose }),
      ]);

      const faces = h('div', {
        style: {
          position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d',
          animation: `kybFlipIn ${ms(540)} cubic-bezier(.3,1,.35,1) both`,
        },
      }, [front, back]);

      return h('div', {
        style: {
          position: 'absolute', width: 'min(880px, 100%)', height: 'min(100%, 560px)',
          perspective: '1100px', transform: `rotate(${c.rot}deg)`, willChange: 'transform',
        },
      }, faces);
    }

    // The card once it has had its moment: small, still legible, still in its
    // author's colour, tinted green when somebody got it.
    function miniCard(c) {
      return h('div', {
        style: {
          flex: '1 1 0', minHeight: '0', maxHeight: '74px', boxSizing: 'border-box',
          padding: '7px 9px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px',
          overflow: 'hidden', background: c.cardBg, border: `2px solid ${c.owner.color}`,
          borderRadius: MINI_RADIUS, transform: `rotate(${c.rot}deg)`,
          opacity: '0', transition: 'opacity 260ms ease-out',
        },
      }, [
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '5px', minWidth: '0' } }, [
          h('span', {
            style: {
              width: '18px', height: '18px', flex: 'none', borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', font: '400 8px var(--kyb-pixel)',
              background: c.owner.color, color: 'var(--kyb-on-accent)',
            },
            text: c.owner.initial,
          }),
          h('span', {
            style: { fontWeight: '800', fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
            text: c.owner.name,
          }),
          h('span', {
            style: { marginLeft: 'auto', flex: 'none', font: '400 8px var(--kyb-pixel)', letterSpacing: '.06em', color: c.countColor },
            text: c.matchers.length ? String(c.matchers.length) : '0',
          }),
        ]),
        h('span', {
          style: {
            fontSize: '11px', lineHeight: '1.22', color: 'var(--kyb-ink-64)', overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical',
          },
          text: c.text,
        }),
      ]);
    }

    // ---------------------------------------------------------------------
    // The loop: play one card, fly it to the rail, start the next.
    // ---------------------------------------------------------------------
    function flyToRail(wrapper, mini, done) {
      const from = wrapper.getBoundingClientRect();
      const to = mini.getBoundingClientRect();
      if (!from.width || !to.width) { done(); return; }
      const scale = to.width / from.width;
      const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
      const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
      wrapper.style.transition = `transform ${DEMOTE}ms cubic-bezier(.4,0,.2,1), opacity ${DEMOTE}ms ease-in`;
      // Reading the box above has already flushed layout, so the transition
      // starts from the card's resting transform rather than jumping.
      wrapper.style.transform = `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${wrapper.dataset.rot}deg)`;
      wrapper.style.opacity = '0';
      timers.push(setTimeout(done, DEMOTE));
    }

    function playCard(i, type) {
      if (i >= cards.length) return;
      const c = cards[i];
      const wrapper = heroCard(c, type);
      wrapper.dataset.rot = String(c.rot);
      hero.appendChild(wrapper);

      timers.push(setTimeout(() => {
        const mini = miniCard(c);
        rail.appendChild(mini);
        flyToRail(wrapper, mini, () => {
          if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
          mini.style.opacity = '1';
          playCard(i + 1, type);
        });
      }, cardSpan(c) + DWELL));
    }

    function runReveal() {
      const data = window.KybData;
      const n = data.clampPlayers(state.players);
      timers.forEach(clearTimeout);
      timers = [];
      rail.innerHTML = '';
      Array.prototype.slice.call(hero.children).forEach((el) => { if (el !== headline) hero.removeChild(el); });
      headline.style.opacity = '0';

      cards = data.revealTimeline(n);
      // One card owns the stage, so it gets the widest type profile the grid
      // sizing would ever hand out rather than the one for this player count.
      // The verdict line and the matcher pills are the whole point of the
      // spotlight, so they are sized up from where the grid left them.
      // tvType() sizes cards for the grid, where the widest one is still a
      // sixth of the screen. A spotlit card is most of it, so the answer, the
      // author and the verdict are all set from this card's own scale.
      const type = assign(kit.tvType(2), { truth: 40, name: 30, disc: 46, gotIt: 21, pill: 23 });

      countEl.textContent = `${cards.length} ${state.labels.answers} · ${n} ${state.labels.players}`;
      const total = cards.reduce((sum, c) => sum + cardSpan(c) + DWELL + DEMOTE, HEADLINE_HOLD + 420);
      replay.textContent = `${state.labels.replay} (≈${Math.round(total / 1000)}s)`;

      // "Here's who said what." introduces the reveal -- it is the line the
      // room hears before the first card, not a caption on an empty stage
      // after the last one.
      headline.style.opacity = '1';
      timers.push(setTimeout(() => { headline.style.opacity = '0'; }, HEADLINE_HOLD));
      timers.push(setTimeout(() => playCard(0, type), HEADLINE_HOLD + 420));
    }

    function update(next) {
      state = assign({ players: 12, question: '', onScoreboard: null, labels: {} }, next || {});
      state.labels = assign(assign({}, DEFAULT_LABELS), (next && next.labels) || {});

      statusEl.textContent = state.labels.status;
      questionEl.textContent = state.question;
      headline.textContent = state.labels.headline;
      scoreboard.textContent = state.labels.scoreboard;
      scoreboard.style.visibility = state.onScoreboard ? 'visible' : 'hidden';
      runReveal();
    }

    update(props);

    return {
      update,
      // The reveal is a one-shot piece of choreography: re-running update()
      // would restart it, so callers refresh only when the round changes.
      destroy() {
        timers.forEach(clearTimeout);
        timers = [];
        if (host.parentNode) host.parentNode.removeChild(host);
      },
    };
  }

  window.KybTvTruthScreen = { mount };
})();
