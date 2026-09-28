// Applies the visitor's persisted theme/language before first paint. Must be
// loaded as a normal (render-blocking) <script src>, as the very first thing
// in <head> -- before any stylesheet or inline <style> -- so a returning
// visitor never sees a flash of the wrong theme or text direction.
(function () {
  var theme = localStorage.getItem('bahjah_theme') || 'dark';
  var lang = localStorage.getItem('bahjah_lang') || 'en';
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  // Every page's markup hardcodes English text; a non-English visitor would
  // otherwise see a flash of English before the page's own script swaps it
  // to the saved language near the end of <body>. Stay hidden until then.
  if (lang !== 'en') {
    document.documentElement.style.visibility = 'hidden';

    // The safety net, and the reason this file hides anything at all is worth
    // the risk.
    //
    // Hiding the page puts every script between here and the un-hide on the
    // critical path: if any of them throws, the un-hide never runs and the
    // visitor gets a blank screen -- full height, full markup, nothing drawn.
    // Worse, it only happens to somebody who ARRIVES with a non-English
    // language saved, so it is invisible in the obvious test. A developer
    // loading the page fresh, or clicking the language toggle, never sees it.
    // That combination has blanked this site more than once: most recently the
    // landing page, where the card fan was built for three games and the
    // library grew to six, so positionCards threw on the fourth card. The same
    // error in English cost a bit of layout; in Arabic it cost the whole site.
    //
    // DOMContentLoaded fires after the inline script at the end of <body>, so
    // on a healthy page the page has already shown itself and this does
    // nothing. It only has an effect when something went wrong -- and then a
    // flash of un-translated English is a far better failure than a blank
    // page. Belt and braces, deliberately: the per-page un-hide still runs
    // first and is still what prevents the flash.
    document.addEventListener('DOMContentLoaded', function () {
      if (document.documentElement.style.visibility === 'hidden') {
        document.documentElement.style.visibility = '';
        console.warn(
          'bahjah: a script failed before this page could show itself; ' +
          'revealing it untranslated rather than leaving it blank.'
        );
      }
    });
  }
})();
