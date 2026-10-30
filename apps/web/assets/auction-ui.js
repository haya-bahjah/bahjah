// مزاد | Auction -- the small helpers the game page, the lobby, the phone and
// the big screen all share: copy in the current language, Arabic-Indic digits,
// the logo mark (drawn inline so the gavel can strike), the paddles, and the
// 1280 x 760 television stage scaled to whatever screen it is on.
window.AucUI = (function () {
  const lang = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const isAr = () => lang() === 'ar';
  const t = (en, ar) => (isAr() ? ar : en);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arDigits = (n) => String(n ?? 0).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  // Numbers in the reader's digits: Arabic-Indic on the Arabic side. Room
  // codes and links stay Latin -- never pass those through here.
  const num = (n) => (isAr() ? arDigits(n) : String(n ?? 0));
  // 0:41
  const clock = (secs) => {
    const s = Math.max(0, Math.ceil(secs));
    return num(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  };
  const secsLeft = (endsAt) => Math.max(0, Math.ceil(((endsAt || Date.now()) - Date.now()) / 1000));

  // 1st / الأول -- the rank in the "You · 2nd · 14" chip.
  const AR_ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
  function ordinal(n) {
    if (isAr()) return AR_ORDINALS[n - 1] || arDigits(n);
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // A game is played in one language (the server's `language`): the lots are
  // shown in it on every screen. Games started before it existed were English.
  const gameLang = (d) => (d && d.language === 'ar' ? 'ar' : 'en');
  const category = (c, l) => {
    if (!c) return '';
    return (l || lang()) === 'ar' && c.nameAr ? c.nameAr : c.name;
  };

  // Switch this screen to the game's language when the game starts, unless
  // the person in front of it has picked a language themselves since the
  // page loaded. The page provides window.aucUseLang, which redraws the
  // screen in the new language; true means it did.
  function adoptGameLang(d) {
    if (window.__aucPickedLang || !d || !d.language || !window.aucUseLang) return false;
    if (lang() === d.language) return false;
    window.aucUseLang(d.language);
    return true;
  }

  // --- The logo mark --------------------------------------------------------
  // A gavel striking a sound block, with three impact ticks. ink: for orange
  // grounds. cream: for brick, oxblood or ink grounds. onlight: for cream.
  const MARKS = {
    ink: { block: '#f2e4cf', blockShade: '#c9b293', ticks: '#f2e4cf', head: '#2a2325', headShade: '#120f10' },
    cream: { block: '#e8a33b', blockShade: '#b97a22', ticks: '#e8a33b', head: '#f2e4cf', headShade: '#cdb798' },
    onlight: { block: '#d8612a', blockShade: '#a3302a', ticks: '#a3302a', head: '#1d1a1b', headShade: '#000000' },
  };
  let markSeq = 0;
  function mark(variant, cls) {
    const c = MARKS[variant] || MARKS.ink;
    const id = `aucm${(markSeq += 1)}`;
    return `<svg class="auc-mark ${cls || ''}" viewBox="0 0 200 200" aria-hidden="true">
      <g class="auc-mark-block">
        <ellipse cx="88" cy="170" rx="62" ry="15" fill="${c.blockShade}"/><rect x="26" y="156" width="124" height="14" fill="${c.blockShade}"/>
        <ellipse cx="88" cy="156" rx="62" ry="15" fill="${c.block}"/>
      </g>
      <g class="auc-mark-ticks" stroke="${c.ticks}" stroke-width="6" stroke-linecap="round">
        <line x1="34" y1="126" x2="20" y2="118"/><line x1="44" y1="112" x2="36" y2="98"/><line x1="30" y1="142" x2="14" y2="142"/>
      </g>
      <defs><clipPath id="${id}">
        <rect x="50" y="52" width="20" height="56" rx="5"/><rect x="150" y="52" width="20" height="56" rx="5"/>
        <rect x="67" y="58" width="9" height="44" rx="3"/><rect x="144" y="58" width="9" height="44" rx="3"/>
        <rect x="74" y="63" width="72" height="34" rx="6"/><rect x="97" y="55" width="26" height="50" rx="4"/>
        <rect x="104" y="100" width="12" height="90" rx="6"/><rect x="100" y="182" width="20" height="16" rx="8"/>
      </clipPath></defs>
      <g class="auc-mark-head"><g transform="rotate(-40 110 80)"><g clip-path="url(#${id})">
        <rect x="40" y="40" width="140" height="170" fill="${c.head}"/>
        <rect x="40" y="84" width="140" height="22" fill="${c.headShade}"/>
        <rect x="110" y="100" width="10" height="110" fill="${c.headShade}"/>
      </g></g></g>
    </svg>`;
  }

  // An empty sound block, no gavel and no figure: the lot whose winner left.
  const block = (fill, shade) => `<svg class="auc-block" viewBox="0 0 200 60" aria-hidden="true">
    <ellipse cx="100" cy="34" rx="92" ry="22" fill="${shade || 'rgba(0,0,0,.28)'}"/>
    <ellipse cx="100" cy="30" rx="92" ry="22" fill="${fill || 'rgba(0,0,0,.22)'}"/>
    <ellipse cx="100" cy="30" rx="10" ry="3" fill="rgba(0,0,0,.35)"/></svg>`;

  // The tiny bidders. raised: arm up with a paddle; still: arms down.
  // turned: facing away, for a lot that failed.
  const figure = (kind, cls) =>
    `<img class="auc-figure ${cls || ''}" src="assets/auction/${kind === 'still' ? 'figure-still' : kind === 'y' ? 'figure-y' : 'figure'}.svg" alt="" aria-hidden="true">`;

  // The wordmark: Rakkas for مزاد, condensed Roboto Serif for MAZAD. The
  // Arabic product shows only the Arabic word.
  const wordmark = (cls) => `<span class="auc-wordmark ${cls || ''}">${t('MAZAD', 'مزاد')}</span>`;
  const lockup = (variant, cls) =>
    `<span class="auc-lockup ${cls || ''}">${wordmark()}${mark(variant || 'ink')}</span>`;

  // --- Paddles --------------------------------------------------------------
  // Mustard is only ever "you" (and points); everyone else takes the brand's
  // other grounds in seat order.
  const SEAT_COLOURS = [
    ['var(--auc-orange)', 'var(--auc-ink)'],
    ['var(--auc-cream)', 'var(--auc-ink)'],
    ['var(--auc-brick)', 'var(--auc-cream)'],
    ['var(--auc-oxblood)', 'var(--auc-cream)'],
    ['var(--auc-ink)', 'var(--auc-cream)'],
  ];
  const initial = (name) => esc(String(name || '').trim().charAt(0).toUpperCase());
  function seatColour(index, isMe) {
    if (isMe) return ['var(--auc-paddle)', 'var(--auc-ink)'];
    return SEAT_COLOURS[Math.max(0, index) % SEAT_COLOURS.length];
  }
  // A round disc with the initial; `handle` adds the paddle's handle.
  function paddle(name, index, opts) {
    const o = opts || {};
    const [bg, fg] = o.colour || seatColour(index, o.isMe);
    return `<span class="auc-paddle ${o.handle ? 'has-handle' : ''} ${o.cls || ''}" style="--pb:${bg};--pf:${fg};${o.size ? `--ps:${o.size}px;` : ''}"><i>${initial(name)}</i></span>`;
  }

  // The television is laid out at 1280 x 760, the size the wireframes draw it
  // at, and scaled to the screen it is on. The scale keeps all of that in
  // view; the stage then grows along whichever side the screen has to spare,
  // so it fills a 16:9 TV or a wide browser window edge to edge instead of
  // sitting between black bars.
  function fitTv(stage) {
    if (!stage) return;
    // The stage's frame, which is the whole window except under the Bahjah
    // bar (assets/game-bar.css); the window when the frame isn't laid out.
    const frame = stage.parentElement;
    const vw = (frame && frame.clientWidth) || window.innerWidth;
    const vh = (frame && frame.clientHeight) || window.innerHeight;
    const k = Math.min(vw / 1280, vh / 760);
    stage.style.width = `${vw / k}px`;
    stage.style.height = `${vh / k}px`;
    stage.style.transform = `scale(${k})`;
  }

  // One clock for every countdown on screen: anything with data-ends gets its
  // seconds (data-show="secs"), its 0:41 (data-show="clock") or its bar width
  // (data-show="bar", over data-total seconds) kept current.
  setInterval(() => {
    document.querySelectorAll('[data-ends]').forEach((el) => {
      const left = Math.max(0, (Number(el.dataset.ends) - Date.now()) / 1000);
      const show = el.dataset.show;
      if (show === 'bar') el.style.width = `${Math.min(100, (left / Number(el.dataset.total || 1)) * 100)}%`;
      else if (show === 'clock') el.textContent = clock(left);
      else el.textContent = num(Math.ceil(left));
    });
  }, 200);
  const live = (endsAt, show, total) => `data-ends="${endsAt || 0}" data-show="${show}"${total ? ` data-total="${total}"` : ''}`;

  // The reveal word: as big as the design draws it (max), then shrunk until
  // no word runs past the edge and the whole category fits in maxHeight.
  // Measured on the page, so it holds for any category, face and screen.
  function fitEl(el, max, maxHeight) {
    if (!el) return;
    let size = max;
    el.style.fontSize = `${size}px`;
    while (size > 32 && (el.scrollWidth > el.clientWidth + 1 || (maxHeight && el.offsetHeight > maxHeight))) {
      size -= 4;
      el.style.fontSize = `${size}px`;
    }
  }

  // The host's quiet TV controls show only while a mouse is moving.
  let pointerTimer = null;
  window.addEventListener('mousemove', () => {
    document.body.classList.add('auc-pointer');
    clearTimeout(pointerTimer);
    pointerTimer = setTimeout(() => document.body.classList.remove('auc-pointer'), 3000);
  }, { passive: true });

  return {
    lang, isAr, t, esc, num, arDigits, clock, secsLeft, ordinal, gameLang, category, adoptGameLang,
    mark, block, figure, wordmark, lockup, paddle, seatColour, initial, fitTv, live, fitEl,
  };
})();
