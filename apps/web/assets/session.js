// Shared auth-session helper used across apps/web pages.
// Same-origin only: the API is served from the same host as these pages.
const BahjahSession = (() => {
  const TOKEN_KEY = 'bahjah_token';
  const USER_KEY = 'bahjah_user';

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

  // Verifies the stored token against the server and refreshes the cached
  // user. Returns null (and clears storage) if there's no valid session.
  async function fetchMe() {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        clear();
        return null;
      }
      const data = await res.json();
      save(token, data.user);
      return data.user;
    } catch {
      // Network hiccup: keep the optimistic cached user rather than signing
      // the visitor out over a transient error.
      return getUser();
    }
  }

  return { getToken, getUser, save, clear, fetchMe };
})();
