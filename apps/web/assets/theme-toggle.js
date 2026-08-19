// Site-wide light/dark switch. assets/prefs-boot.js already applies the stored
// choice to <html data-theme> before first paint; this only draws the control
// and writes the preference back.
//
// It injects itself into each page's existing .nav-right rather than requiring
// 18 headers to be edited by hand, and bails out if a page already ships its
// own #theme-btn (Trivia's three pages do), so nobody ends up with two.
(function () {
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('bahjah_theme', theme); } catch (e) { /* private mode */ }
    if (window.BahjahSndTheme && window.BahjahSndTheme.refreshLockup) {
      window.BahjahSndTheme.refreshLockup();
    }
  }

  function current() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function label(btn, theme) {
    // Show the mode you'd switch *to*, which is the convention the rest of the
    // site's toggles already used.
    btn.innerHTML = theme === 'dark' ? '&#9789;' : '&#9788;';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('aria-pressed', String(theme === 'light'));
  }

  function init() {
    if (document.getElementById('theme-btn')) return; // page ships its own
    const host = document.querySelector('.nav-right') || document.querySelector('.nav');
    if (!host) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'theme-btn';
    btn.className = 'theme-btn';
    // Pages that never had a toggle have no .theme-btn rule, so carry a
    // self-contained fallback that inherits the page's own tokens.
    btn.style.cssText =
      'background:none; border:1px solid var(--border-subtle, rgba(255,255,255,.16)); border-radius:50%;' +
      'width:32px; height:32px; display:flex; align-items:center; justify-content:center;' +
      'font-size:14px; line-height:1; color:var(--text-primary, #fff); cursor:pointer; flex-shrink:0; padding:0;';
    label(btn, current());
    btn.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      apply(next);
      label(btn, next);
    });

    // Sit before the EN/ع switch so the row reads: account, theme, language.
    const langSwitch = host.querySelector('.switch');
    if (langSwitch) host.insertBefore(btn, langSwitch);
    else host.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
