// Shared Kahoot-style animated leaderboard renderer. Used by trivia-play.js
// (player view) and trivia-host-console.js (TV view) so the board plays the
// round out instead of silently jumping to its new state between questions.
//
// Three things animate, from the same remembered snapshot:
//
//   RANK   a player's row slides from where it used to sit to where it sits
//          now, crossing paths with whoever they just overtook.
//   BAR    a player's progress bar grows from its old length to its new one,
//          rather than appearing already full.
//   SCORE  their total counts up to its new value instead of snapping.
//
// Rows have no stable identity across renders (each phase transition fully
// replaces the surrounding markup, destroying the previous board's DOM), so
// this can't measure an old vs new DOM rect directly. Instead it remembers,
// per userId, the rank index / bar width / score from the last render under
// the same `key`. For the slide it then looks up what rect the row now
// occupying that old index has and animates from there -- which stays correct
// even though the "old" row itself no longer exists.
//
// Callers opt a row into the bar and score animations by marking the elements
// in the HTML they return:
//   data-bar    on the bar's fill element, with its final width as an inline
//               `width:<n>%` -- that inline value is the target, and the fill
//               is started from the remembered one.
//   data-score  on the element showing the total, with the numeric value in
//               the attribute (data-score="1200"). Its text is counted up to
//               that number; whatever formatting the caller wrote is used for
//               the final frame, so separators and suffixes survive.
// A row without these marks simply doesn't animate them -- every existing
// caller kept working before they were added.
(function () {
  const previousByKey = new Map(); // key -> Map(userId -> {rank, bar, score})

  const REORDER_MS = 500;
  const BAR_MS = 700;
  const COUNT_MS = 700;

  const reduceMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Ease-out: fast at first, settling at the end. Matches the slide's curve
  // closely enough that a row moving up and its bar growing read as one event.
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Intermediate frames are written the way the caller wrote the final one.
  // The player board formats scores with toLocaleString, which in Arabic is
  // Arabic-Indic digits -- counting up in plain Latin digits and then snapping
  // to ٩٠٠ on the last frame is worse than not animating at all. Comparing the
  // caller's own text against the bare number tells us which it is, without
  // the caller having to pass a formatter in.
  function frameFormatter(finalText, to) {
    if (finalText === String(to)) return (n) => String(n);
    const locale = document.documentElement.getAttribute('lang') === 'ar' ? 'ar-EG' : 'en-US';
    return (n) => Number(n).toLocaleString(locale);
  }

  function countUp(el, from, to, finalText) {
    if (from === to) return;
    const format = frameFormatter(finalText, to);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      if (t >= 1) {
        el.textContent = finalText;
        return;
      }
      el.textContent = format(Math.round(from + (to - from) * easeOut(t)));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // container: the element whose children are the row nodes (one per entry
  // in `rows`, in order). rowHtml(row, index): returns that row's HTML.
  function render(key, container, rows, rowHtml) {
    if (!container) return;
    const prev = previousByKey.get(key);
    container.innerHTML = rows.map((row, i) => rowHtml(row, i)).join('');
    const rowEls = Array.from(container.children);

    // Read every target before writing anything back: measuring after the
    // first mutation would force a reflow per row.
    const bars = rowEls.map((el) => el.querySelector('[data-bar]'));
    const targets = bars.map((bar) => (bar ? bar.style.width : null));
    const scoreEls = rowEls.map((el) => el.querySelector('[data-score]'));
    const finalRects = prev && rowEls.length ? rowEls.map((el) => el.getBoundingClientRect()) : null;

    const still = reduceMotion();

    rowEls.forEach((el, newIndex) => {
      const before = prev && prev.get(rows[newIndex].userId);
      const bar = bars[newIndex];
      const scoreEl = scoreEls[newIndex];

      // Bar: start it at the remembered width so the transition has somewhere
      // to grow from. A player the board has not seen before starts at zero,
      // which reads as them arriving rather than as a jump.
      if (bar && targets[newIndex] && !still) {
        const from = before ? before.bar : '0%';
        if (from !== targets[newIndex]) {
          bar.style.transition = 'none';
          bar.style.width = from;
        }
      }

      // Slide: only for a row that actually changed rank.
      let slideFrom = 0;
      if (finalRects && before && before.rank !== newIndex && !still) {
        const fromRect = finalRects[before.rank] || finalRects[newIndex];
        slideFrom = fromRect.top - finalRects[newIndex].top;
        if (slideFrom) {
          el.style.transition = 'none';
          el.style.transform = `translateY(${slideFrom}px)`;
        }
      }

      if (scoreEl && before && !still) {
        const to = Number(scoreEl.getAttribute('data-score'));
        const from = before.score;
        if (Number.isFinite(to) && Number.isFinite(from) && from !== to) {
          const finalText = scoreEl.textContent;
          scoreEl.textContent = String(from);
          countUp(scoreEl, from, to, finalText);
        }
      }
    });

    // One forced reflow for the whole board, not one per row, so the starting
    // values above are committed before the transitions below are armed.
    if (!still && rowEls.length) void container.offsetHeight;

    if (!still) {
      requestAnimationFrame(() => {
        rowEls.forEach((el, i) => {
          if (el.style.transform) {
            el.style.transition = `transform ${REORDER_MS}ms cubic-bezier(.22,.8,.2,1)`;
            el.style.transform = '';
          }
          const bar = bars[i];
          if (bar && targets[i]) {
            bar.style.transition = `width ${BAR_MS}ms cubic-bezier(.22,.8,.2,1)`;
            bar.style.width = targets[i];
          }
        });
      });
    }

    const next = new Map();
    rows.forEach((row, i) => {
      const scoreEl = scoreEls[i];
      const raw = scoreEl ? Number(scoreEl.getAttribute('data-score')) : NaN;
      next.set(row.userId, {
        rank: i,
        bar: targets[i] || '0%',
        score: Number.isFinite(raw) ? raw : 0,
      });
    });
    previousByKey.set(key, next);
  }

  function reset(key) {
    previousByKey.delete(key);
  }

  window.BahjahRankedBoard = { render, reset };
})();
