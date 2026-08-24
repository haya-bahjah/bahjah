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
  // Knows You Best is deliberately left out: it is not part of this change.
  const LANDING_FIRST = new Set(['trivia', 'mafia']);

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

  // extraQuery is an already-encoded "key=value" string appended to the
  // lobby redirect (e.g. 'preset=snd', see bahjah-landing.html's SND
  // banner) -- optional, every existing caller omits it unchanged.
  async function createRoom(gameId, extraQuery) {
    const token = requireSignedIn();
    if (!token) return;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameType: gameId }),
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
