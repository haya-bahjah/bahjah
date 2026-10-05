// The landing page's hero carousel: one game banner at a time, five seconds
// each, then a cross-fade to the next (styles in assets/hero-carousel.css).
//
// Markup: a .hero-carousel holding .hero-slide elements and an empty
// .hero-carousel__controls; this file fills in a dot per slide and a pause
// button. Only the showing slide is reachable -- the others are inert, so a
// keyboard user never tabs onto a hidden "Play now".
//
// It holds still while the pointer is over the banner or focus is inside it
// (nobody's button should move out from under them), and while the tab is in
// the background. The pause button stops it for good, as auto-moving content
// has to offer (WCAG 2.2.2); a dot jumps to that slide and restarts the clock.
(function () {
  'use strict';
  var INTERVAL = 5000;

  var root = document.querySelector('.hero-carousel');
  if (!root) return;
  var slides = Array.prototype.slice.call(root.querySelectorAll('.hero-slide'));
  var controls = root.querySelector('.hero-carousel__controls');
  if (slides.length < 2 || !controls) {
    if (slides[0]) slides[0].classList.add('is-active');
    return;
  }

  function ar() { return document.documentElement.getAttribute('lang') === 'ar'; }
  var L = {
    dot: function (i, n) { return ar() ? 'الشريحة ' + (i + 1) + ' من ' + n : 'Slide ' + (i + 1) + ' of ' + n; },
    pause: function () { return ar() ? 'إيقاف التبديل' : 'Pause slides'; },
    play: function () { return ar() ? 'تشغيل التبديل' : 'Play slides'; },
  };
  var PAUSE_SVG = '<svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><rect x="0" y="0" width="3" height="12" fill="currentColor"/><rect x="7" y="0" width="3" height="12" fill="currentColor"/></svg>';
  var PLAY_SVG = '<svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0 L10 6 L0 12 Z" fill="currentColor"/></svg>';

  var bar = document.createElement('div');
  bar.className = 'hero-carousel__bar';
  var dots = slides.map(function (_, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'hero-carousel__dot';
    b.addEventListener('click', function () { show(i); restart(); });
    bar.appendChild(b);
    return b;
  });
  var pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.className = 'hero-carousel__pause';
  pauseBtn.addEventListener('click', function () {
    stopped = !stopped;
    paint();
    restart();
  });
  bar.appendChild(pauseBtn);
  controls.appendChild(bar);

  var current = 0;
  var stopped = false;
  var hovering = false;
  var focusInside = false;
  var timer = null;

  function paint() {
    slides.forEach(function (s, i) {
      var on = i === current;
      s.classList.toggle('is-active', on);
      s.inert = !on;
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    dots.forEach(function (d, i) {
      d.setAttribute('aria-current', i === current ? 'true' : 'false');
      d.setAttribute('aria-label', L.dot(i, slides.length));
    });
    pauseBtn.innerHTML = stopped ? PLAY_SVG : PAUSE_SVG;
    pauseBtn.setAttribute('aria-label', stopped ? L.play() : L.pause());
  }

  function show(i) {
    current = (i + slides.length) % slides.length;
    paint();
  }

  function held() { return stopped || hovering || focusInside || document.hidden; }

  function restart() {
    clearTimeout(timer);
    if (held()) return;
    timer = setTimeout(function () { show(current + 1); restart(); }, INTERVAL);
  }

  root.addEventListener('mouseenter', function () { hovering = true; restart(); });
  root.addEventListener('mouseleave', function () { hovering = false; restart(); });
  // Keyboard focus only: a mouse click on a dot also focuses it, and that
  // should not freeze the carousel after the pointer has moved away.
  root.addEventListener('focusin', function (e) {
    var kb = true;
    try { kb = e.target.matches(':focus-visible'); } catch (err) {}
    focusInside = kb;
    restart();
  });
  root.addEventListener('focusout', function (e) {
    if (!root.contains(e.relatedTarget)) { focusInside = false; restart(); }
  });
  document.addEventListener('visibilitychange', restart);
  // The labels are in the page language; the landing page switches language
  // without a reload by flipping <html lang>.
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  show(0);
  restart();
})();
