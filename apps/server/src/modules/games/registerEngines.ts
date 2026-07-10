import { registerGameEngine } from './engine';
import { mafiaEngine } from './mafia/engine';
import { registerPlaceholder } from './placeholderEngine';
import { triviaEngine } from './trivia/engine';

export function registerEngines(): void {
  registerGameEngine(triviaEngine);
  registerGameEngine(mafiaEngine);
  registerPlaceholder('knows-you-best');
}
