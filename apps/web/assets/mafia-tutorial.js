// Shared 6-step "how to play" tutorial overlay for Mafia. Used from both
// mafia.html (a "How to play" link opens it manually) and mafia-lobby.html
// (auto-opens on first visit, guarded by localStorage). Self-contained --
// builds its own overlay markup into document.body on first open() and
// reuses it afterward. Reads the page's current dir="rtl"/"ltr" to pick a
// language rather than tracking its own -- callers already own that state.
const BahjahMafiaTutorial = (() => {
  const STORAGE_KEY = 'bahjah_mafia_tut_v2';

  const STEPS = [
    { en:{ t:'One town. Some of you are lying.', b:'Eight players sit in a room. Three of them are Mafia and know each other. Everyone else is trying to work out who.' },
      ar:{ t:'مدينة واحدة. بعضكم يكذب.', b:'ثمانية لاعبين في غرفة واحدة. ثلاثة منهم مافيا يعرفون بعضهم، والبقية يحاولون كشفهم.' } },
    { en:{ t:'Your role is secret.', b:'You get one card at the start — Mafia, Doctor, Sheriff or Citizen. Nobody else sees it, and it never changes.' },
      ar:{ t:'دورك سرّي.', b:'تأخذ بطاقة واحدة في البداية — مافيا أو طبيب أو شرطي أو مواطن. لا يراها أحد سواك.' } },
    { en:{ t:'Day: talk it out.', b:'The town discusses in the open. Read the room, push a theory, or lie convincingly. This is where the game is actually won.' },
      ar:{ t:'النهار: تحدّث.', b:'تتناقش المدينة علنًا. اقرأ الوجوه، اطرح نظريتك، أو اكذب بإتقان. هنا تُربح اللعبة.' } },
    { en:{ t:'Vote someone out.', b:'Everyone votes. The player with the most votes is eliminated and their card is turned face up for all to see.' },
      ar:{ t:'صوّت لإخراج أحدهم.', b:'يصوّت الجميع. من ينال أكثر الأصوات يخرج، وتُكشف بطاقته للجميع.' } },
    { en:{ t:'Night: the town sleeps.', b:'Mafia pick someone to kill. The Doctor picks someone to save. The Sheriff investigates one player and learns if they are Mafia.' },
      ar:{ t:'الليل: المدينة تنام.', b:'المافيا تختار ضحية، والطبيب يختار من يُنقذ، والشرطي يحقّق مع لاعب ليعرف إن كان مافيا.' } },
    { en:{ t:'How it ends.', b:'Citizens win by voting out every Mafia. Mafia win the moment they equal the rest of the town. Then you share the result.' },
      ar:{ t:'كيف تنتهي.', b:'يفوز الأهالي بإخراج كل المافيا، وتفوز المافيا حين يتساوى عددها مع البقية. ثم تشارك النتيجة.' } },
  ];

  let overlay = null;
  let step = 0;

  function currentLang(){
    return document.documentElement.getAttribute('dir') === 'rtl' ? 'ar' : 'en';
  }

  function pad(n){ return String(n).padStart(2, '0'); }

  function build(){
    overlay = document.createElement('div');
    overlay.className = 'mf-tut-overlay';
    overlay.innerHTML = `
      <div class="mf-tut-card">
        <div class="mf-tut-top">
          <span class="mf-tut-count"></span>
          <div class="mf-tut-skip"></div>
        </div>
        <div class="mf-tut-dots"></div>
        <h2 class="mf-tut-title"></h2>
        <p class="mf-tut-body"></p>
        <div class="mf-tut-actions">
          <div class="mf-tut-back"></div>
          <button type="button" class="bh-btn bh-btn--hot bh-btn--md mf-tut-next"></button>
        </div>
      </div>`;
    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) close(false);
    });
    overlay.querySelector('.mf-tut-skip').addEventListener('click', () => close(true));
    overlay.querySelector('.mf-tut-back').addEventListener('click', () => {
      if(step > 0){ step -= 1; render(); }
    });
    overlay.querySelector('.mf-tut-next').addEventListener('click', () => {
      if(step >= STEPS.length - 1){ close(true); return; }
      step += 1;
      render();
    });
    document.body.appendChild(overlay);
  }

  function render(){
    const lang = currentLang();
    const s = STEPS[step][lang];
    overlay.querySelector('.mf-tut-count').textContent = `${pad(step + 1)} / ${pad(STEPS.length)}`;
    overlay.querySelector('.mf-tut-skip').textContent = lang === 'ar' ? 'تخطي' : 'Skip';
    overlay.querySelector('.mf-tut-title').textContent = s.t;
    overlay.querySelector('.mf-tut-body').textContent = s.b;
    overlay.querySelector('.mf-tut-dots').innerHTML = STEPS.map((_, i) => {
      const cls = i === step ? 'is-active' : i < step ? 'is-done' : '';
      return `<div class="mf-tut-dot ${cls}"></div>`;
    }).join('');
    const backEl = overlay.querySelector('.mf-tut-back');
    backEl.textContent = lang === 'ar' ? 'السابق' : 'Back';
    backEl.style.visibility = step > 0 ? 'visible' : 'hidden';
    const nextEl = overlay.querySelector('.mf-tut-next');
    nextEl.textContent = step === STEPS.length - 1
      ? (lang === 'ar' ? 'فهمت — لنلعب' : "Got it — let's play")
      : (lang === 'ar' ? 'التالي' : 'Next');
  }

  function open(){
    step = 0;
    if(!overlay) build();
    render();
    overlay.style.display = 'flex';
  }

  function close(markSeen){
    if(markSeen) localStorage.setItem(STORAGE_KEY, '1');
    if(overlay) overlay.style.display = 'none';
  }

  function maybeAutoOpen(){
    if(!localStorage.getItem(STORAGE_KEY)) open();
  }

  return { open, close, maybeAutoOpen };
})();
