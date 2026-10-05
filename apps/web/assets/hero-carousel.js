// The landing page's hero carousel: one game banner at a time, five seconds
// each, then a cross-fade to the next (styles in assets/hero-carousel.css).
//
// Markup: a .hero-carousel holding .hero-slide elements and an empty
// .hero-carousel__controls; this file fills in a dot per slide. Only the
// showing slide is reachable -- the others are inert, so a
// keyboard user never tabs onto a hidden "Play now".
//
// It holds still while the pointer is over the banner or focus is inside it
// (nobody's button should move out from under them), and while the tab is in
// the background. A dot jumps to that slide and restarts the clock. (There
// was a pause button too; it was taken off at the owner's request, so hover
// and focus are now the only ways to hold a slide.)
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
  };

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
  controls.appendChild(bar);

  var current = 0;
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
  }

  function show(i) {
    current = (i + slides.length) % slides.length;
    paint();
  }

  function held() { return hovering || focusInside || document.hidden; }

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
