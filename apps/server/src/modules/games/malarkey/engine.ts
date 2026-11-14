import type { RoomMemberSummary } from '@bahjah/shared';
import { GameActionError, tablePlayers, type GameEngine, type GameEngineContext, type GameEngineResult } from '../engine';

// تخاريف (Malarkey) -- collaborative storytelling.
//
// Every player writes the opening line of a story. The stories then rotate:
// each round every player is handed a different story, sees only its last
// line, and writes the next one. With N players there are N stories and N
// rounds -- the opening round, then N - 1 continuations -- so every player
// writes exactly once in every story, the opening line counting as the
// author's turn in their own (the owner's rule). The stories are then read
// out line by line, one at a time, and nothing is scored.

// The owner's timings: 45 seconds for an opening line, 60 for a continuation.
export const OPENING_SECONDS = 45;
export const LINE_SECONDS = 60;
export const MAX_LINE_LENGTH = 250;
// "Everyone's in!" on the phones before the stories move on.
const CLOSING_MS = 1200;
// The "a new story is coming" interstitial between rounds.
const PASS_MS = 2300;
// How long a revealed line stays up before the next one: long enough to read
// it aloud. A short line gets the design's 2.6 seconds; a full 250-character
// line gets about nine.
const REVEAL_MIN_MS = 2600;
const REVEAL_MAX_MS = 9000;
const REVEAL_BASE_MS = 1800;
const REVEAL_PER_CHAR_MS = 30;

export function revealMsFor(text: string | null | undefined): number {
  const len = text ? text.length : 12;
  return Math.max(REVEAL_MIN_MS, Math.min(REVEAL_MAX_MS, REVEAL_BASE_MS + len * REVEAL_PER_CHAR_MS));
}

interface MalarkeyLine {
  round: number;
  authorId: string;
  // Null when the round closed on an empty draft: drawn as "(ran out of ink)"
  // in the reveal, rather than skipped, so the gap is part of the story.
  text: string | null;
  submittedAt?: number;
  // The author had left the game (removed by the host, or gone from the
  // room) and wrote nothing: the turn is left out of the reveal entirely,
  // so a departed player does not pad every story with empty lines.
  dropped?: boolean;
  // The host hid this line during the reveal. Its text is never sent again.
  hidden?: boolean;
}

interface MalarkeyStory {
  // The seat of the player who wrote the opening line.
  seat: number;
  lines: MalarkeyLine[];
}

export interface MalarkeyData {
  // Who plays, frozen at start: userIds in seat order (the room's join
  // order, so every player's ink matches the lobby). Nobody joins mid-game.
  seats: string[];
  // Names as they were at start, so a story still reads right if somebody
  // renames or leaves before the reveal.
  names: Record<string, string>;
  // A random permutation of the seats. Story assignments rotate along it
  // (see storyFor), so who passes to whom is shuffled once per game and is
  // then the same for every round and every reconnect.
  order: number[];
  hostPlays: boolean;
  totalRounds: number;
  round: number;
  // 'write': this round's drafts, by userId. Never sent to anybody but their
  // own writer.
  drafts: Record<string, string>;
  submitted: string[];
  // Players the host took out of the game. They are not waited for, and
  // their empty turns are left out of the reveal.
  removed?: string[];
  // 'write': everyone present is in, and the round closes after a beat.
  closing?: boolean;
  stories: MalarkeyStory[];
  phaseEndsAt?: number;
  roundSeconds?: number;
  revealStory: number;
  // Index into the current story's *visible* lines (dropped turns skipped).
  revealLine: number;
  // 'reveal': the host paused the reading; how long the current line had left.
  revealPaused?: boolean;
  revealRemainingMs?: number;
}

type MalarkeyAction =
  | { type: 'draft'; text: string }
  | { type: 'submit'; text: string }
  // Host: close a writing round now, with whatever is in the drafts.
  | { type: 'advance' }
  // Host: open the next story once the current one has been read.
  | { type: 'next' }
  // Host: pause or resume the reveal.
  | { type: 'pause' }
  // Host: take a player who has left out of the game.
  | { type: 'remove'; userId: string }
  // Host: hide a line from the reveal (and from the stories at the end).
  | { type: 'hide'; story: number; line: number };

interface ClientLine {
  authorId: string;
  seat: number;
  text: string | null;
  hidden?: boolean;
}

interface ClientStory {
  seat: number;
  starterId: string;
  lines: ClientLine[];
  // Lines this story will have once fully read (dropped turns excluded).
  total: number;
}

export interface MalarkeyClientView {
  players: Array<{ userId: string; name: string; seat: number; removed?: boolean }>;
  hostPlays: boolean;
  totalRounds: number;
  round: number;
  roundSeconds?: number;
  phaseEndsAt?: number;
  serverNow: number;
  closing?: boolean;
  submittedUserIds: string[];
  // How many lines each story has, by story index -- counts only, which is
  // all the big screen shows while the stories are growing.
  storyLineCounts: number[];
  // 'write', for a seated viewer.
  seated: boolean;
  removed?: boolean;
  myStory?: number;
  // The last real line of the story this viewer has been handed (a missing
  // turn is skipped over), or null when the story has nothing in it yet.
  // Never who wrote it.
  prompt?: string | null;
  myDraft?: string;
  mySubmitted?: boolean;
  myText?: string;
  // 'reveal' / 'finished'.
  revealStory?: number;
  revealLine?: number;
  revealPaused?: boolean;
  // No story with anything in it comes after this one.
  revealLast?: boolean;
  stories?: ClientStory[];
}

function logEvent(event: string, code: string, detail: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ game: 'malarkey', event, room: code, ...detail }));
}

function hostPlaysIn(ctx: GameEngineContext): boolean {
  return ctx.displayMode === 'phone';
}

function isRemoved(data: MalarkeyData, userId: string): boolean {
  return (data.removed ?? []).includes(userId);
}

// Who the round waits for: seated, still in the room, not taken out by the
// host.
function activeMembers(ctx: GameEngineContext, data: MalarkeyData): RoomMemberSummary[] {
  return data.seats
    .filter((id) => !isRemoved(data, id))
    .map((id) => ctx.members.find((m) => m.userId === id))
    .filter((m): m is RoomMemberSummary => Boolean(m));
}

// Which story the player in `seat` writes in round `round`. Round 0 is their
// own; each round after moves one step along the shuffled order, so in every
// round each story has exactly one writer, nobody ever reads a line they
// wrote, and over N rounds everybody visits every story once.
export function storyFor(data: Pick<MalarkeyData, 'order'>, seat: number, round: number): number {
  const n = data.order.length;
  const pos = data.order.indexOf(seat);
  return data.order[(pos + round) % n];
}

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const visibleLines = (story: MalarkeyStory): MalarkeyLine[] => story.lines.filter((l) => !l.dropped);

function openRound(code: string, data: MalarkeyData, round: number): GameEngineResult<MalarkeyData> {
  const roundSeconds = round === 0 ? OPENING_SECONDS : LINE_SECONDS;
  const phaseEndsAt = Date.now() + roundSeconds * 1000;
  logEvent('phase_started', code, { phase: 'write', round });
  return {
    phase: 'write',
    data: { ...data, round, drafts: {}, submitted: [], closing: false, roundSeconds, phaseEndsAt },
    nextTickAt: phaseEndsAt,
  };
}

// Writes this round's lines into the stories. A submitted line is taken as
// sent; anyone who did not press Send gets their draft, and an empty draft
// goes in as a missing line -- unless its writer has left the game, in which
// case the turn is dropped from the reveal.
function closeRound(ctx: GameEngineContext, data: MalarkeyData): GameEngineResult<MalarkeyData> {
  const stories = data.stories.map((s) => ({ ...s, lines: [...s.lines] }));
  data.seats.forEach((userId, seat) => {
    const story = storyFor(data, seat, data.round);
    const sent = data.submitted.includes(userId);
    const gone = isRemoved(data, userId) || !ctx.members.some((m) => m.userId === userId);
    const draft = sent || !isRemoved(data, userId) ? (data.drafts[userId] ?? '').trim() : '';
    stories[story].lines.push({
      round: data.round,
      authorId: userId,
      text: draft ? draft : null,
      ...(sent ? { submittedAt: Date.now() } : {}),
      ...(!draft && gone ? { dropped: true } : {}),
    });
  });
  logEvent('phase_ended', ctx.code, { phase: 'write', round: data.round, submitted: data.submitted.length, seats: data.seats.length });
  const next: MalarkeyData = { ...data, stories, drafts: {}, closing: false };

  if (data.round + 1 < data.totalRounds) {
    const phaseEndsAt = Date.now() + PASS_MS;
    return { phase: 'pass', data: { ...next, submitted: [], phaseEndsAt }, nextTickAt: phaseEndsAt };
  }
  return openReveal(ctx.code, { ...next, submitted: [] }, 0);
}

// Schedules the next line of the current story, or nothing once it is all
// on screen (the host then opens the next one).
function scheduleLine(data: MalarkeyData): GameEngineResult<MalarkeyData> {
  const lines = visibleLines(data.stories[data.revealStory]);
  if (data.revealLine >= lines.length - 1) {
    return { phase: 'reveal', data: { ...data, phaseEndsAt: undefined, revealPaused: false, revealRemainingMs: undefined } };
  }
  const phaseEndsAt = Date.now() + revealMsFor(lines[data.revealLine]?.text);
  return { phase: 'reveal', data: { ...data, phaseEndsAt, revealPaused: false, revealRemainingMs: undefined }, nextTickAt: phaseEndsAt };
}

// The next story with anything in it, from `from` on, or -1. A story whose
// only writer was taken out before writing has nothing to read.
function nextStoryFrom(data: MalarkeyData, from: number): number {
  for (let i = from; i < data.stories.length; i += 1) if (visibleLines(data.stories[i]).length > 0) return i;
  return -1;
}

function finish(code: string, data: MalarkeyData): GameEngineResult<MalarkeyData> {
  logEvent('game_completed', code, { stories: data.stories.length });
  return { phase: 'finished', data: { ...data, phaseEndsAt: undefined, revealPaused: false } };
}

function openReveal(code: string, data: MalarkeyData, from: number): GameEngineResult<MalarkeyData> {
  const story = nextStoryFrom(data, from);
  if (story < 0) return finish(code, data);
  logEvent('phase_started', code, { phase: 'reveal', story });
  return scheduleLine({ ...data, revealStory: story, revealLine: 0 });
}

function storyComplete(data: MalarkeyData): boolean {
  const story = data.stories[data.revealStory];
  return !story || data.revealLine >= visibleLines(story).length - 1;
}

function maybeClose(ctx: GameEngineContext, data: MalarkeyData): GameEngineResult<MalarkeyData> {
  if (data.closing) return { phase: 'write', data, nextTickAt: data.phaseEndsAt };
  const present = activeMembers(ctx, data).filter((m) => m.connected);
  const everyoneIn = present.length > 0 && present.every((m) => data.submitted.includes(m.userId));
  if (!everyoneIn) return { phase: 'write', data, nextTickAt: data.phaseEndsAt };
  const phaseEndsAt = Math.min(data.phaseEndsAt ?? Infinity, Date.now() + CLOSING_MS);
  return { phase: 'write', data: { ...data, closing: true, phaseEndsAt }, nextTickAt: phaseEndsAt };
}

function cleanText(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_LINE_LENGTH);
}

// The last line of a story that has words in it -- what the next writer is
// shown. A turn that ran out of ink is skipped over, so the next writer
// still has something to go on.
function lastRealLine(story: MalarkeyStory): string | null {
  for (let i = story.lines.length - 1; i >= 0; i -= 1) {
    const line = story.lines[i];
    if (!line.dropped && line.text) return line.text;
  }
  return null;
}

// What the room has heard so far: every story already read, and the current
// one up to the line on screen. Later stories stay sealed until their turn.
function revealedStories(data: MalarkeyData, phase: string): ClientStory[] {
  const upTo = phase === 'finished' ? data.stories.length : data.revealStory + 1;
  return data.stories.slice(0, upTo).map((story, i) => {
    const all = visibleLines(story);
    const lines = phase !== 'finished' && i === data.revealStory ? all.slice(0, data.revealLine + 1) : all;
    return {
      seat: story.seat,
      starterId: data.seats[story.seat],
      total: all.length,
      lines: lines.map((l) => ({
        authorId: l.authorId,
        seat: data.seats.indexOf(l.authorId),
        text: l.hidden ? null : l.text,
        ...(l.hidden ? { hidden: true } : {}),
      })),
    };
  });
}

function requireHost(member: RoomMemberSummary, message: string): void {
  if (!member.isHost) throw new GameActionError('NOT_HOST', message);
}

export const malarkeyEngine: GameEngine<MalarkeyData, MalarkeyAction> = {
  gameType: 'malarkey',

  createInitialState(ctx) {
    const hostPlays = hostPlaysIn(ctx);
    const players = tablePlayers(ctx);
    const seats = players.map((m) => m.userId);
    const data: MalarkeyData = {
      seats,
      names: Object.fromEntries(players.map((m) => [m.userId, m.displayName])),
      order: shuffled(seats.length),
      hostPlays,
      totalRounds: seats.length,
      round: 0,
      drafts: {},
      submitted: [],
      removed: [],
      stories: seats.map((_, seat) => ({ seat, lines: [] })),
      revealStory: 0,
      revealLine: 0,
    };
    logEvent('game_started', ctx.code, { players: seats.length, hostPlays });
    return openRound(ctx.code, data, 0);
  },

  applyAction(ctx, phase, data, userId, action) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (!member) throw new GameActionError('NOT_A_MEMBER', 'You are not in this room.');
    const type = action && typeof action === 'object' ? action.type : undefined;

    if (type === 'next') {
      requireHost(member, 'Only the host turns the pages.');
      if (phase !== 'reveal') throw new GameActionError('INVALID_PHASE', 'There is no story being read.');
      if (!storyComplete(data)) throw new GameActionError('STORY_UNFOLDING', 'The story is still unfolding.');
      return openReveal(ctx.code, data, data.revealStory + 1);
    }

    if (type === 'pause') {
      requireHost(member, 'Only the host can pause the reading.');
      if (phase !== 'reveal') throw new GameActionError('INVALID_PHASE', 'There is no story being read.');
      if (data.revealPaused) {
        const phaseEndsAt = Date.now() + Math.max(800, data.revealRemainingMs ?? REVEAL_MIN_MS);
        return { phase, data: { ...data, revealPaused: false, revealRemainingMs: undefined, phaseEndsAt }, nextTickAt: phaseEndsAt };
      }
      if (storyComplete(data)) return { phase, data };
      const revealRemainingMs = Math.max(0, (data.phaseEndsAt ?? Date.now()) - Date.now());
      return { phase, data: { ...data, revealPaused: true, revealRemainingMs, phaseEndsAt: undefined } };
    }

    if (type === 'hide') {
      requireHost(member, 'Only the host can hide a line.');
      if (phase !== 'reveal' && phase !== 'finished') throw new GameActionError('INVALID_PHASE', 'There is nothing to hide yet.');
      const { story: si, line: li } = action as { story: number; line: number };
      const story = data.stories[si];
      const target = story ? visibleLines(story)[li] : undefined;
      // Only lines the room has already seen can be hidden -- the host does
      // not get to read ahead.
      const shown = phase === 'finished' || si < data.revealStory || (si === data.revealStory && li <= data.revealLine);
      if (!target || !shown) throw new GameActionError('INVALID_ACTION', 'That line is not on the screen.');
      const stories = data.stories.map((s, i) =>
        i !== si ? s : { ...s, lines: s.lines.map((l) => (l === target ? { ...l, hidden: true } : l)) }
      );
      return { phase, data: { ...data, stories }, nextTickAt: data.revealPaused ? undefined : data.phaseEndsAt };
    }

    if (type === 'remove') {
      requireHost(member, 'Only the host can take a player out of the game.');
      if (phase !== 'write' && phase !== 'pass') throw new GameActionError('INVALID_PHASE', 'Players can only be taken out while the stories are being written.');
      const target = String((action as { userId?: unknown }).userId ?? '');
      if (!data.seats.includes(target)) throw new GameActionError('INVALID_ACTION', 'That player is not in this game.');
      if (target === userId) throw new GameActionError('INVALID_ACTION', 'You cannot take yourself out.');
      if (isRemoved(data, target)) return { phase, data, nextTickAt: data.phaseEndsAt };
      if (activeMembers(ctx, data).filter((m) => m.userId !== target).length < 2) {
        throw new GameActionError('INVALID_ACTION', 'A story needs at least two writers.');
      }
      logEvent('player_removed', ctx.code, {});
      const next = { ...data, removed: [...(data.removed ?? []), target] };
      if (phase === 'write') return maybeClose(ctx, next);
      return { phase, data: next, nextTickAt: data.phaseEndsAt };
    }

    if (type === 'advance') {
      requireHost(member, 'Only the host can move the room on.');
      if (phase !== 'write') throw new GameActionError('INVALID_PHASE', 'Nobody is writing right now.');
      return closeRound(ctx, data);
    }

    if (type !== 'draft' && type !== 'submit') throw new GameActionError('INVALID_ACTION', 'Unknown action.');
    if (!data.seats.includes(userId)) {
      throw new GameActionError('NOT_SEATED', member.isHost ? 'The host runs the big screen and does not write.' : 'You joined after the stories were dealt.');
    }
    if (isRemoved(data, userId)) throw new GameActionError('REMOVED', 'The host took you out of this game.');
    if (phase !== 'write') throw new GameActionError('INVALID_PHASE', 'Writing is closed.');
    if (data.submitted.includes(userId)) {
      // Idempotent per (player, round): a double tap or a retry after a blip
      // changes nothing.
      if (type === 'draft') return { phase, data, nextTickAt: data.phaseEndsAt };
      throw new GameActionError('ALREADY_SUBMITTED', 'Your line is already in.');
    }
    if (data.closing) throw new GameActionError('INVALID_PHASE', 'Writing is closed.');
    // A late action from a phone whose clock ran slow: the server's deadline
    // stands, and the tick about to fire uses the draft already saved.
    if (data.phaseEndsAt && Date.now() > data.phaseEndsAt + 250) {
      throw new GameActionError('ROUND_LOCKED', 'Time is up for this round.');
    }

    const text = cleanText((action as { text?: unknown }).text);
    if (type === 'draft') {
      return { phase, data: { ...data, drafts: { ...data.drafts, [userId]: text } }, nextTickAt: data.phaseEndsAt };
    }
    if (!text.trim()) throw new GameActionError('EMPTY_LINE', 'Write something first.');
    logEvent('submission_received', ctx.code, { round: data.round });
    return maybeClose(ctx, { ...data, drafts: { ...data.drafts, [userId]: text }, submitted: [...data.submitted, userId] });
  },

  tick(ctx, phase, data) {
    if (phase === 'write') return closeRound(ctx, data);
    if (phase === 'pass') return openRound(ctx.code, data, data.round + 1);
    if (phase === 'reveal') {
      if (data.revealPaused || storyComplete(data)) return { phase, data };
      return scheduleLine({ ...data, revealLine: data.revealLine + 1 });
    }
    return { phase, data };
  },

  // A round ends early once everyone *present* has sent their line, so it is
  // looked at again when somebody's phone drops.
  onPresenceChange(ctx, phase, data) {
    if (phase === 'write') return maybeClose(ctx, data);
    return { phase, data, nextTickAt: data.revealPaused ? undefined : data.phaseEndsAt };
  },

  toClientView(ctx, phase, data, viewerUserId): MalarkeyClientView {
    const seat = data.seats.indexOf(viewerUserId);
    const removed = isRemoved(data, viewerUserId);
    const view: MalarkeyClientView = {
      players: data.seats.map((userId, i) => ({
        userId,
        name: data.names[userId] ?? '',
        seat: i,
        ...(isRemoved(data, userId) ? { removed: true } : {}),
      })),
      hostPlays: data.hostPlays,
      totalRounds: data.totalRounds,
      round: data.round,
      roundSeconds: data.roundSeconds,
      phaseEndsAt: data.phaseEndsAt,
      serverNow: Date.now(),
      closing: data.closing,
      submittedUserIds: phase === 'write' ? data.submitted : [],
      storyLineCounts: data.stories.map((s) => s.lines.length),
      seated: seat >= 0,
      ...(removed ? { removed: true } : {}),
    };

    if ((phase === 'write' || phase === 'pass') && seat >= 0 && !removed) {
      const round = phase === 'pass' ? data.round + 1 : data.round;
      const story = storyFor(data, seat, round);
      view.myStory = story;
      if (round > 0) view.prompt = lastRealLine(data.stories[story]);
      if (phase === 'write') {
        view.myDraft = data.drafts[viewerUserId] ?? '';
        view.mySubmitted = data.submitted.includes(viewerUserId);
        if (view.mySubmitted) view.myText = data.drafts[viewerUserId];
      }
    }

    if (phase === 'reveal' || phase === 'finished') {
      view.revealStory = data.revealStory;
      view.revealLine = data.revealLine;
      view.revealPaused = Boolean(data.revealPaused);
      view.revealLast = nextStoryFrom(data, data.revealStory + 1) < 0;
      view.stories = revealedStories(data, phase);
    }
    return view;
  },
};
