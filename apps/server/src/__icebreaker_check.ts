import { knowsYouBestEngine as e } from './modules/games/knowsYouBest/engine';
const members: any[] = ['host','a','b','c'].map((id) => ({ userId: id, displayName: id, isHost: id==='host', connected: true, isBot: false }));
const ctx: any = { members, displayMode: 'tv', controllerId: 'host', config: { config: { totalRounds: 2, categories: ['x'] }, pool: [
  { id: 'p1', category: 'x', text: 'Q1' }, { id: 'p2', category: 'x', text: 'Q2' }], fixedOrder: true, icebreaker: true } };
let r: any = e.createInitialState(ctx);
console.log(r.phase, r.data.icebreaker);
for (const u of ['a','b','c']) r = e.applyAction(ctx, r.phase, r.data, u, { type: 'answer', text: 'ans-' + u });
console.log(r.phase, JSON.stringify(r.data.lastRoundReveal));
console.log(JSON.stringify(e.toClientView(ctx, r.phase, r.data, 'host')).slice(0, 200));
r = e.applyAction(ctx, r.phase, r.data, 'host', { type: 'advance', roundIndex: 0, phase: 'reveal' });
console.log(r.phase, r.data.roundIndex);
r = e.applyAction(ctx, r.phase, r.data, 'host', { type: 'advance' });
console.log(r.phase, r.data.lastRoundReveal.length);
r = e.applyAction(ctx, r.phase, r.data, 'host', { type: 'advance', roundIndex: 1, phase: 'reveal' });
console.log(r.phase, JSON.stringify(e.getFinalResults(r.data)));
