import { registerGameEngine } from './engine';
import { registerPlaceholder } from './placeholderEngine';
import { triviaEngine } from './trivia/engine';

export function registerEngines(): void {
  registerGameEngine(triviaEngine);
  registerPlaceholder('mafia');
  registerPlaceholder('knows-you-best');
}
