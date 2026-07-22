// Shared helper for in-game phase timers: drives a progress-bar fill and a
// text countdown from a single server-provided `endsAt` timestamp. Used by
// trivia-play.js, mafia-play.js, and trivia-host-console.js so every timed
// phase (answer window, night/day/vote, TV countdown) looks and behaves the
// same way instead of each screen reinventing its own tick loop.
(function () {
  const running = new Map(); // key -> intervalId

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
    stop(key);
    if (!endsAt) {
      if (fillEl) fillEl.style.width = '0%';
      if (textEl) textEl.textContent = '';
      return;
    }
    const totalMs = Math.max(1, endsAt - Date.now());
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

  function stop(key) {
    const id = running.get(key);
    if (id) {
      clearInterval(id);
      running.delete(key);
    }
  }

  window.BahjahTimerBar = { start, stop, fmt };
})();
