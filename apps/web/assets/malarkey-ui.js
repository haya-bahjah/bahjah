// تخاريف · Malarkey -- what every Malarkey page shares: the copy (from the
// design handoff's T.ar / T.en, casual Saudi dialect), the design system's
// pieces (PlayerAvatar, Timer, RoundProgress, RisoShape, the logomark) as
// HTML strings, the server clock, and the big screen's fit.
window.MkUI = (function () {
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const lang = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const isAr = () => lang() === 'ar';
  // Arabic copy counts in Arabic-Indic digits. Room codes and timers do not.
  const d = (n) => (isAr() ? String(n).replace(/\d/g, (x) => AR_DIGITS[x]) : String(n));
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const T = {
    ar: {
      tagline: 'حكايات تكتبونها سوا', sub: 'كل واحد يكتب سطر… والنهاية محد يعرفها.', create: 'سوّ غرفة', haveCode: 'عندي كود',
      playersRange: 'من ٣ إلى ١٠ لاعبين', joinH: 'وش كود الغرفة؟', joinSub: 'تلقاه على الشاشة الكبيرة، أو اسأل المضيف.', codeHint: 'الكود ٤ حروف',
      nameLabel: 'اسمك', defaultName: 'نورة', joinBtn: 'دخّلني', room: 'غرفة', waitingFriends: 'ناطرين الربع…', ready: 'جاهزين؟',
      lobbyHostSub: 'خلّهم يدخلون بالكود. تقدر تبدأ من ٣ لاعبين.', start: 'يلا نبدأ', hi: 'هلا', playerSub: (h) => 'أنت داخل. ' + h + ' بتبدأ اللعبة.',
      howH: 'كيف نلعب؟', how1: 'اكتب أول سطر لحكاية جديدة.', how2: 'كمّل حكايات الباقين. بتشوف آخر سطر بس!',
      how3tv: 'اقروا الحكايات سوا على الشاشة الكبيرة.', how3ph: 'اقروا الحكايات سوا في النهاية.', summary: (n) => n + ' لاعبين = ' + n + ' حكايات',
      round: (a, b) => 'الجولة ' + a + ' من ' + b, firstH: 'ابدأ حكاية جديدة', firstSub: 'اكتب أول سطر. كل ما كان أغرب، أحسن.',
      contH: 'كمّل الحكاية', contSub: 'هذا آخر سطر فيها. وش صار بعدها؟', byOne: 'كتبه واحد منكم', ph: 'اكتب سطرك هنا…',
      autoSend: 'لو خلص الوقت، نرسل اللي كتبته.', send: 'أرسل سطري', sentH: 'وصل سطرك!', sentSub: 'الجولة الجاية تبدأ أول ما يخلّصون.',
      left: (n) => 'باقي ' + n + ' يكتبون', allIn: 'الكل خلّص!', passH: 'جاتك حكاية جديدة', passSub: 'ما راح تعرف مين كتبها.',
      storyOf: (a, b) => 'الحكاية ' + a + ' من ' + b, lineOf: (a, b) => 'السطر ' + a + ' من ' + b, nextStory: 'الحكاية الجاية', theEnd: 'النهاية',
      ink: '(خلص الحبر)', closer: 'وتوتة توتة، خلصت الحدوتة', endH: (n) => n + ' حكايات جديدة', endSub: 'اضغط على أي حكاية تقراها كاملة.',
      by: (n) => 'البداية من ' + n, again: 'جولة ثانية', waitHost: 'ننتظر المضيف…', leave: 'اطلع من الغرفة', share: 'شارك الحكاية',
      copied: 'تم نسخ الحكاية', roomCopied: 'تم نسخ رابط الغرفة', back: 'رجوع', tvJoin: 'ادخلوا من جوالاتكم', tvScan: 'امسحوا الكود، أو اكتبوا:',
      tvWriting0: 'الكل يكتب أول سطر', tvWritingSub: 'ولا أحد يشوف وش كتب لين النهاية.', doneOf: (a, b) => a + ' من ' + b + ' خلّصوا',
      tvGrow: 'الحكايات تكبر…', story: (n) => 'الحكاية ' + n, lines: (a, b) => a + ' من ' + b + ' أسطر', tvPass: 'الحكايات تتنقّل…',
      hostPlays: 'المضيف يلعب معكم', hostPlaysOn: 'بدون شاشة كبيرة. الكل يلعب من جواله.', hostPlaysOff: 'اللعبة تنعرض على الشاشة الكبيرة.',
      storyEnd: 'وخلصت!', revealingNote: 'الحكاية تنكشف…', waitNext: (h) => 'ننتظر ' + h + ' تفتح الحكاية الجاية',
      // Beyond the prototype: the host's controls on the big screen, and the
      // states a real room has that a clickable prototype does not.
      moveOn: 'كمّلوا الحين', endRoom: 'أنهِ الغرفة', confirm: 'اضغط للتأكيد', ending: 'جارٍ الإنهاء…',
      ended: 'انتهت هذه الغرفة.', endedSub: 'المضيف أنهى الغرفة.', home: 'ارجع لتخاريف', connecting: 'جارٍ الاتصال…',
      lateH: 'الحكايات توزّعت', lateSub: 'دخلت بعد ما بدأت اللعبة. تقدر تقرا الحكايات في النهاية.',
      locked: 'خلص وقت هالجولة.', joinFail: 'تعذّر الدخول للغرفة.', enterName: 'اكتب اسمك.', enterCode: 'اكتب كود من ٤ حروف.',
      signIn: 'عندك حساب؟ سجّل دخولك', bigScreenHint: 'هذي الشاشة هي الشاشة الكبيرة. لو بتلعب من جوالك، شغّل «المضيف يلعب معكم».',
      shareText: (title) => 'حكاية كتبناها سوا في تخاريف على بهجة: ' + title,
      you: 'أنت', away: 'غير متصل',
    },
    en: {
      tagline: 'Stories you write together', sub: 'Everyone writes a line. Nobody knows the ending.', create: 'Start a room', haveCode: 'I have a code',
      playersRange: '3–10 players', joinH: "What's the room code?", joinSub: "It's on the big screen, or ask the host.", codeHint: 'The code is 4 letters',
      nameLabel: 'Your name', defaultName: 'Noura', joinBtn: 'Let me in', room: 'Room', waitingFriends: 'Waiting for friends…', ready: 'Ready?',
      lobbyHostSub: 'Share the code. You can start with 3 players.', start: "Let's go", hi: 'Hi', playerSub: (h) => "You're in. " + h + ' will start the game.',
      howH: 'How to play', how1: 'Write the first line of a new story.', how2: "Continue the others' stories. You only see the last line!",
      how3tv: 'Read them together on the big screen.', how3ph: 'Read them together at the end.', summary: (n) => n + ' players = ' + n + ' stories',
      round: (a, b) => 'Round ' + a + ' of ' + b, firstH: 'Start a new story', firstSub: 'Write the first line. Weirder is better.',
      contH: 'Keep it going', contSub: 'This is the last line. What happens next?', byOne: 'Written by one of you', ph: 'Write your line here…',
      autoSend: "When time's up, we send what you have.", send: 'Send my line', sentH: 'Your line is in!', sentSub: "Next round starts when everyone's done.",
      left: (n) => n + ' still writing', allIn: "Everyone's in!", passH: 'A new story is coming', passSub: "You won't know who wrote it.",
      storyOf: (a, b) => 'Story ' + a + ' of ' + b, lineOf: (a, b) => 'Line ' + a + ' of ' + b, nextStory: 'Next story', theEnd: 'The end',
      ink: '(ran out of ink)', closer: "And that's the end of the tale", endH: (n) => n + ' new stories', endSub: 'Tap a story to read it in full.',
      by: (n) => 'Started by ' + n, again: 'Play again', waitHost: 'Waiting for the host…', leave: 'Leave room', share: 'Share story',
      copied: 'Story copied', roomCopied: 'Room link copied', back: 'Back', tvJoin: 'Join on your phones', tvScan: 'Scan, or type:',
      tvWriting0: "Everyone's writing a first line", tvWritingSub: 'Nobody sees what you wrote until the end.', doneOf: (a, b) => a + ' of ' + b + ' done',
      tvGrow: 'The stories are growing…', story: (n) => 'Story ' + n, lines: (a, b) => a + ' of ' + b + ' lines', tvPass: 'Passing the stories along…',
      hostPlays: 'Host plays too', hostPlaysOn: 'No big screen. Everyone plays on their phone.', hostPlaysOff: 'The game shows on the big screen.',
      storyEnd: 'The end!', revealingNote: 'The story is unfolding…', waitNext: (h) => 'Waiting for ' + h + ' to open the next story',
      moveOn: 'Move on now', endRoom: 'End room', confirm: 'Tap to confirm', ending: 'Ending…',
      ended: 'This room has ended.', endedSub: 'The host ended the room.', home: 'Back to Malarkey', connecting: 'Connecting…',
      lateH: 'The stories were already dealt', lateSub: 'You joined after the game started. You can read the stories at the end.',
      locked: 'Time is up for this round.', joinFail: 'Could not join the room.', enterName: 'Write your name.', enterCode: 'Type a 4-letter code.',
      signIn: 'Have an account? Sign in', bigScreenHint: 'This screen is the big screen. To play from your phone, turn on “Host plays too”.',
      shareText: (title) => 'A story we wrote together in Malarkey on Bahjah: ' + title,
      you: 'you', away: 'offline',
    },
  };
  const t = () => T[lang()];

  const fwdIcon = () => (isAr() ? 'ph-arrow-left' : 'ph-arrow-right');
  const backIcon = () => (isAr() ? 'ph-arrow-right' : 'ph-arrow-left');

  // --- PlayerAvatar --------------------------------------------------------
  const STATUS = {
    writing: ['pencil-simple', 'var(--ink-yellow)'],
    done: ['check', 'var(--ink-green)'],
    host: ['crown', 'var(--ink-yellow)'],
    away: ['moon', 'var(--paper-2)'],
  };
  function avatar(name, index, size = 56, opts = {}) {
    const ink = `var(--player-${index % 8})`;
    const misreg = `var(--player-${(index + 5) % 8})`;
    const s = opts.status && STATUS[opts.status];
    const empty = Boolean(opts.empty);
    const initial = empty ? '?' : ((String(name || '').trim()[0] || '?').toUpperCase());
    const badge = s && !empty ? `<span class="mk-avatar__status" style="background:${s[1]}"><i class="ph-bold ph-${s[0]}" aria-hidden="true"></i></span>` : '';
    const label = opts.showName ? `<span class="mk-avatar__name">${empty ? '…' : esc(name)}</span>` : '';
    return `<span class="mk-avatar${empty ? ' mk-avatar--empty' : ''}${opts.away ? ' mk-avatar--away' : ''}"${opts.title ? ` title="${esc(opts.title)}"` : ''}>` +
      `<span class="mk-avatar__disc" style="width:${size}px;height:${size}px;font-size:${size * 0.46}px;background:${ink};--mk-av-misreg:${misreg}">${esc(initial)}${badge}</span>${label}</span>`;
  }

  // --- RoundProgress -------------------------------------------------------
  function progress(current, total, opts = {}) {
    let dots = '';
    for (let i = 1; i <= total; i += 1) {
      const cls = i < current ? ' mk-progress__dot--done' : i === current ? ' mk-progress__dot--now' : '';
      dots += `<span class="mk-progress__dot${cls}"></span>`;
    }
    return `<div class="mk-progress${total > 8 || opts.tight ? ' mk-progress--tight' : ''}" aria-label="${esc(opts.label || `${current} / ${total}`)}">${dots}</div>`;
  }

  // --- Timer ---------------------------------------------------------------
  // Drawn once with its deadline on it, then kept current by the ticker below
  // against the server's clock.
  function timer(endsAt, total, size = 68) {
    const secs = secsLeft(endsAt);
    return `<div class="mk-timer" role="timer" data-mk-ends="${endsAt || 0}" data-mk-total="${total}" style="width:${size}px;height:${size}px;${timerFill(secs, total)}">` +
      `<span class="mk-timer__inner" style="inset:${size * 0.16}px"></span>` +
      `<span class="mk-timer__num" style="font-size:${size * 0.36}px">${secs}</span></div>`;
  }
  function timerFill(secs, total) {
    const pct = Math.max(0, Math.min(1, total ? secs / total : 0));
    const ink = secs <= 10 ? 'var(--ink-red)' : 'var(--ink-pink)';
    return `background:conic-gradient(${ink} ${pct * 360}deg, var(--paper-0) 0)`;
  }
  function tickTimers() {
    document.querySelectorAll('.mk-timer[data-mk-ends]').forEach((el) => {
      const ends = Number(el.dataset.mkEnds);
      const total = Number(el.dataset.mkTotal) || 45;
      const exact = ends ? Math.max(0, (ends - now()) / 1000) : 0;
      const secs = Math.ceil(exact);
      const pct = Math.max(0, Math.min(1, exact / total));
      const ink = secs <= 10 ? 'var(--ink-red)' : 'var(--ink-pink)';
      el.style.background = `conic-gradient(${ink} ${pct * 360}deg, var(--paper-0) 0)`;
      el.classList.toggle('mk-timer--urgent', secs <= 10 && secs > 0);
      el.setAttribute('aria-label', `${secs} seconds left`);
      const num = el.querySelector('.mk-timer__num');
      if (num && num.textContent !== String(secs)) num.textContent = String(secs);
    });
  }
  setInterval(tickTimers, 200);

  // --- The server's clock --------------------------------------------------
  // Deadlines are server times. Each state carries serverNow; the offset is
  // the largest of the last few samples, since a state slow to arrive only
  // ever makes the server look further behind than it is (same as Mazad).
  let clockOffset = 0;
  const samples = [];
  const now = () => Date.now() + clockOffset;
  const secsLeft = (endsAt) => Math.max(0, Math.ceil(((endsAt || now()) - now()) / 1000));
  document.addEventListener('bahjah:game-state', (e) => {
    const serverNow = e.detail && e.detail.data && e.detail.data.serverNow;
    if (typeof serverNow !== 'number') return;
    samples.push(serverNow - Date.now());
    if (samples.length > 8) samples.shift();
    clockOffset = Math.max(...samples);
  });

  // --- RisoShape -----------------------------------------------------------
  function burstClip(n, inner) {
    const p = [];
    for (let i = 0; i < n * 2; i += 1) {
      const r = i % 2 ? inner : 50;
      const a = (Math.PI * i) / n - Math.PI / 2;
      p.push(`${(50 + r * Math.cos(a)).toFixed(1)}% ${(50 + r * Math.sin(a)).toFixed(1)}%`);
    }
    return `polygon(${p.join(',')})`;
  }
  const CLIPS = {
    circle: 'circle(50% at 50% 50%)',
    burst: burstClip(14, 34),
    sparkle: 'polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)',
  };
  function shape(kind, color, size, opts = {}) {
    const off = opts.offset ?? Math.max(3, Math.round(size / 16));
    const layer = (c, dx, dy) => {
      const base = `background:${c};transform:translate(${dx}px,${dy}px);`;
      if (kind === 'half') return `<span style="${base}top:50%;border-radius:0 0 999px 999px"></span>`;
      if (kind === 'checker') return `<span style="${base}background:conic-gradient(${c} 25%,transparent 0 50%,${c} 0 75%,transparent 0) 0 0/${size / 4}px ${size / 4}px"></span>`;
      if (kind === 'rings') return `<span style="${base}border-radius:50%;background:repeating-radial-gradient(circle,${c} 0 ${size / 18}px,transparent ${size / 18}px ${size / 9}px)"></span>`;
      return `<span style="${base}clip-path:${CLIPS[kind] || CLIPS.circle}"></span>`;
    };
    const grain = opts.grain === false ? '' : `<span class="mk-shape__grain" style="inset:-${off}px"></span>`;
    return `<span class="mk-shape${opts.className ? ' ' + opts.className : ''}" aria-hidden="true" style="width:${size}px;height:${size}px;transform:rotate(${opts.rotate || 0}deg);${opts.style || ''}">` +
      `${opts.misreg ? layer(opts.misreg, off, off * 0.7) : ''}${layer(color, 0, 0)}${grain}</span>`;
  }

  // --- The logomark --------------------------------------------------------
  // Built from CSS shapes exactly as MalarkeyLogomark draws it: a checker
  // circle in aqua and blue with an orange offset and a yellow sparkle, and a
  // cream speech bubble saying تخاريف. `icon` is the rounded square with ت.
  function logo(size = 200, variant = 'full') {
    const k = size / 360;
    let art;
    if (variant === 'icon') {
      art = `<div style="position:absolute;inset:0;border-radius:80px;border:5px solid var(--ink-black);overflow:hidden;background:var(--ink-aqua);isolation:isolate;box-sizing:border-box">
        <div style="position:absolute;left:-40px;top:-40px;mix-blend-mode:multiply">${shape('checker', 'var(--ink-blue)', 720, { grain: false })}</div>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
          <div style="position:relative;transform:rotate(3deg)">
            <span style="position:absolute;width:44px;height:44px;background:var(--paper-0);border-right:5px solid var(--ink-black);border-bottom:5px solid var(--ink-black);bottom:-25px;left:40px;transform:rotate(45deg);z-index:1"></span>
            <div style="position:relative;width:190px;height:154px;background:var(--paper-0);border:5px solid var(--ink-black);border-radius:36px;box-shadow:8px 8px 0 var(--ink-orange);display:flex;align-items:center;justify-content:center">
              <span class="mk-logo__word" dir="rtl" lang="ar" style="font-size:118px;line-height:1;padding-top:26px">ت</span>
            </div>
          </div>
        </div></div>`;
    } else {
      art = `<div style="position:absolute;left:18px;top:18px;width:324px;height:324px;border-radius:50%;background:var(--ink-orange);transform:translate(10px,8px)"></div>
        <div style="position:absolute;left:18px;top:18px;width:324px;height:324px;border-radius:50%;overflow:hidden;background:var(--tint-aqua);isolation:isolate">
          <div style="position:absolute;left:0;top:0;mix-blend-mode:multiply">${shape('checker', 'var(--ink-aqua)', 648, { grain: false })}</div>
          <div style="position:absolute;left:-40px;top:-40px;mix-blend-mode:multiply">${shape('checker', 'var(--ink-blue)', 648, { grain: false })}</div>
        </div>
        ${shape('sparkle', 'var(--ink-yellow)', 70, { misreg: 'var(--ink-orange)', style: 'position:absolute;right:20px;top:20px' })}
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
          <div style="position:relative;transform:rotate(3deg)">
            <span style="position:absolute;width:30px;height:30px;background:var(--paper-0);border-right:2.5px solid var(--ink-black);border-bottom:2.5px solid var(--ink-black);bottom:-16px;left:44px;transform:rotate(45deg);z-index:1"></span>
            <div style="position:relative;background:var(--paper-0);border:2.5px solid var(--ink-black);border-radius:24px;box-shadow:6px 6px 0 var(--ink-orange);padding:4px 26px 0" dir="rtl" lang="ar">
              <span class="mk-logo__word" style="line-height:1.3;font-size:96px;text-shadow:-4px 3px 0 var(--ink-orange)">تخاريف</span>
            </div>
          </div>
        </div>`;
    }
    return `<div class="mk-logo" dir="ltr" role="img" aria-label="تخاريف · Malarkey" style="width:${size}px;height:${size}px"><div class="mk-logo__art" style="transform:scale(${k})">${art}</div></div>`;
  }

  // --- Big screen ----------------------------------------------------------
  function fitTv(stage) {
    if (!stage) return;
    const frame = stage.parentElement;
    const vw = (frame && frame.clientWidth) || window.innerWidth;
    const vh = (frame && frame.clientHeight) || window.innerHeight;
    const k = Math.min(vw / 800, vh / 450);
    stage.style.transform = `translate(${(vw - 800 * k) / 2}px, ${(vh - 450 * k) / 2}px) scale(${k})`;
  }

  // --- Toast ---------------------------------------------------------------
  let toastTimer = null;
  function toast(message) {
    let el = document.getElementById('mk-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mk-toast';
      el.className = 'mk-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.innerHTML = `<i class="ph-bold ph-sparkle" aria-hidden="true"></i><span>${esc(message)}</span>`;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); } catch (err) { reject(err); } finally { ta.remove(); }
    });
  }

  // The language switch on the Bahjah bar (assets/game-bar.js calls this).
  function setLang(next) {
    if (next !== 'ar' && next !== 'en') return;
    document.documentElement.setAttribute('lang', next);
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
    try { localStorage.setItem('bahjah_lang', next); } catch (_) { /* private mode */ }
    document.dispatchEvent(new Event('bahjah:lang-change'));
  }
  window.gameBarSetLang = setLang;

  function initLang() {
    const l = lang();
    document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
  }

  return { T, t, lang, isAr, d, esc, avatar, progress, timer, tickTimers, now, secsLeft, shape, logo, fitTv, toast, copyText, setLang, initLang, fwdIcon, backIcon };
})();
