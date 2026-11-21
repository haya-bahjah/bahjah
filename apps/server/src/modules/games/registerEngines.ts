import { auctionEngine } from './auction/engine';
import { registerGameEngine } from './engine';
import { ihjEngine } from './ihj/engine';
import { fabricationEngine } from './fabrication/engine';
import { knowsYouBestEngine } from './knowsYouBest/engine';
import { mafiaEngine } from './mafia/engine';
import { malarkeyEngine } from './malarkey/engine';
import { forOrAgainstEngine } from './forOrAgainst/engine';
import { saudiHomeEngine } from './saudiHome/engine';
import { triviaEngine } from './trivia/engine';

export function registerEngines(): void {
  registerGameEngine(triviaEngine);
  registerGameEngine(mafiaEngine);
  registerGameEngine(knowsYouBestEngine);
  registerGameEngine(fabricationEngine);
  registerGameEngine(auctionEngine);
  registerGameEngine(ihjEngine);
  registerGameEngine(saudiHomeEngine);
  registerGameEngine(malarkeyEngine);
  registerGameEngine(forOrAgainstEngine);
}
