// Deterministic "noir identity token" assignment for Mafia, by join order --
// not by seat or role, so a player keeps the same token badge for the whole
// game. Cycles past 8 players. Does not touch the site-wide avatar system
// (assets/avatars.js / avatar-picker.js) -- an uploaded photo still wins
// over the token, exactly like every other game.
//
// Relies on `members` arriving in join order, which the room-membership
// query now guarantees (rooms/service.ts orders by joinedAt), so a player's
// token is stable across reconnects rather than merely usually stable.
//
// Also owns the role card table -- art, display name and accent colour per
// role, in both languages. The TV and the phone both draw cards (dawn, the
// elimination flip, the verdict line-up, your own reveal), and they have to
// agree on which piece of art belongs to whom, so it lives in one place
// rather than once per surface.
// Exposed on `window` (not a bare `const`) because every consumer feature-
// detects it as `window.BahjahMafiaIdentity` before use. A top-level `const`
// creates a global lexical binding that never becomes a property of the
// global object, so those guards saw `undefined` and silently skipped -- the
// tokens never rendered anywhere. Same shape as avatars.js / share-card.js.
window.BahjahMafiaIdentity = (() => {
  const TOKENS = ['fedora', 'revolver', 'cigar', 'lipstick', 'watch', 'dice', 'shoe', 'briefcase'];
  const BASE_PATH = 'assets/mafia/tokens/';

  function tokenNameFor(members, userId) {
    const index = members.findIndex((m) => m.userId === userId);
    const safeIndex = index === -1 ? 0 : index;
    return TOKENS[safeIndex % TOKENS.length];
  }

  function tokenFor(members, userId) {
    return BASE_PATH + tokenNameFor(members, userId) + '.svg';
  }

  // The server's four roles, in the design's language. 'detective' is the
  // Sheriff and 'villager' is the Citizen -- the engine's names predate the
  // design and are not worth a migration to rename.
  const CARD_PATH = 'assets/mafia/cards/';
  const ROLES = {
    mafia: {
      color: '#EE2D23',
      name: { en: 'Mafia Boss', ar: 'زعيم المافيا' },
      desc: {
        en: 'Kill one name a night. Look innocent by day.',
        ar: 'اقتل اسمًا كل ليلة. وابدُ بريئًا في النهار.',
      },
    },
    doctor: {
      color: '#AEB8C4',
      name: { en: 'Doctor', ar: 'الطبيب' },
      desc: {
        en: 'Save one life a night. Guess right and nobody dies.',
        ar: 'أنقذ حياة كل ليلة. خمّن صح ولن يموت أحد.',
      },
    },
    detective: {
      color: '#C8A94E',
      name: { en: 'Sheriff', ar: 'العمدة' },
      desc: {
        en: 'Check one name a night. The badge never lies.',
        ar: 'تحقّق من اسم كل ليلة. الشارة لا تكذب.',
      },
    },
    villager: {
      color: '#E8EAF0',
      name: { en: 'Citizen', ar: 'مواطن' },
      desc: {
        en: 'No power but your voice. Read the room, vote well.',
        ar: 'لا قوة لك سوى صوتك. اقرأ الطاولة وصوّت بحكمة.',
      },
    },
  };

  // Mafia and Citizen each have two pieces of art. The game draws no
  // distinction between boss and hitman, or between the two citizens, so
  // which one a player gets is cosmetic -- picked by a stable hash of their
  // id so it never flickers between renders or between the two surfaces.
  function hashSeed(str) {
    let hash = 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return hash;
  }
  function roleArt(role, userId) {
    if (role === 'mafia') return CARD_PATH + (hashSeed(userId) % 2 === 0 ? 'mafia-boss.svg' : 'mafia-hitman.svg');
    if (role === 'doctor') return CARD_PATH + 'doctor.svg';
    if (role === 'detective') return CARD_PATH + 'sheriff.svg';
    return CARD_PATH + (hashSeed(userId) % 2 === 0 ? 'citizen-m.svg' : 'citizen-f.svg');
  }
  function roleName(role, lang) {
    const r = ROLES[role];
    return r ? r.name[lang === 'ar' ? 'ar' : 'en'] : '';
  }
  function roleDesc(role, lang) {
    const r = ROLES[role];
    return r ? r.desc[lang === 'ar' ? 'ar' : 'en'] : '';
  }
  function roleColor(role) {
    const r = ROLES[role];
    return r ? r.color : '#E8EAF0';
  }

  return { tokenFor, tokenNameFor, TOKENS, ROLES, roleArt, roleName, roleDesc, roleColor };
})();
