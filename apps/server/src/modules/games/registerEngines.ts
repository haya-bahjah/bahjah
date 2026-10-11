import { registerGameEngine } from './engine';
import { knowsYouBestEngine } from './knowsYouBest/engine';
import { mafiaEngine } from './mafia/engine';
import { saudiHomeEngine } from './saudiHome/engine';
import { triviaEngine } from './trivia/engine';

export function registerEngines(): void {
  registerGameEngine(triviaEngine);
  registerGameEngine(mafiaEngine);
  registerGameEngine(knowsYouBestEngine);
  registerGameEngine(saudiHomeEngine);
}
