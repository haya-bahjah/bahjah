// Adds a hamburger menu to every marketing/account page's header so
// About/Contact/Our Games/How to Play stay reachable below the ~820px
// breakpoint where .nav-links is hidden (see each page's own <style>).
// Self-contained: injects its own CSS, so no per-page stylesheet edits
// are needed -- just <script src="assets/mobile-nav.js"></script>.
(function () {
  function init() {
    document.querySelectorAll('header .nav').forEach((nav) => {
      const links = nav.querySelector('.nav-links');
      const right = nav.querySelector('.nav-right');
      if (!links || !right || nav.querySelector('.nav-hamburger')) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-hamburger';
      btn.setAttribute('aria-label', 'Menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '&#9776;';
      right.appendChild(btn);

      const close = () => {
        nav.classList.remove('mobile-open');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '&#9776;';
      };
      const open = () => {
        nav.classList.add('mobile-open');
        btn.setAttribute('aria-expanded', 'true');
        btn.innerHTML = '&#10005;';
      };

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (nav.classList.contains('mobile-open')) close();
        else open();
      });

      links.addEventListener('click', (e) => {
        if (e.target.closest('a')) close();
      });

      document.addEventListener('click', (e) => {
        if (nav.classList.contains('mobile-open') && !nav.contains(e.target)) close();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
      });

      window.addEventListener('resize', () => {
        if (window.innerWidth > 820) close();
      });
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .nav-hamburger{ display:none; background:none; border:1px solid var(--line); border-radius:8px; width:34px; height:34px; align-items:center; justify-content:center; color:var(--text); font-size:16px; line-height:1; flex-shrink:0; padding:0; }
    @media (max-width:820px){
      .nav-hamburger{ display:flex; }
      .nav{ position:relative; }
      .nav.mobile-open .nav-links{ display:flex; flex-direction:column; position:absolute; top:100%; left:0; right:0; background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:10px 14px; margin-top:10px; gap:2px; box-shadow:0 16px 40px rgba(0,0,0,.28); z-index:30; }
      .nav.mobile-open .nav-links a, .nav.mobile-open .nav-links button{ display:block; width:100%; text-align:start; padding:12px 6px; border-bottom:1px solid var(--line); }
      .nav.mobile-open .nav-links li:last-child a{ border-bottom:none; }
    }
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
