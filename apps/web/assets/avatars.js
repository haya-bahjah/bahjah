// Original, minimalist avatar set (colored badge + simple glyph), matching
// the site's line-art motif style. An avatar value is one of:
//   null               -> deterministic default, derived from the user id
//   "icon:<id>"        -> one of AVATAR_ICONS below
//   "data:image/...;base64,..." -> an uploaded photo
window.BahjahAvatars = (function () {
  const ICONS = [
    { id: 'star', color: '#2FE0FF', glyph: 'M12 3l2.4 5.8 6.2.5-4.7 4 1.4 6.1L12 16.6 6.7 19.4l1.4-6.1-4.7-4 6.2-.5z' },
    { id: 'bolt', color: '#F5B14B', glyph: 'M13 2 4 14h6l-1 8 9-12h-6z' },
    { id: 'moon', color: '#9B8CFF', glyph: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5z' },
    { id: 'wave', color: '#2FBFAE', glyph: 'M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0 4 3 6 0' },
    { id: 'diamond', color: '#FF5DA2', glyph: 'M12 2 4 12l8 10 8-10z' },
    { id: 'heart', color: '#D7263D', glyph: 'M12 20 3.5 12.2C1 9.8 1.4 6 4.3 4.3 6.6 3 9.4 3.7 12 6.2 14.6 3.7 17.4 3 19.7 4.3c2.9 1.7 3.3 5.5.8 7.9z' },
    { id: 'flower', color: '#FF8C7A', glyph: 'M12 8a4 4 0 1 1-4 4M12 8a4 4 0 1 0 4 4M12 8a4 4 0 1 1 4-4M12 8a4 4 0 1 0-4-4M16 12a4 4 0 1 1-4 4M8 12a4 4 0 1 0 4 4' },
    { id: 'hex', color: '#4B8AF5', glyph: 'M12 2l8.7 5v10L12 22l-8.7-5V7z' },
    { id: 'spiral', color: '#C6E82F', glyph: 'M12 20a8 8 0 1 1 8-8 6 6 0 1 1-6-6 4 4 0 1 1 4 4' },
    { id: 'triangle', color: '#B24BF5', glyph: 'M12 3 22 20H2z' },
    { id: 'drop', color: '#4BD97A', glyph: 'M12 2c4 5 7 9 7 13a7 7 0 1 1-14 0c0-4 3-8 7-13z' },
    { id: 'flame', color: '#FF7A33', glyph: 'M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c1 1 2 3 2 5a5 5 0 1 1-10 0c0-5 3-8 5-14z' },
  ];

  function iconById(id) {
    return ICONS.find((i) => i.id === id) || ICONS[0];
  }

  function defaultIconForSeed(seed) {
    let hash = 0;
    for (let i = 0; i < String(seed).length; i++) hash = (hash * 31 + String(seed).charCodeAt(i)) >>> 0;
    return ICONS[hash % ICONS.length];
  }

  function iconSvgMarkup(icon) {
    return `<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="12" fill="${icon.color}"/><path d="${icon.glyph}" fill="none" stroke="#0B0714" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // Returns an HTML string for an <div>/<span> container (caller sets size).
  function renderAvatarHtml(avatarValue, seedForDefault) {
    if (avatarValue && avatarValue.indexOf('icon:') === 0) {
      return iconSvgMarkup(iconById(avatarValue.slice(5)));
    }
    if (avatarValue && avatarValue.indexOf('data:image/') === 0) {
      return `<img src="${avatarValue}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    }
    return iconSvgMarkup(defaultIconForSeed(seedForDefault || 'bahjah'));
  }

  return { ICONS, renderAvatarHtml };
})();
