// Shared "create a room" / "join a room by code" logic used by the landing
// page and every per-game marketing page. Each host page must provide:
//   - a `#toast` element (`<div class="toast"><div class="toast-inner" id="toast"></div></div>`)
//   - BahjahSession (assets/session.js) for the auth token
// i18n reads document.documentElement.lang at call time instead of a
// page-global `lang` variable, so this file has no dependency on how any
// particular page tracks its own language state.
const BahjahRoomActions = (() => {
  function isArabic() {
    return document.documentElement.getAttribute('lang') === 'ar';
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  const ROOM_ERROR_MESSAGES = {
    ROOM_NOT_FOUND: { en: 'No room with that code.', ar: 'لا توجد غرفة بهذا الرمز.' },
    ROOM_ENDED: { en: 'This room has ended.', ar: 'انتهت هذه الغرفة.' },
    VALIDATION_ERROR: { en: 'Please check the room code and try again.', ar: 'يرجى التحقق من رمز الغرفة والمحاولة مرة أخرى.' },
    TRIAL_EXPIRED: { en: 'Your free trial has ended — redirecting to Settings to choose a plan.', ar: 'انتهت تجربتك المجانية — جارٍ تحويلك إلى الإعدادات لاختيار باقة.' },
  };
  function roomErrorMessage(error) {
    const lang = isArabic() ? 'ar' : 'en';
    const fallback = { en: 'Something went wrong — please try again.', ar: 'حدث خطأ ما — حاول مرة أخرى.' };
    const entry = (error && ROOM_ERROR_MESSAGES[error.code]) || fallback;
    return entry[lang];
  }

  // Shared by createRoom/joinByCode: TRIAL_EXPIRED gets a redirect to
  // Settings instead of just a toast, since a plain error message would
  // leave the visitor stuck with no obvious next step.
  function handleRoomError(error) {
    showToast(roomErrorMessage(error));
    if (error && error.code === 'TRIAL_EXPIRED') {
      setTimeout(() => { window.location.href = 'settings.html'; }, 1400);
    }
  }

  function requireSignedIn() {
    const token = BahjahSession.getToken();
    if (token) return token;
    showToast(isArabic() ? 'سجّل الدخول أولاً.' : 'Sign in first.');
    setTimeout(() => {
      window.location.href = `auth.html?next=${encodeURIComponent(location.pathname + location.search)}`;
    }, 900);
    return null;
  }


  // Games whose Host button opens the game's own landing page instead of
  // creating a room on the spot. The landing page is where the game is
  // introduced and where "Create room" actually lives, so jumping straight to
  // a lobby skips it entirely.
  //
  // This is what made Mafia look like two different products depending on how
  // you got there. Every other route into Mafia -- the signed-out card fan on
  // the home page, and Our Games -- is a plain <a href="mafia.html">, so both
  // land on the designed page. Only the signed-in dashboard's Host button went
  // through here, and with Mafia missing from this set it created a room and
  // dropped the host straight into mafia-lobby.html, never showing the page
  // everyone else sees. A routing difference, not a styling one.
  //
  // All three games now behave the same way, so no entry point can silently
  // skip a game's landing page again.
  // Hayakom too: its card's id is the page's name, not its game type
  // ('saudi-home'), and its page is where a host sets up the big screen.
  const LANDING_FIRST = new Set(['trivia', 'mafia', 'knows-you-best', 'hayakom']);

  // Navigate with a short cross-fade so moving from the site into a game does
  // not flash. Uses the View Transitions API where it exists and falls back to
  // fading the document out, which every browser can do.
  function navigateTo(href) {
    const go = () => { window.location.href = href; };
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      go();
      return;
    }
    if (document.startViewTransition) {
      document.startViewTransition(go);
      return;
    }
    document.documentElement.style.transition = 'opacity 180ms ease';
    document.documentElement.style.opacity = '0';
    setTimeout(go, 180);
  }

  // The Host affordance. Routes to the game's landing page for games in
  // LANDING_FIRST, otherwise creates the room immediately as before.
  function hostGame(gameId) {
    if (LANDING_FIRST.has(gameId)) {
      navigateTo(`${gameId}.html`);
      return;
    }
    return createRoom(gameId);
  }

  // Games whose room can be set up either way: a TV plus phones (the host runs
  // the game from the big screen and does not play) or phones only (no TV;
  // the host plays along and runs the game from their own phone). Must match
  // GAMES_WITH_DISPLAY_CHOICE in apps/server/src/modules/rooms/service.ts --
  // the server turns a 'phone' request for any other game into a TV room.
  const DISPLAY_CHOICE_GAMES = new Set(['trivia', 'fabrication', 'knows-you-best']);
  const DISPLAY_CHOICE_KEY = 'bahjah_display_choice';

  function rememberedDisplayMode() {
    try {
      const v = localStorage.getItem(DISPLAY_CHOICE_KEY);
      return v === 'phone' || v === 'tv' ? v : null;
    } catch (e) {
      return null;
    }
  }

  // "Where are you playing?" -- asked once per room, as a bottom sheet over
  // whichever page the Create button is on. Resolves 'tv' or 'phone', or null
  // if the host backs out. Self-contained (its own styles, both languages)
  // because it opens on every game's page, each with its own theme.
  function askDisplayMode() {
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
          try { localStorage.setItem(DISPLAY_CHOICE_KEY, mode); } catch (err) { /* private mode */ }
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

  // extraQuery is an already-encoded "key=value" string appended to the
  // lobby redirect (e.g. 'preset=snd', which trivia-lobby-config.js reads)
  // -- optional, every existing caller omits it unchanged.
  //
  // displayMode, when a caller passes one, is used as is. Otherwise a game
  // that offers the choice asks the host where they are playing, and every
  // other game is a TV room (the server's default).
  async function createRoom(gameId, extraQuery, displayMode) {
    const token = requireSignedIn();
    if (!token) return;
    let mode = displayMode;
    if (!mode && DISPLAY_CHOICE_GAMES.has(gameId)) {
      mode = await askDisplayMode();
      if (!mode) return;
    }
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameType: gameId, ...(mode ? { displayMode: mode } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        handleRoomError(data.error);
        return;
      }
      const suffix = extraQuery ? `&${extraQuery}` : '';
      window.location.href = `${gameId}-lobby.html?code=${encodeURIComponent(data.room.code)}${suffix}`;
    } catch (err) {
      showToast(isArabic() ? 'خطأ في الشبكة — حاول مرة أخرى.' : 'Network error — please try again.');
    }
  }

  async function joinByCode(inputId) {
    const input = document.getElementById(inputId);
    const code = input.value.trim().toUpperCase();
    if (!code) {
      showToast(isArabic() ? 'أدخل رمز الغرفة أولاً.' : 'Enter a room code first.');
      return;
    }

    const token = BahjahSession.getToken();
    if (!token) {
      // No account -- don't force sign-in for a code join. Look up which
      // game this code belongs to and send them straight to that lobby's
      // guest-entry form (name + avatar only), same as scanning its QR code.
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/lookup`);
        const data = await res.json();
        if (!res.ok) {
          showToast(roomErrorMessage(data.error));
          return;
        }
        window.location.href = `${data.gameType}-lobby.html?code=${encodeURIComponent(code)}`;
      } catch (err) {
        showToast(isArabic() ? 'خطأ في الشبكة — حاول مرة أخرى.' : 'Network error — please try again.');
      }
      return;
    }

    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        handleRoomError(data.error);
        return;
      }
      window.location.href = `${data.room.gameType}-lobby.html?code=${encodeURIComponent(data.room.code)}`;
    } catch (err) {
      showToast(isArabic() ? 'خطأ في الشبكة — حاول مرة أخرى.' : 'Network error — please try again.');
    }
  }

  return { showToast, roomErrorMessage, requireSignedIn, createRoom, hostGame, navigateTo, joinByCode };
})();
