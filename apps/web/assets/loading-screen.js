// Saudi National Day intro — the pixel-lock loading screen.
//
// Runs once per session, as the first thing inside <body> on the landing page,
// so the overlay is in the DOM before the browser's first paint and the
// landing never shows through underneath it.
//
// The overlay covers the landing page rather than replacing it: the landing
// keeps parsing and loading behind the animation, so "handing off" is just
// removing the overlay -- there is no second navigation and nothing to
// re-fetch. That is also what makes the preload requirement fall out for
// free (see WAIT_FOR_LOAD below).
//
// Dependency-free: CSS transitions driven by a data-phase attribute, plus the
// small timeline here. Styles live in assets/loading-screen.css.
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Tuning. SPEED is the single dial: every duration below is divided by it,
  // exactly as the reference's speed slider does. 0.4 is the reference's
  // default and yields the ~7.2s sequence.
  // ---------------------------------------------------------------------
  var SPEED = 0.4;

  var GRID = 9;                 // 9x9 = 81 tiles
  var CELL = 18;                // tile size, px
  var GAP = 2;
  var PAD = 16;                 // square is CELL*GRID + PAD across

  // Which tiles lock first. The brief asks for centre-out, so ring 0 (the
  // middle tile) starts at zero delay and each ring out is staggered behind
  // it. Note the reference file actually staggers the other way -- its
  // delay is (8 - ring) * 95, and since ring maxes at 4 on a 9x9 the
  // outermost ring leads and the centre lands last. Flip this to 'edge-in'
  // to reproduce the reference's ordering exactly.
  var ORDER = 'centre-out';

  // Phase boundaries, in reference-milliseconds (divided by SPEED at use).
  //   0  pixels fly in and lock; wordmark and caption visible
  //   1  white flash, wordmark and caption clear
  //   2  square collapses to a thin CRT line
  //   3  line opens out to full screen
  var T_FLASH = 1550;
  var T_LINE = 1900;
  var T_OPEN = 2200;
  var T_DONE = 2900;

  // Once window.load has fired we are allowed to cut the sequence short --
  // but never before the pixels have locked and flashed, or a fast connection
  // would reduce the whole thing to a blink. Set to 0 to always cut as soon
  // as loading finishes, or Infinity to always play the full timeline.
  var CUT_FLOOR = T_LINE;

  // The handoff never waits on the network: if load has not fired by T_DONE
  // we reveal the landing anyway and let the rest stream in.
  var WAIT_FOR_LOAD = false;

  var PALETTE = ['#006C35', '#0E9F58', '#39FF6A', '#7C3AED', '#3DE0FF', '#8A1538'];
  var CENTRE_COLOR = '#39FF6A';
  var SESSION_KEY = 'bahjah_intro_seen';

  // ---------------------------------------------------------------------

  function ms(v) { return v / SPEED; }

  // Private browsing and some embedded webviews throw on storage access.
  function seenThisSession() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  }
  function markSeen() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* nothing to do */ }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Bail before building anything. The stylesheet hides .bh-intro whenever
  // <html data-intro="skip">, so setting this is also what prevents a flash
  // if the markup is ever moved back into the page statically.
  if (seenThisSession() || prefersReducedMotion()) {
    document.documentElement.setAttribute('data-intro', 'skip');
    return;
  }
  markSeen();

  var side = CELL * GRID + PAD;

  var root = document.createElement('div');
  root.className = 'bh-intro';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-label', 'Loading Bahjah');
  root.style.setProperty('--intro-side', side + 'px');
  root.innerHTML =
    '<div class="bh-intro-glow"></div>' +
    '<div class="bh-intro-scan"></div>' +
    '<div class="bh-intro-centre">' +
      '<div class="bh-intro-welcome">' +
        '<img src="assets/logos/bahjah-wordmark.png?v=20260823" alt="بهجة Bahjah">' +
        '<b>WELCOME TO BAHJAH</b>' +
      '</div>' +
      '<div class="bh-intro-screen">' +
        '<div class="bh-intro-grid"></div>' +
        '<div class="bh-intro-flash"></div>' +
      '</div>' +
    '</div>' +
    '<div class="bh-intro-caption">' +
      '<div class="bh-intro-loading">LOADING</div>' +
      '<div class="bh-intro-track"><div class="bh-intro-bar"></div></div>' +
      '<div class="bh-intro-tagline">YOUR PHONE IS THE CONTROLLER.</div>' +
    '</div>' +
    '<button type="button" class="bh-intro-skip">SKIP &#9654;</button>';

  // The square's transition has to be built here rather than in the
  // stylesheet: its duration is derived from SPEED.
  var ease = 'cubic-bezier(.7,.02,.24,1)';
  var screenEl = root.querySelector('.bh-intro-screen');
  screenEl.style.transition =
    'width ' + ms(380) + 'ms ' + ease + ', height ' + ms(380) + 'ms ' + ease +
    ', background 160ms linear, box-shadow 300ms linear, border-radius 300ms linear';

  var gridEl = root.querySelector('.bh-intro-grid');
  gridEl.style.gridTemplateColumns = 'repeat(' + GRID + ',' + CELL + 'px)';
  gridEl.style.gap = GAP + 'px';
  gridEl.style.transition =
    'opacity 140ms linear, transform ' + ms(260) + 'ms cubic-bezier(.2,1.5,.35,1)';

  var mid = (GRID - 1) / 2;
  var frag = document.createDocumentFragment();
  for (var r = 0; r < GRID; r++) {
    for (var c = 0; c < GRID; c++) {
      var ring = Math.max(Math.abs(r - mid), Math.abs(c - mid));
      var tile = document.createElement('div');
      tile.className = 'bh-intro-tile';
      var color = ring === 0 ? CENTRE_COLOR : PALETTE[(r * 3 + c * 5 + ring) % PALETTE.length];
      // Each tile flies in from a random bearing at a random distance.
      var ang = Math.random() * Math.PI * 2;
      var dist = 300 + Math.random() * 320;
      var step = ORDER === 'edge-in' ? (GRID - 1 - ring) : ring;
      var delay = ms(step * 95 + Math.random() * 120);

      tile.style.width = CELL + 'px';
      tile.style.height = CELL + 'px';
      tile.style.background = color;
      tile.style.boxShadow = '0 0 10px ' + color + '66';
      tile.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      tile.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
      tile.style.animation =
        'bhIntroSnap ' + ms(520) + 'ms cubic-bezier(.2,1.5,.35,1) ' + delay.toFixed(0) + 'ms both';
      frag.appendChild(tile);
    }
  }
  gridEl.appendChild(frag);

  var barEl = root.querySelector('.bh-intro-bar');
  barEl.style.animation = 'bhIntroBar ' + ms(1900) + 'ms cubic-bezier(.4,0,.6,1) both';

  document.body.appendChild(root);
  // The landing page behind the overlay must not scroll while it is up.
  var prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  // ---------------------------------------------------------------------
  // Timeline
  // ---------------------------------------------------------------------
  var timers = [];
  var started = Date.now();
  var finished = false;

  function at(delay, fn) { timers.push(setTimeout(fn, ms(delay))); }
  function phase(p) { root.setAttribute('data-phase', String(p)); }

  function teardown() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    timers.length = 0;
    document.documentElement.style.overflow = prevOverflow;
    root.classList.add('is-leaving');
    // Matches the .is-leaving transition; removing the node ends the
    // animation for good rather than leaving an invisible layer on top.
    setTimeout(function () {
      if (root.parentNode) root.parentNode.removeChild(root);
    }, 300);
  }

  // Jump straight to the outro from wherever we are: used by SKIP and by the
  // early cut. Runs the collapse and open so the reveal still reads as the
  // designed transition rather than a hard cut.
  function finish(immediate) {
    if (finished) return;
    timers.forEach(clearTimeout);
    timers.length = 0;
    if (immediate) { teardown(); return; }
    phase(2);
    timers.push(setTimeout(function () { phase(3); }, ms(T_OPEN - T_LINE)));
    timers.push(setTimeout(teardown, ms(T_DONE - T_LINE)));
  }

  function run() {
    phase(0);
    at(T_FLASH, function () { phase(1); });
    at(T_LINE, function () { phase(2); });
    at(T_OPEN, function () { phase(3); });
    at(T_DONE, teardown);
  }

  root.querySelector('.bh-intro-skip').addEventListener('click', function () {
    finish(true);
  });

  // Escape is the keyboard equivalent of SKIP.
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape' && !finished) { finish(true); document.removeEventListener('keydown', onKey); }
  });

  // Preloading is implicit -- the landing page is loading behind the overlay
  // the whole time. All this does is let a fast load cut the sequence short,
  // and it never extends it: if load has not fired by T_DONE the timeline
  // tears down regardless.
  window.addEventListener('load', function () {
    if (finished || WAIT_FOR_LOAD) return;
    var elapsed = Date.now() - started;
    if (elapsed >= ms(CUT_FLOOR)) finish(false);
    else timers.push(setTimeout(function () { finish(false); }, ms(CUT_FLOOR) - elapsed));
  });

  run();
})();
