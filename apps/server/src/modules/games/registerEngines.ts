import { registerGameEngine } from './engine';
import { knowsYouBestEngine } from './knowsYouBest/engine';
import { mafiaEngine } from './mafia/engine';
import { triviaEngine } from './trivia/engine';

export function registerEngines(): void {
  registerGameEngine(triviaEngine);
  registerGameEngine(mafiaEngine);
  registerGameEngine(knowsYouBestEngine);
}
