// Draws the game night recap as a 1080x1920 (story-ratio) PNG for sharing,
// in the site's arcade look: the MVP, the top three and a few awards. The
// recap page (recap.html) works out every string in the viewer's language and
// hands over a plain model; this file only lays it out, so the wording lives
// in one place.
//
// Players are drawn as letter tiles rather than their avatars on purpose: an
// avatar can be an uploaded photo, an SVG icon or an arcade sprite, and any
// one of them failing to load (or tainting the canvas) would cost the whole
// image. The tiles are also what the recap designs use.
window.BahjahRecapCard = (function () {
  const C = {
    bg: '#0B0B14',
    raised: '#12121F',
    card: '#1A1A2B',
    ink: '#F7F7FF',
    ink64: 'rgba(247,247,255,.64)',
    ink40: 'rgba(247,247,255,.4)',
    line: 'rgba(247,247,255,.12)',
    yellow: '#FFE600',
    yellowDim: 'rgba(255,230,0,.12)',
    purple: '#7C3AED',
  };

  // Tile colours for players, picked from their name so the same player is
  // the same colour on every slide and in the image.
  const TILE_COLORS = ['#39FF88', '#FFE600', '#22D3EE', '#FF2DA6', '#A78BFA', '#60A5FA'];

  function tileColor(seed) {
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return TILE_COLORS[h % TILE_COLORS.length];
  }

  function initial(name) {
    const first = Array.from(String(name || '?').trim())[0] || '?';
    return first.toLocaleUpperCase();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Shrinks text until it fits, then cuts it with an ellipsis as a last
  // resort -- names are user-typed and can be anything.
  function fitText(ctx, text, maxWidth, font, minSize) {
    let size = font.size;
    ctx.font = `${font.weight} ${size}px ${font.family}`;
    while (ctx.measureText(text).width > maxWidth && size > minSize) {
      size -= 2;
      ctx.font = `${font.weight} ${size}px ${font.family}`;
    }
    if (ctx.measureText(text).width <= maxWidth) return text;
    let cut = Array.from(text);
    while (cut.length > 1 && ctx.measureText(cut.join('') + '…').width > maxWidth) cut.pop();
    return cut.join('') + '…';
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function waitForFonts(isAr) {
    if (!document.fonts) return;
    try {
      await Promise.all([
        document.fonts.load('800 64px Tektur'),
        document.fonts.load('400 24px Silkscreen'),
        isAr ? document.fonts.load('700 48px "Readex Pro"') : Promise.resolve(),
      ]);
    } catch (e) {
      /* best-effort: the system face still draws a usable card */
    }
  }

  function tile(ctx, x, y, size, name, seed) {
    roundRect(ctx, x, y, size, size, size * 0.22);
    ctx.fillStyle = tileColor(seed);
    ctx.fill();
    ctx.fillStyle = C.bg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(size * 0.5)}px Tektur, "Readex Pro", sans-serif`;
    ctx.fillText(initial(name), x + size / 2, y + size / 2 + size * 0.03);
    ctx.textBaseline = 'alphabetic';
  }

  // model: {
  //   lang, kicker, title, meta,
  //   mvp: { label, name, seed, points, sub } | null,
  //   top: [{ rank, name, seed, points }],        // up to 3
  //   awards: [{ label, color, name, seed, detail }], // up to 4
  //   footer,
  // }
  async function build(model) {
    const isAr = model.lang === 'ar';
    await waitForFonts(isAr);

    const W = 1080;
    const H = 1920;
    const M = 80; // side margin
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.direction = isAr ? 'rtl' : 'ltr';

    const display = isAr ? '"Readex Pro", Tektur, sans-serif' : 'Tektur, "Readex Pro", sans-serif';
    const pixel = isAr ? '"Readex Pro", sans-serif' : 'Silkscreen, "Readex Pro", monospace';
    // Start/end edges flip with the language.
    const startX = isAr ? W - M : M;
    const endX = isAr ? M : W - M;
    const startAlign = isAr ? 'right' : 'left';
    const endAlign = isAr ? 'left' : 'right';

    // Background: arcade black with a soft purple bloom and a faint grid.
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const bloom = ctx.createRadialGradient(W * 0.8, 120, 40, W * 0.8, 120, 900);
    bloom.addColorStop(0, 'rgba(124,58,237,.35)');
    bloom.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(247,247,255,.035)';
    ctx.lineWidth = 2;
    for (let gx = 0; gx <= W; gx += 60) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy <= H; gy += 60) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // Wordmark, falling back to text if the image is unavailable.
    try {
      const logo = await loadImage('assets/logos/bahjah-wordmark.png?v=20260823');
      const lh = 64;
      const lw = (logo.width / logo.height) * lh;
      ctx.drawImage(logo, isAr ? W - M - lw : M, 92, lw, lh);
    } catch (e) {
      ctx.fillStyle = C.ink;
      ctx.textAlign = startAlign;
      ctx.font = `800 52px ${display}`;
      ctx.fillText(isAr ? 'بهجة' : 'Bahjah', startX, 146);
    }

    // Kicker + title + meta line.
    let y = 270;
    ctx.textAlign = startAlign;
    ctx.fillStyle = '#A78BFA';
    ctx.font = `400 26px ${pixel}`;
    ctx.fillText(model.kicker, startX, y);
    y += 96;
    ctx.fillStyle = C.ink;
    const title = fitText(ctx, model.title, W - 2 * M, { weight: 800, size: 92, family: display }, 56);
    ctx.fillText(title, startX, y);
    y += 62;
    ctx.fillStyle = C.ink40;
    ctx.font = `400 24px ${pixel}`;
    ctx.fillText(model.meta, startX, y);

    // MVP card.
    y += 60;
    if (model.mvp) {
      const ch = 330;
      ctx.save();
      ctx.shadowColor = 'rgba(255,230,0,.25)';
      ctx.shadowBlur = 50;
      roundRect(ctx, M, y, W - 2 * M, ch, 28);
      ctx.fillStyle = '#1C1A10';
      ctx.fill();
      ctx.restore();
      roundRect(ctx, M, y, W - 2 * M, ch, 28);
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.yellow;
      ctx.stroke();

      // Label chip.
      ctx.font = `400 24px ${pixel}`;
      const lw = ctx.measureText(model.mvp.label).width + 40;
      const chipX = isAr ? W - M - 40 - lw : M + 40;
      roundRect(ctx, chipX, y + 36, lw, 48, 10);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = C.yellow;
      ctx.textAlign = 'center';
      ctx.fillText(model.mvp.label, chipX + lw / 2, y + 68);

      const ts = 170;
      const tileX = isAr ? W - M - 40 - ts : M + 40;
      tile(ctx, tileX, y + 120, ts, model.mvp.name, model.mvp.seed);
      const textX = isAr ? tileX - 36 : tileX + ts + 36;
      const textW = W - 2 * M - ts - 116;
      ctx.textAlign = startAlign;
      ctx.fillStyle = C.ink;
      ctx.fillText(fitText(ctx, model.mvp.name, textW, { weight: 800, size: 72, family: display }, 40), textX, y + 192);
      ctx.fillStyle = C.yellow;
      ctx.font = `800 64px ${display}`;
      ctx.fillText(model.mvp.points, textX, y + 260);
      ctx.fillStyle = C.ink64;
      ctx.font = `500 32px ${display}`;
      ctx.fillText(fitText(ctx, model.mvp.sub, textW, { weight: 500, size: 32, family: display }, 22), textX, y + 306);
      y += ch + 44;
    }

    // Top three.
    if (model.top.length) {
      const rowH = 92;
      for (const p of model.top) {
        roundRect(ctx, M, y, W - 2 * M, rowH - 14, 18);
        ctx.fillStyle = C.raised;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = C.line;
        ctx.stroke();
        const cy = y + (rowH - 14) / 2;
        ctx.textBaseline = 'middle';
        ctx.textAlign = startAlign;
        ctx.fillStyle = p.rank === 1 ? C.yellow : C.ink40;
        ctx.font = `800 34px ${display}`;
        ctx.fillText(`#${p.rank}`, isAr ? W - M - 28 : M + 28, cy);
        const ts = 52;
        tile(ctx, isAr ? W - M - 120 - ts : M + 120, cy - ts / 2, ts, p.name, p.seed);
        ctx.textBaseline = 'middle';
        ctx.textAlign = startAlign;
        ctx.fillStyle = C.ink;
        ctx.fillText(fitText(ctx, p.name, 520, { weight: 700, size: 36, family: display }, 24), isAr ? W - M - 200 : M + 200, cy);
        ctx.textAlign = endAlign;
        ctx.fillStyle = p.rank === 1 ? C.yellow : C.ink64;
        ctx.font = `800 34px ${display}`;
        ctx.fillText(p.points, isAr ? M + 28 : W - M - 28, cy);
        ctx.textBaseline = 'alphabetic';
        y += rowH;
      }
      y += 20;
    }

    // Awards, two to a row.
    const gap = 24;
    const aw = (W - 2 * M - gap) / 2;
    const ah = 210;
    model.awards.slice(0, 4).forEach((a, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ax = isAr ? W - M - aw - col * (aw + gap) : M + col * (aw + gap);
      const ay = y + row * (ah + gap);
      if (ay + ah > H - 280) return; // never run into the footer
      roundRect(ctx, ax, ay, aw, ah, 20);
      ctx.fillStyle = C.raised;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.line;
      ctx.stroke();
      ctx.fillStyle = a.color;
      ctx.fillRect(ax + 20, ay, aw - 40, 4);
      const inX = isAr ? ax + aw - 28 : ax + 28;
      ctx.textAlign = startAlign;
      ctx.fillStyle = a.color;
      ctx.font = `400 22px ${pixel}`;
      ctx.fillText(fitText(ctx, a.label, aw - 56, { weight: 400, size: 22, family: pixel }, 16), inX, ay + 52);
      tile(ctx, isAr ? ax + aw - 28 - 64 : ax + 28, ay + 76, 64, a.name, a.seed);
      ctx.textAlign = startAlign;
      ctx.fillStyle = C.ink;
      const nameX = isAr ? ax + aw - 28 - 84 : ax + 28 + 84;
      ctx.fillText(fitText(ctx, a.name, aw - 140, { weight: 800, size: 34, family: display }, 22), nameX, ay + 120);
      ctx.fillStyle = C.ink64;
      ctx.fillText(fitText(ctx, a.detail, aw - 56, { weight: 500, size: 26, family: display }, 18), inX, ay + 182);
    });

    // Footer: the night in one line, and the site.
    const barH = 120;
    const barY = H - barH - 90;
    ctx.textAlign = 'center';
    ctx.fillStyle = C.ink40;
    ctx.font = `400 22px ${pixel}`;
    ctx.fillText(model.footer, W / 2, barY - 34);
    roundRect(ctx, M, barY, W - 2 * M, barH, 28);
    ctx.fillStyle = '#39FF88';
    ctx.fill();
    ctx.fillStyle = C.bg;
    ctx.font = `800 52px Tektur, sans-serif`;
    ctx.fillText('bahjah.com', W / 2, barY + barH / 2 + 18);

    ctx.textAlign = 'left';
    return canvas;
  }

  return { build, tileColor, initial };
})();
