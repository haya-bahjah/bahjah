// Shared plumbing for the four MATCH/TRUTH screens.
//
// The handoff ships them as React components. Bahjah's web app is plain
// scripts with no bundler and no React runtime, so each screen is ported to a
// vanilla renderer that builds the same element tree with the same inline
// styles -- every size, colour, radius, duration, easing and delay is copied
// across literally. This file is only the tools that port needs: an element
// helper, an SVG helper, and the full-canvas host each screen mounts into.
(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // camelCase -> the CSS property name, including the vendor-prefixed form
  // React writes as WebkitBackfaceVisibility.
  function cssName(key) {
    if (key.charAt(0) === key.charAt(0).toUpperCase()) {
      return '-' + key.charAt(0).toLowerCase() + key.slice(1).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
    }
    return key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  }

  // Styles are passed as objects of finished CSS strings -- no unit guessing,
  // so nothing can silently drift from the approved values.
  function applyStyle(el, style) {
    Object.keys(style).forEach((key) => {
      const value = style[key];
      if (value === null || value === undefined || value === false) return;
      el.style.setProperty(cssName(key), String(value));
    });
  }

  function append(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      child.forEach((c) => append(el, c));
      return;
    }
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  // h('div', {style, text, html, on:{click}, attrs:{}}, children)
  function h(tag, props, children) {
    const el = document.createElement(tag);
    const p = props || {};
    if (p.className) el.className = p.className;
    if (p.style) applyStyle(el, p.style);
    if (p.attrs) Object.keys(p.attrs).forEach((k) => el.setAttribute(k, p.attrs[k]));
    if (p.on) Object.keys(p.on).forEach((k) => el.addEventListener(k, p.on[k]));
    if (p.text !== undefined && p.text !== null) el.textContent = String(p.text);
    if (p.html !== undefined) el.innerHTML = p.html;
    if (children) append(el, children);
    return el;
  }

  function svg(tag, attrs, style) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    if (style) applyStyle(el, style);
    return el;
  }

  // Each screen owns its full canvas: no page chrome around it, and nothing of
  // the host page's container styles reaching in. On a multi-page static site
  // that means a fixed layer over the viewport, which is also what turns the
  // handoff's 1280x720 / 390x844 canvases into the 100vw/100vh production size.
  function mountHost(kind) {
    const host = h('div', {
      className: 'kyb-screen',
      attrs: { 'data-kyb-screen': kind },
      style: {
        position: 'fixed',
        inset: '0',
        // Above design-system/arcade.css's "glass" layer (body::after, at
        // z-index 2147483000): its scanlines, grain and vignette are the site
        // cabinet, and the handoff wants nothing of the page reaching in.
        zIndex: '2147483001',
        overflow: 'hidden',
        // The screens are drawn left-to-right; the site's RTL flip would
        // mirror the two-column phone board and the TV grid away from the
        // approved layout.
        direction: 'ltr',
      },
    });
    document.body.appendChild(host);
    return host;
  }

  // ---------------------------------------------------------------------
  // Responsive type.
  //
  // The handoff's contract is that Answer / Match / Truth text has to stay
  // readable from 5 to 12 players, so the sizes are DERIVED from how much room
  // each card actually gets rather than written down once. A twelve-player TV
  // grid gives each card roughly half the width a five-player one does; fixed
  // sizes either overflow at twelve or look lost at five.
  //
  // Formulas are the README's, verbatim. Returned in px numbers so callers can
  // do their own arithmetic (several sizes are defined in terms of another).
  // ---------------------------------------------------------------------
  function clamp(min, value, max) {
    return Math.min(max, Math.max(min, value));
  }

  // TV: the grid is two rows of ceil(n/2) columns, so a card's width follows
  // from the column count. 1212 = the 1280 canvas less 2x34 padding; 14 = gap.
  function tvType(playerCount) {
    const cols = Math.max(1, Math.ceil(playerCount / 2));
    const cardPx = (1212 - (cols - 1) * 14) / cols;
    const answer = clamp(19, 11 + cardPx * 0.06, 36);
    const truth = clamp(17, answer - 2.5, 32);
    const name = clamp(17, truth * 0.9, 26);
    return {
      cardPx,
      cols,
      answer,                                    // answer card body
      truth,                                     // truth card body
      tag: clamp(12, answer * 0.44, 15),         // Silkscreen number tag
      name,                                      // truth author name
      disc: clamp(26, name * 1.5, 38),           // author initial disc, px box
      pill: clamp(13, truth * 0.62, 17),         // matcher pill name
      gotIt: clamp(11, truth * 0.5, 14),         // "n GOT IT", Silkscreen
    };
  }

  // Phone: rows are a fixed 76px and the list scrolls, so these scale on the
  // player count alone rather than on measured width.
  function phoneType(playerCount) {
    const n = playerCount;
    const answer = clamp(16.5, 16.5 + (12 - n) * 0.6, 21);
    const truth = clamp(15.5, 15.5 + (12 - n) * 0.45, 19);
    return {
      answer,             // match answer row
      slot: answer - 1,   // match player slot
      truth,              // truth answer row
      name: truth - 1,    // truth author / player name
      pill: truth * 0.7,  // truth matcher pill
    };
  }

  // Sizes come out of the formulas as fractions; round to a tenth so the
  // inline styles stay readable and identical between renders.
  function px(n) {
    return `${Math.round(n * 10) / 10}px`;
  }

  window.KybScreenKit = { h, svg, applyStyle, mountHost, SVG_NS, tvType, phoneType, px, clamp };
})();
