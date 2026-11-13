// "Where are you playing?" -- the one question a host is asked when they
// open a room in a game that can be played either way: TV + phones (the
// host's screen is the room's display and they don't play), or phones only
// (no TV; the host plays along and runs the game from their own phone).
//
// BahjahDisplayModePicker.ask() resolves 'tv' or 'phone', or null if the host
// backs out. Shared by assets/room-actions.js (every game's Create room) and
// Mafia's own app (assets/mafia-game/mafia-live.js). Self-contained -- its
// own styles, both languages -- because it opens over every game's page, each
// with its own theme.
window.BahjahDisplayModePicker = (() => {
  function isArabic() {
    return document.documentElement.getAttribute('lang') === 'ar';
  }

  const KEY = 'bahjah_display_choice';

  function rememberedDisplayMode() {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'phone' || v === 'tv' ? v : null;
    } catch (e) {
      return null;
    }
  }

  // "Where are you playing?" -- asked once per room, as a bottom sheet over
  // whichever page the Create button is on. Resolves 'tv' or 'phone', or null
  // if the host backs out. Self-contained (its own styles, both languages)
  // because it opens on every game's page, each with its own theme.
  function ask() {
    return new Promise((resolve) => {
      const ar = isArabic();
      const last = rememberedDisplayMode();
      const t = (en, arText) => (ar ? arText : en);
      const options = [
        {
          mode: 'tv',
          title: t('TV + phones', 'شاشة + جوالات'),
          body: t('Put the game on a TV or laptop. You run it from there, everyone else plays on their phones.',
            'اعرض اللعبة على تلفزيون أو لابتوب. أنت تديرها من هناك، والبقية يلعبون من جوالاتهم.'),
          glyph: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
        },
        {
          mode: 'phone',
          title: t('Phones only — I play too', 'جوالات فقط — وأنا ألعب معكم'),
          body: t('No TV needed. You play along and run the game from your own phone.',
            'لا حاجة لشاشة. تلعب معهم وتدير اللعبة من جوالك.'),
          glyph: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>',
        },
      ];

      const root = document.createElement('div');
      root.className = 'bdm';
      root.setAttribute('dir', ar ? 'rtl' : 'ltr');
      root.innerHTML = `
        <style>
          .bdm{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;
            background:rgba(11,11,20,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
            font-family:'Space Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif;animation:bdm-fade .16s ease}
          .bdm-sheet{width:min(100%,460px);background:#12121F;color:#F7F7FF;border:1px solid rgba(247,247,255,.12);
            border-bottom:0;border-radius:16px 16px 0 0;padding:20px 16px calc(18px + env(safe-area-inset-bottom,0px));
            box-shadow:0 -12px 40px rgba(0,0,0,.5);animation:bdm-up .22s cubic-bezier(.34,1.56,.64,1)}
          @media (min-width:640px){.bdm{align-items:center}.bdm-sheet{border-radius:16px;border-bottom:1px solid rgba(247,247,255,.12)}}
          .bdm-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 4px 14px}
          .bdm-title{margin:0;font:800 20px/1.2 'Tektur','Space Grotesk',system-ui,sans-serif;letter-spacing:.01em}
          .bdm-x{all:unset;cursor:pointer;width:36px;height:36px;display:grid;place-items:center;border-radius:8px;color:rgba(247,247,255,.64)}
          .bdm-x:hover{background:rgba(247,247,255,.08);color:#F7F7FF}
          .bdm-opt{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;gap:14px;align-items:flex-start;
            padding:14px;margin-top:10px;border-radius:12px;background:#1A1A2B;border:1px solid rgba(247,247,255,.1);
            transition:border-color .14s,transform .14s,box-shadow .14s;text-align:start}
          .bdm-opt:hover{border-color:#39FF88;box-shadow:0 0 0 1px #39FF88,0 0 18px rgba(57,255,136,.25)}
          .bdm-opt:active{transform:scale(.98)}
          .bdm-opt:focus-visible,.bdm-x:focus-visible{outline:2px solid #22D3EE;outline-offset:2px}
          .bdm-glyph{flex:none;width:44px;height:44px;border-radius:10px;display:grid;place-items:center;background:rgba(57,255,136,.12);color:#39FF88}
          .bdm-opt-title{display:block;font:700 16px/1.25 'Space Grotesk',system-ui,sans-serif}
          .bdm-opt-body{display:block;margin-top:4px;font:400 14px/1.45 'Space Grotesk',system-ui,sans-serif;color:rgba(247,247,255,.64)}
          .bdm-last{display:inline-block;margin-inline-start:6px;padding:1px 7px;border-radius:999px;vertical-align:2px;
            font:700 10px/1.6 'Space Grotesk',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;background:rgba(34,211,238,.14);color:#22D3EE}
          @keyframes bdm-fade{from{opacity:0}}
          @keyframes bdm-up{from{transform:translateY(24px);opacity:.4}}
          @media (prefers-reduced-motion:reduce){.bdm,.bdm-sheet{animation:none}}
        </style>
        <div class="bdm-sheet" role="dialog" aria-modal="true" aria-labelledby="bdm-title">
          <div class="bdm-head">
            <h2 class="bdm-title" id="bdm-title">${t('Where are you playing?', 'كيف بتلعبون؟')}</h2>
            <button type="button" class="bdm-x" data-bdm-close aria-label="${t('Close', 'إغلاق')}">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          ${options.map((o) => `
            <button type="button" class="bdm-opt" data-bdm-mode="${o.mode}">
              <span class="bdm-glyph">${o.glyph}</span>
              <span>
                <span class="bdm-opt-title">${o.title}${last === o.mode ? `<span class="bdm-last">${t('Last time', 'آخر مرة')}</span>` : ''}</span>
                <span class="bdm-opt-body">${o.body}</span>
              </span>
            </button>`).join('')}
        </div>`;

      const previousFocus = document.activeElement;
      function close(result) {
        document.removeEventListener('keydown', onKey);
        root.remove();
        if (previousFocus && previousFocus.focus) previousFocus.focus();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') close(null);
      }
      root.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-bdm-mode]');
        if (opt) {
          const mode = opt.getAttribute('data-bdm-mode');
          try { localStorage.setItem(KEY, mode); } catch (err) { /* private mode */ }
          close(mode);
          return;
        }
        if (e.target === root || e.target.closest('[data-bdm-close]')) close(null);
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(root);
      const first = root.querySelector(`[data-bdm-mode="${last || 'tv'}"]`);
      if (first) first.focus();
    });
  }

  return { ask };
})();
