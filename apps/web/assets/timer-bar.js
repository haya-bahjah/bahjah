// Shared helper for in-game phase timers: drives a progress-bar fill and a
// text countdown from a single server-provided `endsAt` timestamp. Used by
// trivia-play.js, mafia-play.js, and trivia-host-console.js so every timed
// phase (answer window, night/day/vote, TV countdown) looks and behaves the
// same way instead of each screen reinventing its own tick loop.
(function () {
  const running = new Map(); // key -> intervalId
  // key -> { endsAt, totalMs }. Kept apart from the interval, and deliberately
  // outliving stop(), because a screen that re-renders (or pauses and comes
  // back) calls start() again with fresh DOM nodes: the bar has to carry on
  // from where it was rather than treat that call as the start of the phase.
  const spans = new Map();

  function fmt(remainMs, longFormat) {
    const secs = Math.max(0, Math.ceil(remainMs / 1000));
    if (!longFormat || secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // fillEl/textEl: DOM elements (either may be null/absent). endsAt: absolute
  // ms timestamp the phase ends at. opts.longFormat: use m:ss once past 60s
  // (mafia's longer phases) instead of always "Ns". opts.onTick(secs): fired
  // every tick, e.g. to trigger the last-3-seconds sound cue.
  function start(key, fillEl, textEl, endsAt, opts) {
    opts = opts || {};
    // Carry the span across a restart of the same phase. Measuring it fresh on
    // every call was why the bar refilled itself: each re-render -- and one
    // happens every time any player submits -- made "100%" mean whatever was
    // left at that instant, so a bar three quarters spent jumped back to full
    // and drained again. The countdown text was right all along, which is what
    // made it look like the clock itself had been reset.
    stop(key);
    if (!endsAt) {
      if (fillEl) fillEl.style.width = '0%';
      if (textEl) textEl.textContent = '';
      return;
    }
    const prev = spans.get(key);
    const totalMs = prev && prev.endsAt === endsAt
      ? prev.totalMs
      : Math.max(1, endsAt - Date.now());
    spans.set(key, { endsAt, totalMs });
    const tick = () => {
      const remainMs = Math.max(0, endsAt - Date.now());
      const pct = Math.max(0, Math.min(100, (remainMs / totalMs) * 100));
      const secs = Math.ceil(remainMs / 1000);
      if (fillEl) {
        fillEl.style.width = `${pct}%`;
        fillEl.classList.toggle('is-danger', secs > 0 && secs <= 5);
      }
      if (textEl) textEl.textContent = fmt(remainMs, opts.longFormat);
      if (opts.onTick) opts.onTick(secs);
      if (remainMs <= 0) stop(key);
    };
    tick();
    running.set(key, setInterval(tick, 200));
  }

  // Stops the ticking but keeps the phase's span, so resuming the same phase
  // picks the bar up where it left off instead of refilling it.
  function stop(key) {
    const id = running.get(key);
    if (id) {
      clearInterval(id);
      running.delete(key);
    }
  }

  window.BahjahTimerBar = { start, stop, fmt };
})();
