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
})();
