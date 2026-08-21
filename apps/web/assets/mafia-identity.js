// Deterministic "noir identity token" assignment for Mafia, by join order --
// not by seat or role, so a player keeps the same token badge for the whole
// game. Cycles past 8 players. Does not touch the site-wide avatar system
// (assets/avatars.js / avatar-picker.js) -- an uploaded photo still wins
// over the token, exactly like every other game.
//
// NOTE: relies on `members` being in stable join order. The room-membership
// query this data ultimately comes from has no explicit ORDER BY today, so
// this is a cosmetic-only assumption (a reconnect could in theory reshuffle
// which token a player sees) -- never a game-logic risk, since the server
// keys everything by userId regardless of array order.
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

  return { tokenFor, tokenNameFor, TOKENS };
})();
