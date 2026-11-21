// مين أنا؟ · Who Am I? -- what every page of the game shares: the copy (from
// the wireframes, Arabic and English as two separate experiences), the
// design system's pieces as HTML strings (logo, Button, Badge, ClueCard,
// PointsLadder, TimerRing, MaskedPortrait, PlayerScore, Toast), the server
// clock, the 960 x 540 stage fit, a confirm sheet and toasts.
window.WaiUI = (function () {
  const lang = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const isAr = () => lang() === 'ar';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Arabic copy uses Arabic-Indic digits; English uses Western ones. Codes
  // are always Latin, monospace and left to right.
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const d = (n) => (isAr() ? String(n).replace(/[0-9]/g, (x) => AR_DIGITS[x]) : String(n));
  const pts = (n) => d(isAr() ? String(n) : Number(n).toLocaleString('en-US'));
  const secs = (s) => d(Math.max(0, Math.ceil(s)));
  const POINTS = [600, 500, 400, 300, 200, 100];
  const PT_COLORS = ['var(--points-1)', 'var(--points-2)', 'var(--points-3)', 'var(--points-4)', 'var(--points-5)', 'var(--points-6)'];
  const DOTS = ['#7CC8FF', '#FFC93C', '#F6B7C1', '#3FD6A6', '#9C94FF', '#FF9C7A'];

  const T = {
    ar: {
      title: 'مين أنا', q: '؟', waitCreate: 'بانتظار المضيف لإنشاء جلسة',
      newSession: 'جلسة جديدة', pack: 'مجموعة الشخصيات', packs: { global: 'شخصيات عالمية', arab: 'شخصيات عربية وسعودية', fiction: 'خيال ورسوم متحركة', mixed: 'كل المجموعات' },
      clueReveal: 'كشف التلميحات', timed: 'مؤقّت', hostClicks: 'نقرة المضيف', perClue: 'ثوانٍ لكل تلميح', identities: 'عدد الشخصيات', points: 'سُلّم النقاط',
      hostOnTv: 'التحكم من التلفاز', hostOnTvSub: 'لمن ليس معه جوال ثانٍ: أزرار التحكم على الشاشة.', create: 'أنشئ الجلسة', save: 'احفظ', settings: 'الإعدادات',
      joinPhone: 'انضم من جوالك', goTo: (u) => `ادخل ${u} واكتب الرمز`, orScan: 'أو امسح الرمز', joined: (n) => `${d(n)} ${n === 1 ? 'لاعب انضم' : n === 2 ? 'لاعبان انضمّا' : 'لاعبين انضموا'}`,
      invite: 'ادعُ اللاعبين', code: 'رمز الجلسة', shareInvite: 'شارك الدعوة', castTv: 'اعرض على التلفاز', castHow: 'افتح هذا الرابط على التلفاز أو اللابتوب بنفس حسابك ليصبح الشاشة المشتركة.', yourName: 'اسمك', join: 'انضم', scanQr: 'امسح رمز QR',
      lobby: 'الردهة', hostLabel: (n) => `المضيف: ${n}`, howTo: 'كيف تلعب', how1: 'ستتكلم الشخصية بـ٦ تلميحات', how2: 'خمّن من جوالك — المحاولات مجانية', how3: 'أبكر تخمين يربح أكثر', how3sub: 'من ٦٠٠ إلى ١٠٠ نقطة',
      players: 'اللاعبون', waitStart: 'بانتظار المضيف للبدء', minPlayers: 'الحد الأدنى لاعبان', start: 'ابدأ اللعبة', edit: 'تعديل', identitiesN: (n) => `${d(n)} ${n <= 10 && n > 2 ? 'شخصيات' : 'شخصية'}`,
      hi: (n) => `أهلًا ${n}`, youreIn: 'أنت في الردهة', playersN: (n) => `${d(n)} ${n === 1 ? 'لاعب' : n === 2 ? 'لاعبان' : n <= 10 ? 'لاعبين' : 'لاعبًا'}`, watchType: 'راقب الشاشة، واكتب اسم الشخصية هنا متى عرفتها.', waitHost: 'بانتظار المضيف',
      hostPanel: 'لوحة المضيف', hostPanelHow: 'امسح الرمز بجوالك (بنفس الحساب) لتفتح لوحة المضيف: الإجابة، والتخمينات، والمراجعة.', openHere: 'افتح اللوحة هنا',
      roundOf: (r, t) => `الجولة ${d(r)} من ${d(t)}`, firstWorth: 'التلميح الأول بـ٦٠٠ نقطة', startClues: 'ابدأ التلميحات', hostOnly: 'للمضيف فقط', alsoAccepted: 'مقبول أيضًا', clues: 'التلميحات', revealClue1: 'اكشف التلميح ١',
      getReady: 'استعد…', clue1Worth: 'التلميح الأول يساوي ٦٠٠ نقطة',
      clueOf: (c) => `التلميح ${d(c)} من ٦`, roundClue: (r, t, c) => `الجولة ${d(r)} من ${d(t)} · التلميح ${d(c)} من ٦`, ptsNow: (p) => `+${pts(p)} نقطة الآن`, ptsLbl: (p) => `${pts(p)} نقطة`,
      nextIn: (s) => `التالي خلال ${secs(s)} ث`, sShort: (s) => `${secs(s)} ث`, pause: 'إيقاف', resume: 'استئناف', skip: 'تخطَّ', solvedLbl: 'عرفوها', nextClue: 'التلميح التالي', revealAnswer: 'اكشف الإجابة',
      whoAmI: 'مين أنا؟', typeName: 'اكتب اسم الشخصية', submit: 'أرسل', whosGot: 'من عرفها؟',
      stClue: (c, p) => `التلميح ${d(c)} · +${pts(p)}`, stReview: 'قيد المراجعة', stGuessing: (n) => `يحاول · ${n === 1 ? 'محاولة' : n === 2 ? 'محاولتان' : `${d(n)} محاولات`}`, stNone: 'لم يخمّن بعد',
      guesses: 'التخمينات', atClue: (n, c) => `${n} · التلميح ${d(c)}`, review: 'للمراجعة', correctPts: (p) => `صحيح · +${pts(p)}`, wrong: 'خطأ', accepted: 'مقبول', rejected: 'مرفوض', reviewN: (n) => `راجع ${d(n)}`, noGuesses: 'لا تخمينات بعد.',
      yourTries: 'محاولاتك', tryAgain: 'حاول مجددًا', notIt: 'ليست الإجابة — بلا خصم', gotIt: 'عرفتها', lockedAt: (c) => `إجابتك مقفلة عند التلميح ${d(c)}`, keepIt: 'لا تكشفها لأحد',
      reviewing: 'المضيف يراجع تخمينًا', reviewTitle: 'مراجعة', reviewOf: (i, n) => `${d(i)} من ${d(n)}`, wroteAt: (n, c) => `${n} كتب عند التلميح ${d(c)}`, answer: 'الإجابة', closeMatch: 'تطابق جزئي',
      acceptGives: (n, p) => `إن قبلتها يحصل ${n} على ${pts(p)} — قيمة التلميح وقت إرساله.`, accept: 'اقبل', reject: 'ارفض',
      underReview: 'قيد المراجعة', heldPts: (c) => `المضيف يتحقق من إجابتك. نقاطك محفوظة عند التلميح ${d(c)}.`, tryAnother: 'جرّب تخمينًا آخر',
      iAm: 'أنا…', iAmName: (n) => `أنا ${n}`, clueShort: (c) => `التلميح ${d(c)}`, leaderboard: 'الترتيب', roundOver: (r) => `نهاية الجولة ${d(r)}`, missed: (n) => `${d(n)} لم يعرفوها`, nobodySolved: 'لم يعرفها أحد هذه المرة.',
      atClueLow: (c) => `عند التلميح ${d(c)}`, total: (p) => `المجموع ${pts(p)}`, notThisTime: 'فاتتك هذه المرة',
      afterRound: (r, t) => `بعد الجولة ${d(r)} من ${d(t)}`, doneOf: (r, t) => `${d(r)} من ${d(t)}`, nextIdentity: 'الشخصية التالية', seeWinner: 'اعرض الفائز', endEarly: 'أنهِ اللعبة الآن', yourRank: 'ترتيبك', ptsUnit: (p) => `${pts(p)} نقطة`, thisRound: (p) => `+${pts(p)} هذه الجولة`, nextSoon: 'الشخصية التالية قريبًا',
      winner: 'الفائز', winnerPts: (p) => `الفائز! · ${pts(p)} نقطة`, winners: 'الفائزون', gameOver: 'انتهت اللعبة', statsLine: (i, g) => `${d(i)} شخصيات · ${d(g)} تخمينًا`, cont: 'متابعة',
      finalPlace: 'المركز النهائي', solvedOf: (s, t) => `عرفت ${d(s)} من ${d(t)}`, tiedPlace: 'بالتساوي مع غيرك',
      playAgain: 'جولة أخرى؟', samePlayers: 'نفس اللاعبين، شخصيات جديدة', whatNext: 'ماذا بعد؟', rematch: 'العب مجددًا', newPack: 'مجموعة جديدة', share: 'شارك النتيجة', endSession: 'أنهِ الجلسة',
      shareYours: 'شارك نتيجتك', iSolved: (s, t) => `عرفتُ ${d(s)} من ${d(t)}`, placePts: (r, p) => `المركز ${d(r)} · ${pts(p)} نقطة`, shareBtn: 'شارك', waitDecision: 'بانتظار قرار المضيف', leave: 'غادر',
      reconnecting: 'جارٍ إعادة الاتصال…', pausedNothing: 'الجولة متوقفة مؤقتًا، ولن يضيع شيء', roundClueShort: (r, c) => `الجولة ${d(r)} · التلميح ${d(c)}`,
      disconnected: (n) => `فقد ${n} الاتصال`, online: 'متصل', offline: 'غير متصل', ptsKept: (n) => `نقاط ${n} محفوظة؛ يعود لنفس التلميح.`, remove: (n) => `أزل ${n}`, removeQ: (n) => `إزالة ${n}؟`, removeBody: 'تبقى نقاطه، لكنه لن يكمل هذه اللعبة.',
      wrongCode: 'الرمز غير صحيح أو الجلسة ممتلئة', reconnected: 'عدت للعبة', roundLocked: 'أُغلقت الجولة', lateGuess: 'وصل تخمينك بعد انتهاء الوقت، فلم يُحتسب.', waitReveal: 'انتظر الكشف',
      skipQ: 'تخطّي هذه الشخصية؟', skipBody: 'لن تُحتسب نقاط هذه الشخصية لأحد، وتنتقلون للتالية.', yesSkip: 'نعم، تخطَّ', endQ: 'إنهاء اللعبة الآن؟', endBody: 'يظهر الترتيب النهائي بالنقاط الحالية.', yesEnd: 'نعم، أنهِ', closeQ: 'إنهاء الجلسة؟', closeBody: 'تُغلق الغرفة للجميع.', yesClose: 'نعم، أنهِ الجلسة', cancel: 'إلغاء',
      revealQ: 'كشف الإجابة الآن؟', revealBody: 'تنتهي الجولة لمن لم يعرفها بعد.', yesReveal: 'نعم، اكشف',
      controls: 'التحكم', hide: 'H · إخفاء', show: 'H · إظهار', tvMode: 'تحكم المضيف', moveToTv: 'انقل التحكم للتلفاز', moveToPhone: 'التحكم من الجوال',
      removedH: 'المضيف أخرجك من اللعبة', removedSub: 'تقدر ترجع وتلعب جولة ثانية.', lateH: 'اللعبة بدأت', lateSub: 'دخلت بعد البداية. تابع من الشاشة الكبيرة.', ended: 'انتهت هذه الجلسة.', home: 'ارجع لمين أنا؟',
      connecting: 'جارٍ الاتصال…', copied: 'تم النسخ', shareText: (s, t, r, p) => `عرفتُ ${s} من ${t} في «مين أنا؟» على بهجة — المركز ${r} بـ${p} نقطة!`,
      tagline: 'شخصية مخفية، ست تلميحات، وأبكر تخمين يربح أكثر.', createRoom: 'أنشئ جلسة', haveCode: 'عندي رمز', back: 'رجوع', allSolved: 'الكل عرفها!',
      errors: {
        ROOM_NOT_FOUND: 'الرمز غير صحيح أو الجلسة ممتلئة', ROOM_FULL: 'الرمز غير صحيح أو الجلسة ممتلئة', ROOM_NOT_JOINABLE: 'اللعبة بدأت. تقدر تدخل أول ما يبدأ المضيف جولة جديدة.', ROOM_ENDED: 'انتهت هذه الجلسة.',
        NOT_ENOUGH_PLAYERS: 'تحتاجون لاعبَين على الأقل.', RATE_LIMITED: 'شوي شوي! جرّب بعد ثواني.', INTERNAL_ERROR: 'صار خطأ. جرّب مرة ثانية.', VALIDATION_ERROR: 'تأكد وجرّب مرة ثانية.',
        ROUND_LOCKED: 'أُغلقت الجولة — وصل تخمينك بعد انتهاء الوقت.', ALREADY_SOLVED: 'عرفتها، وإجابتك مقفلة.', TOO_MANY: 'محاولات كثيرة — انتظر التلميح التالي.', INVALID_ACTION: 'اكتب اسمًا.',
      },
    },
    en: {
      title: 'Who am I', q: '?', waitCreate: 'Waiting for the host to create a session',
      newSession: 'New session', pack: 'Pack', packs: { global: 'Global icons', arab: 'Arab & Saudi icons', fiction: 'Fiction & cartoons', mixed: 'All packs' },
      clueReveal: 'Clue reveal', timed: 'Timed', hostClicks: 'Host clicks', perClue: 'Per clue', identities: 'Identities', points: 'Points',
      hostOnTv: 'Host controls on TV', hostOnTvSub: 'No second phone? The controls sit on the shared screen.', create: 'Create', save: 'Save', settings: 'Settings',
      joinPhone: 'Join from your phone', goTo: (u) => `Go to ${u} and enter the code`, orScan: 'or scan', joined: (n) => `${n} joined`,
      invite: 'Invite players', code: 'Session code', shareInvite: 'Share invite', castTv: 'Cast to TV', castHow: 'Open this link on the TV or laptop, signed in to your account, to make it the shared screen.', yourName: 'Your name', join: 'Join', scanQr: 'Scan QR',
      lobby: 'Lobby', hostLabel: (n) => `Host: ${n}`, howTo: 'How to play', how1: 'A hidden character gives 6 clues', how2: 'Guess on your phone — tries are free', how3: 'Earlier guesses earn more', how3sub: '600 → 100 pts',
      players: 'Players', waitStart: 'Waiting for the host to start', minPlayers: 'Min 2 players', start: 'Start game', edit: 'Edit', identitiesN: (n) => `${n} ${n === 1 ? 'identity' : 'identities'}`,
      hi: (n) => `Hi ${n}`, youreIn: "You're in", playersN: (n) => `${n} ${n === 1 ? 'player' : 'players'}`, watchType: 'Watch the screen. Type the name here when you know it.', waitHost: 'Waiting for host',
      hostPanel: 'Host panel', hostPanelHow: 'Scan with your phone (same account) to open the host panel: the answer, the guesses and reviews.', openHere: 'Open the panel here',
      roundOf: (r, t) => `Round ${r} of ${t}`, firstWorth: 'First clue is worth 600', startClues: 'Start clues', hostOnly: 'Host only', alsoAccepted: 'Also accepted', clues: 'Clues', revealClue1: 'Reveal clue 1',
      getReady: 'Get ready…', clue1Worth: 'Clue 1 is worth 600 pts',
      clueOf: (c) => `Clue ${c} of 6`, roundClue: (r, t, c) => `Round ${r} of ${t} · Clue ${c} of 6`, ptsNow: (p) => `+${pts(p)} pts now`, ptsLbl: (p) => `${pts(p)} pts`,
      nextIn: (s) => `Next clue in ${secs(s)}s`, sShort: (s) => `${secs(s)}s`, pause: 'Pause', resume: 'Resume', skip: 'Skip', solvedLbl: 'Solved', nextClue: 'Next clue', revealAnswer: 'Reveal answer',
      whoAmI: 'Who am I?', typeName: "Type the character's name", submit: 'Submit', whosGot: "Who's got it",
      stClue: (c, p) => `Clue ${c} · +${pts(p)}`, stReview: 'Under review', stGuessing: (n) => `Guessing · ${n} ${n === 1 ? 'try' : 'tries'}`, stNone: 'No guess yet',
      guesses: 'Guesses', atClue: (n, c) => `${n} · clue ${c}`, review: 'Review', correctPts: (p) => `Correct · +${pts(p)}`, wrong: 'Wrong', accepted: 'Accepted', rejected: 'Rejected', reviewN: (n) => `Review ${n}`, noGuesses: 'No guesses yet.',
      yourTries: 'Your tries', tryAgain: 'Try again', notIt: 'Not it, no penalty', gotIt: 'You got it', lockedAt: (c) => `Locked in at clue ${c}`, keepIt: 'Keep it to yourself',
      reviewing: 'Host is reviewing a guess', reviewTitle: 'Review', reviewOf: (i, n) => `${i} of ${n}`, wroteAt: (n, c) => `${n} at clue ${c}`, answer: 'Answer', closeMatch: 'Close match',
      acceptGives: (n, p) => `Accepting gives ${n} ${pts(p)} — the clue value when they sent it.`, accept: 'Accept', reject: 'Reject',
      underReview: 'Under review', heldPts: (c) => `The host is checking your guess. Your clue ${c} points are held.`, tryAnother: 'Try another',
      iAm: 'I am…', iAmName: (n) => `I am ${n}`, clueShort: (c) => `Clue ${c}`, leaderboard: 'Leaderboard', roundOver: (r) => `Round ${r} over`, missed: (n) => `${n} missed`, nobodySolved: 'Nobody got this one.',
      atClueLow: (c) => `at clue ${c}`, total: (p) => `Total ${pts(p)}`, notThisTime: 'Not this time',
      afterRound: (r, t) => `After round ${r} of ${t}`, doneOf: (r, t) => `${r} of ${t} done`, nextIdentity: 'Next identity', seeWinner: 'See the winner', endEarly: 'End early', yourRank: 'Your rank', ptsUnit: (p) => `${pts(p)} pts`, thisRound: (p) => `+${pts(p)} this round`, nextSoon: 'Next identity soon',
      winner: 'Winner', winnerPts: (p) => `Winner! · ${pts(p)} pts`, winners: 'Winners', gameOver: 'Game over', statsLine: (i, g) => `${i} identities, ${g} guesses`, cont: 'Continue',
      finalPlace: 'Final place', solvedOf: (s, t) => `Solved ${s} of ${t}`, tiedPlace: 'Tied with others',
      playAgain: 'Play again?', samePlayers: 'Same players, new identities', whatNext: 'What next?', rematch: 'Rematch', newPack: 'New pack', share: 'Share', endSession: 'End session',
      shareYours: 'Share your result', iSolved: (s, t) => `I solved ${s} of ${t}`, placePts: (r, p) => `${ordinal(r)} place · ${pts(p)} pts`, shareBtn: 'Share', waitDecision: 'Waiting for host', leave: 'Leave',
      reconnecting: 'Reconnecting…', pausedNothing: 'The round is paused. Nothing is lost.', roundClueShort: (r, c) => `Round ${r}, clue ${c}`,
      disconnected: (n) => `${n} disconnected`, online: 'Online', offline: 'Offline', ptsKept: (n) => `${n}'s points are kept; they rejoin at the current clue.`, remove: (n) => `Remove ${n}`, removeQ: (n) => `Remove ${n}?`, removeBody: 'Their points stay, but they will not finish this game.',
      wrongCode: 'Wrong code or session full', reconnected: 'Reconnected', roundLocked: 'Round locked', lateGuess: "Your guess arrived after time, so it didn't count.", waitReveal: 'Wait for the reveal',
      skipQ: 'Skip this identity?', skipBody: 'Nobody scores for it, and you move on to the next one.', yesSkip: 'Yes, skip', endQ: 'End the game now?', endBody: 'The final ranking shows with the current points.', yesEnd: 'Yes, end it', closeQ: 'End the session?', closeBody: 'The room closes for everyone.', yesClose: 'Yes, end session', cancel: 'Cancel',
      revealQ: 'Reveal the answer now?', revealBody: "The round ends for anyone who hasn't got it.", yesReveal: 'Yes, reveal',
      controls: 'Controls', hide: 'H · HIDE', show: 'H · SHOW', tvMode: 'Host (TV mode)', moveToTv: 'Move controls to the TV', moveToPhone: 'Control from phone',
      removedH: 'The host took you out of this game', removedSub: 'You can come back for another round.', lateH: 'The game has started', lateSub: 'You joined after it began. Follow along on the big screen.', ended: 'This session has ended.', home: 'Back to Who am I?',
      connecting: 'Connecting…', copied: 'Copied', shareText: (s, t, r, p) => `I solved ${s} of ${t} in Who am I? on Bahjah — ${ordinal(r)} place with ${p} pts!`,
      tagline: 'A hidden character, six clues, and the earliest guess wins the most.', createRoom: 'Start a session', haveCode: 'I have a code', back: 'Back', allSolved: 'Everyone has it!',
      errors: {
        ROOM_NOT_FOUND: 'Wrong code or session full', ROOM_FULL: 'Wrong code or session full', ROOM_NOT_JOINABLE: 'The game has started. You can join when the host starts a new game.', ROOM_ENDED: 'This session has ended.',
        NOT_ENOUGH_PLAYERS: 'You need at least 2 players.', RATE_LIMITED: 'Slow down! Try again in a few seconds.', INTERNAL_ERROR: 'Something went wrong. Try again.', VALIDATION_ERROR: 'Check and try again.',
        ROUND_LOCKED: 'Round locked — your guess arrived after time.', ALREADY_SOLVED: "You've got it — your answer is locked in.", TOO_MANY: 'That is a lot of tries — wait for the next clue.', INVALID_ACTION: 'Type a name.',
      },
    },
  };
  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  const t = () => T[lang()];

  function errorText(err) {
    if (!err) return '';
    return t().errors[err.code] || err.message || t().errors.INTERNAL_ERROR;
  }
  window.BahjahErrorText = (err) => (document.body && document.body.classList.contains('wai') ? errorText(err) : null);

  // --- Icons (Lucide, inline) ----------------------------------------------
  const PATHS = {
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    skip: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
    pointer: '<path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
    tv: '<rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    hash: '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    userMinus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" x2="16" y1="11" y2="11"/>',
    send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    list: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    mute: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
    left: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
  };
  function icon(name, size = 18) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  }
  const back = () => (isAr() ? 'right' : 'left');

  // --- Logo (rebuilt as SVG from LogoMark.dc.html) -----------------------------
  let logoSeq = 0;
  function emblem(size = 40) {
    const id = `wl${(logoSeq += 1)}`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 140 140" role="img" aria-label="${esc(t().title + t().q)}" style="flex:none;display:block">
      <defs>
        <clipPath id="${id}c"><rect width="140" height="140" rx="16"/></clipPath>
        <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E86FF"/><stop offset="1" stop-color="#2F5BFF"/></linearGradient>
        <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F43E6"/><stop offset="1" stop-color="#18288A"/></linearGradient>
        <radialGradient id="${id}g" cx="50%" cy="100%" r="55%"><stop offset="0" stop-color="rgba(185,204,255,.55)"/><stop offset="1" stop-color="rgba(185,204,255,0)"/></radialGradient>
        <linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE59A"/><stop offset="1" stop-color="#FFC93C"/></linearGradient>
        <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,229,154,.9)"/><stop offset="1" stop-color="rgba(255,229,154,0)"/></linearGradient>
        <linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(10,15,61,.6)"/><stop offset=".85" stop-color="rgba(10,15,61,0)"/></linearGradient>
        <filter id="${id}w" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
        <filter id="${id}n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0"/></filter>
      </defs>
      <g clip-path="url(#${id}c)">
        <rect width="140" height="84" fill="url(#${id}s)"/><rect y="84" width="140" height="56" fill="url(#${id}f)"/>
        <rect width="140" height="84" fill="url(#${id}g)"/>
        <path d="M54 84V41a16 16 0 0 1 32 0v43z" fill="#FFC93C" opacity=".6" filter="url(#${id}w)"/>
        <path d="M54 84V41a16 16 0 0 1 32 0v43z" fill="url(#${id}d)"/>
        <polygon points="54,84 86,84 120,140 20,140" fill="url(#${id}l)"/>
        <polygon points="68,84 72,84 75.6,140 64.4,140" fill="url(#${id}h)"/>
        <circle cx="70" cy="60.8" r="2.75" fill="#0A0F3D"/>
        <rect x="66.5" y="64" width="7" height="20" rx="3" fill="#0A0F3D"/>
        <rect width="140" height="140" filter="url(#${id}n)" opacity=".35" style="mix-blend-mode:overlay"/>
      </g></svg>`;
  }
  function wordmark(size = 20) {
    return `<span class="w-wordmark" style="font-size:${size}px">${esc(t().title)}<span class="w-q">${t().q}</span></span>`;
  }
  function logo(size = 32, text = true) {
    return `<span class="w-logo-row">${emblem(size)}${text ? wordmark(Math.round(size * 0.6)) : ''}</span>`;
  }

  // --- Components ------------------------------------------------------------
  function badge(text, tone = '') {
    return `<span class="w-badge${tone ? ` w-badge--${tone}` : ''}">${esc(text)}</span>`;
  }
  function btn(label, opts = {}) {
    const cls = ['w-btn', opts.variant ? `w-btn--${opts.variant}` : '', opts.size ? `w-btn--${opts.size}` : '', opts.block ? 'w-btn--block' : '', !label ? 'w-btn--icon' : ''].filter(Boolean).join(' ');
    const attrs = Object.entries(opts.attrs || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
    return `<button type="button" class="${cls}"${attrs}${opts.disabled ? ' disabled' : ''}${!label && opts.title ? ` aria-label="${esc(opts.title)}" title="${esc(opts.title)}"` : ''}>${opts.icon ? icon(opts.icon, opts.size === 'sm' ? 16 : 18) : ''}${label ? esc(label) : ''}</button>`;
  }
  // ClueCard: state revealed | current | locked.
  function clueCard(n, text, state, opts = {}) {
    const p = POINTS[n - 1];
    const color = PT_COLORS[n - 1];
    if (state === 'locked') {
      return `<div class="w-clue w-clue--locked"><span class="w-clue__n">${d(n)}</span><span class="w-clue__t">${esc(opts.placeholder || '••••• ••• •••••• ••• ••••')}</span>${icon('lock', 13)}<span class="w-clue__p">${pts(p)}</span></div>`;
    }
    return `<div class="w-clue${state === 'current' ? ' w-clue--current' : ''}${opts.compact ? ' w-clue--compact' : ''}"${opts.noAnim ? ' style="animation:none"' : ''}><span class="w-clue__n" style="background:${color}">${d(n)}</span><span class="w-clue__t" dir="auto">${esc(text)}</span><span class="w-clue__p" style="color:${color}">${esc(t().ptsLbl(p))}</span></div>`;
  }
  function ladder(active = 0) {
    return `<div class="w-ladder">${POINTS.map((p, i) => `<div class="w-ladder__bar"><span>${pts(p)}</span><i style="height:${18 + (5 - i) * 7}px;background:${PT_COLORS[i]}${active && i + 1 !== active ? ';opacity:.35' : ''}"></i></div>`).join('')}</div>`;
  }
  // TimerRing: counts down to endsAt (server time); ticks itself.
  function ring(endsAt, total, opts = {}) {
    const size = opts.size || 72;
    const r = size / 2 - 5;
    const c = 2 * Math.PI * r;
    const left = opts.paused ? (opts.remainingMs || 0) / 1000 : Math.max(0, ((endsAt || 0) - now()) / 1000);
    const frac = total ? Math.max(0, Math.min(1, left / total)) : 0;
    return `<div class="w-ring${opts.paused ? ' is-paused' : ''}" style="width:${size}px;height:${size}px" ${opts.paused ? '' : `data-wai-ends="${endsAt || 0}" data-wai-total="${total}"`} data-c="${c}">
      <svg width="${size}" height="${size}"><circle class="w-ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="5"/><circle class="w-ring__fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}"/></svg>
      <span class="w-ring__n" style="font-size:${Math.round(size * 0.36)}px">${opts.paused ? icon('pause', Math.round(size * 0.3)) : secs(left)}</span></div>`;
  }
  function tickTimers() {
    document.querySelectorAll('[data-wai-ends]').forEach((el) => {
      const ends = Number(el.dataset.waiEnds);
      const total = Number(el.dataset.waiTotal) || 1;
      const left = Math.max(0, (ends - now()) / 1000);
      const n = el.querySelector('.w-ring__n');
      if (n) n.textContent = secs(left);
      const f = el.querySelector('.w-ring__fill');
      const c = Number(el.dataset.c);
      if (f && c) f.setAttribute('stroke-dashoffset', String(c * (1 - Math.max(0, Math.min(1, left / total)))));
    });
    document.querySelectorAll('[data-wai-clock]').forEach((el) => {
      const ends = Number(el.dataset.waiClock);
      el.textContent = (el.dataset.fmt === 'next' ? t().nextIn : t().sShort)(Math.max(0, (ends - now()) / 1000));
    });
  }
  setInterval(tickTimers, 250);

  // MaskedPortrait: reveal 0..1 lowers the blur; revealed shows the image or
  // the name.
  function portrait(opts = {}) {
    const w = opts.width || 150;
    const h = Math.round(w * (opts.ratio || 1.25));
    const blur = Math.round(22 * (1 - Math.max(0, Math.min(1, opts.reveal || 0))));
    const img = opts.image ? `<img class="w-portrait__img" src="${esc(opts.image)}" alt="" style="filter:blur(${opts.revealed ? 0 : blur}px)">` : '';
    const q = opts.revealed && opts.image ? '' : `<span class="w-portrait__q" style="font-size:${Math.round(w * 0.5)}px">${opts.revealed ? '' : esc(t().q === '?' ? '?' : '؟')}</span>`;
    const name = opts.revealed && opts.name ? `<span class="w-portrait__name" dir="auto">${esc(opts.name)}</span>` : '';
    return `<div class="w-portrait${opts.revealed ? ' is-revealed' : ''}" style="width:${w}px;height:${h}px">${img}${q}${name}</div>`;
  }
  function dot(name, seat, size = 28) {
    const initial = Array.from(String(name || '?').trim())[0] || '?';
    return `<span class="w-dot" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.46)}px;background:${DOTS[(seat || 0) % DOTS.length]}">${esc(initial.toUpperCase())}</span>`;
  }
  function chip(name, seat, opts = {}) {
    return `<span class="w-chip${opts.offline ? ' is-offline' : ''}">${dot(name, seat)}<bdi>${esc(name)}</bdi></span>`;
  }
  function scoreRow(p, opts = {}) {
    return `<div class="w-score${opts.lead ? ' is-lead' : ''}"><span class="w-score__rank">${d(opts.rank)}</span>${dot(p.name, p.seat, opts.dot || 28)}<span class="w-score__name" dir="auto">${esc(p.name)}</span>${opts.lead && opts.crown ? `<span style="color:var(--c-sun)">${icon('crown', 16)}</span>` : ''}<span class="w-score__pts">${pts(opts.score)}</span>${opts.after || ''}</div>`;
  }
  // Players ranked; equal scores share a place (1, 1, 3).
  function ranked(players, scores) {
    const list = players.filter((p) => !p.removed).map((p) => ({ ...p, score: (scores || {})[p.userId] || 0 })).sort((a, b) => b.score - a.score);
    return list.map((p) => ({ ...p, rank: list.filter((x) => x.score > p.score).length + 1 }));
  }

  // --- Stage, sheet, toast ---------------------------------------------------
  function fitStage(stage) {
    if (!stage) return;
    const frame = stage.parentElement;
    const vw = (frame && frame.clientWidth) || innerWidth;
    const vh = (frame && frame.clientHeight) || innerHeight;
    const k = Math.min(vw / 960, vh / 540);
    stage.style.transform = `scale(${k})`;
  }

  function confirmSheet({ title, body, yes, danger }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'w-sheet';
      wrap.innerHTML = `<div role="dialog" aria-modal="true"><h2 class="w-h2">${esc(title)}</h2>${body ? `<p class="w-body">${esc(body)}</p>` : ''}
        <button type="button" class="w-btn w-btn--lg w-btn--block${danger ? ' w-btn--light' : ''}" data-yes>${esc(yes)}</button>
        <button type="button" class="w-btn w-btn--ghost w-btn--block" data-no>${esc(t().cancel)}</button></div>`;
      const done = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      function onKey(e) { if (e.key === 'Escape') done(false); }
      wrap.addEventListener('click', (e) => {
        if (e.target.closest('[data-yes]')) done(true);
        else if (e.target.closest('[data-no]') || e.target === wrap) done(false);
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(wrap);
      wrap.querySelector('[data-yes]').focus();
    });
  }

  let toastTimer = null;
  function toast(message, tone = 'info') {
    let el = document.getElementById('w-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'w-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    const ic = { correct: 'check', wrong: 'x', info: 'eye', points: 'star' }[tone] || 'eye';
    el.className = `w-toast w-toast--${tone}`;
    el.innerHTML = `<span class="w-toast__i">${icon(ic, 15)}</span><span>${esc(message)}</span>`;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error('no clipboard'));
  }
  function shareOrCopy(text, url) {
    if (navigator.share) return navigator.share({ title: `${t().title}${t().q}`, text, url }).catch(() => {});
    return copyText(url ? `${text}\n${url}` : text).then(() => toast(t().copied)).catch(() => {});
  }

  // --- Server clock ----------------------------------------------------------
  let offset = 0;
  const samples = [];
  const now = () => Date.now() + offset;
  document.addEventListener('bahjah:game-state', (e) => {
    const s = e.detail && e.detail.data && e.detail.data.serverNow;
    if (typeof s !== 'number') return;
    samples.push(s - Date.now());
    if (samples.length > 8) samples.shift();
    offset = Math.max(...samples);
  });

  function sfx(name) {
    const fx = window.BahjahSoundFx;
    if (fx && fx.isEnabled && fx.isEnabled() && typeof fx[name] === 'function') {
      try { fx[name](); } catch (_) { /* audio needs a tap first */ }
    }
  }
  function soundButton(cls = 'w-btn w-btn--secondary w-btn--sm w-btn--icon') {
    const fx = window.BahjahSoundFx;
    if (!fx) return '';
    const on = fx.isEnabled();
    return `<button type="button" class="${cls}" data-wai-sound aria-pressed="${on}" aria-label="sound">${icon(on ? 'volume' : 'mute', 16)}</button>`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wai-sound]');
    if (!b || !window.BahjahSoundFx) return;
    const on = window.BahjahSoundFx.toggle();
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = icon(on ? 'volume' : 'mute', 16);
  });

  function setLang(next) {
    if (next !== 'ar' && next !== 'en') return;
    document.documentElement.setAttribute('lang', next);
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
    try { localStorage.setItem('bahjah_lang', next); } catch (_) { /* private mode */ }
    document.dispatchEvent(new Event('bahjah:lang-change'));
  }
  window.gameBarSetLang = setLang;
  function initLang() {
    document.documentElement.setAttribute('dir', isAr() ? 'rtl' : 'ltr');
  }
  // The identity's name / a clue in the reader's language.
  const pick = (o) => (o ? (isAr() ? o.ar : o.en) : '');

  return {
    T, t, lang, isAr, esc, d, pts, secs, ordinal, POINTS, PT_COLORS, now, errorText, icon, back, emblem, wordmark, logo, badge, btn, clueCard, ladder, ring, tickTimers,
    portrait, dot, chip, scoreRow, ranked, fitStage, confirmSheet, toast, copyText, shareOrCopy, sfx, soundButton, setLang, initLang, pick,
  };
})();
