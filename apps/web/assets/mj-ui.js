// مجلسك · Your Gatherings -- what every page of the game shares: the copy
// (from the wireframes, Arabic and English), the logo, the event's theme art,
// tints, timers, toasts and sheets, the server clock, the 960 x 540 stage
// fit, and shrinking pictures on the phone before they are uploaded.
window.MjUI = (function () {
  const lang = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const isAr = () => lang() === 'ar';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const d = (n) => (isAr() ? String(n).replace(/[0-9]/g, (x) => AR_DIGITS[x]) : String(n));
  const pts = (n) => d(isAr() ? String(n) : Number(n).toLocaleString('en-US'));
  const plus = (n) => `⁦+${pts(n)}⁩`;
  const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const arPlayers = (n) => (n === 1 ? 'ضيف واحد' : n === 2 ? 'ضيفان' : n <= 10 ? `${d(n)} ضيوف` : `${d(n)} ضيفًا`);

  const T = {
    ar: {
      game: 'مجلسك', tagline: 'Your Gatherings', createGame: 'أنشئ لعبة', joinCode: 'انضم برمز', myGames: 'ألعابي', draft: 'مسودة', published: 'منشورة', noGames: 'ما عندك ألعاب بعد. أنشئ أول لعبة لمناسبتك.',
      back: 'رجوع', stepOf: (s) => `الخطوة ${d(s)} من ٤`,
      details: 'تفاصيل المناسبة', eventTitle: 'عنوان المناسبة', eventTitlePh: 'تخرج سارة', occasion: 'نوع المناسبة',
      occasions: { graduation: 'تخرج', bridal: 'حفلة عروس', farewell: 'وداع', baby: 'استقبال مولود', custom: 'مخصص' },
      whoCelebrating: 'مين نحتفل فيه؟', honoreePh: 'سارة', description: 'وصف (اختياري)', gameLang: 'لغة اللعبة', langs: { ar: 'العربية', en: 'English', both: 'الاثنتين' }, nextTheme: 'التالي: الثيم',
      pickTheme: 'اختر الثيم', livePreview: 'معاينة مباشرة', phone: 'الجوال', shared: 'الشاشة المشتركة',
      themes: { graduation: 'تخرج', bridal: 'حفلة عروس', birthday: 'عيد ميلاد', eid: 'عيد', mothers: 'يوم الأم', custom: 'صورتك' },
      upload: 'ارفع صورة', uploadNote: 'JPG أو PNG. تُصغَّر الصورة تلقائيًا، ويبقى النص واضحًا. إن حذفتها نرجع للثيم الافتراضي.', removeImage: 'احذف الصورة', nextQuestions: 'التالي: الأسئلة',
      questions: 'الأسئلة', addQuestion: 'أضف سؤالًا', nextPreview: 'التالي: المعاينة', noQuestions: 'ما فيه أسئلة بعد. أضف أول سؤال.',
      formats: { mc: 'اختيار من متعدد', text: 'نص', checklist: 'قائمة تحديد', match: 'مطابقة', photo: 'صورة' },
      unscored: 'بدون نقاط', ptsBadge: (p) => `${pts(p)} نقطة`, questionEditor: 'محرر السؤال', format: 'نوع السؤال', prompt: 'السؤال', promptPh: 'وين درست سارة؟',
      option: (i) => `الخيار ${d(i)}`, addOption: '+ أضف خيارًا', markCorrect: 'اضغط ✓ للإجابة الصحيحة', pair: (i) => `الزوج ${d(i)}`, addPair: '+ أضف زوجًا', leftPh: 'الاسم', rightPh: 'اللقب',
      accepted: 'إجابات مقبولة', acceptedPh: 'إجابة تُحتسب صحيحة', maxLen: 'أقصى عدد حروف', scored: 'بنقاط', points: 'النقاط', timer: 'المؤقت', noTimer: 'بلا مؤقت', secs: (s) => `${d(s)} ث`,
      photoNote: 'أسئلة الصور بدون نقاط دائمًا، وتذهب الصور لألبوم المحتفى به.', textNote: 'النص بدون نقاط إلا إذا أضفت إجابات مقبولة.', saveQuestion: 'احفظ السؤال', deleteQuestion: 'احذف السؤال', moveUp: 'أعلى', moveDown: 'أسفل',
      preview: 'المعاينة', guestPhone: 'جوال الضيف', qOf: (i, n) => `السؤال ${d(i)} من ${d(n)}`, editsNote: 'التعديلات بعد النشر تُطبّق على الجلسة القادمة.', saveDraft: 'احفظ كمسودة', publishLaunch: 'انشر وابدأ', saved: 'تم الحفظ',
      hostPlays: 'المضيف يلعب معكم', hostPlaysSub: 'تجاوب من جوالك مثل الضيوف، بدون ترتيب في النتائج.',
      problems: { NO_TITLE: 'أضف عنوانًا للمناسبة.', NO_HONOREE: 'اكتب اسم المحتفى به.', NO_QUESTIONS: 'أضف سؤالًا واحدًا على الأقل.', NO_PROMPT: 'اكتب نص السؤال.', NEED_TWO_OPTIONS: 'أضف خيارين على الأقل.', NEED_ONE_OPTION: 'أضف خيارًا واحدًا على الأقل.', NEED_TWO_PAIRS: 'أضف زوجين على الأقل.', PAIRS_NOT_UNIQUE: 'كل اسم ولقب يتكرر مرة واحدة فقط.', MARK_CORRECT: 'حدد الإجابة الصحيحة أو اجعله بدون نقاط.', ADD_ACCEPTED: 'أضف إجابة مقبولة أو اجعله بدون نقاط.' },
      qProblem: (i, p) => `السؤال ${d(i)}: ${p}`, open: 'افتح', edit: 'تعديل', launch: 'ابدأ جلسة', album: 'الألبوم',
      enterCode: 'أدخل الرمز', codeHint: 'يظهر على الشاشة الكبيرة، أو امسح رمز QR', next: 'التالي', youreJoining: 'أنت تنضم إلى', callYou: 'وش نناديك؟', namePh: 'لمى', shownToAll: 'يظهر للجميع في الحفلة', join: 'انضم',
      youreIn: (n) => `حياك يا ${n}!`, startSoon: 'المضيف يبدأ قريب', guestsJoined: (n) => (isAr() ? `${arPlayers(n)} انضموا` : ''),
      lockIn: 'ثبّت إجابتك', submit: 'أرسل', typeAnswer: 'اكتب إجابتك…', pickAll: 'اختر كل ما ينطبق', tapMatch: 'اضغط اسمًا ثم لقبه', takePhoto: 'التقط صورة أو اختر واحدة', albumNote: (h) => `تذهب لألبوم ذكريات ${h}`, uploading: 'جارٍ الرفع…', changePhoto: 'غيّر الصورة',
      locked: 'تم تثبيت إجابتك', watchScreen: 'تابع الشاشة الكبيرة', nice: (p) => `أحسنت! ${plus(p)} نقطة`, notQuite: 'قريب — كمّل', youreRank: (r, p) => `ترتيبك ${d(r)} · ${pts(p)} نقطة`, answerSaved: 'وصلت إجابتك', noAnswer: 'ما وصلت إجابة منك لهذا السؤال',
      thanks: (h) => `شكرًا لاحتفالك مع ${h}!`, finished: (r, p) => `حللت ${d(r)} · ${pts(p)} نقطة`, share: 'شارك', leaveNote: (h) => `اترك رسالة لـ${h}`, notePh: 'رسالة قصيرة…', sendNote: 'أرسل الرسالة', noteSent: 'وصلت رسالتك', thanksPlaying: 'شكرًا لمشاركتك!',
      welcomeTo: 'أهلًا بكم في', joinAt: (u) => `انضم من ${u}`, waitingGuests: 'بانتظار الضيوف…', answered: (a, n) => `${d(a)} من ${d(n)} جاوبوا`, mabrouk: (h) => `مبروك يا ${h}!`, winners: 'الفائزون', summary: 'ملخص اللعبة', answersIn: (n) => `${d(n)} إجابات وصلت`, goesTo: (h) => `تذهب لـ${h}`,
      lobby: 'الردهة', live: 'مباشر', needTwo: 'تحتاجون ضيفين على الأقل', start: 'ابدأ اللعبة', remove: 'أزل', removeQ: (n) => `إزالة ${n}؟`, removeBody: 'يخرج من هذه اللعبة.', disconnected: (n) => `${n} فقد الاتصال`,
      pause: 'إيقاف', resume: 'استئناف', paused: 'متوقف', skip: 'تخطَّ', reveal: 'اكشف', lockNow: 'أغلق الإجابات', nextQuestion: 'السؤال التالي', seeResults: 'النتائج', endGame: 'أنهِ اللعبة', endQ: 'إنهاء اللعبة الآن؟', endBody: 'تظهر النتائج بما تم.', yesEnd: 'نعم، أنهِ', skipQ: 'تخطّي هذا السؤال؟', skipBody: 'لن يُحتسب.', yesSkip: 'نعم، تخطَّ', cancel: 'إلغاء',
      results: 'النتائج', leaderboard: 'الترتيب', answers: 'الإجابات', submitted: (n) => `أرسلوا ${d(n)}`, unanswered: (n) => `بلا إجابة ${d(n)}`, unscoredN: (n) => `بدون نقاط ${d(n)}`, skippedTag: 'تم تخطيه',
      shareResults: 'شارك النتائج', copyLink: 'انسخ الرابط', whatsapp: 'واتساب', saveImage: 'احفظ الصورة', privateNote: 'الإجابات الخاصة والصور لا تُشارك أبدًا.', copied: 'تم النسخ',
      newSession: 'جلسة جديدة', endSession: 'أنهِ الجلسة', closeQ: 'إنهاء الجلسة؟', closeBody: 'تُغلق الغرفة للجميع.', yesClose: 'نعم، أنهِ',
      hostPanel: 'لوحة المضيف', hostPanelHow: 'امسح الرمز بجوالك (بنفس الحساب) لتتحكم باللعبة من جوالك.', settings: 'الإعدادات', yourTurnToo: 'دورك تجاوب',
      reconnecting: 'جارٍ إعادة الاتصال…', keepOpen: 'لا تغلق الصفحة.', ended: 'انتهت هذه الجلسة.', home: 'ارجع لمجلسك', removedH: 'المضيف أخرجك من اللعبة', leave: 'غادر', connecting: 'جارٍ الاتصال…',
      albumTitle: (h) => `ألبوم ${h}`, albumEmpty: 'لا صور أو رسائل بعد.', notes: 'رسائل', photos: 'صور', shareAlbum: 'شارك الألبوم مع المحتفى به', albumPrivate: 'الرابط خاص: من معه الرابط يقدر يشوف الألبوم.', from: (n) => `من ${n}`,
      tvLobbyHint: 'افتح هذه الصفحة على التلفاز أو اللابتوب لتكون الشاشة المشتركة.',
      errors: { ROOM_NOT_FOUND: 'الرمز غير صحيح.', ROOM_FULL: 'الجلسة ممتلئة.', ROOM_NOT_JOINABLE: 'انتهت هذه الجلسة.', ROOM_ENDED: 'انتهت هذه الجلسة.', RATE_LIMITED: 'شوي شوي! جرّب بعد ثواني.', INTERNAL_ERROR: 'صار خطأ. جرّب مرة ثانية.', VALIDATION_ERROR: 'تأكد وجرّب مرة ثانية.', ROUND_LOCKED: 'أُغلقت الإجابات لهذا السؤال.', ALREADY_ANSWERED: 'إجابتك مثبّتة.', NOT_READY: 'كمّل اللعبة قبل النشر.', NOT_ENOUGH_PLAYERS: 'تحتاجون ضيفين على الأقل.', TOO_MANY: 'وصلت للحد الأقصى.' },
    },
    en: {
      game: 'مجلسك', tagline: 'Your Gatherings', createGame: 'Create a game', joinCode: 'Join with code', myGames: 'My games', draft: 'Draft', published: 'Published', noGames: 'No games yet. Create the first one for your occasion.',
      back: 'Back', stepOf: (s) => `Step ${s} of 4`,
      details: 'Event details', eventTitle: 'Event title', eventTitlePh: "Sara's graduation", occasion: 'Occasion',
      occasions: { graduation: 'Graduation', bridal: 'Bridal shower', farewell: 'Farewell', baby: 'Baby shower', custom: 'Custom' },
      whoCelebrating: 'Who are we celebrating?', honoreePh: 'Sara', description: 'Description (optional)', gameLang: 'Game language', langs: { ar: 'العربية', en: 'English', both: 'Both' }, nextTheme: 'Next: theme',
      pickTheme: 'Pick a theme', livePreview: 'Live preview', phone: 'Phone', shared: 'Shared screen',
      themes: { graduation: 'Graduation', bridal: 'Bridal shower', birthday: 'Birthday', eid: 'Eid', mothers: "Mother's Day", custom: 'Your image' },
      upload: 'Upload image', uploadNote: 'JPG or PNG. Resized for you, text stays legible. Falls back to the default theme if removed.', removeImage: 'Remove image', nextQuestions: 'Next: questions',
      questions: 'Questions', addQuestion: 'Add question', nextPreview: 'Next: preview', noQuestions: 'No questions yet. Add the first one.',
      formats: { mc: 'Multiple choice', text: 'Textbox', checklist: 'Checklist', match: 'Match', photo: 'Photo' },
      unscored: 'unscored', ptsBadge: (p) => `${pts(p)}pt`, questionEditor: 'Question editor', format: 'Format', prompt: 'Question', promptPh: 'Where did Sara study?',
      option: (i) => `Option ${i}`, addOption: '+ Add option', markCorrect: 'Tap ✓ to mark the right answer', pair: (i) => `Pair ${i}`, addPair: '+ Add pair', leftPh: 'Name', rightPh: 'Nickname',
      accepted: 'Accepted answers', acceptedPh: 'An answer that counts', maxLen: 'Max characters', scored: 'Scored', points: 'Points', timer: 'Timer', noTimer: 'No timer', secs: (s) => `${s}s`,
      photoNote: 'Photo questions are never scored; the photos go into the honoree\'s album.', textNote: 'Textbox is unscored unless you add accepted answers.', saveQuestion: 'Save question', deleteQuestion: 'Delete question', moveUp: 'Up', moveDown: 'Down',
      preview: 'Preview', guestPhone: 'Guest phone', qOf: (i, n) => `Question ${i} of ${n}`, editsNote: 'Edits after publishing apply to the next session.', saveDraft: 'Save draft', publishLaunch: 'Publish & launch', saved: 'Saved',
      hostPlays: 'Host plays too', hostPlaysSub: 'Answer from your phone like a guest, without a place on the leaderboard.',
      problems: { NO_TITLE: 'Add an event title.', NO_HONOREE: 'Say who we are celebrating.', NO_QUESTIONS: 'Add at least one question.', NO_PROMPT: 'Write the question.', NEED_TWO_OPTIONS: 'Add at least two options.', NEED_ONE_OPTION: 'Add at least one option.', NEED_TWO_PAIRS: 'Add at least two pairs.', PAIRS_NOT_UNIQUE: 'Each name and nickname can appear once.', MARK_CORRECT: 'Mark the right answer, or make it unscored.', ADD_ACCEPTED: 'Add an accepted answer, or make it unscored.' },
      qProblem: (i, p) => `Question ${i}: ${p}`, open: 'Open', edit: 'Edit', launch: 'Start a session', album: 'Album',
      enterCode: 'Enter the code', codeHint: 'Shown on the big screen, or scan the QR', next: 'Next', youreJoining: "You're joining", callYou: 'What should we call you?', namePh: 'Lama', shownToAll: 'Shown to everyone at the party', join: 'Join',
      youreIn: (n) => `You're in, ${n}!`, startSoon: 'The host will start soon', guestsJoined: (n) => `${n} ${n === 1 ? 'guest' : 'guests'} joined`,
      lockIn: 'Lock in answer', submit: 'Submit', typeAnswer: 'Type your answer…', pickAll: 'Pick all that apply', tapMatch: 'Tap a name, then its nickname', takePhoto: 'Take a photo or choose one', albumNote: (h) => `Goes into ${h}'s memory album`, uploading: 'Uploading…', changePhoto: 'Change photo',
      locked: 'Answer locked in', watchScreen: 'Watch the big screen', nice: (p) => `Nice! ${plus(p)} points`, notQuite: 'Not quite — keep going', youreRank: (r, p) => `You're ${ordinal(r)} · ${pts(p)} pts`, answerSaved: 'Your answer is in', noAnswer: 'No answer from you this time',
      thanks: (h) => `Thanks for celebrating ${h}!`, finished: (r, p) => `You finished ${ordinal(r)} · ${pts(p)} pts`, share: 'Share', leaveNote: (h) => `Leave a note for ${h}`, notePh: 'A short note…', sendNote: 'Send note', noteSent: 'Your note is in', thanksPlaying: 'Thanks for playing!',
      welcomeTo: 'Welcome to', joinAt: (u) => `Join at ${u}`, waitingGuests: 'Waiting for guests…', answered: (a, n) => `${a} of ${n} answered`, mabrouk: (h) => `Mabrouk, ${h}!`, winners: 'Winners', summary: 'Game summary', answersIn: (n) => `${n} ${n === 1 ? 'answer' : 'answers'} in`, goesTo: (h) => `They go to ${h}`,
      lobby: 'Lobby', live: 'Live', needTwo: 'Need at least 2 players', start: 'Start game', remove: 'Remove', removeQ: (n) => `Remove ${n}?`, removeBody: 'They leave this game.', disconnected: (n) => `${n} disconnected`,
      pause: 'Pause', resume: 'Resume', paused: 'Paused', skip: 'Skip', reveal: 'Reveal', lockNow: 'Close answers', nextQuestion: 'Next question', seeResults: 'Results', endGame: 'End game', endQ: 'End the game now?', endBody: 'Results show with what has been played.', yesEnd: 'Yes, end it', skipQ: 'Skip this question?', skipBody: 'It will not count.', yesSkip: 'Yes, skip', cancel: 'Cancel',
      results: 'Results', leaderboard: 'Leaderboard', answers: 'Answers', submitted: (n) => `Submitted ${n}`, unanswered: (n) => `Unanswered ${n}`, unscoredN: (n) => `Unscored ${n}`, skippedTag: 'Skipped',
      shareResults: 'Share the results', copyLink: 'Copy link', whatsapp: 'WhatsApp', saveImage: 'Save image', privateNote: 'Private answers and photos are never shared.', copied: 'Copied',
      newSession: 'New session', endSession: 'End session', closeQ: 'End the session?', closeBody: 'The room closes for everyone.', yesClose: 'Yes, end it',
      hostPanel: 'Host panel', hostPanelHow: 'Scan with your phone (same account) to run the game from it.', settings: 'Settings', yourTurnToo: 'Your turn to answer',
      reconnecting: 'Reconnecting…', keepOpen: 'Keep this page open.', ended: 'This session has ended.', home: 'Back to مجلسك', removedH: 'The host took you out of this game', leave: 'Leave', connecting: 'Connecting…',
      albumTitle: (h) => `${h}'s album`, albumEmpty: 'No photos or notes yet.', notes: 'Notes', photos: 'Photos', shareAlbum: 'Share the album with the honoree', albumPrivate: 'The link is private: anyone with it can see the album.', from: (n) => `From ${n}`,
      tvLobbyHint: 'Open this page on the TV or laptop to make it the shared screen.',
      errors: { ROOM_NOT_FOUND: 'Wrong code.', ROOM_FULL: 'This session is full.', ROOM_NOT_JOINABLE: 'This session has ended.', ROOM_ENDED: 'This session has ended.', RATE_LIMITED: 'Slow down! Try again in a few seconds.', INTERNAL_ERROR: 'Something went wrong. Try again.', VALIDATION_ERROR: 'Check and try again.', ROUND_LOCKED: 'Answers are locked for this question.', ALREADY_ANSWERED: 'Your answer is locked in.', NOT_READY: 'Finish the game before publishing.', NOT_ENOUGH_PLAYERS: 'You need at least 2 players.', TOO_MANY: "You've reached the limit." },
    },
  };
  const t = () => T[lang()];
  function errorText(err) {
    if (!err) return '';
    return t().errors[err.code] || err.message || t().errors.INTERNAL_ERROR;
  }
  window.BahjahErrorText = (err) => (document.body && document.body.classList.contains('mj') ? errorText(err) : null);

  // --- Icons (Lucide) ---------------------------------------------------------
  const PATHS = {
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>',
    left: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
    up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>', pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>', skip: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    tv: '<rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>', phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  };
  const icon = (name, size = 18) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  const back = () => (isAr() ? 'right' : 'left');

  function logo(small) {
    return `<span class="mj-logo${small ? ' mj-logo--sm' : ''}" role="img" aria-label="مجلسك · Your Gatherings"><span class="mj-logo__ar">مجلسك</span><span class="mj-logo__en">Your Gatherings</span></span>`;
  }

  // --- Theme art ----------------------------------------------------------------
  const THEMES = ['graduation', 'bridal', 'birthday', 'eid', 'mothers'];
  const OCCASION_THEME = { graduation: 'graduation', bridal: 'bridal', farewell: 'eid', baby: 'birthday', custom: 'bridal' };
  function themeUrl(themeId, imageId) {
    if (themeId === 'custom' && imageId) return `/api/games/majlisak/images/${encodeURIComponent(imageId)}`;
    return `assets/majlisak/themes/${THEMES.includes(themeId) ? themeId : 'bridal'}.jpg`;
  }
  // The accent follows the theme; an uploaded image takes the default lavender.
  function applyTheme(themeId) {
    document.body.dataset.mjTheme = THEMES.includes(themeId) ? themeId : 'bridal';
  }
  function art(kind, s, chip) {
    return `<div class="mj-art mj-art--${kind}" style="background-image:url('${themeUrl(s.themeId, s.themeImageId)}')">${chip !== false ? `<span class="mj-event" dir="auto">${esc(s.title)}</span>` : ''}</div>`;
  }

  // --- People --------------------------------------------------------------------
  const TINTS = { lavender: '#DCDAF8', pink: '#FCE3EE', aqua: '#D6F3F5', butter: '#FEEDB6', mint: '#C9EFD9', peach: '#FDE1CF' };
  const TINT_ORDER = ['lavender', 'pink', 'aqua', 'butter', 'mint'];
  function tintOf(avatar, seed) {
    if (avatar && avatar.indexOf('tint:') === 0 && TINTS[avatar.slice(5)]) return TINTS[avatar.slice(5)];
    let h = 0; for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return TINTS[TINT_ORDER[h % TINT_ORDER.length]];
  }
  function dot(p, size = 28) {
    const initial = Array.from(String(p.name || '?').trim())[0] || '?';
    return `<span class="mj-dot" style="width:${size}px;height:${size}px;background:${tintOf(p.avatar, p.userId || p.name)};font-size:${Math.round(size * 0.42)}px">${esc(initial.toUpperCase())}</span>`;
  }
  const ranked = (list) => list.map((r) => ({ ...r, rank: list.filter((x) => x.score > r.score).length + 1 }));

  // --- Server clock and timers ---------------------------------------------------
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
  const clock = (secs) => { const s = Math.max(0, Math.ceil(secs)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function timer(x) {
    if (!x.question || !x.question.timerSec) return '';
    if (x.paused) return `<span class="mj-timer">${esc(t().paused)} · ${clock((x.remainingMs || 0) / 1000)}</span>`;
    if (!x.phaseEndsAt) return '';
    return `<span class="mj-timer" data-mj-ends="${x.phaseEndsAt}">${clock((x.phaseEndsAt - now()) / 1000)}</span>`;
  }
  function tick() {
    document.querySelectorAll('[data-mj-ends]').forEach((el) => {
      const left = (Number(el.dataset.mjEnds) - now()) / 1000;
      el.textContent = clock(left);
      el.classList.toggle('is-low', left <= 5);
    });
  }
  setInterval(tick, 250);

  // --- Sheets, toasts, stage ---------------------------------------------------------
  function confirmSheet({ title, body, yes }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'mj-sheet';
      wrap.innerHTML = `<div role="dialog" aria-modal="true"><h2 class="mj-title" style="font-size:22px">${esc(title)}</h2>${body ? `<p class="mj-body">${esc(body)}</p>` : ''}
        <button type="button" class="mj-btn mj-btn--block" data-yes>${esc(yes)}</button><button type="button" class="mj-btn mj-btn--secondary mj-btn--block" data-no>${esc(t().cancel)}</button></div>`;
      const done = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      function onKey(e) { if (e.key === 'Escape') done(false); }
      wrap.addEventListener('click', (e) => { if (e.target.closest('[data-yes]')) done(true); else if (e.target.closest('[data-no]') || e.target === wrap) done(false); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(wrap);
      wrap.querySelector('[data-yes]').focus();
    });
  }
  let toastTimer = null;
  function toast(message, tone) {
    let el = document.getElementById('mj-toast');
    if (!el) { el = document.createElement('div'); el.id = 'mj-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.className = `mj-toast${tone === 'no' ? ' mj-toast--no' : ''}`;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  function fitStage(stage) {
    if (!stage) return;
    const frame = stage.parentElement;
    const k = Math.min(((frame && frame.clientWidth) || innerWidth) / 960, ((frame && frame.clientHeight) || innerHeight) / 540) * 0.98;
    stage.style.transform = `scale(${k})`;
  }
  function shareOrCopy(text, url) {
    if (navigator.share) return navigator.share({ title: 'مجلسك', text, url }).catch(() => {});
    const all = url ? `${text}\n${url}` : text;
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(all).then(() => toast(t().copied)).catch(() => {});
    return Promise.resolve();
  }

  // Shrinks a picture on the phone before it is sent: the long side to 1280
  // px, JPEG, stepping quality down until it is under ~350 KB.
  function shrinkImage(file, maxSide = 1280, maxBytes = 350 * 1024) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('type')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        let q = 0.85;
        const attempt = () => c.toBlob((blob) => {
          if (!blob) { reject(new Error('encode')); return; }
          if (blob.size > maxBytes && q > 0.45) { q -= 0.1; attempt(); return; }
          resolve(blob);
        }, 'image/jpeg', q);
        attempt();
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  const token = () => (typeof BahjahSession !== 'undefined' && (BahjahSession.getToken() || BahjahSession.getGuestToken())) || '';
  async function api(method, path, body, raw) {
    const res = await fetch(`/api/games/majlisak${path}`, {
      method,
      headers: { ...(raw ? { 'Content-Type': raw.type || 'image/jpeg' } : { 'Content-Type': 'application/json' }), Authorization: `Bearer ${token()}` },
      body: raw || (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error((data.error && data.error.message) || 'error'); e.code = data.error && data.error.code; e.data = data; e.status = res.status; throw e; }
    return data;
  }

  function setLang(next) {
    if (next !== 'ar' && next !== 'en') return;
    document.documentElement.setAttribute('lang', next);
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
    try { localStorage.setItem('bahjah_lang', next); } catch (_) { /* private mode */ }
    document.dispatchEvent(new Event('bahjah:lang-change'));
  }
  window.gameBarSetLang = setLang;
  const initLang = () => document.documentElement.setAttribute('dir', isAr() ? 'rtl' : 'ltr');

  return { T, t, lang, isAr, esc, d, pts, plus, ordinal, errorText, icon, back, logo, THEMES, OCCASION_THEME, themeUrl, applyTheme, art, TINTS, TINT_ORDER, tintOf, dot, ranked, now, timer, tick, clock, confirmSheet, toast, fitStage, shareOrCopy, shrinkImage, api, token, setLang, initLang };
})();
