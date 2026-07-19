// Shared auth-session helper used across apps/web pages.
// Same-origin only: the API is served from the same host as these pages.
//
// Real accounts and guest (QR/code join) sessions are kept in entirely
// separate localStorage namespaces on purpose: a guest must never show up
// as "signed in to Bahjah" on the rest of the site (header avatar dropdown,
// profile/settings/leaderboard) -- getToken/getUser/fetchMe below only ever
// look at the real-account keys, so every page's existing signed-in check
// keeps working unchanged for guests (it just reports "signed out"). Guest
// state lives under getGuestToken/getGuestUser instead, and self-expires
// after 6 hours to match the short-lived token the server issues.
const BahjahSession = (() => {
  const TOKEN_KEY = 'bahjah_token';
  const USER_KEY = 'bahjah_user';
  const GUEST_TOKEN_KEY = 'bahjah_guest_token';
  const GUEST_USER_KEY = 'bahjah_guest_user';
  const GUEST_SAVED_AT_KEY = 'bahjah_guest_saved_at';
  const GUEST_TTL_MS = 6 * 60 * 60 * 1000;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function saveGuest(token, user) {
    localStorage.setItem(GUEST_TOKEN_KEY, token);
    localStorage.setItem(GUEST_USER_KEY, JSON.stringify(user));
    localStorage.setItem(GUEST_SAVED_AT_KEY, String(Date.now()));
  }

  function clearGuest() {
    localStorage.removeItem(GUEST_TOKEN_KEY);
    localStorage.removeItem(GUEST_USER_KEY);
    localStorage.removeItem(GUEST_SAVED_AT_KEY);
  }

  // Self-expiring: once 6 hours have passed since a guest joined, this
  // clears the stored guest session and returns null, so any lobby page
  // they revisit falls back to the name+avatar entry form again.
  function getGuestToken() {
    const savedAt = Number(localStorage.getItem(GUEST_SAVED_AT_KEY));
    if (!savedAt || Date.now() - savedAt > GUEST_TTL_MS) {
      clearGuest();
      return null;
    }
    return localStorage.getItem(GUEST_TOKEN_KEY);
  }

  function getGuestUser() {
    if (!getGuestToken()) return null;
    const raw = localStorage.getItem(GUEST_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  // For game-page code that doesn't care whether the visitor is a real
  // account or an active guest -- prefers the real session when both exist.
  function getActiveToken() {
    return getToken() || getGuestToken();
  }

  function getActiveUser() {
    return getUser() || getGuestUser();
  }

  // Verifies a token against the server. Defaults to the stored real-account
  // token and refreshes/clears that same storage on success/failure, exactly
  // as before; pass an explicit token (e.g. a guest token) to just validate
  // it without touching either storage namespace. Returns null if there's no
  // valid session.
  async function fetchMe(tokenOverride) {
    const token = tokenOverride || getToken();
    if (!token) return null;
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        if (!tokenOverride) clear();
        return null;
      }
      const data = await res.json();
      if (!tokenOverride) save(token, data.user);
      return data.user;
    } catch {
      // Network hiccup: keep the optimistic cached user rather than signing
      // the visitor out over a transient error.
      return tokenOverride ? null : getUser();
    }
  }

  return {
    getToken, getUser, save, clear, fetchMe,
    saveGuest, clearGuest, getGuestToken, getGuestUser,
    getActiveToken, getActiveUser,
  };
})();
