// Applies the visitor's persisted theme/language before first paint. Must be
// loaded as a normal (render-blocking) <script src>, as the very first thing
// in <head> -- before any stylesheet or inline <style> -- so a returning
// visitor never sees a flash of the wrong theme or text direction.
(function () {
  var theme = localStorage.getItem('bahjah_theme') || 'dark';
  // A link can name the language it should open in (?lang=ar) -- a private
  // event's QR code does, so a player lands in the event's language before
  // the first paint rather than flipping once the room loads. It is kept as
  // the visitor's choice from then on, as if they had pressed the switch.
  var asked = /[?&]lang=(en|ar)(?:&|$)/.exec(location.search);
  if (asked) localStorage.setItem('bahjah_lang', asked[1]);
  var lang = localStorage.getItem('bahjah_lang') || 'en';
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  // Every page's markup hardcodes English text; a non-English visitor would
  // otherwise see a flash of English before the page's own script swaps it
  // to the saved language near the end of <body>. Stay hidden until then.
  if (lang !== 'en') {
    document.documentElement.style.visibility = 'hidden';
  }
})();
