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
  // The six Knows You Best characters, with geometry lifted from the design
  // handoff's AVATARS array. The handoff writes its colours as literal hexes
  // (its light palette); they are tokens here so the characters re-pitch with
  // the theme instead of staying paper-light on the ink-dark side.
  //
  // Drawn as nested elements rather than SVG: the eyes blink via a scaleY
  // keyframe and each character carries its own idle animation, both of which
  // want real elements to animate. Styles live in assets/kyb-theme.css.
  const KYB_CHARACTERS = [
    { id: 'blob', name: 'Bouncy Blob', rarity: 'COMMON', element: 'Water',
      body: 'var(--kyb-cyan)', belly: 'rgba(255,255,255,.5)', bodyH: 40,
      bodyR: '46% 46% 52% 52%/40% 40% 62% 62%', bellyH: 20,
      ear: 'var(--kyb-cyan)', earW: 13, earH: 13, earR: '50%', earX: 4, earY: 1,
      earRotL: 0, earRotR: 0, cheek: 'var(--kyb-pink)', glyph: '\u25CF',
      anim: 'kybBob 1.5s ease-in-out infinite' },
    { id: 'dino', name: 'Dino Pop', rarity: 'RARE', element: 'Earth',
      body: 'var(--kyb-green)', belly: 'rgba(255,255,255,.45)', bodyH: 42,
      bodyR: '48% 48% 44% 44%/42% 42% 58% 58%', bellyH: 19,
      ear: 'var(--kyb-yellow)', earW: 14, earH: 14, earR: '3px 14px 3px 14px', earX: 5, earY: 0,
      earRotL: -16, earRotR: 16, cheek: 'var(--kyb-pink)', glyph: '\u25B2',
      anim: 'kybHop 1.15s ease-in-out infinite' },
    { id: 'bunny', name: 'Bunny Blaze', rarity: 'RARE', element: 'Fire',
      body: 'var(--kyb-pink)', belly: 'rgba(201,138,0,.5)', bodyH: 38,
      bodyR: '50% 50% 46% 46%/44% 44% 56% 56%', bellyH: 17,
      ear: 'var(--kyb-yellow)', earW: 13, earH: 25, earR: '50% 50% 36% 36%', earX: 6, earY: -7,
      earRotL: -13, earRotR: 13, cheek: 'var(--kyb-yellow)', glyph: '\u2726',
      anim: 'kybHop .95s ease-in-out infinite' },
    { id: 'star', name: 'Starry Spark', rarity: 'EPIC', element: 'Light',
      body: 'var(--kyb-yellow)', belly: 'rgba(255,255,255,.5)', bodyH: 42,
      bodyR: '50%', bellyH: 18,
      ear: 'var(--kyb-yellow)', earW: 12, earH: 12, earR: '2px 12px 2px 12px', earX: 3, earY: 1,
      earRotL: -45, earRotR: 45, cheek: 'var(--kyb-pink)', glyph: '\u2605',
      anim: 'kybSpinWob 2.4s ease-in-out infinite' },
    { id: 'donut', name: 'Donut Sprinkles', rarity: 'EPIC', element: 'Sugar',
      body: 'var(--kyb-card)', belly: 'var(--kyb-pink)', bodyH: 42,
      bodyR: '50%', bellyH: 22,
      ear: 'var(--kyb-pink)', earW: 12, earH: 7, earR: '5px', earX: 5, earY: 3,
      earRotL: -22, earRotR: 22, cheek: 'var(--kyb-pink)', glyph: '\u25C6',
      anim: 'kybBob 1.9s ease-in-out infinite' },
    { id: 'neko', name: 'Neko Nova', rarity: 'MYTHIC', element: 'Cosmic',
      body: 'var(--kyb-purple)', belly: 'rgba(255,255,255,.34)', bodyH: 41,
      bodyR: '46% 46% 50% 50%/42% 42% 58% 58%', bellyH: 18,
      ear: 'var(--kyb-purple)', earW: 15, earH: 15, earR: '3px 15px 3px 15px', earX: 3, earY: 0,
      earRotL: -12, earRotR: 12, cheek: 'var(--kyb-yellow)', glyph: '\u2726',
      anim: 'kybFloat 2.3s ease-in-out infinite' },
  ];

  const KYB_RARITY_COLOR = {
    COMMON: 'var(--kyb-ink-40)',
    RARE: 'var(--kyb-cyan)',
    EPIC: 'var(--kyb-purple)',
    MYTHIC: 'var(--kyb-yellow)',
  };

  function kybCharacterById(id) {
    return KYB_CHARACTERS.find((c) => c.id === id) || KYB_CHARACTERS[0];
  }

  // Ear shapes as SVG path fragments (left-side; the right ear mirrors via
  // a horizontal flip on the <use> element), roughly matching each
  // character's design-file silhouette (round/spike/long/point/nub).

  // A 54px stack: ears behind, body, belly highlight, two blinking eyes,
  // cheeks and mouth. The caller sizes the container; everything inside is
  // proportional to the 54px design so it scales cleanly (seats use 1.35x).
  function kybCharacterSvgMarkup(c) {
    // The handoff's geometry is in px against a 54px box. Emitting it as a
    // percentage of that box is what lets one definition serve every size --
    // 54px tiles on the phone, 86px seats on the TV -- instead of squashing
    // when the container grows.
    const pc = (px) => `${(px / 54) * 100}%`;
    const ear = (side) => {
      const rot = side === 'l' ? c.earRotL : c.earRotR;
      const edge = side === 'l' ? 'left' : 'right';
      return `<span class="kyb-av-ear" style="${edge}:${pc(c.earX)}; top:${pc(c.earY)};` +
        `width:${pc(c.earW)}; height:${pc(c.earH)}; border-radius:${c.earR};` +
        `background:${c.ear}; transform:rotate(${rot}deg);"></span>`;
    };
    return `<span class="kyb-av" style="--kyb-av-anim:${c.anim};">
      ${ear('l')}${ear('r')}
      <span class="kyb-av-body" style="height:${pc(c.bodyH)}; border-radius:${c.bodyR}; background:${c.body};">
        <span class="kyb-av-belly" style="height:${(c.bellyH / c.bodyH) * 100}%; background:${c.belly};"></span>
        <span class="kyb-av-eye" style="left:32%;"></span>
        <span class="kyb-av-eye" style="right:32%;"></span>
        <span class="kyb-av-cheek" style="left:12%; background:${c.cheek};"></span>
        <span class="kyb-av-cheek" style="right:12%; background:${c.cheek};"></span>
        <span class="kyb-av-mouth"></span>
      </span>
    </span>`;
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

  return { ICONS, KYB_CHARACTERS, KYB_RARITY_COLOR, renderAvatarHtml };
})();
