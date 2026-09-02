// Knows You Best — MATCH / TRUTH data layer.
//
// This is match_truth_export/kyb-data.js with the demo arrays replaced by the
// live round, which is the one file the handoff asks us to swap. The shapes it
// hands the four screens are unchanged:
//
//   PLAYERS      {id, name, initial, color}
//   ANSWERS      {id, owner, text, short, doodle, matchers}   owner/matchers are
//                indexes into PLAYERS
//   PHONE_ORDER  shuffled answer order for the phone TRUTH screen
//
// revealTimeline(n) / revealDuration(n) are kept exactly as written -- they are
// the TV TRUTH choreography and nothing here may drift from them.
(function () {
  // Same five brand hues, in the same order the rest of KYB cycles them
  // (knows-you-best-host-console.js CHIP_ACCENTS), so a player keeps one colour
  // across the lobby, the chips, and these four screens.
  const COLORS = ['var(--kyb-pink)', 'var(--kyb-cyan)', 'var(--kyb-green)', 'var(--kyb-purple)', 'var(--kyb-yellow)'];

  // The handoff's twelve card doodles, cycled if a room ever runs longer.
  const DOODLES = ['●', '▲', '✕', '◼', '●', '▲', '✦', '◼', '✕', '●', '★', '▲'];

  // per-card wobble, in degrees (multiply by a 0-2 "wobble" factor if you want it tunable)
  const ROTATION_BASE = [-1.4, 1.1, -0.8, 1.3, -1.2, 0.9, 1.2, -1.1, 0.7, -1.3, 1, -0.9];

  // The live round. Reassigned wholesale by setRound(); every screen reads
  // these through the accessors below, never through a captured reference.
  let PLAYERS = [];
  let ANSWERS = [];
  let PHONE_ORDER = [];
  let ROTATIONS = ROTATION_BASE.slice();

  // The export clamped to the design's 5-12 range because its demo data was
  // twelve rows long. Against a live room the ceiling is the round itself:
  // clamping to 12 would drop players from a bigger room, and clamping up to 5
  // would index past the end of a smaller one.
  function clampPlayers(n) {
    const max = Math.max(ANSWERS.length, PLAYERS.length);
    if (!max) return 0;
    return Math.max(1, Math.min(max, Math.round(n)));
  }

  /**
   * TV TRUTH reveal timeline — strictly serial: a card only starts flipping once the
   * previous card has finished its whole sequence (flip → answer → author tag →
   * "n GOT IT" → matcher pills). ~22s for 12 answers.
   *
   * Verbatim from the handoff. Do not retime, restagger, or "simplify" it.
   */
  function revealTimeline(n) {
    let t = 400;
    return ANSWERS.slice(0, clampPlayers(n)).map((a, i) => {
      const ms = a.matchers.filter((j) => j < clampPlayers(n)).map((j) => PLAYERS[j]);
      const base = t;
      const M_START = 1300, M_STEP = 130;
      const lastBeat = ms.length ? M_START + (ms.length - 1) * M_STEP + 340 : 1150 + 340;
      t = base + Math.max(1490, lastBeat) + 220;      // next card waits for this one
      return {
        id: a.id, text: a.text, owner: PLAYERS[a.owner], rot: ROTATIONS[i],
        flipDelay: base, textDelay: base + 560, tagDelay: base + 860, labelDelay: base + 1150,
        matchers: ms.map((m, k) => ({ ...m, delay: base + M_START + k * M_STEP })),
        countLabel: ms.length ? (ms.length === 1 ? '1 GOT IT' : ms.length + ' GOT IT') : 'NOBODY GOT IT',
        countColor: ms.length ? 'var(--kyb-green)' : 'var(--kyb-pink)',
        cardBg: ms.length ? 'var(--kyb-tint-g)' : 'var(--kyb-card)'
      };
    });
  }
  const revealDuration = (n) => 400 + clampPlayers(n) * 1810;   // rough total, ms

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // The phone's answer order is shuffled once per round and cached, so the
  // reveal does not re-order itself under the player on a re-render -- and so
  // it never mirrors what the TV is showing.
  let phoneOrderKey = null;

  /**
   * Load the current round.
   *
   * @param {Object} round
   * @param {Array}  round.players  [{id, name, initial, color}] -- indexes are what
   *                                answer.owner / answer.matchers point at
   * @param {Array}  round.answers  [{id, text, short, owner, matchers}]
   * @param {string} round.key      identity of the round; the phone order reshuffles
   *                                only when this changes
   */
  function setRound(round) {
    PLAYERS = (round && round.players ? round.players : []).map((p, i) => ({
      id: p.id,
      name: p.name,
      initial: p.initial || String(p.name || '?').trim().charAt(0) || '?',
      color: p.color || COLORS[i % COLORS.length],
    }));
    ANSWERS = (round && round.answers ? round.answers : []).map((a, i) => ({
      id: a.id,
      owner: a.owner,
      text: a.text,
      short: a.short !== undefined ? a.short : a.text,
      doodle: a.doodle || DOODLES[i % DOODLES.length],
      matchers: Array.isArray(a.matchers) ? a.matchers : [],
    }));
    ROTATIONS = ANSWERS.map((_, i) => ROTATION_BASE[i % ROTATION_BASE.length]);

    const key = round && round.key !== undefined ? String(round.key) : null;
    if (key === null || key !== phoneOrderKey || PHONE_ORDER.length !== ANSWERS.length) {
      phoneOrderKey = key;
      PHONE_ORDER = shuffle(ANSWERS.map((_, i) => i));
    }
  }

  window.KybData = {
    COLORS,
    DOODLES,
    setRound,
    players: () => PLAYERS,
    answers: () => ANSWERS,
    phoneOrder: () => PHONE_ORDER,
    rotations: () => ROTATIONS,
    clampPlayers,
    revealTimeline,
    revealDuration,
  };
})();
