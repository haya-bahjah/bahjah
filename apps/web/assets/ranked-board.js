// Shared Kahoot-style animated leaderboard renderer. Used by trivia-play.js
// (player view) and trivia-host-console.js (TV view) so a player's row
// visually slides to its new rank position -- crossing paths with whoever
// they just overtook -- instead of the board silently jumping between
// questions.
//
// Rows have no stable identity across renders (each phase transition fully
// replaces the surrounding markup, destroying the previous board's DOM), so
// this can't measure an old vs new DOM rect directly. Instead it remembers
// each userId's rank *index* from the last render under the same `key`,
// then -- after painting the new, already-sorted rows -- looks up what rect
// the row now occupying that old index has, and animates from there. That
// keeps the animation correct even though the "old" row itself no longer
// exists.
(function () {
  const previousRanksByKey = new Map(); // key -> Map(userId -> index)

  // container: the element whose children are the row nodes (one per entry
  // in `rows`, in order). rowHtml(row, index): returns that row's HTML.
  function render(key, container, rows, rowHtml) {
    if (!container) return;
    const prevRanks = previousRanksByKey.get(key);
    container.innerHTML = rows.map((row, i) => rowHtml(row, i)).join('');
    const rowEls = Array.from(container.children);

    if (prevRanks && rowEls.length) {
      const finalRects = rowEls.map((el) => el.getBoundingClientRect());
      rowEls.forEach((el, newIndex) => {
        const oldIndex = prevRanks.get(rows[newIndex].userId);
        if (oldIndex === undefined || oldIndex === newIndex) return;
        const fromRect = finalRects[oldIndex] || finalRects[newIndex];
        const delta = fromRect.top - finalRects[newIndex].top;
        if (!delta) return;
        el.style.transition = 'none';
        el.style.transform = `translateY(${delta}px)`;
        void el.offsetHeight; // force a reflow so the transition below actually animates
        requestAnimationFrame(() => {
          el.style.transition = 'transform .5s cubic-bezier(.22,.8,.2,1)';
          el.style.transform = '';
        });
      });
    }

    const nextRanks = new Map();
    rows.forEach((row, i) => nextRanks.set(row.userId, i));
    previousRanksByKey.set(key, nextRanks);
  }

  function reset(key) {
    previousRanksByKey.delete(key);
  }

  window.BahjahRankedBoard = { render, reset };
})();
