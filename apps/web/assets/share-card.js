// Builds a 1080x1920 (story-ratio) PNG for sharing a game result to
// Instagram/Snapchat/TikTok stories, and drives the actual share flow
// (native file share when available, otherwise download + clipboard copy).
window.BahjahShareCard = (function () {
  const FONT_HREF =
    "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,600&family=Lalezar&family=Cairo:wght@400;500;600;700;900&display=swap";

  const GAME_META = {
    trivia: { logo: "assets/logos/trivia-logo.png", logoBg: "#EFEFE9", fit: "contain" },
    mafia: { logo: "assets/logos/mafia-logo.png", logoBg: "#000000", fit: "contain" },
    "knows-you-best": { logo: "assets/logos/knows-you-best-logo.png", logoBg: "#0B0B14", fit: "contain" },
  };

  function ensureFont() {
    if (document.querySelector("link[data-bahjah-share-font]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    link.setAttribute("data-bahjah-share-font", "1");
    document.head.appendChild(link);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
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

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  async function waitForFonts() {
    if (!document.fonts) return;
    try {
      await Promise.all([
        document.fonts.load("800 72px Fraunces"),
        document.fonts.load("800 64px Lalezar"),
        document.fonts.load("700 40px Cairo"),
        document.fonts.load("900 56px Cairo"),
      ]);
      await document.fonts.ready;
    } catch (e) {
      /* best-effort */
    }
  }

  async function build({ gameId, lang, headline, subline }) {
    ensureFont();
    await waitForFonts();

    const meta = GAME_META[gameId] || GAME_META.trivia;
    const isAr = lang === "ar";
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.direction = isAr ? "rtl" : "ltr";

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#170F22");
    bgGrad.addColorStop(1, "#2B1B3D");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Decorative brand rings (echoes the site's fan-circles motif)
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(178,75,245,0.35)";
    [
      [W - 210, 210, 90],
      [W - 110, 330, 58],
      [W - 230, 400, 46],
    ].forEach(([cx, cy, r]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Bahjah wordmark
    ctx.fillStyle = "#F7EFE0";
    ctx.textAlign = isAr ? "right" : "left";
    ctx.font = isAr ? "700 56px 'Cairo', sans-serif" : "700 44px 'Cairo', sans-serif";
    ctx.fillText(isAr ? "بهجة" : "Bahjah", isAr ? W - 80 : 80, 150);

    // Game logo card
    const cardSize = 600;
    const cardX = (W - cardSize) / 2;
    const cardY = 360;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 30;
    roundRect(ctx, cardX, cardY, cardSize, cardSize, 44);
    ctx.fillStyle = meta.logoBg;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, cardX, cardY, cardSize, cardSize, 44);
    ctx.clip();
    try {
      const img = await loadImage(meta.logo);
      if (meta.fit === "cover") {
        const scale = Math.max(cardSize / img.width, cardSize / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, cardX + (cardSize - dw) / 2, cardY + (cardSize - dh) / 2, dw, dh);
      } else {
        const pad = cardSize * 0.14;
        const availW = cardSize - pad * 2;
        const availH = cardSize - pad * 2;
        const scale = Math.min(availW / img.width, availH / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, cardX + (cardSize - dw) / 2, cardY + (cardSize - dh) / 2, dw, dh);
      }
    } catch (e) {
      /* logo failed to load -- card still shows its brand color */
    }
    ctx.restore();

    // Headline
    ctx.textAlign = "center";
    ctx.fillStyle = "#F7EFE0";
    ctx.font = isAr ? "800 76px 'Lalezar', sans-serif" : "800 68px 'Fraunces', serif";
    let ty = cardY + cardSize + 140;
    const headLines = wrapText(ctx, headline, W - 160);
    headLines.forEach((line) => {
      ctx.fillText(line, W / 2, ty);
      ty += isAr ? 88 : 78;
    });

    // Subline
    if (subline) {
      ctx.font = "600 38px 'Cairo', sans-serif";
      ctx.fillStyle = "#C9B8DE";
      ty += 18;
      const subLines = wrapText(ctx, subline, W - 200);
      subLines.forEach((line) => {
        ctx.fillText(line, W / 2, ty);
        ty += 50;
      });
    }

    // Bottom CTA pill linking to bahjah.com
    const barW = W - 160;
    const barH = 150;
    const barX = 80;
    const barY = H - barH - 110;
    roundRect(ctx, barX, barY, barW, barH, 34);
    ctx.fillStyle = "#B24BF5";
    ctx.fill();
    ctx.fillStyle = "#170F22";
    ctx.font = "800 52px 'Fraunces', serif";
    ctx.fillText("bahjah.com", W / 2, barY + barH / 2 + 18);

    ctx.textAlign = "left";
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  function downloadBlob(blob, fileName) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // gameId: 'trivia' | 'mafia' | 'knows-you-best'
  // lang: 'en' | 'ar'
  // headline/subline: drawn on the image
  // text: caption used for the native share sheet / clipboard fallback
  // url: link included in the native share sheet
  // shareBtn: optional button to flash a confirmation label on fallback
  async function share({ gameId, lang, headline, subline, text, url, shareBtn }) {
    let blob = null;
    try {
      const canvas = await build({ gameId, lang, headline, subline });
      blob = await canvasToBlob(canvas);
    } catch (e) {
      /* fall through to text-only share below */
    }

    const fileName = `bahjah-${gameId}-story.png`;
    const file = blob ? new File([blob], fileName, { type: "image/png" }) : null;

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }

    if (navigator.share) {
      if (blob) downloadBlob(blob, fileName);
      try {
        await navigator.share({ text, url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }

    if (blob) downloadBlob(blob, fileName);
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
    } catch (e) {
      /* clipboard unavailable -- image download is still useful on its own */
    }
    if (shareBtn) {
      const original = shareBtn.textContent;
      shareBtn.textContent = lang === "ar" ? "تم الحفظ والنسخ!" : "Saved & copied!";
      setTimeout(() => {
        shareBtn.textContent = original;
      }, 2000);
    }
  }

  return { build, share };
})();
