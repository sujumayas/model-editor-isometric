import { Level } from '../level/Level';
import { GridCoord, TileBehavior } from '../core/types';

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  phase: 1 | 2;
  build(): Level;
}

const FLOOR_TILE = 0;
const BLOCKER_TILE = 60;

function buildBaseLevel(name: string, width: number, height: number): Level {
  const level = Level.createDefault(name, { width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      level.setTile('terrain', { x, y }, { tileId: FLOOR_TILE });
    }
  }
  return level;
}

function applyBehavior(level: Level, coord: GridCoord, behavior: TileBehavior): void {
  level.setTileBehavior(coord, behavior);
}

function placeBlockers(level: Level, coords: GridCoord[]): void {
  coords.forEach((coord) => {
    level.setTileBehavior(coord, { type: 'blocker' });
    level.setTile('terrain', coord, { tileId: BLOCKER_TILE });
  });
}

function placeBehaviors(level: Level, coords: GridCoord[], behavior: TileBehavior): void {
  coords.forEach((coord) => level.setTileBehavior(coord, behavior));
}

function buildSlowPath(): Level {
  const level = buildBaseLevel('Test Map 1: Slow Path', 8, 6);
  applyBehavior(level, { x: 1, y: 5 }, { type: 'spawn' });
  applyBehavior(level, { x: 6, y: 0 }, { type: 'exit' });

  placeBlockers(level, [
    { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 },
    { x: 5, y: 3 }, { x: 5, y: 1 }, { x: 5, y: 0 },
  ]);

  placeBehaviors(level, [
    { x: 1, y: 4 },
    { x: 2, y: 4 },
    { x: 3, y: 4 },
    { x: 4, y: 3 },
    { x: 4, y: 2 },
    { x: 5, y: 2 },
    { x: 6, y: 2 },
    { x: 6, y: 1 },
  ], { type: 'slow' });

  return level;
}

function buildHoleMaze(): Level {
  const level = buildBaseLevel('Test Map 2: Hole Maze', 10, 8);
  applyBehavior(level, { x: 1, y: 7 }, { type: 'spawn' });
  applyBehavior(level, { x: 8, y: 1 }, { type: 'exit' });

  placeBlockers(level, [
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 },
    { x: 6, y: 4 }, { x: 7, y: 4 }, { x: 8, y: 4 }, { x: 9, y: 4 },
    { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 },
  ]);

  placeBehaviors(level, [
    { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 },
    { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 3 },
    { x: 7, y: 2 }, { x: 5, y: 1 },
  ], { type: 'hole' });

  return level;
}

function buildConveyorPuzzle(): Level {
  const level = buildBaseLevel('Test Map 3: Conveyor Loop', 8, 8);
  applyBehavior(level, { x: 1, y: 6 }, { type: 'spawn' });
  applyBehavior(level, { x: 6, y: 1 }, { type: 'exit' });

  placeBlockers(level, [
    { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 3 }, { x: 4, y: 4 },
    { x: 2, y: 1 }, { x: 5, y: 6 },
  ]);

  placeBehaviors(level, [
    { x: 1, y: 5 },
    { x: 2, y: 5 },
    { x: 3, y: 5 },
  ], { type: 'conveyor', direction: 'east' });

  placeBehaviors(level, [
    { x: 4, y: 5 },
    { x: 5, y: 5 },
  ], { type: 'conveyor', direction: 'north' });

  placeBehaviors(level, [
    { x: 5, y: 4 },
    { x: 5, y: 3 },
    { x: 5, y: 2 },
  ], { type: 'conveyor', direction: 'west' });

  placeBehaviors(level, [
    { x: 4, y: 2 },
    { x: 3, y: 2 },
  ], { type: 'conveyor', direction: 'north' });

  placeBehaviors(level, [
    { x: 3, y: 1 },
    { x: 4, y: 1 },
  ], { type: 'conveyor', direction: 'east' });

  return level;
}

function buildHazardGauntlet(): Level {
  const level = buildBaseLevel('Test Map 4: Hazard Run', 7, 10);
  applyBehavior(level, { x: 3, y: 9 }, { type: 'spawn' });
  applyBehavior(level, { x: 3, y: 0 }, { type: 'exit' });
  applyBehavior(level, { x: 3, y: 8 }, { type: 'door', doorId: 'A', open: false });

  placeBlockers(level, [
    { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
  ]);

  const hazardLine: GridCoord[] = [];
  for (let y = 1; y <= 7; y++) {
    hazardLine.push({ x: 3, y });
  }
  placeBehaviors(level, hazardLine, { type: 'hazard-burn', damage: 1 });

  placeBehaviors(level, [{ x: 2, y: 7 }, { x: 4, y: 7 }], { type: 'hole' });

  return level;
}

export const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'slow-path',
    name: 'Test Map 1',
    description: 'Simple path with slow tiles.',
    phase: 1,
    build: buildSlowPath,
  },
  {
    id: 'hole-maze',
    name: 'Test Map 2',
    description: 'Maze featuring holes and blockers.',
    phase: 1,
    build: buildHoleMaze,
  },
  {
    id: 'conveyor-puzzle',
    name: 'Test Map 3',
    description: 'Conveyor loop that pushes the token around.',
    phase: 1,
    build: buildConveyorPuzzle,
  },
  {
    id: 'hazard-run',
    name: 'Test Map 4',
    description: 'Hazard gauntlet with a blocking door.',
    phase: 1,
    build: buildHazardGauntlet,
  },
];

function buildStraightLine(): Level {
  const level = buildBaseLevel('Test Map 5: Straight Shot', 10, 3);
  applyBehavior(level, { x: 1, y: 1 }, { type: 'spawn' });
  applyBehavior(level, { x: 8, y: 1 }, { type: 'exit' });
  return level;
}

function buildObstacleMaze(): Level {
  const level = buildBaseLevel('Test Map 6: Obstacle Maze', 10, 8);
  applyBehavior(level, { x: 1, y: 6 }, { type: 'spawn' });
  applyBehavior(level, { x: 8, y: 1 }, { type: 'exit' });

  placeBlockers(level, [
    { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 },
    { x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 4 },
    { x: 2, y: 6 }, { x: 4, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 },
  ]);

  placeBehaviors(level, [
    { x: 5, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 2 },
  ], { type: 'slow' });

  return level;
}

function buildHazardChoice(): Level {
  const level = buildBaseLevel('Test Map 7: Hazard Shortcut', 9, 7);
  applyBehavior(level, { x: 1, y: 5 }, { type: 'spawn' });
  applyBehavior(level, { x: 7, y: 1 }, { type: 'exit' });

  placeBlockers(level, [
    { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 },
    { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 },
    { x: 5, y: 4 }, { x: 5, y: 5 },
  ]);

  placeBehaviors(level, [
    { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 },
  ], { type: 'slow' });

  placeBehaviors(level, [
    { x: 4, y: 2 }, { x: 4, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 2 },
  ], { type: 'hazard-burn', damage: 1 });

  return level;
}

export const PHASE_TWO_SCENARIOS: TestScenario[] = [
  {
    id: 'straight-shot',
    name: 'Test Map 5',
    description: 'Straight line to the exit (basic pathfinding).',
    phase: 2,
    build: buildStraightLine,
  },
  {
    id: 'obstacle-maze',
    name: 'Test Map 6',
    description: 'Maze that forces rerouting around blockers.',
    phase: 2,
    build: buildObstacleMaze,
  },
  {
    id: 'hazard-shortcut',
    name: 'Test Map 7',
    description: 'Choose between safe detour or hazardous shortcut.',
    phase: 2,
    build: buildHazardChoice,
  },
];

export const TEST_SCENARIOS_ALL: TestScenario[] = [
  ...TEST_SCENARIOS,
  ...PHASE_TWO_SCENARIOS,
];
