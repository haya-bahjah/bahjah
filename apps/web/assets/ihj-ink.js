// إنسان حيوان جماد -- the red pen, shared by the lobby, the phone and the big
// screen. Every mark is an SVG path that draws itself in (pathLength=1,
// dash offset 1 -> 0), so a ring round a ten looks written rather than
// stamped.
window.IhjInk = (function () {
  const RING = 'M52 5 C82 4 97 26 95 52 C93 80 70 96 46 94 C20 92 4 72 6 46 C9 20 30 6 60 10';
  const TICK = 'M8 52 L34 82 L92 10';
  const CROSS = 'M18 18 L82 82 M82 18 L18 82';

  const lang = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const isAr = () => lang() === 'ar';
  const arDigits = (n) => String(n ?? 0).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const num = (n) => (isAr() ? arDigits(n) : String(n ?? 0));
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Pick the copy for the current language.
  const t = (en, ar) => (isAr() ? ar : en);

  // still: draw it already finished -- for marks that were on screen before
  // this redraw, which should not write themselves in all over again.
  function svg(d, { style = '', width = 3, delay = 0, still = false } = {}) {
    return `<svg class="ihj-ink-svg${still ? ' is-still' : ''}" viewBox="0 0 100 100" preserveAspectRatio="none" style="${style}" aria-hidden="true"><path d="${d}" pathLength="1" stroke-width="${width}" vector-effect="non-scaling-stroke" style="animation-delay:${delay}s"/></svg>`;
  }

  function ring({ rotate = -6, style = '', ...rest } = {}) {
    return svg(RING, { ...rest, style: `inset:0;width:100%;height:100%;transform:rotate(${rotate}deg);${style}` });
  }

  // A letter with the red ring round it, sized from its font size.
  function circled(ch, size, opts = {}) {
    const box = Math.round(size * 1.5);
    return `<span class="ihj-circled" style="width:${box}px;height:${box}px;font-size:${size}px;${opts.font ? `font-family:${opts.font};` : ''}"><span style="top:${(size * 0.06).toFixed(1)}px">${esc(ch)}</span>${ring({ rotate: -8, width: opts.width || 4, delay: opts.delay || 0, still: opts.still })}</span>`;
  }

  // 10 ringed, 5 with a tick at its corner, 0 with a cross at its corner.
  // opts.arabic writes the number in Arabic digits whatever the page language
  // (an Arabic example sheet on the English page).
  function mark(score, opts = {}) {
    const fs = opts.size || 15;
    const box = Math.round(fs * 2.1);
    const corner = document.documentElement.getAttribute('dir') === 'rtl' ? 'left:-6px' : 'right:-6px';
    let pen;
    if (score === 10) pen = ring({ delay: opts.delay, still: opts.still });
    else if (score === 5) pen = svg(TICK, { style: `top:-2px;${corner};width:16px;height:16px`, width: 3.5, delay: opts.delay, still: opts.still });
    else pen = svg(CROSS, { style: `top:-2px;${corner};width:14px;height:14px`, width: 3.5, delay: opts.delay, still: opts.still });
    return `<span class="ihj-mark" style="width:${box}px;height:${box}px;font-size:${fs}px">${opts.arabic ? arDigits(score) : num(score)}${pen}</span>`;
  }

  // A word with the ring round it: a red-pen stamp ("Accepted").
  function stamp(text, opts = {}) {
    return `<span style="position:relative;display:inline-block;padding:6px 20px;color:var(--ihj-pen);font-family:var(--ihj-hand);font-size:${opts.size || 22}px;transform:rotate(-5deg)">${esc(text)}${svg(RING, { style: 'inset:0;width:100%;height:100%', delay: opts.delay, still: opts.still })}</span>`;
  }

  function cross(opts = {}) {
    return svg('M10 20 L90 80 M90 20 L10 80', { style: 'inset:0;width:100%;height:100%', ...opts });
  }

  // The television is drawn at 960 x 540 and scaled to whatever screen it is
  // on, so the 40px rules stay exactly where the design puts them.
  function fitTv(stage) {
    if (!stage) return;
    // The stage's frame, which is the whole window except under the Bahjah
    // bar (assets/game-bar.css); the window when the frame isn't laid out.
    const frame = stage.parentElement;
    const vw = (frame && frame.clientWidth) || window.innerWidth;
    const vh = (frame && frame.clientHeight) || window.innerHeight;
    const k = Math.min(vw / 960, vh / 540);
    stage.style.transform = `translate(${(vw - 960 * k) / 2}px, ${(vh - 540 * k) / 2}px) scale(${k})`;
  }

  return { RING, lang, isAr, num, arDigits, esc, t, svg, ring, circled, mark, stamp, cross, fitTv };
})();
