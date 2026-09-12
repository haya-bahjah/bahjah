// The admin pages' way in, and the token they carry once through.
//
// Two credentials can open an admin page, and this decides which is offered:
// a Bahjah account on the ADMIN_EMAILS list (the better one -- it says who
// looked), or the shared passphrase, which exists so nobody is locked out of
// their own dashboard until a secrets change lands.
//
// The portal token lives in sessionStorage, not localStorage, and that is
// deliberate. It is a session minted from a secret several people may know,
// on a machine that may not be yours alone; it should die with the tab rather
// than sit on the disk for twelve hours waiting for the next person to open
// the laptop.
(function () {
  'use strict';

  var KEY = 'bahjah_admin_portal';

  function getPortalToken() {
    try {
      return sessionStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function setPortalToken(token) {
    try {
      sessionStorage.setItem(KEY, token);
    } catch (e) {
      /* private window with storage blocked -- the page still works for this
         one page load, it just cannot be remembered across a reload. */
    }
  }

  function clearPortalToken() {
    try {
      sessionStorage.removeItem(KEY);
    } catch (e) { /* nothing to clear */ }
  }

  // The portal session first, then the signed-in account. An admin who is
  // also signed in normally keeps working without ever seeing the passphrase
  // form.
  function authToken() {
    var portal = getPortalToken();
    if (portal) return portal;
    try {
      return window.BahjahSession ? window.BahjahSession.getToken() : null;
    } catch (e) {
      return null;
    }
  }

  function authHeader() {
    var token = authToken();
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  // Exchanges the passphrase for a session. Resolves with an error string
  // rather than throwing, because every failure here is something to show a
  // person rather than something to debug.
  function signIn(password) {
    return fetch('/api/admin/portal-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
    })
      .then(function (res) {
        if (res.status === 429) return { error: 'Too many attempts. Wait fifteen minutes and try again.' };
        // The server answers 404 for a wrong passphrase and for a portal that
        // is switched off alike, so it never confirms which. Neither does this.
        if (!res.ok) return { error: 'That passphrase was not accepted.' };
        return res.json().then(function (body) {
          if (!body || !body.token) return { error: 'That passphrase was not accepted.' };
          setPortalToken(body.token);
          return { ok: true };
        });
      })
      .catch(function () {
        return { error: "Couldn't reach the server. Try again." };
      });
  }

  window.BahjahAdminPortal = {
    authToken: authToken,
    authHeader: authHeader,
    signIn: signIn,
    signOut: clearPortalToken,
    hasPortalSession: function () { return Boolean(getPortalToken()); },
  };
})();
