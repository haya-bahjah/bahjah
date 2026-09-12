// Knows You Best — the two pixel sprites the result screens are built around.
//
// Both are drawn as SVG rects on a tiny integer viewBox with
// shape-rendering:crispEdges, so they stay hard-edged pixel art at any size
// instead of being resampled. Their ink outline is not a stroke: it is four
// stacked drop-shadow() filters offset one step in each direction, which
// outlines the silhouette including the gaps between the crown's points --
// a stroke on each rect would draw interior edges too.
//
// Geometry is the handoff's, rect by rect. Every rect below is [x, y, w, h] in
// viewBox units.
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  // Four-way ink outline. Fixed at 2px, as the prototype has it at every size:
  // it is a drawn-ink line, not a scaled stroke, so it must not thicken with
  // the sprite.
  function inkOutline(unit) {
    const u = `${unit}px`;
    return (
      `drop-shadow(${u} 0 0 var(--kyb-ink)) drop-shadow(-${u} 0 0 var(--kyb-ink)) ` +
      `drop-shadow(0 ${u} 0 var(--kyb-ink)) drop-shadow(0 -${u} 0 var(--kyb-ink))`
    );
  }

  function rect(x, y, w, h, fill) {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', w); r.setAttribute('height', h);
    if (fill) r.setAttribute('fill', fill);
    return r;
  }

  function svgRoot(viewBox, widthPx, filterUnitPx) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', viewBox);
    s.setAttribute('shape-rendering', 'crispEdges');
    s.setAttribute('aria-hidden', 'true');
    s.style.width = `${widthPx}px`;
    s.style.height = 'auto';
    s.style.display = 'block';
    s.style.overflow = 'visible';
    s.style.filter = inkOutline(filterUnitPx);
    return s;
  }

  // The arcade star, rect for rect from the prototype.
  //
  // Taken from the design file rather than the README's per-row table, because
  // that table lists (x, width) at each y and has no entry for y=1 -- read
  // literally it detaches the tip pixel from the body and the star renders
  // with a floating dot above it. The prototype's first rect is 2 units tall
  // and spans y0-y1, which is what closes that gap.
  const STAR_RECTS = [
    [5, 0, 1, 2], [4, 2, 3, 1], [0, 3, 11, 1], [1, 4, 9, 1],
    [2, 5, 7, 2], [3, 7, 5, 1],
    [2, 8, 2, 1], [7, 8, 2, 1],
    [1, 9, 2, 2], [8, 9, 2, 2],
  ];

  // size = rendered width in px.
  function star(size) {
    const s = svgRoot('0 0 11 11', size, 2);
    STAR_RECTS.forEach(([x, y, w, hh]) => s.appendChild(rect(x, y, w, hh, 'var(--kyb-yellow)')));
    // Specular highlight, one row inside the star's shoulder.
    s.appendChild(rect(4, 4, 2, 1, 'rgba(255,255,255,.55)'));
    s.style.animation =
      'kybPop 460ms cubic-bezier(.2,1.5,.4,1) 140ms both, kybBob 2.6s ease-in-out 600ms infinite';
    return s;
  }

  // The crown: three stepped points over a jewelled band on an ink base.
  const CROWN_POINTS = [
    [[0, 4, 5, 3], [1, 2, 3, 2]],                 // left
    [[7, 4, 6, 3], [8, 2, 4, 2], [9, 0, 2, 2]],   // centre, tallest
    [[15, 4, 5, 3], [16, 2, 3, 2]],               // right
  ];
  const CROWN_JEWELS = [
    [3, 7, 2, 2, 'var(--kyb-pink)'],
    [9, 7, 2, 2, 'var(--kyb-green)'],
    [15, 7, 2, 2, 'var(--kyb-cyan)'],
  ];

  function crown(size) {
    const s = svgRoot('0 0 20 12', size, 2);
    // The prototype tucks the crown down over whatever sits below it.
    s.style.marginBottom = '-8px';
    CROWN_POINTS.forEach((point) => {
      point.forEach(([x, y, w, h]) => s.appendChild(rect(x, y, w, h, 'var(--kyb-yellow)')));
    });
    s.appendChild(rect(0, 6, 20, 4, 'var(--kyb-yellow)'));            // band
    s.appendChild(rect(0, 6, 20, 1, 'rgba(255,255,255,.5)'));         // band highlight
    CROWN_JEWELS.forEach(([x, y, w, h, fill]) => s.appendChild(rect(x, y, w, h, fill)));
    s.appendChild(rect(0, 10, 20, 2, 'var(--kyb-ink)'));              // base
    s.style.animation =
      'kybPop 460ms cubic-bezier(.2,1.5,.4,1) 120ms both, kybBob 2.6s ease-in-out 600ms infinite';
    return s;
  }

  // The handoff's two crown sizes: wider when it sits over a bare name, since
  // there is no photo frame under it to give it scale.
  const CROWN_OVER_PHOTO = 116;
  const CROWN_OVER_NAME = 132;

  window.KybSprites = { star, crown, CROWN_OVER_PHOTO, CROWN_OVER_NAME };
})();
