// My Games: the saved question packs a host builds once and reuses.
//
// This started life inline in bahjah-landing.html's signed-in dashboard. It
// moved here when My Games became its own page so the two never drift -- the
// page owns the chrome and the markup hooks, this owns the data and the modal.
//
// Packs are authored inside the games themselves (Trivia's custom-category
// modal, Knows You Best's custom-questions panel) and auto-saved server-side
// by questionPackSync.ts, so this file only lists/hosts/deletes them -- there
// is deliberately no create flow here.
//
// Mount with the element ids listed in mount(); the grid is the only one that
// is required.
(function () {
  const PACK_GAME_LABELS = {
    trivia: { en: 'Trivia', ar: 'سؤال و جواب' },
    'knows-you-best': { en: 'Knows You Best', ar: 'عارفكم' },
  };

  const TRASH_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="3 6 5 6 21 6"></polyline>' +
    '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
    '<line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';

  let packs = [];
  let els = {};

  function lang() {
    return document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  }
  function t(en, ar) {
    return lang() === 'ar' ? ar : en;
  }
  function netError() {
    BahjahRoomActions.showToast(t('Network error — please try again.', 'خطأ في الشبكة — حاول مرة أخرى.'));
  }

  // -- list -----------------------------------------------------------------

  function render() {
    if (!els.grid) return;
    const show = (el, on) => { if (el) el.style.display = on ? '' : 'none'; };

    if (packs.length === 0) {
      els.grid.innerHTML = '';
      show(els.grid, false);
      show(els.empty, true);
      return;
    }
    show(els.grid, true);
    show(els.empty, false);

    els.grid.innerHTML = packs.map((p) => {
      const label = PACK_GAME_LABELS[p.gameType] || { en: p.gameType, ar: p.gameType };
      const count = lang() === 'ar'
        ? `${p.itemCount} سؤال`
        : `${p.itemCount} question${p.itemCount === 1 ? '' : 's'}`;
      return `
        <div class="pack-card">
          <div class="pack-card-top">
            <span class="pack-card-name">${p.name}</span>
            <span class="pack-badge">${lang() === 'ar' ? label.ar : label.en}</span>
          </div>
          <span class="pack-card-count">${count}</span>
          <div class="pack-card-actions">
            <button type="button" class="bh-btn bh-btn--primary bh-btn--md" data-host-pack="${p.id}">${t('Host', 'استضف')}</button>
            <button type="button" class="pack-delete-btn" data-delete-pack="${p.id}" aria-label="${t('Delete pack', 'حذف الحزمة')}">${TRASH_ICON}</button>
          </div>
        </div>`;
    }).join('');
  }

  async function load() {
    const token = BahjahSession.getToken();
    if (!token) {
      packs = [];
      render();
      return;
    }
    try {
      const res = await fetch('/api/games/packs', { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : { packs: [] };
      packs = data.packs || [];
    } catch (err) {
      packs = [];
    }
    render();
  }

  async function hostFromPack(id) {
    const token = BahjahRoomActions.requireSignedIn();
    if (!token) return;
    try {
      const res = await fetch(`/api/games/packs/${encodeURIComponent(id)}/host`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        BahjahRoomActions.showToast(BahjahRoomActions.roomErrorMessage(data.error));
        if (data.error && data.error.code === 'TRIAL_EXPIRED') {
          setTimeout(() => { window.location.href = 'settings.html'; }, 1400);
        }
        return;
      }
      window.location.href = `${data.room.gameType}-lobby.html?code=${encodeURIComponent(data.room.code)}`;
    } catch (err) {
      netError();
    }
  }

  async function deletePack(id) {
    const confirmMsg = t('Delete this pack? This can’t be undone.', 'حذف هذه الحزمة؟ لا يمكن التراجع عن ذلك.');
    if (!window.confirm(confirmMsg)) return;
    const token = BahjahSession.getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/games/packs/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('delete failed');
      packs = packs.filter((p) => p.id !== id);
      render();
    } catch (err) {
      netError();
    }
  }

  // -- wiring ---------------------------------------------------------------

  function mount(opts) {
    const o = opts || {};
    els = {
      grid: document.getElementById(o.grid || 'packs-grid'),
      empty: document.getElementById(o.empty || 'packs-empty'),
    };
    // Delegated, so the buttons can be re-rendered freely.
    document.addEventListener('click', (e) => {
      const host = e.target.closest('[data-host-pack]');
      if (host) { e.preventDefault(); hostFromPack(host.dataset.hostPack); return; }
      const del = e.target.closest('[data-delete-pack]');
      if (del) { e.preventDefault(); deletePack(del.dataset.deletePack); }
    });

    // Pack names and counts are language-sensitive, so redraw on a swap.
    document.addEventListener('bahjah:lang-change', render);

    return load();
  }

  window.BahjahPacks = { mount, reload: load, render };
})();
