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
// The reveal reads one line every 2.6 seconds, on every screen at once.
const REVEAL_LINE_MS = 2600;

interface MalarkeyLine {
  round: number;
  authorId: string;
  // Null when the round closed on an empty draft: drawn as "(ran out of ink)"
  // in the reveal, rather than skipped, so the gap is part of the story.
  text: string | null;
  submittedAt?: number;
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
  // 'write': everyone present is in, and the round closes after a beat.
  closing?: boolean;
  stories: MalarkeyStory[];
  phaseEndsAt?: number;
  roundSeconds?: number;
  revealStory: number;
  revealLine: number;
}

type MalarkeyAction =
  | { type: 'draft'; text: string }
  | { type: 'submit'; text: string }
  // Host: close a writing round now, with whatever is in the drafts.
  | { type: 'advance' }
  // Host: open the next story once the current one has been read.
  | { type: 'next' };

interface ClientLine {
  authorId: string;
  seat: number;
  text: string | null;
}

interface ClientStory {
  seat: number;
  starterId: string;
  lines: ClientLine[];
}

export interface MalarkeyClientView {
  players: Array<{ userId: string; name: string; seat: number }>;
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
  myStory?: number;
  // The last line of the story this viewer has been handed. Never who wrote it.
  prompt?: string | null;
  myDraft?: string;
  mySubmitted?: boolean;
  myText?: string;
  // 'reveal' / 'finished'.
  revealStory?: number;
  revealLine?: number;
  stories?: ClientStory[];
}

function logEvent(event: string, code: string, detail: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ game: 'malarkey', event, room: code, ...detail }));
}

function hostPlaysIn(ctx: GameEngineContext): boolean {
  return ctx.displayMode === 'phone';
}

function seatedMembers(ctx: GameEngineContext, data: MalarkeyData): RoomMemberSummary[] {
  return data.seats
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
// goes in as a missing line.
function closeRound(code: string, data: MalarkeyData): GameEngineResult<MalarkeyData> {
  const stories = data.stories.map((s) => ({ ...s, lines: [...s.lines] }));
  data.seats.forEach((userId, seat) => {
    const story = storyFor(data, seat, data.round);
    const sent = data.submitted.includes(userId);
    const draft = (data.drafts[userId] ?? '').trim();
    stories[story].lines.push({
      round: data.round,
      authorId: userId,
      text: draft ? draft : null,
      ...(sent ? { submittedAt: Date.now() } : {}),
    });
  });
  logEvent('phase_ended', code, { phase: 'write', round: data.round, submitted: data.submitted.length, seats: data.seats.length });
  const next: MalarkeyData = { ...data, stories, drafts: {}, closing: false };

  if (data.round + 1 < data.totalRounds) {
    const phaseEndsAt = Date.now() + PASS_MS;
    return { phase: 'pass', data: { ...next, submitted: [], phaseEndsAt }, nextTickAt: phaseEndsAt };
  }
  return openReveal(code, { ...next, submitted: [] }, 0);
}

function openReveal(code: string, data: MalarkeyData, story: number): GameEngineResult<MalarkeyData> {
  logEvent('phase_started', code, { phase: 'reveal', story });
  const phaseEndsAt = Date.now() + REVEAL_LINE_MS;
  return {
    phase: 'reveal',
    data: { ...data, revealStory: story, revealLine: 0, phaseEndsAt },
    nextTickAt: data.totalRounds > 1 ? phaseEndsAt : undefined,
  };
}

function storyComplete(data: MalarkeyData): boolean {
  return data.revealLine >= data.totalRounds - 1;
}

function maybeClose(ctx: GameEngineContext, data: MalarkeyData): GameEngineResult<MalarkeyData> {
  if (data.closing) return { phase: 'write', data, nextTickAt: data.phaseEndsAt };
  const present = seatedMembers(ctx, data).filter((m) => m.connected);
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

// What the room has heard so far: every story already read, and the current
// one up to the line on screen. Later stories stay sealed until their turn.
function revealedStories(data: MalarkeyData, phase: string): ClientStory[] {
  const upTo = phase === 'finished' ? data.stories.length : data.revealStory + 1;
  return data.stories.slice(0, upTo).map((story, i) => {
    const lines = phase !== 'finished' && i === data.revealStory ? story.lines.slice(0, data.revealLine + 1) : story.lines;
    return {
      seat: story.seat,
      starterId: data.seats[story.seat],
      lines: lines.map((l) => ({ authorId: l.authorId, seat: data.seats.indexOf(l.authorId), text: l.text })),
    };
  });
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
      if (!member.isHost) throw new GameActionError('NOT_HOST', 'Only the host turns the pages.');
      if (phase !== 'reveal') throw new GameActionError('INVALID_PHASE', 'There is no story being read.');
      if (!storyComplete(data)) throw new GameActionError('STORY_UNFOLDING', 'The story is still unfolding.');
      if (data.revealStory + 1 < data.stories.length) return openReveal(ctx.code, data, data.revealStory + 1);
      logEvent('game_completed', ctx.code, { stories: data.stories.length });
      return { phase: 'finished', data: { ...data, phaseEndsAt: undefined } };
    }

    if (type === 'advance') {
      if (!member.isHost) throw new GameActionError('NOT_HOST', 'Only the host can move the room on.');
      if (phase !== 'write') throw new GameActionError('INVALID_PHASE', 'Nobody is writing right now.');
      return closeRound(ctx.code, data);
    }

    if (type !== 'draft' && type !== 'submit') throw new GameActionError('INVALID_ACTION', 'Unknown action.');
    if (!data.seats.includes(userId)) {
      throw new GameActionError('NOT_SEATED', member.isHost ? 'The host runs the big screen and does not write.' : 'You joined after the stories were dealt.');
    }
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
    if (phase === 'write') return closeRound(ctx.code, data);
    if (phase === 'pass') return openRound(ctx.code, data, data.round + 1);
    if (phase === 'reveal') {
      if (storyComplete(data)) return { phase, data };
      const revealLine = data.revealLine + 1;
      const phaseEndsAt = Date.now() + REVEAL_LINE_MS;
      const next = { ...data, revealLine, phaseEndsAt };
      return { phase, data: next, nextTickAt: storyComplete(next) ? undefined : phaseEndsAt };
    }
    return { phase, data };
  },

  // A round ends early once everyone *present* has sent their line, so it is
  // looked at again when somebody's phone drops.
  onPresenceChange(ctx, phase, data) {
    if (phase === 'write') return maybeClose(ctx, data);
    return { phase, data, nextTickAt: data.phaseEndsAt };
  },

  toClientView(ctx, phase, data, viewerUserId): MalarkeyClientView {
    const seat = data.seats.indexOf(viewerUserId);
    const view: MalarkeyClientView = {
      players: data.seats.map((userId, i) => ({ userId, name: data.names[userId] ?? '', seat: i })),
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
    };

    if ((phase === 'write' || phase === 'pass') && seat >= 0) {
      const round = phase === 'pass' ? data.round + 1 : data.round;
      const story = storyFor(data, seat, round);
      view.myStory = story;
      if (round > 0) {
        const lines = data.stories[story].lines;
        view.prompt = lines.length ? lines[lines.length - 1].text : null;
      }
      if (phase === 'write') {
        view.myDraft = data.drafts[viewerUserId] ?? '';
        view.mySubmitted = data.submitted.includes(viewerUserId);
        if (view.mySubmitted) view.myText = data.drafts[viewerUserId];
      }
    }

    if (phase === 'reveal' || phase === 'finished') {
      view.revealStory = data.revealStory;
      view.revealLine = data.revealLine;
      view.stories = revealedStories(data, phase);
    }
    return view;
  },
};
