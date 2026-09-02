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

  window.KybScreenKit = { h, svg, applyStyle, mountHost, SVG_NS };
})();
