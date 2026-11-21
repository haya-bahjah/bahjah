// مع أو ضد · For or Against -- what every page of the game shares: the copy
// (from the wireframes, Arabic and English), the design system's pieces as
// HTML strings (logo, Shape, PlayerToken, Timer, VoteMeter, PhaseStepper,
// StatementCard, TeamPanel, VoteButton), the server clock, the 1280 x 720
// stage fit, a confirm sheet and toasts.
window.FoaUI = (function () {
  const lang = () => (document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en');
  const isAr = () => lang() === 'ar';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Numbers, timers and codes are always Western digits, left to right.
  const n2 = (n) => String(Math.max(0, n | 0)).padStart(2, '0');
  const num = (n) => `<bdi dir="ltr">${n2(n)}</bdi>`;
  const iso = (s) => '⁨' + String(s ?? '') + '⁩';
  const fmt = (secs) => {
    const s = Math.max(0, Math.ceil(secs));
    return `${n2(Math.floor(s / 60))}:${n2(s % 60)}`;
  };

  // Arabic count of points: نقطة واحدة / نقطتين / 3–10 نقاط / 11+ نقطة.
  function arPts(p) {
    const n = Number(p);
    if (n === 1) return 'نقطة واحدة';
    if (n === 2) return 'نقطتين';
    return `${p} ${n === 0 || (n >= 3 && n <= 10) ? 'نقاط' : 'نقطة'}`;
  }
  const T = {
    ar: {
      host: 'المضيف', setup: 'إعداد الجلسة', settings: 'الإعدادات', source: 'مصدر البيانات', packs: 'باقات جاهزة', mine: 'بياناتي', both: 'كلاهما',
      cats: { everyday: 'حياة يومية', food: 'طعام', tech: 'تقنية', sport: 'رياضة', mine: 'من المضيف' },
      addStatement: 'أضف بياناً', addPh: 'جملة قصيرة تنتهي بنقطة.', add: 'أضف', count: 'عدد البيانات', perTeam: 'وقت كل فريق',
      allowSwitch: 'السماح بتغيير الرأي في التصويت الثاني', save: 'تم', settingUp: 'يُجهّز المضيف الجلسة…',
      hostPlays: 'المضيف يلعب معكم', hostPlaysOn: 'بدون شاشة كبيرة. الكل يلعب من جواله.', hostPlaysOff: 'اللعبة تنعرض على الشاشة الكبيرة.',
      joinNow: 'انضموا الآن', orCode: 'أو أدخل الرمز', players: 'اللاعبون', howTo: 'كيف نلعب',
      howBody: (t) => `صوّت مع أو ضد. كل فريق يدافع ${t}. ثم صوّت من جديد، والأكثر أصواتاً يفوز.`,
      lobbyCount: (n, m) => `${n} لاعبين · الحد الأدنى ${m}`, start: 'ابدأ اللعبة', joinGame: 'انضم إلى اللعبة', code: 'رمز الجلسة', name: 'اسمك',
      yourToken: 'شكلك في اللعبة', join: 'انضم', remove: 'أزِله', lobby: 'الردهة', waitHost: 'بانتظار أن يبدأ المضيف…',
      statementN: 'البيان', openVote: 'افتح التصويت', skip: 'تخطَّ البيان', thinkIt: 'فكّر جيداً. التصويت بعد قليل.',
      voteOnPhone: 'صوّت من جهازك', hiddenVotes: 'الأصوات مخفية حتى يُغلق التصويت.', voted: 'صوّت', closeVote: 'أغلق التصويت',
      picked: (s) => `اخترتَ «${s}». يمكنك التغيير حتى يُغلق التصويت.`, firstVote: 'التصويت الأول', waitingFor: 'بانتظار', allIn: 'الكل صوّت!',
      abstainNote: 'من لا يصوّت يُعدّ ممتنعاً ولا ينضم لأي فريق.', split: 'انقسمت الآراء.', abstained: 'ممتنع:',
      startsFirst: (team, t) => `يبدأ ${team} · ${t} لكل فريق`, startTeam: (team) => `ابدأ دور ${team}`, teams: 'الفريقان',
      onTeam: 'أنت في فريق', withYou: 'معك:', goesFirst: 'فريقك يبدأ أولاً', goesSecond: 'فريقك يدافع ثانياً', abstainedYou: 'امتنعت عن التصويت. تقدر تصوّت في التصويت الثاني.',
      teamFor: 'فريق مع', teamAgainst: 'فريق ضد', forW: 'مع', againstW: 'ضد',
      pause: 'أوقف مؤقتاً', resume: 'استأنف', endTurn: 'أنهِ دور الفريق', yourTurn: 'دوركم الآن', argue: (s) => `دافعوا عن «${s}». تحدّثوا بحرية، كلٌّ بدوره.`,
      theirTurn: (team) => `دور ${team}`, listen: 'استمع جيداً. ستصوّت من جديد بعد قليل.', arguing: (team) => `${team} يدافع`,
      paused: 'متوقف مؤقتاً', pausedBody: (t) => `المضيف أوقف النقاش. سيُستأنف الوقت من ${t}.`,
      endTurnQ: (team) => `إنهاء دور ${team} الآن؟`, endTurnBody: (next) => (next ? `سيبدأ دور ${next} فوراً. لا يمكن التراجع.` : 'سيُفتح التصويت الثاني فوراً. لا يمكن التراجع.'),
      yesEnd: 'نعم، أنهِ الدور', cancel: 'إلغاء', skipQ: 'تخطّي هذا البيان؟', skipBody: 'لن يُحسب ولن تُمنح نقاط عليه.', yesSkip: 'نعم، تخطَّ',
      endGameQ: 'إنهاء اللعبة الآن؟', endGameBody: 'تُعرض النتائج، وتُعلَّم البيانات الباقية «لم يُلعب».', yesEndGame: 'نعم، أنهِ اللعبة',
      closeQ: 'إغلاق الجلسة؟', closeBody: 'يخرج الجميع من الغرفة.', yesClose: 'نعم، أغلق',
      removeQ: (nm) => `إزالة ${nm} من اللعبة؟`, removeBody: 'تُلغى أصواته في هذا البيان ولا يُنتظر.', yesRemove: 'نعم، أزِله',
      changed: 'هل غيّرت رأيك؟', voteAgain: 'صوّت من جديد', firstPicked: 'في البداية اخترت', switchedTo: (s) => `غيّرتَ رأيك إلى «${s}».`,
      lockedNote: 'تغيير الرأي مقفل في هذه اللعبة.', finalVote: 'التصويت الثاني', closeReveal: 'أغلق التصويت وأعلن الحكم',
      verdict: 'الحكم', wins: (s) => `فاز «${s}»`, whatChanged: 'ماذا تغيّر؟', before: 'قبل النقاش', after: 'بعد النقاش', changedMind: 'غيّروا رأيهم',
      pointFor: (s) => `+1 نقطة لكل من صوّت «${s}»`, result: 'النتيجة', next: 'البيان التالي', seeResults: 'اعرض النتائج', endGame: 'أنهِ اللعبة',
      youWon: (s) => `صوّتَّ «${s}». +1 نقطة!`, youLost: (s) => `صوّتَّ «${s}» هذه المرة. لا نقاط في هذه الجولة.`, youAbstained: 'لم تصوّت هذه المرة. لا نقاط في هذه الجولة.',
      yourPoints: 'نقاطك', waitNext: 'بانتظار البيان التالي…',
      tie: 'تعادل.', tieBody: 'جولة حاسمة: دقيقة لكل فريق، ثم تصويت أخير.', tieHost: 'جولة حاسمة: 01:00 لكل فريق ثم تصويت. إن تكرر التعادل فلا فائز.',
      tiePhone: 'دقيقة إضافية لكل فريق. أقنعهم.', suddenDeath: 'ابدأ الجولة الحاسمة', noWinner: 'بلا فائز، إلى التالي', noWinnerRes: 'بلا فائز.', noResult: 'لا نتيجة.', noVotes: 'لم يصوّت أحد.',
      suddenTag: 'جولة حاسمة',
      everyoneIs: (s) => `الجميع «${s}».`, nobodyIs: (s) => `لا أحد «${s}»`, willSkip: (team) => `سيُتخطّى دور ${team}.`, isEmpty: (team) => `${team} فارغ`,
      alone: (a, b) => `سيدافع ${a} وحده، ثم يُفتح التصويت الثاني.`, nobodyVoted: 'لم يصوّت أحد. التصويت الثاني يُفتح مباشرة.', startFinal: 'افتح التصويت الثاني',
      offline: (nm) => `${nm} غير متصل`, offlineSeat: (nm) => `${nm} غير متصل · مكانه محفوظ`, offlineBanner: (nm) => `انقطع اتصال ${nm}. بانتظار عودته…`,
      offlineHost: (team) => (team ? `يبقى في ${team} ويمكنه العودة قبل إغلاق التصويت.` : 'يمكنه العودة قبل إغلاق التصويت.'), wait: 'انتظر',
      reconnecting: 'جارٍ إعادة الاتصال…', keepOpen: 'لا تغلق الصفحة. ستعود إلى مكانك.', tryAgain: 'أعد المحاولة',
      gameOver: 'انتهت اللعبة.', statements: 'البيانات', notPlayed: (n) => `لم يُلعب · ${n} بيانات`, skipped: '(تُخطّي)', tieTag: '(تعادل)', noneTag: '(بلا نتيجة)',
      newGame: 'جولة جديدة', shareResults: 'شارك النتائج', closeSession: 'أغلق الجلسة', yourRank: 'مركزك',
      pointsLine: (p, c) => `${arPts(p)} · ${c === 0 ? 'لم تغيّر رأيك' : c === 1 ? 'غيّرت رأيك مرة واحدة' : c === 2 ? 'غيّرت رأيك مرتين' : `غيّرت رأيك ${c} ${c <= 10 ? 'مرات' : 'مرة'}`}`,
      shareYours: 'شارك نتيجتك', leave: 'اخرج', summary: (p, t, w) => `${p} بيانات من ${t}${w ? ` · الفائز: ${w}` : ''}`,
      copied: 'تم النسخ', removedH: 'المضيف أخرجك من اللعبة', removedSub: 'تقدر ترجع وتلعب جولة ثانية.', lateH: 'اللعبة بدأت', lateSub: 'دخلت بعد البداية. تابع من الشاشة الكبيرة.',
      ended: 'انتهت هذه الغرفة.', home: 'ارجع لمع أو ضد', hide: 'H · إخفاء', show: 'H · إظهار',
      tagline: 'العبوا رأيكم. دافعوا عنه.', sub: 'بيان واحد، فريقان، ودقيقتان ونص لكل فريق. الأغلبية تحكم.', create: 'أنشئ غرفة', haveCode: 'عندي رمز',
      range: 'لاعبان أو أكثر', back: 'رجوع', enterCode: 'اكتب رمزاً من ٤ أحرف.', enterName: 'اكتب اسمك.', connecting: 'جارٍ الاتصال…',
      phases: ['البيان', 'التصويت', 'الفرق', 'النقاش', 'إعادة التصويت', 'النتيجة'],
      shareText: (r, p) => `حللت ${r} في «مع أو ضد» على بهجة برصيد ${arPts(p)}!`,
      errors: {
        ROOM_NOT_FOUND: 'ما لقينا غرفة بهالرمز.', ROOM_FULL: 'الغرفة مليانة.', ROOM_NOT_JOINABLE: 'اللعبة بدأت. تقدر تدخل أول ما يبدأ المضيف جولة جديدة.',
        ROOM_ENDED: 'هذه الغرفة انتهت.', NOT_ENOUGH_PLAYERS: 'تحتاجون لاعبَين على الأقل.', RATE_LIMITED: 'شوي شوي! جرّب بعد ثواني.',
        INTERNAL_ERROR: 'صار خطأ. جرّب مرة ثانية.', VALIDATION_ERROR: 'تأكد من النص وجرّب مرة ثانية.', LOCKED: 'تغيير الرأي مقفل في هذه اللعبة.', TOO_MANY: 'وصلت للحد الأقصى من بياناتك.',
      },
    },
    en: {
      host: 'Host', setup: 'Session setup', settings: 'Settings', source: 'Statement source', packs: 'Ready packs', mine: 'My statements', both: 'Both',
      cats: { everyday: 'Everyday life', food: 'Food', tech: 'Tech', sport: 'Sport', mine: 'From the host' },
      addStatement: 'Add a statement', addPh: 'A short sentence ending with a full stop.', add: 'Add', count: 'Statements', perTeam: 'Time per team',
      allowSwitch: 'Allow changing sides in the final vote', save: 'Done', settingUp: 'The host is setting up the session…',
      hostPlays: 'Host plays too', hostPlaysOn: 'No big screen. Everyone plays on their phone.', hostPlaysOff: 'The game shows on the big screen.',
      joinNow: 'Join now', orCode: 'Or enter the code', players: 'Players', howTo: 'How to play',
      howBody: (t) => `Vote For or Against. Each team argues for ${t}. Then vote again — most votes wins.`,
      lobbyCount: (n, m) => `${n} players · min ${m}`, start: 'Start game', joinGame: 'Join the game', code: 'Session code', name: 'Your name',
      yourToken: 'Your game token', join: 'Join', remove: 'Remove', lobby: 'Lobby', waitHost: 'Waiting for the host to start…',
      statementN: 'Statement', openVote: 'Open voting', skip: 'Skip statement', thinkIt: 'Think it over. Voting opens shortly.',
      voteOnPhone: 'Vote on your phone', hiddenVotes: 'Votes stay hidden until voting closes.', voted: 'Voted', closeVote: 'Close voting',
      picked: (s) => `You picked ${s}. You can change until voting closes.`, firstVote: 'First vote', waitingFor: 'Waiting for', allIn: 'Everyone has voted!',
      abstainNote: "Anyone who doesn't vote abstains and joins no team.", split: 'Opinions are split.', abstained: 'Abstained:',
      startsFirst: (team, t) => `${team} starts · ${t} per team`, startTeam: (team) => `Start ${team}`, teams: 'Teams',
      onTeam: "You're on team", withYou: 'With you:', goesFirst: 'Your team goes first', goesSecond: 'Your team argues second', abstainedYou: "You didn't vote. You can vote in the final vote.",
      teamFor: 'Team For', teamAgainst: 'Team Against', forW: 'For', againstW: 'Against',
      pause: 'Pause', resume: 'Resume', endTurn: "End team's turn", yourTurn: 'Your turn', argue: (s) => `Argue ${s}. Speak freely, one at a time.`,
      theirTurn: (team) => `${team}'s turn`, listen: "Listen closely. You'll vote again shortly.", arguing: (team) => `${team} is arguing`,
      paused: 'Paused', pausedBody: (t) => `The host paused the debate. Time resumes from ${t}.`,
      endTurnQ: (team) => `End ${team}'s turn now?`, endTurnBody: (next) => (next ? `${next} starts immediately. This can't be undone.` : "The final vote opens immediately. This can't be undone."),
      yesEnd: 'Yes, end turn', cancel: 'Cancel', skipQ: 'Skip this statement?', skipBody: "It won't count and nobody scores for it.", yesSkip: 'Yes, skip',
      endGameQ: 'End the game now?', endGameBody: 'The results are shown; statements left are marked "not played".', yesEndGame: 'Yes, end game',
      closeQ: 'Close the session?', closeBody: 'Everyone leaves the room.', yesClose: 'Yes, close',
      removeQ: (nm) => `Remove ${nm} from the game?`, removeBody: "Their votes on this statement are dropped and nobody waits for them.", yesRemove: 'Yes, remove',
      changed: 'Changed your mind?', voteAgain: 'Vote again', firstPicked: 'At first you picked', switchedTo: (s) => `You switched to ${s}.`,
      lockedNote: 'Changing sides is off for this game.', finalVote: 'Final vote', closeReveal: 'Close & reveal verdict',
      verdict: 'The verdict', wins: (s) => `${s} wins`, whatChanged: 'What changed?', before: 'Before debate', after: 'After debate', changedMind: 'Changed their mind',
      pointFor: (s) => `+1 point for everyone who voted ${s}`, result: 'Result', next: 'Next statement', seeResults: 'See the results', endGame: 'End game',
      youWon: (s) => `You voted ${s}. +1 point!`, youLost: (s) => `You voted ${s} this time. No points this round.`, youAbstained: "You didn't vote this time. No points this round.",
      yourPoints: 'Your points', waitNext: 'Waiting for the next statement…',
      tie: 'Tie.', tieBody: 'Sudden death: one minute per team, then one last vote.', tieHost: 'Sudden death: 01:00 per team, then a vote. Another tie means no winner.',
      tiePhone: 'One extra minute per team. Win them over.', suddenDeath: 'Start sudden death', noWinner: 'No winner, next', noWinnerRes: 'No winner.', noResult: 'No result.', noVotes: 'Nobody voted.',
      suddenTag: 'Sudden death',
      everyoneIs: (s) => `Everyone is ${s}.`, nobodyIs: (s) => `Nobody is ${s}`, willSkip: (team) => `${team}'s turn will be skipped.`, isEmpty: (team) => `${team} is empty`,
      alone: (a) => `${a} argues alone, then the final vote opens.`, nobodyVoted: 'Nobody voted. The final vote opens straight away.', startFinal: 'Open the final vote',
      offline: (nm) => `${nm} is offline`, offlineSeat: (nm) => `${nm} offline · seat kept`, offlineBanner: (nm) => `${nm} disconnected. Waiting for them to return…`,
      offlineHost: (team) => (team ? `They stay on ${team} and can return before voting closes.` : 'They can return before voting closes.'), wait: 'Wait',
      reconnecting: 'Reconnecting…', keepOpen: "Keep this page open. You'll rejoin where you were.", tryAgain: 'Try again',
      gameOver: 'Game over.', statements: 'Statements', notPlayed: (n) => `Not played · ${n} statements`, skipped: '(Skipped)', tieTag: '(Tie)', noneTag: '(No result)',
      newGame: 'New game', shareResults: 'Share results', closeSession: 'Close session', yourRank: 'Your rank',
      pointsLine: (p, c) => `${p} ${Number(p) === 1 ? 'point' : 'points'} · ${c === 0 ? 'never changed your mind' : c === 1 ? 'changed your mind once' : `changed your mind ${c} times`}`,
      shareYours: 'Share your result', leave: 'Leave', summary: (p, t, w) => `${p} of ${t} statements${w ? ` · winner: ${w}` : ''}`,
      copied: 'Copied', removedH: 'The host took you out of this game', removedSub: 'You can come back for another round.', lateH: 'The game has started', lateSub: 'You joined after it began. Follow along on the big screen.',
      ended: 'This room has ended.', home: 'Back to For or Against', hide: 'H · HIDE', show: 'H · SHOW',
      tagline: 'Take a side. Defend it.', sub: 'One statement, two teams, two and a half minutes each. The majority rules.', create: 'Start a room', haveCode: 'I have a code',
      range: '2 or more players', back: 'Back', enterCode: 'Type a 4-letter code.', enterName: 'Write your name.', connecting: 'Connecting…',
      phases: ['STATEMENT', 'VOTE', 'TEAMS', 'DEBATE', 'RE-VOTE', 'RESULT'],
      shareText: (r, p) => `I came ${r} in For or Against on Bahjah with ${p} ${Number(p) === 1 ? 'point' : 'points'}!`,
      errors: {
        ROOM_NOT_FOUND: 'No room with that code.', ROOM_FULL: 'This room is full.', ROOM_NOT_JOINABLE: 'The game has started. You can join when the host starts a new game.',
        ROOM_ENDED: 'This room has ended.', NOT_ENOUGH_PLAYERS: 'You need at least 2 players.', RATE_LIMITED: 'Slow down! Try again in a few seconds.',
        INTERNAL_ERROR: 'Something went wrong. Try again.', VALIDATION_ERROR: 'Check the text and try again.', LOCKED: 'Changing sides is off for this game.', TOO_MANY: "You've reached the limit of your own statements.",
      },
    },
  };
  const t = () => T[lang()];
  const sideWord = (side) => (side === 'for' ? t().forW : t().againstW);
  const teamName = (side) => (side === 'for' ? t().teamFor : t().teamAgainst);

  // A server error in the reader's language (lobby-room.js asks through
  // window.BahjahErrorText).
  function errorText(err) {
    if (!err) return '';
    return t().errors[err.code] || err.message || t().errors.INTERNAL_ERROR;
  }
  window.BahjahErrorText = (err) => (document.body && document.body.classList.contains('foa') ? errorText(err) : null);

  // --- Icons (Lucide, inline) ----------------------------------------------
  const ICON = {
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="14" y="4" width="4" height="16"/><rect x="6" y="4" width="4" height="16"/>',
    skip: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    vote: '<path d="m9 12 2 2 4-4"/><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z"/><path d="M22 19H2"/>',
    volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    mute: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    arrowBack: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  };
  const icon = (name, size = 18) =>
    `<svg class="foa-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;
  const fwd = () => (isAr() ? 'arrowBack' : 'arrow');
  const back = () => (isAr() ? 'arrow' : 'arrowBack');

  // --- Logo (4a): the slanted split recolours the words ---------------------
  function logo(width = 160) {
    const k = width / 640;
    const words = `<span class="foa-logo__words" lang="ar" dir="rtl">مع أو ضد</span>`;
    return `<div class="foa-logo" role="img" aria-label="مع أو ضد · For or Against" style="width:${width}px;height:${Math.round(440 * k)}px">
      <div class="foa-logo__art" style="transform:scale(${k})">
        <div class="foa-logo__blue">${words}</div>
        <div class="foa-logo__red">${words}</div>
        <span class="foa-logo__tri"></span><span class="foa-logo__circle"></span><span class="foa-logo__sq"></span>
      </div></div>`;
  }

  // --- Shape & PlayerToken ---------------------------------------------------
  const COLORS = ['var(--yellow-500)', 'var(--blue-500)', 'var(--red-500)', 'var(--green-500)', 'var(--orange-500)', 'var(--pink-400)', 'var(--sky-400)', 'var(--ink)'];
  const KINDS = ['circle', 'square', 'half', 'quarter', 'triangle'];
  function shape(kind, color, size) {
    if (kind === 'triangle') return `<span aria-hidden="true" class="foa-shape" style="width:0;height:0;border-left:${size * 0.58}px solid transparent;border-right:${size * 0.58}px solid transparent;border-bottom:${size}px solid ${color}"></span>`;
    let extra = '';
    if (kind === 'circle') extra = 'border-radius:50%;';
    if (kind === 'half') extra = `height:${size / 2}px;border-radius:${size}px ${size}px 0 0;`;
    if (kind === 'quarter') extra = `border-radius:${size}px 0 0 0;`;
    return `<span aria-hidden="true" class="foa-shape" style="width:${size}px;height:${size}px;background:${color};${extra}"></span>`;
  }
  function token(name, index, opts = {}) {
    const size = opts.size || 72;
    const kind = KINDS[index % KINDS.length];
    // Players past the 40th get the same shape as an earlier one in a
    // different colour; colour and shape cycle on different lengths.
    const color = COLORS[(index + Math.floor(index / 40)) % COLORS.length];
    const ring = opts.side === 'for' ? 'var(--side-for)' : opts.side === 'against' ? 'var(--side-against)' : 'var(--ink)';
    const cls = `foa-token${opts.offline ? ' is-offline' : ''}${opts.removed ? ' is-removed' : ''}`;
    const dot = opts.voted ? '<span class="foa-token__dot" aria-hidden="true"></span>' : '';
    const label = opts.showName === false ? '' : `<span class="foa-token__name" dir="auto">${esc(name)}</span>`;
    return `<div class="${cls}" style="width:${size + 24}px"${opts.title ? ` title="${esc(opts.title)}"` : ''}>
      <div class="foa-token__frame" style="width:${size}px;height:${size}px;border-color:${ring};border-radius:${opts.side === 'for' ? '50%' : '0'};align-items:${kind === 'half' ? 'flex-end' : 'center'}${opts.speaking ? ';outline:4px solid var(--yellow-500);outline-offset:2px' : ''}">${shape(kind, color, size * 0.56)}${dot}</div>${label}</div>`;
  }

  // --- Badge, StatementCard --------------------------------------------------
  const badge = (text, tone = 'neutral') => `<span class="foa-badge foa-badge--${tone}">${text}</span>`;
  function statementText(st) {
    if (!st) return '';
    return st.mine ? st.ar : isAr() ? st.ar : st.en;
  }
  function statementCard(st, index, total, opts = {}) {
    if (!st) return '';
    const cat = st.mine ? t().cats.mine : t().cats[st.category] || '';
    return `<div class="foa-statement foa-statement--${opts.size || 'lg'}">
      <div class="foa-statement__meta">${badge(`<bdi dir="ltr">${n2(index + 1)} / ${n2(total)}</bdi>`)}${opts.noCat ? '' : badge(esc(cat), 'outline')}${opts.sudden ? badge(esc(t().suddenTag), 'ink') : ''}</div>
      <div class="foa-statement__text" dir="auto">${esc(statementText(st))}</div>
    </div>`;
  }

  // --- Timer -------------------------------------------------------------
  // Drawn with its deadline, then kept current against the server's clock.
  function timer(endsAt, total, opts = {}) {
    const secs = opts.paused ? (opts.remainingMs || 0) / 1000 : endsAt ? Math.max(0, (endsAt - now()) / 1000) : total;
    const pct = total ? Math.max(0, Math.min(1, secs / total)) : 0;
    const side = opts.side || 'neutral';
    return `<div class="foa-timer foa-timer--${side} foa-timer--${opts.size || 'lg'}${opts.paused ? ' is-paused' : ''}" data-foa-ends="${opts.paused ? 0 : endsAt || 0}" data-foa-total="${total}" role="timer">
      <div class="foa-timer__body">${opts.label ? `<div class="foa-timer__label">${esc(opts.label)}</div>` : ''}<div class="foa-timer__num" dir="ltr">${fmt(secs)}</div></div>
      <div class="foa-timer__bar"><div class="foa-timer__fill${secs <= 10 ? ' is-low' : ''}" style="width:${(pct * 100).toFixed(1)}%"></div></div></div>`;
  }
  function tickTimers() {
    document.querySelectorAll('.foa-timer[data-foa-ends]').forEach((el) => {
      const ends = Number(el.dataset.foaEnds);
      if (!ends) return;
      const total = Number(el.dataset.foaTotal) || 150;
      const secs = Math.max(0, (ends - now()) / 1000);
      const n = el.querySelector('.foa-timer__num');
      const f = fmt(secs);
      if (n && n.textContent !== f) n.textContent = f;
      const fill = el.querySelector('.foa-timer__fill');
      if (fill) {
        fill.style.width = `${(Math.max(0, Math.min(1, secs / total)) * 100).toFixed(1)}%`;
        fill.classList.toggle('is-low', secs <= 10);
      }
    });
    document.querySelectorAll('[data-foa-clock]').forEach((el) => {
      const ends = Number(el.dataset.foaClock);
      if (ends) el.textContent = fmt(Math.max(0, (ends - now()) / 1000));
    });
  }
  setInterval(tickTimers, 250);

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

  // --- VoteMeter, PhaseStepper, TeamPanel, VoteButton --------------------------
  function meter(f, a, height = 56) {
    const total = f + a || 1;
    const fp = (f / total) * 100;
    return `<div class="foa-meter" dir="${isAr() ? 'rtl' : 'ltr'}" style="height:${height}px">
      <div class="foa-meter__for" style="width:${fp}%">${f > 0 ? `<span dir="ltr">${f}</span>` : ''}</div>
      ${f > 0 && a > 0 ? '<div class="foa-meter__gap"></div>' : ''}
      <div class="foa-meter__against">${a > 0 ? `<span dir="ltr">${a}</span>` : ''}</div></div>`;
  }
  function stepper(current) {
    return `<div class="foa-stepper">${t().phases.map((p, i) => `<div class="foa-stepper__step${i === current ? ' is-on' : i < current ? ' is-done' : ''}"><span class="foa-stepper__n" dir="ltr">${n2(i + 1)}</span><span class="foa-stepper__label">${esc(p)}</span></div>`).join('')}</div>`;
  }
  function teamPanel(side, players, opts = {}) {
    const tokens = players.map((p) => token(p.name, p.seat, { side, size: opts.tokenSize || 44, offline: p.offline })).join('');
    const empty = !players.length ? `<div class="foa-team__empty">${esc(t().nobodyIs(sideWord(side)))}</div>` : '';
    return `<div class="foa-team foa-team--${side}${opts.active ? ' is-active' : ''}${opts.muted ? ' is-muted' : ''}${!players.length && opts.dashed ? ' is-dashed' : ''}">
      <div class="foa-team__head"><div class="foa-team__titles"><span class="foa-team__name">${esc(teamName(side))}</span><span class="foa-team__en">${side === 'for' ? 'TEAM FOR' : 'TEAM AGAINST'} · ${players.length}</span></div>${shape(side === 'for' ? 'circle' : 'square', opts.active ? 'var(--yellow-500)' : 'var(--white)', 44)}</div>
      <div class="foa-team__body">${tokens}${empty}</div></div>`;
  }
  function voteButton(side, opts = {}) {
    return `<button type="button" class="foa-vote foa-vote--${side}${opts.selected ? ' is-selected' : ''}${opts.dimmed ? ' is-dimmed' : ''}" data-vote="${side}" aria-pressed="${Boolean(opts.selected)}"${opts.disabled ? ' disabled' : ''}>
      <div class="foa-vote__top">${shape(side === 'for' ? 'circle' : 'square', opts.selected ? 'var(--yellow-500)' : 'var(--white)', 48)}</div>
      <div class="foa-vote__bottom"><span class="foa-vote__word">${esc(sideWord(side))}</span><span class="foa-vote__en">${side === 'for' ? 'FOR' : 'AGAINST'}</span></div></button>`;
  }

  // --- Stage, sheet, toast ---------------------------------------------------
  function fitStage(stage) {
    if (!stage) return;
    const frame = stage.parentElement;
    const vw = (frame && frame.clientWidth) || innerWidth;
    const vh = (frame && frame.clientHeight) || innerHeight;
    const k = Math.min(vw / 1280, vh / 720);
    stage.style.transform = `translate(${(vw - 1280 * k) / 2}px, ${(vh - 720 * k) / 2}px) scale(${k})`;
  }

  // A confirm sheet: every skip and every irreversible step asks first.
  function confirmSheet({ title, body, yes, tone = 'against' }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'foa-scrim';
      wrap.innerHTML = `<div class="foa-sheet" role="dialog" aria-modal="true"><h2 class="foa-sheet__title">${esc(title)}</h2><p class="foa-sheet__body">${esc(body || '')}</p>
        <button type="button" class="foa-btn foa-btn--${tone} foa-btn--lg foa-btn--block" data-yes>${esc(yes)}</button>
        <button type="button" class="foa-btn foa-btn--ghost foa-btn--md foa-btn--block" data-no>${esc(t().cancel)}</button></div>`;
      const done = (v) => { wrap.remove(); resolve(v); };
      wrap.addEventListener('click', (e) => {
        if (e.target.closest('[data-yes]')) done(true);
        else if (e.target.closest('[data-no]') || e.target === wrap) done(false);
      });
      document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); done(false); }
      });
      document.body.appendChild(wrap);
      wrap.querySelector('[data-yes]').focus();
    });
  }

  let toastTimer = null;
  function toast(message) {
    let el = document.getElementById('foa-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'foa-toast';
      el.className = 'foa-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error('no clipboard'));
  }

  function sfx(name) {
    const fx = window.BahjahSoundFx;
    if (fx && fx.isEnabled && fx.isEnabled() && typeof fx[name] === 'function') {
      try { fx[name](); } catch (_) { /* audio needs a tap first */ }
    }
  }
  function soundButton(cls = 'foa-btn foa-btn--secondary foa-btn--sm foa-btn--icon') {
    const fx = window.BahjahSoundFx;
    if (!fx) return '';
    const on = fx.isEnabled();
    return `<button type="button" class="${cls}" data-foa-sound aria-pressed="${on}" aria-label="sound">${icon(on ? 'volume' : 'mute', 16)}</button>`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-foa-sound]');
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

  return {
    T, t, lang, isAr, esc, n2, num, iso, fmt, now, sideWord, teamName, errorText, icon, fwd, back, logo, shape, token, badge,
    statementText, statementCard, timer, tickTimers, meter, stepper, teamPanel, voteButton, fitStage, confirmSheet, toast, copyText, sfx, soundButton, setLang, initLang,
  };
})();
