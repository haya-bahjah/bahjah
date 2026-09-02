// The site's avatar component. An avatar value is one of:
//   null               -> deterministic default, derived from the user id
//   "arcade:<id>"      -> one of the 60 avatars in the pack, defined in
//                         assets/arcade-avatars.js
//   "icon:<id>"        -> a value stored before the pack landed. Still
//                         resolves, mapped onto its pack counterpart (see
//                         LEGACY_ICON_ALIAS) so nobody's saved pick changes
//                         identity -- only how it is drawn.
//   "kyb:<id>"         -> one of KYB_CHARACTERS below (Knows You Best only --
//                         offered by that game's avatar picker, and drawn from
//                         nested elements whose colours and geometry live in
//                         assets/kyb-theme.css, so it only renders on a page
//                         that loads that sheet)
//   "data:image/...;base64,..." -> an uploaded photo
//
// The artwork and its framing are both the Claude Design handoff "Bahjah
// Avatar Library" (artboards "Avatar Pack" / "Avatar Pack Rich" / "Avatar Pack
// Helm"): assets/arcade-avatars.js carries the handoff's symbols verbatim,
// assets/design-system/avatar.css carries its chip and tile frames, and this
// file is the join between them -- it resolves a stored value to one avatar
// and emits the frame markup with that avatar's accent colour attached.
//
// Every call site keeps the markup contract it had before: one element that
// fills the container it is written into.
window.BahjahAvatars = (function () {
  // The twelve flat glyph discs the site drew before the pack existed. The
  // handoff replaces that artwork wholesale, so they are no longer drawn and
  // no longer offered in the picker -- but values already saved against them
  // must keep resolving to the same person's avatar, so each one names the
  // pack avatar that carries its idea. Picking any avatar now writes an
  // "arcade:" value, so these only ever resolve, never get written.
  const LEGACY_ICON_ALIAS = {
    star: 'champ',      // the crowned winner
    bolt: 'bolt',       // Volt
    moon: 'nightfall',
    wave: 'wave',
    diamond: 'frost',
    heart: 'blush',
    flower: 'bamboo',
    hex: 'hex',
    spiral: 'loop',
    triangle: 'cone',
    drop: 'diver',
    flame: 'ember',
  };

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

  // The handoff's accents are literal hexes, so the frame needs one for a
  // Knows You Best character too: each takes the palette hex behind the token
  // its own body already uses, so a character's chip glows in its own colour
  // exactly as a pack avatar's does.
  const KYB_ACCENT = {
    blob: '#22D3EE',    // --kyb-cyan
    dino: '#39FF88',    // --kyb-green
    bunny: '#FF2DA6',   // --kyb-pink
    star: '#FFE600',    // --kyb-yellow
    donut: '#FF2DA6',   // --kyb-pink (its belly and sprinkles)
    neko: '#7C3AED',    // --kyb-purple
  };

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

  // ---------------------------------------------------------------------
  // Resolving a stored value to one avatar.
  //
  // resolve() is the single place that turns whatever is in the database into
  // "which avatar, in which accent". Everything downstream -- the chip, the
  // picker tile, the picker's selected state -- reads it, so a value can
  // never draw as one avatar in the header and another in a lobby seat.
  // ---------------------------------------------------------------------

  const FALLBACK_ACCENT = '#F7F7FF';   // --soft-white, the handoff's neutral

  function pack() {
    return window.BahjahArcadeAvatars || null;
  }

  // The hash the site has always used to derive a default from a user id.
  // Kept byte for byte: changing it would reshuffle which default every
  // existing player without a saved pick is shown.
  function seedHash(seed) {
    let hash = 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return hash;
  }

  function defaultPackAvatar(seed) {
    const p = pack();
    if (!p || !p.ROSTER.length) return null;
    return p.ROSTER[seedHash(seed || 'bahjah') % p.ROSTER.length];
  }

  // { kind, id, avatar?, character?, src?, accent }
  //   kind 'pack'   -> a pack avatar (the default case, and every new pick)
  //   kind 'kyb'    -> a Knows You Best character
  //   kind 'photo'  -> an uploaded photo
  //   kind 'none'   -> the pack script has not loaded (no artwork to draw)
  function resolve(avatarValue, seedForDefault) {
    const value = avatarValue || '';
    const p = pack();

    if (value.indexOf('data:image/') === 0) {
      return { kind: 'photo', id: null, src: value, accent: FALLBACK_ACCENT };
    }
    if (value.indexOf('kyb:') === 0) {
      const character = kybCharacterById(value.slice(4));
      return { kind: 'kyb', id: character.id, character, accent: KYB_ACCENT[character.id] || FALLBACK_ACCENT };
    }

    // Both pack values and pre-pack "icon:" values land on a pack avatar.
    let packId = null;
    if (value.indexOf('arcade:') === 0) packId = value.slice(7);
    else if (value.indexOf('icon:') === 0) packId = LEGACY_ICON_ALIAS[value.slice(5)] || null;

    const avatar = (packId && p && p.byId(packId)) || defaultPackAvatar(seedForDefault);
    if (!avatar) return { kind: 'none', id: null, accent: FALLBACK_ACCENT };
    return { kind: 'pack', id: avatar.id, avatar, accent: p.COLORS[avatar.color] || FALLBACK_ACCENT };
  }

  // Two values are the same avatar when they resolve to the same one -- which
  // is how the picker highlights a player still carrying a pre-pack "icon:"
  // value on the pack tile that now draws it.
  //
  // An empty value means "hasn't picked one", not "picked the default": the
  // picker must show nothing selected there rather than highlighting whichever
  // avatar the seed happens to land on.
  function sameAvatar(a, b, seedForDefault) {
    if (!a || !b) return false;
    const ra = resolve(a, seedForDefault);
    const rb = resolve(b, seedForDefault);
    return ra.kind === rb.kind && ra.id === rb.id && (ra.kind !== 'photo' || ra.src === rb.src);
  }

  // What a frame needs to tint itself. The handoff builds its tints by
  // suffixing the accent hex with an alpha byte, so the same strings are
  // rebuilt here rather than approximated.
  //   chip ground {c}3D / chip border {c}55        (round preview)
  //   tile ground {c}57 (tintStrength 34%)         (grid tile)
  //   tile glow   {c}33 idle, {c}88 selected,
  //               {c}66 selected shadow, {c}44 selected inset
  function frameVars(accent) {
    return (
      `--bh-av-accent:${accent};` +
      `--bh-av-tint:${accent}3D;` +
      `--bh-av-ring:${accent}55;` +
      `--bh-av-tile-tint:${accent}57;` +
      `--bh-av-glow:${accent}33;` +
      `--bh-av-glow-selected:${accent}88;` +
      `--bh-av-ring-selected:${accent}44;`
    );
  }

  // Name and one-line trait, as the handoff's preview panel shows them. The
  // picker uses these for its tile name plates and tooltips.
  function describe(avatarValue, seedForDefault) {
    const r = resolve(avatarValue, seedForDefault);
    if (r.kind === 'pack') return { name: r.avatar.name, trait: r.avatar.trait, accent: r.accent };
    if (r.kind === 'kyb') return { name: r.character.name, trait: r.character.element, accent: r.accent };
    return { name: '', trait: '', accent: r.accent };
  }

  // The artwork alone, unframed, at the size the caller's box gives it.
  function artMarkup(r, opts) {
    if (r.kind === 'photo') return `<img src="${r.src}" alt="">`;
    if (r.kind === 'kyb') return kybCharacterSvgMarkup(r.character);
    if (r.kind === 'pack') {
      return window.BahjahArcadeAvatars.markup(r.avatar.id, opts);
    }
    return '';
  }

  // ---------------------------------------------------------------------
  // The two frames the handoff draws.
  // ---------------------------------------------------------------------

  // The handoff's "Round preview - player chips" disc. This is what every
  // existing call site gets: the header account button, lobby seats,
  // scoreboards, result rows, the profile picture -- all unchanged in where
  // they sit and what they do, now drawn the handoff's way.
  function renderAvatarHtml(avatarValue, seedForDefault) {
    const r = resolve(avatarValue, seedForDefault);
    const cls = r.kind === 'photo' ? 'bh-av bh-av--photo' : 'bh-av';
    // Round framing: the handoff pulls the symbol's box back to
    // -14 -10 148 148 so the character still reads once a circle crops the
    // corners, and drops the per-avatar drop-shadow (the disc's own tint
    // carries the accent at this size).
    return `<span class="${cls}" style="${frameVars(r.accent)}">` +
      artMarkup(r, { glow: false }) +
      '</span>';
  }

  // The handoff's picker grid tile: square framing, its own drop-shadow glow,
  // and the accent variables the tile's border, tint and selected state read.
  // The caller supplies the button (assets/avatar-picker.js) so the picker
  // keeps its own click handling; this only fills and tints it.
  function tileAttrs(avatarValue, seedForDefault) {
    const r = resolve(avatarValue, seedForDefault);
    return { style: frameVars(r.accent), html: artMarkup(r, { tile: true, glow: false }) };
  }

  return {
    KYB_CHARACTERS,
    KYB_RARITY_COLOR,
    LEGACY_ICON_ALIAS,
    resolve,
    sameAvatar,
    describe,
    renderAvatarHtml,
    tileAttrs,
  };
})();
