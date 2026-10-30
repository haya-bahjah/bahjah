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
    Science: 'علوم',
    'Strange facts': 'حقائق غريبة',
    'World facts': 'حقائق عالمية',
  };
  // lang: whose language to show it in -- the game's, during a game.
  const category = (name, l) => ((l || lang()) === 'ar' && CATEGORY_AR[name]) || name || '';

  // A game is played in one language (the server's `language`): its
  // questions, the answers on the board and the reveal are all in it,
  // whatever language a screen's own buttons are in. Games started before
  // the setting existed were English.
  const gameLang = (d) => (d && d.language === 'ar' ? 'ar' : 'en');
  const question = (d) => {
    const q = d && d.currentQuestion;
    if (!q) return '';
    return gameLang(d) === 'ar' ? q.promptAr || q.prompt : q.prompt;
  };

  // Switch this screen to the game's language when the game starts, unless
  // the person in front of it has picked a language themselves since the
  // page loaded. The page provides window.fabUseLang, which redraws the
  // screen in the new language; true means it did, so the caller's own
  // draw is already done.
  function adoptGameLang(d) {
    if (window.__fabPickedLang || !d || !d.language || !window.fabUseLang) return false;
    if (lang() === d.language) return false;
    window.fabUseLang(d.language);
    return true;
  }

  // The "Ransom note" logo, exported to PNG (the brief asks for the logo as
  // an image rather than live Vibes text). light: tiles with ink edges, for
  // paper and yellow grounds. dark: borderless tiles, for ink grounds.
  const logoSrc = (tone) => `assets/fabrication/logo-${isAr() ? 'ar' : 'en'}-${tone || 'light'}.png?v=20261019`;
  const logo = (tone, cls) =>
    `<img class="${cls || 'fab-logo'}" src="${logoSrc(tone)}" alt="${t('Fabrication', 'فبركة')}">`;

  // The television is drawn at the wireframes' 1280 x 720 sizes, but not as a
  // fixed 16:9 box: the stage is scaled to the screen's height (or to its
  // width, on a window narrower than 1100 design pixels for that height) and
  // then made as wide and tall as its frame at that scale, so every screen
  // fills the window with no black bars and its layout reflows to the shape.
  function fitTv(stage) {
    if (!stage) return;
    // The stage's frame, which is the whole window except under the Bahjah
    // bar (assets/game-bar.css); the window when the frame isn't laid out.
    const frame = stage.parentElement;
    const vw = (frame && frame.clientWidth) || window.innerWidth;
    const vh = (frame && frame.clientHeight) || window.innerHeight;
    const k = Math.min(vh / 720, vw / 1100);
    stage.style.width = `${vw / k}px`;
    stage.style.height = `${vh / k}px`;
    stage.style.transform = `scale(${k})`;
  }

  // The reveal's pacing, shared so the phones keep step with the television:
  // the lies go up one at a time (1.5s each) and the truth is stamped last.
  // The standings then wait for the host's Next (the server's standingsShown),
  // not a clock. Times are from the start of the reveal, for a board with
  // `lies` lies on it.
  const REVEAL_LIE_MS = 1500;
  const reveal = {
    lieAt: (i) => 600 + i * REVEAL_LIE_MS,
    truthAt: (lies) => 600 + lies * REVEAL_LIE_MS + 400,
  };

  // The host's quiet TV controls show only while a mouse is moving.
  let pointerTimer = null;
  window.addEventListener('mousemove', () => {
    document.body.classList.add('fab-pointer');
    clearTimeout(pointerTimer);
    pointerTimer = setTimeout(() => document.body.classList.remove('fab-pointer'), 3000);
  }, { passive: true });

  return { lang, isAr, t, esc, num, arDigits, count, category, gameLang, question, adoptGameLang, logoSrc, logo, fitTv, reveal };
})();
