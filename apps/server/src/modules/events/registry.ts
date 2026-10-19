import type { GameType } from '@bahjah/shared';

// Private event games: a game opened from a link handed out for one event,
// with that event's own questions and none of the bank's.
//
// Two games run as events. A Knows You Best event lists its prompts here. A
// Welcome to a Saudi Home event (gameType 'saudi-home') plays that game's own
// content bank (games/saudiHome/content.ts) -- the game exists only as an
// event; its public way in, Hayakom, is itself an event (the last one below).
//
// The link is the only way in. Whoever opens it gets a room of their own --
// several groups at one event can each run a game at the same time -- and that
// room is stamped with the event's id (Room.eventId), which is what the rest of
// the server reads to give it the event's rules:
//
//   - its questions, played in the order written here, one per round
//     (knowsYouBest/config.ts resolveKnowsYouBestPool);
//   - its player limit, in place of the game's usual one
//     (rooms/service.ts roomPlayerLimits);
//   - a free start: nobody needs a Day Pass to begin or replay it
//     (rooms/service.ts assertHostMayStart).
//
// The link key is the secret. It is not listed anywhere on the site, and
// removing an event from EVENTS turns its link off; rooms already open keep
// running under the ordinary rules from then on.
export interface GameEvent {
  id: string;
  // The last path segment of the private link: bahjah.com/event/<linkKey>.
  linkKey: string;
  gameType: GameType;
  // Shown on the event's landing page and the lobby.
  title: { en: string; ar: string };
  // Overrides GAME_PLAYER_LIMITS[gameType].max for the event's rooms.
  maxPlayers: number;
  // The language every screen of the event's rooms is shown in.
  lang: 'en' | 'ar';
  // Knows You Best only: the event's prompts, in play order, one per round.
  prompts?: string[];
  // Knows You Best only: play it as an ice breaker rather than a game. There
  // is no matching and nothing is scored -- each round, once every answer is
  // in, the screen reveals them one at a time with their authors' names, so
  // the room gets to know each other (knowsYouBest/engine.ts resolveAnswering).
  icebreaker?: boolean;
}

const EVENTS: GameEvent[] = [
  {
    id: 'ucl-meet-greet',
    linkKey: 'ucl-v2KEzNw9iIUV',
    gameType: 'knows-you-best',
    title: { en: 'UCL Meet & Greet', ar: 'لقاء طلاب UCL' },
    maxPlayers: 40,
    lang: 'ar',
    icebreaker: true,
    prompts: [
      'ايش هو تخصصك الحالي؟',
      'أنت بأي سنة دراسية؟ (تحضيري، سنة أولى، سنة ثانية، إلخ).',
      'إيش الوظيفة اللي تحلم فيها؟',
      'إيش أكلك المفضل؟',
      'مين مغنيك المفضل؟',
      'من وين أنت بالسعودية؟',
      'ايش هي المقولة المفضلة بالنسبة لك؟',
      'ايش أبرز إنجاز تفتخر به؟',
      'ايش تجربة جديدة ودك تعيشها؟',
      'أكثر هدف ودك تحققه هذه السنة؟',
    ],
  },
  {
    // October 14, 2026. Stays live until it is taken out of this list.
    id: 'saudi-home-oct14',
    linkKey: 'saudi-home-Rk7pQ2vXm9Ld',
    gameType: 'saudi-home',
    title: { en: 'Welcome to a Saudi Home', ar: 'حياكم في بيت سعودي' },
    maxPlayers: 12,
    lang: 'en',
  },
  {
    // Hayakom: the same game, open to everyone from its page in the games
    // suite (hayakom.html). The one event whose link is public on purpose --
    // anyone can open the door, so it carries the event rules with it: free
    // to start, no account needed, twelve players.
    id: 'hayakom',
    linkKey: 'hayakom',
    gameType: 'saudi-home',
    title: { en: 'Hayakom', ar: 'حياكم' },
    maxPlayers: 12,
    lang: 'en',
  },
];

export function getEventByLinkKey(linkKey: string): GameEvent | null {
  return EVENTS.find((e) => e.linkKey === linkKey) ?? null;
}

export function getEventById(id: string | null | undefined): GameEvent | null {
  if (!id) return null;
  return EVENTS.find((e) => e.id === id) ?? null;
}
