// فبركة | Fabrication -- the small helpers the landing page, the lobby, the
// phone and the big screen all share: copy in the current language, Arabic
// digits and counted nouns, the logo for the language, and the 1280 x 720
// television stage scaled to whatever screen it is on.
window.FabUI = (function () {
  const lang = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const isAr = () => lang() === 'ar';
  const t = (en, ar) => (isAr() ? ar : en);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arDigits = (n) => String(n ?? 0).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  // Numbers in the reader's digits: Arabic-Indic on the Arabic side.
  const num = (n) => (isAr() ? arDigits(n) : String(n ?? 0));

  // Arabic counts one, a pair, then a plural (3-10), then the singular
  // accusative from eleven on -- "١ مرات" is simply wrong. Each entry is
  // [one, two, few (3-10), many (11+)].
  const AR_NOUNS = {
    time: ['مرة واحدة', 'مرتين', 'مرات', 'مرة'],
    player: ['لاعبًا واحدًا', 'لاعبَين', 'لاعبين', 'لاعبًا'],
    point: ['نقطة واحدة', 'نقطتين', 'نقاط', 'نقطة'],
    round: ['جولة واحدة', 'جولتين', 'جولات', 'جولة'],
    truth: ['حقيقة واحدة', 'حقيقتين', 'حقائق', 'حقيقة'],
    question: ['سؤال واحد', 'سؤالين', 'أسئلة', 'سؤالًا'],
  };
  function arCount(n, noun) {
    const f = AR_NOUNS[noun];
    if (n === 1) return f[0];
    if (n === 2) return f[1];
    if (n >= 3 && n <= 10) return `${arDigits(n)} ${f[2]}`;
    return `${arDigits(n)} ${f[3]}`;
  }
  const EN_NOUNS = { time: 'time', player: 'player', point: 'point', round: 'round', truth: 'truth', question: 'question' };
  function enCount(n, noun) {
    return `${n} ${EN_NOUNS[noun]}${n === 1 ? '' : 's'}`;
  }
  // "3 players" / "٣ لاعبين", in the current language.
  const count = (n, noun) => (isAr() ? arCount(n, noun) : enCount(n, noun));

  // The question bank's categories are stored in English; the Arabic side
  // shows them in Arabic.
  const CATEGORY_AR = {
    Animals: 'حيوانات',
    Culture: 'ثقافة',
    Food: 'أكل',
    Geography: 'جغرافيا',
    History: 'تاريخ',
    'Human body': 'جسم الإنسان',
    Inventions: 'اختراعات',
    Nature: 'طبيعة',
    'Saudi/GCC facts': 'السعودية والخليج',
    Science: 'علوم',
    'Strange facts': 'حقائق غريبة',
    'World facts': 'حقائق عالمية',
  };
  const category = (name) => (isAr() && CATEGORY_AR[name]) || name || '';

  // The "Ransom note" logo, exported to PNG (the brief asks for the logo as
  // an image rather than live Vibes text). light: tiles with ink edges, for
  // paper and yellow grounds. dark: borderless tiles, for ink grounds.
  const logoSrc = (tone) => `assets/fabrication/logo-${isAr() ? 'ar' : 'en'}-${tone || 'light'}.png?v=20261019`;
  const logo = (tone, cls) =>
    `<img class="${cls || 'fab-logo'}" src="${logoSrc(tone)}" alt="${t('Fabrication', 'فبركة')}">`;

  // The television is laid out at 1280 x 720, the size the wireframes draw
  // it at, and scaled to the screen it is on.
  function fitTv(stage) {
    if (!stage) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const k = Math.min(vw / 1280, vh / 720);
    stage.style.transform = `translate(${(vw - 1280 * k) / 2}px, ${(vh - 720 * k) / 2}px) scale(${k})`;
  }

  // The reveal's pacing, shared so the phones keep step with the television:
  // the lies go up one at a time (1.5s each), the truth is stamped last, and
  // the standings follow once the room has had a moment with it. Times are
  // from the start of the reveal, for a board with `lies` lies on it.
  const REVEAL_LIE_MS = 1500;
  const reveal = {
    lieAt: (i) => 600 + i * REVEAL_LIE_MS,
    truthAt: (lies) => 600 + lies * REVEAL_LIE_MS + 400,
    standingsAt: (lies) => 600 + lies * REVEAL_LIE_MS + 400 + 7000,
  };

  // The host's quiet TV controls show only while a mouse is moving.
  let pointerTimer = null;
  window.addEventListener('mousemove', () => {
    document.body.classList.add('fab-pointer');
    clearTimeout(pointerTimer);
    pointerTimer = setTimeout(() => document.body.classList.remove('fab-pointer'), 3000);
  }, { passive: true });

  return { lang, isAr, t, esc, num, arDigits, count, category, logoSrc, logo, fitTv, reveal };
})();
