/**
 * Gameplay type definitions for player state, game state, and behavior context.
 */

import { GridCoord, GameplayTileType, TileProperties } from '../core/types';

// ============================================================================
// Player State
// ============================================================================

/** Player state type for FSM */
export type PlayerStateType = 'idle' | 'moving' | 'dead' | 'won';

/** Complete player state */
export interface PlayerState {
  /** Current grid position */
  position: GridCoord;
  /** Interpolated visual position for rendering */
  visualPosition: { x: number; y: number };
  /** Current state in FSM */
  state: PlayerStateType;
  /** Current hit points */
  hp: number;
  /** Maximum hit points */
  maxHp: number;
  /** Spawn position for reset */
  spawnPosition: GridCoord;
  /** Pending forced move from conveyor */
  pendingForcedMove?: GridCoord;
  /** Current movement path */
  path: GridCoord[];
  /** Current segment index in path */
  segmentIndex: number;
  /** Progress through current segment (0-1) */
  segmentProgress: number;
}

/** Default player state factory */
export function createDefaultPlayerState(spawnPosition: GridCoord = { x: 0, y: 0 }): PlayerState {
  return {
    position: { ...spawnPosition },
    visualPosition: { x: spawnPosition.x, y: spawnPosition.y },
    state: 'idle',
    hp: 3,
    maxHp: 3,
    spawnPosition: { ...spawnPosition },
    path: [],
    segmentIndex: 0,
    segmentProgress: 0,
  };
}

// ============================================================================
// Game State
// ============================================================================

/** Complete game state */
export interface GameState {
  /** Player state */
  player: PlayerState;
  /** Set of open door IDs */
  openDoors: Set<string>;
  /** Current turn number */
  turnNumber: number;
  /** Step-by-step mode enabled */
  isStepMode: boolean;
  /** Waiting for user to advance step */
  waitingForStep: boolean;
}

/** Default game state factory */
export function createDefaultGameState(spawnPosition?: GridCoord): GameState {
  return {
    player: createDefaultPlayerState(spawnPosition),
    openDoors: new Set(),
    turnNumber: 0,
    isStepMode: false,
    waitingForStep: false,
  };
}

// ============================================================================
// Tile Behavior Context
// ============================================================================

/** Context passed to tile behaviors */
export interface TileBehaviorContext {
  /** Current player state */
  player: PlayerState;
  /** Tile properties at the position */
  tileProperties: TileProperties;
  /** Grid coordinate of the tile */
  coord: GridCoord;
  /** Current game state */
  gameState: GameState;
}

// ============================================================================
// Events
// ============================================================================

/** Player event types for FSM */
export type PlayerEventType =
  | 'MOVE_TO'
  | 'ARRIVED'
  | 'RESET'
  | 'FORCED_MOVE';

/** Player event with payload */
export interface PlayerEvent {
  type: PlayerEventType;
  target?: GridCoord;
}

// ============================================================================
// Damage Result
// ============================================================================

/** Result of applying damage to player */
export interface DamageResult {
  /** New player state after damage */
  newState: PlayerState;
  /** Amount of damage dealt */
  damageDealt: number;
  /** Cause of damage */
  cause: GameplayTileType;
  /** Whether player died */
  died: boolean;
}
