/**
 * Gameplay module exports.
 * Provides tile behavior system and game state management.
 */

// Types
export * from './types';

// Behaviors
export { TileBehavior, BaseTileBehavior } from './behaviors/BaseTileBehavior';
export { FloorBehavior } from './behaviors/FloorBehavior';
export { BlockerBehavior } from './behaviors/BlockerBehavior';
export { SlowBehavior } from './behaviors/SlowBehavior';
export { HoleBehavior } from './behaviors/HoleBehavior';
export { ConveyorBehavior } from './behaviors/ConveyorBehavior';
export { HazardBehavior } from './behaviors/HazardBehavior';
export { DoorBehavior } from './behaviors/DoorBehavior';
export { ExitBehavior } from './behaviors/ExitBehavior';
export { SpawnBehavior } from './behaviors/SpawnBehavior';

// Registry
export { TileBehaviorRegistry, getTileBehaviorRegistry } from './TileBehaviorRegistry';
