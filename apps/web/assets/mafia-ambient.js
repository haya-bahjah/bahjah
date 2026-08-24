// Fills the Mafia night sky. Every .noir page that includes
// <div class="mf-ambient" id="mf-ambient"></div> gets the same starfield, so
// the lobby and the in-game screens share the landing page's atmosphere rather
// than each building (or omitting) their own.
(function () {
  function build() {
    const host = document.getElementById('mf-ambient');
    if (!host || host.childElementCount) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 34; i++) {
      const s = document.createElement('div');
      s.className = 'mf-star';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 60 + '%';
      s.style.animationDuration = (2 + Math.random() * 3).toFixed(2) + 's';
      s.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
      frag.appendChild(s);
    }
    host.appendChild(frag);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
