import { CharacterDefinition } from './CharacterAnimator';

function buildFrames(direction: 'NE' | 'NW' | 'SE' | 'SW', state: 'idle' | 'run', count: number): string[] {
  return Array.from({ length: count }, (_, i) => `critters/boar/boar_${direction}_${state}_${i}.png`);
}

export const BOAR_CHARACTER: CharacterDefinition = {
  id: 'boar',
  name: 'Boar',
  size: { width: 46, height: 32 },
  anchor: { x: 23, y: 28 },
  states: {
    idle: {
      key: 'idle',
      frameDuration: 0.16,
      frames: {
        ne: buildFrames('NE', 'idle', 7),
        nw: buildFrames('NW', 'idle', 7),
        se: buildFrames('SE', 'idle', 7),
        sw: buildFrames('SW', 'idle', 7),
      },
    },
    run: {
      key: 'run',
      frameDuration: 0.1,
      frames: {
        ne: buildFrames('NE', 'run', 4),
        nw: buildFrames('NW', 'run', 4),
        se: buildFrames('SE', 'run', 4),
        sw: buildFrames('SW', 'run', 4),
      },
    },
  },
};
