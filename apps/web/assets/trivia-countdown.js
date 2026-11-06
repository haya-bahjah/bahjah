// The "Get Ready!" countdown that opens a Trivia game, drawn the same way on
// the television and on every phone.
//
// Shared because both surfaces show it at the same moment and a room looks at
// both at once -- the host console used to render the markup with no styles
// behind it at all, so the one beat where everybody is watching the same
// thing was a bare number on an empty screen.
//
// Driven from the server's phaseEndsAt, never from a fixed-length CSS
// animation: a phone that joins late, reloads, or reconnects halfway through
// picks the sweep up where the room already is instead of starting its own
// seven seconds.
(function (global) {
  'use strict';

  var R = 46; // viewBox radius; the circumference below follows from it
  var CIRCUMFERENCE = 2 * Math.PI * R;
  var DANGER_FROM = 3;

  function markup(lang) {
    var ready = lang === 'ar' ? 'استعدّوا' : 'Get Ready';
    return (
      '<div class="countdown-screen">' +
        '<div class="countdown-ring" id="tv-countdown-ring">' +
          '<svg viewBox="0 0 100 100" aria-hidden="true">' +
            '<circle class="countdown-track" cx="50" cy="50" r="' + R + '"></circle>' +
            '<circle class="countdown-sweep" id="tv-countdown-sweep" cx="50" cy="50" r="' + R + '"' +
              ' stroke-dasharray="' + CIRCUMFERENCE.toFixed(2) + '"' +
              ' stroke-dashoffset="0"></circle>' +
          '</svg>' +
          // aria-live so a screen reader announces each second rather than
          // silently showing a ring it cannot convey.
          '<div class="countdown-number" id="tv-countdown-number" role="timer" aria-live="assertive"></div>' +
        '</div>' +
        '<p class="countdown-label">' + ready + '</p>' +
      '</div>'
    );
  }

  // Returns a stop() so a caller that re-renders mid-countdown (a reconnect,
  // a resize) can leave no interval behind.
  function start(root, endsAt, lang) {
    if (!root) return function () {};
    root.innerHTML = markup(lang);

    var ring = root.querySelector('#tv-countdown-ring');
    var sweep = root.querySelector('#tv-countdown-sweep');
    var numEl = root.querySelector('#tv-countdown-number');
    var go = lang === 'ar' ? 'انطلقوا!' : 'GO!';

    // The full span is measured once, when the countdown is first drawn, so
    // the ring reads as a proportion of the phase rather than of whatever was
    // left when this particular screen happened to render.
    var totalMs = Math.max(1, (endsAt || Date.now()) - Date.now());
    var lastWhole = null;
    var timer = null;

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function tick() {
      var remainMs = Math.max(0, (endsAt || Date.now()) - Date.now());
      var secs = Math.ceil(remainMs / 1000);

      if (sweep) {
        var fraction = Math.max(0, Math.min(1, remainMs / totalMs));
        // Offset grows as time runs out, so the ring empties clockwise.
        sweep.setAttribute('stroke-dashoffset', (CIRCUMFERENCE * (1 - fraction)).toFixed(2));
      }
      if (ring) ring.classList.toggle('is-danger', secs > 0 && secs <= DANGER_FROM);

      if (numEl && secs !== lastWhole) {
        lastWhole = secs;
        numEl.textContent = secs > 0 ? String(secs) : go;
        numEl.classList.toggle('is-go', secs <= 0);
        // Restart the beat: removing the class and forcing a reflow is the
        // only reliable way to replay a CSS animation on an element that is
        // not being replaced.
        numEl.classList.remove('is-beat');
        void numEl.offsetWidth;
        numEl.classList.add('is-beat');
      }

      if (remainMs <= 0) stop();
    }

    tick();
    timer = setInterval(tick, 100);
    return stop;
  }

  global.BahjahTriviaCountdown = { start: start };
})(window);
