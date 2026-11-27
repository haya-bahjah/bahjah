import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';
import { isScored, type Question } from './model';
import { pointsFor, type AnswerValue } from './scoring';
import { clearSession, getSession, type SessionConfig } from './session';

// مجلسك (Your Gatherings) -- a host's own party quiz, played together.
//
// The host moves everybody at once: a question opens, guests answer on their
// phones (one locked-in answer each), the question locks when its timer runs
// out or everyone has answered, the host reveals it, then moves on. Guests
// arriving late play from the question in front of everyone. Formats:
// multiple choice, textbox, checklist (pick all that apply), match and photo.
//
// Phases: question -> locked -> reveal, for each question, then final.
//
// "Host plays too" seats the host like a guest -- they answer, and their
// answers appear in the results -- but they are never ranked: they wrote the
// quiz.

const ALL_IN_GRACE_MS = 900;

interface Answer {
  value: AnswerValue;
  // Server time it arrived, and how long the clock still had (timed questions).
  at: number;
  remainingMs: number | null;
}

interface QuestionResult {
  questionId: string;
  skipped?: boolean;
  answers: Record<string, { value: AnswerValue; correct: boolean; points: number }>;
}

export interface MajlisakData extends Omit<SessionConfig, 'questions'> {
  questions: Question[];
  hostId: string;
  names: Record<string, string>;
  removed: string[];
  index: number;
  // Match: the order the right-hand items are shown in, per question.
  shuffles: Record<string, number[]>;
  phaseEndsAt?: number;
  paused?: boolean;
  remainingMs?: number;
  closing?: boolean;
  answers: Record<string, Answer>;
  results: QuestionResult[];
  scores: Record<string, number>;
  endedEarly?: boolean;
}

type Action =
  | { type: 'answer'; value: unknown }
  | { type: 'pause' }
  | { type: 'lock' }
  | { type: 'reveal' }
  | { type: 'next' }
  | { type: 'skip' }
  | { type: 'endGame' }
  | { type: 'remove'; userId: string };

function logEvent(event: string, code: string, detail: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ game: 'majlisak', event, room: code, ...detail }));
}

const keep = (phase: string, data: MajlisakData): GameEngineResult<MajlisakData> => ({ phase, data, nextTickAt: data.paused ? undefined : data.phaseEndsAt });

// Who is playing right now: every guest still in the room (and the host, when
// they play), minus anyone the host took out. Late arrivals count from the
// moment they join.
function players(ctx: GameEngineContext, data: MajlisakData): RoomMemberSummary[] {
  return ctx.members.filter((m) => !m.isBot && !data.removed.includes(m.userId) && (!m.isHost || data.hostPlays));
}
const present = (ctx: GameEngineContext, data: MajlisakData) => players(ctx, data).filter((m) => m.connected);
// Ranked players: never the host.
const rankable = (ctx: GameEngineContext, data: MajlisakData) => players(ctx, data).filter((m) => m.userId !== data.hostId);

function seeded(n: number, seed: string): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  for (let i = n - 1; i > 0; i -= 1) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Never show the pairs already lined up.
  if (n > 1 && order.every((v, i) => v === i)) order.push(order.shift()!);
  return order;
}

function openQuestion(code: string, data: MajlisakData, index: number): GameEngineResult<MajlisakData> {
  if (index >= data.questions.length) return finish(code, data, false);
  const q = data.questions[index];
  const phaseEndsAt = q.timerSec ? Date.now() + q.timerSec * 1000 : undefined;
  logEvent('phase_started', code, { phase: 'question', index, format: q.format });
  return { phase: 'question', data: { ...data, index, answers: {}, phaseEndsAt, paused: false, remainingMs: undefined, closing: false }, nextTickAt: phaseEndsAt };
}

function lock(code: string, data: MajlisakData): GameEngineResult<MajlisakData> {
  logEvent('phase_ended', code, { phase: 'question', index: data.index, answers: Object.keys(data.answers).length });
  return { phase: 'locked', data: { ...data, phaseEndsAt: undefined, paused: false, remainingMs: undefined, closing: false } };
}

// Scores the question once, at the reveal.
function reveal(code: string, data: MajlisakData): GameEngineResult<MajlisakData> {
  const q = data.questions[data.index];
  const scored = isScored(q);
  const answers: QuestionResult['answers'] = {};
  const scores = { ...data.scores };
  for (const [userId, a] of Object.entries(data.answers)) {
    if (data.removed.includes(userId)) continue;
    const r = pointsFor(q, a.value, a.remainingMs, scored);
    answers[userId] = { value: a.value, correct: r.correct, points: r.points };
    if (r.points) scores[userId] = (scores[userId] ?? 0) + r.points;
  }
  logEvent('score_awarded', code, { index: data.index, scored, right: Object.values(answers).filter((a) => a.correct).length });
  const results = [...data.results.filter((r) => r.questionId !== q.id), { questionId: q.id, answers }];
  return { phase: 'reveal', data: { ...data, scores, results, phaseEndsAt: undefined, paused: false, closing: false } };
}

function finish(code: string, data: MajlisakData, early: boolean): GameEngineResult<MajlisakData> {
  logEvent('game_completed', code, { answered: data.results.length, early });
  return { phase: 'final', data: { ...data, phaseEndsAt: undefined, paused: false, closing: false, endedEarly: early } };
}

// Everyone here has answered: lock after a short beat.
function maybeClose(ctx: GameEngineContext, data: MajlisakData): GameEngineResult<MajlisakData> {
  if (data.closing) return keep('question', data);
  const here = present(ctx, data);
  if (!here.length || !here.every((m) => data.answers[m.userId])) return keep('question', data);
  const phaseEndsAt = Date.now() + ALL_IN_GRACE_MS;
  return { phase: 'question', data: { ...data, closing: true, paused: false, remainingMs: undefined, phaseEndsAt }, nextTickAt: phaseEndsAt };
}

// Checks an answer has the shape its question's format needs.
function parseAnswer(q: Question, raw: unknown): AnswerValue {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bad = () => new GameActionError('INVALID_ACTION', 'That answer does not fit this question.');
  switch (q.format) {
    case 'mc': {
      const c = Number(v.choice);
      if (!Number.isInteger(c) || c < 0 || c >= q.options.length) throw bad();
      return { choice: c };
    }
    case 'checklist': {
      if (!Array.isArray(v.choices)) throw bad();
      const set = [...new Set(v.choices.map(Number))];
      if (!set.length || set.some((c) => !Number.isInteger(c) || c < 0 || c >= q.options.length)) throw bad();
      return { choices: set.sort((a, b) => a - b) };
    }
    case 'match': {
      if (!Array.isArray(v.pairs) || v.pairs.length !== q.pairs.length) throw bad();
      const pairs = v.pairs.map(Number);
      if (pairs.some((c) => !Number.isInteger(c) || c < 0 || c >= q.pairs.length) || new Set(pairs).size !== pairs.length) throw bad();
      return { pairs };
    }
    case 'text': {
      const text = String(v.text ?? '').trim().replace(/\s+/g, ' ');
      if (!text) throw new GameActionError('INVALID_ACTION', 'Write something first.');
      if (text.length > q.maxLength) throw new GameActionError('INVALID_ACTION', `Keep it under ${q.maxLength} characters.`);
      if (/[\u0000-\u0008\u000B-\u001F\u007F]/.test(text)) throw bad();
      return { text };
    }
    case 'photo': {
      const photoId = String(v.photoId ?? '');
      if (!/^[0-9a-f-]{36}$/.test(photoId)) throw bad();
      return { photoId };
    }
    default:
      throw bad();
  }
}

export const majlisakEngine: GameEngine<MajlisakData, Action> = {
  gameType: 'majlisak',

  async loadConfig(code) {
    return getSession(code);
  },

  createInitialState(ctx) {
    const config = ctx.config as SessionConfig | null | undefined;
    if (!config || !config.questions || !config.questions.length) throw new GameActionError('NOT_LAUNCHED', 'Launch this game from مجلسك first.');
    const host = ctx.members.find((m) => m.isHost);
    const data: MajlisakData = {
      ...config,
      hostId: host ? host.userId : '',
      names: Object.fromEntries(ctx.members.map((m) => [m.userId, m.displayName])),
      removed: [],
      index: 0,
      shuffles: Object.fromEntries(config.questions.filter((q) => q.format === 'match').map((q) => [q.id, seeded(q.pairs.length, q.id)])),
      answers: {},
      results: [],
      scores: {},
    };
    logEvent('game_started', ctx.code, { questions: config.questions.length, players: players(ctx, data).length, hostPlays: config.hostPlays });
    return openQuestion(ctx.code, data, 0);
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (!member) throw new GameActionError('NOT_A_MEMBER', 'You are not in this room.');
    const type = action && typeof action === 'object' ? action.type : undefined;

    if (type === 'answer') {
      if (member.isHost && !data.hostPlays) throw new GameActionError('NOT_SEATED', 'The host runs the game and does not answer.');
      if (data.removed.includes(userId)) throw new GameActionError('REMOVED', 'The host took you out of this game.');
      if (phase !== 'question' || data.closing) throw new GameActionError('ROUND_LOCKED', 'Answers are locked for this question.');
      if (data.answers[userId]) throw new GameActionError('ALREADY_ANSWERED', 'Your answer is already locked in.');
      const q = data.questions[data.index];
      let value = parseAnswer(q, (action as { value?: unknown }).value);
      // Match answers come in the shown (shuffled) order; store them in the
      // question's own order.
      if (q.format === 'match' && 'pairs' in value) {
        const order = data.shuffles[q.id] ?? q.pairs.map((_, i) => i);
        value = { pairs: value.pairs.map((shown) => order[shown]) };
      }
      const remainingMs = q.timerSec ? (data.paused ? data.remainingMs ?? 0 : Math.max(0, (data.phaseEndsAt ?? Date.now()) - Date.now())) : null;
      const names = data.names[userId] ? data.names : { ...data.names, [userId]: member.displayName };
      logEvent('submission_received', ctx.code, { index: data.index, format: q.format });
      return maybeClose(ctx, { ...data, names, answers: { ...data.answers, [userId]: { value, at: Date.now(), remainingMs } } });
    }

    if (!member.isHost) throw new GameActionError('NOT_HOST', 'Only the host can do that.');

    switch (type) {
      case 'pause': {
        if (phase !== 'question' || !data.questions[data.index].timerSec || data.closing) throw new GameActionError('INVALID_PHASE', 'There is no clock running.');
        if (data.paused) {
          const phaseEndsAt = Date.now() + Math.max(500, data.remainingMs ?? 0);
          return { phase, data: { ...data, paused: false, remainingMs: undefined, phaseEndsAt }, nextTickAt: phaseEndsAt };
        }
        return { phase, data: { ...data, paused: true, remainingMs: Math.max(0, (data.phaseEndsAt ?? Date.now()) - Date.now()), phaseEndsAt: undefined } };
      }
      case 'lock':
        if (phase !== 'question') throw new GameActionError('INVALID_PHASE', 'No question is open.');
        return lock(ctx.code, data);
      case 'reveal':
        if (phase !== 'question' && phase !== 'locked') throw new GameActionError('INVALID_PHASE', 'There is nothing to reveal.');
        return reveal(ctx.code, data);
      case 'next':
        if (phase !== 'reveal') throw new GameActionError('INVALID_PHASE', 'Reveal this question first.');
        return openQuestion(ctx.code, data, data.index + 1);
      case 'skip': {
        if (phase !== 'question' && phase !== 'locked') throw new GameActionError('INVALID_PHASE', 'Nothing to skip.');
        const q = data.questions[data.index];
        logEvent('question_skipped', ctx.code, { index: data.index });
        return openQuestion(ctx.code, { ...data, results: [...data.results, { questionId: q.id, skipped: true, answers: {} }] }, data.index + 1);
      }
      case 'endGame':
        if (phase === 'final') return keep(phase, data);
        return finish(ctx.code, data, true);
      case 'remove': {
        const target = String((action as { userId?: unknown }).userId ?? '');
        if (target === userId) throw new GameActionError('INVALID_ACTION', 'You cannot remove yourself.');
        if (!ctx.members.some((m) => m.userId === target) && !data.names[target]) throw new GameActionError('INVALID_ACTION', 'That player is not in this game.');
        if (data.removed.includes(target)) return keep(phase, data);
        const answers = { ...data.answers };
        delete answers[target];
        const next = { ...data, removed: [...data.removed, target], answers };
        return phase === 'question' ? maybeClose(ctx, next) : keep(phase, next);
      }
      default:
        throw new GameActionError('INVALID_ACTION', 'Unknown action.');
    }
  },

  tick(ctx, phase, data) {
    if (phase === 'question' && !data.paused) return lock(ctx.code, data);
    return keep(phase, data);
  },

  onPresenceChange(ctx, phase, data) {
    if (phase === 'question') return maybeClose(ctx, data);
    return keep(phase, data);
  },

  async cleanup(code) {
    await clearSession(code);
  },

  toClientView(ctx, phase, data, viewer) {
    const isHost = viewer === data.hostId;
    const q = data.questions[data.index];
    const scoredGame = data.questions.some(isScored);
    const ps = players(ctx, data);
    const answeredIds = Object.keys(data.answers).filter((id) => !data.removed.includes(id));
    const view: Record<string, unknown> = {
      serverNow: Date.now(),
      title: data.title,
      honoree: data.honoree,
      occasion: data.occasion,
      language: data.language,
      themeId: data.themeId,
      themeImageId: data.themeImageId,
      hostPlays: data.hostPlays,
      isHost,
      seated: !data.removed.includes(viewer) && (viewer !== data.hostId || data.hostPlays),
      removed: data.removed.includes(viewer),
      index: data.index,
      total: data.questions.length,
      scoredGame,
      players: ps.map((m) => ({ userId: m.userId, name: m.displayName, avatar: m.avatar, connected: m.connected, isHost: m.isHost })),
      scores: data.scores,
      phaseEndsAt: data.phaseEndsAt,
      paused: Boolean(data.paused),
      remainingMs: data.remainingMs,
      closing: Boolean(data.closing),
      answeredCount: answeredIds.length,
      playerCount: ps.length,
    };
    if (q && phase !== 'final') {
      const order = data.shuffles[q.id];
      // The question as guests see it: never which answer is right before the
      // reveal, and the match column shuffled.
      view.question = {
        id: q.id,
        format: q.format,
        prompt: q.prompt,
        options: q.options,
        lefts: q.format === 'match' ? q.pairs.map((p) => p.left) : [],
        rights: q.format === 'match' && order ? order.map((i) => q.pairs[i].right) : [],
        maxLength: q.maxLength,
        scored: isScored(q),
        points: q.points,
        timerSec: q.timerSec,
      };
      const mine = data.answers[viewer];
      // Match answers are stored in the question's own order; the phone
      // shows the right column shuffled, so send them back in that order.
      const shownOrder = (v: AnswerValue): AnswerValue => (q.format === 'match' && order && 'pairs' in v ? { pairs: v.pairs.map((orig) => order.indexOf(orig)) } : v);
      view.myAnswer = mine ? shownOrder(mine.value) : null;
      if (isHost) view.answeredIds = answeredIds;
      if (phase === 'reveal') {
        const res = data.results.find((r) => r.questionId === q.id);
        const counts = q.options.map(() => 0);
        for (const a of Object.values(res?.answers ?? {})) {
          if ('choice' in a.value) counts[a.value.choice] += 1;
          if ('choices' in a.value) for (const c of a.value.choices) counts[c] += 1;
        }
        view.reveal = {
          correct: q.correct,
          pairs: q.format === 'match' ? q.pairs : [],
          accepted: q.format === 'text' && isScored(q) ? q.accepted : [],
          counts,
          answered: Object.keys(res?.answers ?? {}).length,
          right: Object.values(res?.answers ?? {}).filter((a) => a.correct).length,
        };
        const my = res?.answers[viewer];
        view.myResult = my ? { correct: my.correct, points: my.points } : null;
      }
    }
    // The host's panel loads photo answers through its own album.
    if (isHost) view.gameId = data.gameId;
    if (phase === 'final') {
      const ranked = rankable(ctx, data)
        .map((m) => ({ userId: m.userId, name: m.displayName, avatar: m.avatar, score: data.scores[m.userId] ?? 0 }))
        .sort((a, b) => b.score - a.score);
      view.ranking = ranked.map((r) => ({ ...r, rank: ranked.filter((x) => x.score > r.score).length + 1 }));
      view.endedEarly = Boolean(data.endedEarly);
      // Submitted / unanswered / unscored, per question, for everyone.
      view.summary = data.questions.map((qq) => {
        const r = data.results.find((x) => x.questionId === qq.id);
        const submitted = r ? Object.keys(r.answers).length : 0;
        return { id: qq.id, prompt: qq.prompt, format: qq.format, scored: isScored(qq), skipped: Boolean(r?.skipped), played: Boolean(r), submitted, unanswered: r && !r.skipped ? Math.max(0, ps.length - submitted) : 0 };
      });
      view.mySolved = data.results.filter((r) => r.answers[viewer]?.correct).length;
      // The host's Answers tab: every answer, by question. Never sent to guests.
      if (isHost) {
        view.answersTable = data.questions.map((qq) => {
          const r = data.results.find((x) => x.questionId === qq.id);
          return {
            id: qq.id,
            prompt: qq.prompt,
            format: qq.format,
            options: qq.options,
            pairs: qq.pairs,
            skipped: Boolean(r?.skipped),
            answers: Object.entries(r?.answers ?? {}).map(([userId, a]) => ({ userId, name: data.names[userId] ?? '', value: a.value, correct: a.correct, points: a.points })),
          };
        });
      }
    }
    return view;
  },

  getFinalResults(data) {
    const ids = Object.keys(data.names).filter((id) => id !== data.hostId && !data.removed.includes(id));
    const top = Math.max(0, ...ids.map((id) => data.scores[id] ?? 0));
    return ids.map((userId) => ({ userId, score: data.scores[userId] ?? 0, isWinner: top > 0 && (data.scores[userId] ?? 0) === top }));
  },
};
