// The Bahjah bar on the themed games (see assets/game-bar.css). The day/night
// button is drawn by assets/theme-toggle.js; this keeps the EN / ع switch in
// step with the page and tells the television how tall the bar is.
//
// Each game page owns its language: Mazad has setLang(next), Fabrication and
// Insan Hayawan Jamad have toggleLang(). Both announce the change with
// bahjah:lang-change, which is when the switch repaints.
(function () {
  const bar = document.querySelector('.site-header.game-bar');
  if (!bar) return;
  document.body.classList.add('has-game-bar');

  const current = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');

  function paint() {
    bar.querySelectorAll('.switch [data-lang]').forEach((b) => {
      b.classList.toggle('active', b.dataset.lang === current());
    });
  }

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.switch [data-lang]');
    if (!b) return;
    const next = b.dataset.lang;
    if (typeof window.setLang === 'function') window.setLang(next);
    else if (next !== current() && typeof window.toggleLang === 'function') window.toggleLang();
  });
  document.addEventListener('bahjah:lang-change', paint);
  paint();

  // The bar's height, for the waiting-room stage below it. Changes to it
  // (the bar hiding once a round is live, a font loading) re-fit the stage
  // through the page's own resize handler.
  let last = -1;
  function measure() {
    const h = bar.offsetHeight;
    if (h === last) return;
    last = h;
    document.documentElement.style.setProperty('--game-bar-h', `${h}px`);
    window.dispatchEvent(new Event('resize'));
  }
  new ResizeObserver(measure).observe(bar);
  measure();
})();
