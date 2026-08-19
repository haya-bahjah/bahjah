// Original, minimalist avatar set (colored badge + simple glyph), matching
// the site's line-art motif style. An avatar value is one of:
//   null               -> deterministic default, derived from the user id
//   "icon:<id>"        -> one of AVATAR_ICONS below
//   "kyb:<id>"         -> one of KYB_CHARACTERS below (Knows You Best only --
//                         offered by that game's avatar picker, but rendered
//                         here so the choice still shows correctly anywhere
//                         else a user's avatar appears site-wide)
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

  // Knows You Best character avatars -- geometry ported from the design
  // handoff's procedurally-drawn CSS construction (ears/body/belly/eyes/
  // cheeks/mouth), recolored from its light-palette hex values onto DS
  // neon equivalents, shipped as a single static pose (the handoff's
  // rarity tiers, "Element" flavor text, and per-character CSS keyframe
  // animations are intentionally not included -- static icons only).
  const KYB_CHARACTERS = [
    { id: 'blob', name: 'Bouncy Blob', body: 'var(--cyber-cyan)', belly: 'rgba(255,255,255,.55)', ear: 'var(--cyber-cyan)', cheek: 'var(--neon-pink)', earShape: 'round' },
    { id: 'dino', name: 'Dino Pop', body: 'var(--pixel-green)', belly: 'rgba(255,255,255,.5)', ear: 'var(--arcade-yellow)', cheek: 'var(--neon-pink)', earShape: 'spike' },
    { id: 'bunny', name: 'Bunny Blaze', body: 'var(--neon-pink)', belly: 'rgba(255,230,0,.55)', ear: 'var(--arcade-yellow)', cheek: 'var(--arcade-yellow)', earShape: 'long' },
    { id: 'star', name: 'Starry Spark', body: 'var(--arcade-yellow)', belly: 'rgba(255,255,255,.55)', ear: 'var(--arcade-yellow)', cheek: 'var(--neon-pink)', earShape: 'point' },
    { id: 'donut', name: 'Donut Sprinkles', body: 'var(--soft-white)', belly: 'var(--neon-pink)', ear: 'var(--neon-pink)', cheek: 'var(--neon-pink)', earShape: 'nub' },
    { id: 'neko', name: 'Neko Nova', body: 'var(--electric-purple)', belly: 'rgba(255,255,255,.4)', ear: 'var(--electric-purple)', cheek: 'var(--arcade-yellow)', earShape: 'spike' },
  ];

  function kybCharacterById(id) {
    return KYB_CHARACTERS.find((c) => c.id === id) || KYB_CHARACTERS[0];
  }

  // Ear shapes as SVG path fragments (left-side; the right ear mirrors via
  // a horizontal flip on the <use> element), roughly matching each
  // character's design-file silhouette (round/spike/long/point/nub).
  const EAR_PATHS = {
    round: 'M0 10c0-6 5-10 9-10s9 4 9 10z',
    spike: 'M0 10 9-2 18 10z',
    long: 'M2 10C0 2 2-9 8-9s6 9 4 19z',
    point: 'M0 10 9-3 18 10z',
    nub: 'M2 9c0-4 3-6 7-6s7 2 7 6z',
  };

  function kybCharacterSvgMarkup(character) {
    const ear = EAR_PATHS[character.earShape] || EAR_PATHS.round;
    return `<svg viewBox="0 0 54 54" width="100%" height="100%">
      <circle cx="27" cy="27" r="27" fill="${character.body}" opacity=".18"/>
      <g fill="${character.ear}" stroke="var(--arcade-black)" stroke-width="1.6" stroke-linejoin="round">
        <g transform="translate(9,9)"><path d="${ear}"/></g>
        <g transform="translate(36,9) scale(-1,1)"><path d="${ear}"/></g>
      </g>
      <rect x="4" y="14" width="46" height="32" rx="16" ry="15" fill="${character.body}" stroke="var(--arcade-black)" stroke-width="1.8"/>
      <ellipse cx="27" cy="45" rx="15" ry="7" fill="${character.belly}"/>
      <circle cx="18" cy="27" r="3" fill="var(--arcade-black)"/>
      <circle cx="36" cy="27" r="3" fill="var(--arcade-black)"/>
      <ellipse cx="11" cy="33" rx="3" ry="2" fill="${character.cheek}"/>
      <ellipse cx="43" cy="33" rx="3" ry="2" fill="${character.cheek}"/>
      <path d="M22 34c0 3 2.5 5 5 5s5-2 5-5" fill="none" stroke="var(--arcade-black)" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  }

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
    if (avatarValue && avatarValue.indexOf('kyb:') === 0) {
      return kybCharacterSvgMarkup(kybCharacterById(avatarValue.slice(4)));
    }
    if (avatarValue && avatarValue.indexOf('data:image/') === 0) {
      return `<img src="${avatarValue}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    }
    return iconSvgMarkup(defaultIconForSeed(seedForDefault || 'bahjah'));
  }

  return { ICONS, KYB_CHARACTERS, renderAvatarHtml };
})();
