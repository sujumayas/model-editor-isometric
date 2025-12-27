/**
 * Agent type definitions for autonomous entities (Clops, enemies).
 * Designed for extensibility to support Phase 3 (multiple Clops) and Phase 4 (enemies).
 */

import { GridCoord, GameplayTileType } from '../core/types';

// ============================================================================
// Agent State Types
// ============================================================================

/** Agent state in the FSM */
export type AgentStateType =
  | 'idle'       // Waiting at spawn or after completing action
  | 'planning'   // Computing path to target
  | 'moving'     // Executing movement along path
  | 'scared'     // Avoiding danger (visual indicator)
  | 'hurt'       // Just took damage (flash effect)
  | 'dead'       // HP reached 0
  | 'won';       // Reached exit tile

/** Agent type for different entity kinds */
export type AgentType = 'clop' | 'enemy';

// ============================================================================
// Agent State
// ============================================================================

/** Complete agent state at any point in time */
export interface AgentState {
  /** Current FSM state */
  readonly type: AgentStateType;
  /** Current hit points */
  readonly hp: number;
  /** Maximum hit points */
  readonly maxHp: number;
  /** Current logical grid position */
  readonly position: GridCoord;
  /** Interpolated visual position for rendering */
  readonly visualPosition: { x: number; y: number };
  /** Target position the agent is trying to reach */
  readonly targetPosition: GridCoord | null;
  /** Current computed path to target */
  readonly currentPath: GridCoord[];
  /** Current index in the path */
  readonly pathIndex: number;
  /** Movement progress through current segment (0-1) */
  readonly moveProgress: number;
  /** Number of turns taken */
  readonly turnsTaken: number;
  /** Last source of damage for UI feedback */
  readonly lastDamageSource: GameplayTileType | null;
  /** Spawn position for reset */
  readonly spawnPosition: GridCoord;
  /** Pending forced move from conveyor */
  readonly pendingForcedMove?: GridCoord;
}

// ============================================================================
// Agent Configuration
// ============================================================================

/** Configuration for spawning an agent */
export interface AgentConfig {
  /** Unique identifier for this agent */
  readonly id: string;
  /** Type of agent (clop, enemy) */
  readonly type: AgentType;
  /** Maximum HP */
  readonly maxHp: number;
  /** Visual movement speed in tiles per second */
  readonly moveSpeed: number;
  /** Hazard avoidance weight for pathfinding (higher = more avoidance) */
  readonly hazardAvoidanceWeight: number;
  /** Rendering color */
  readonly color: string;
  /** Eye color for cyclops rendering */
  readonly eyeColor: string;
}

/** Default Clop configuration */
export const DEFAULT_CLOP_CONFIG: AgentConfig = {
  id: 'clop-1',
  type: 'clop',
  maxHp: 2,
  moveSpeed: 4,
  hazardAvoidanceWeight: 5,
  color: 'rgba(100, 200, 255, 0.9)',
  eyeColor: '#ffffff',
};

/** Create a new Clop config with a unique ID */
export function createClopConfig(id: string, overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    ...DEFAULT_CLOP_CONFIG,
    id,
    ...overrides,
  };
}

// ============================================================================
// Agent State Factory
// ============================================================================

/** Create initial agent state at spawn position */
export function createAgentState(
  spawnPosition: GridCoord,
  config: AgentConfig
): AgentState {
  return {
    type: 'idle',
    hp: config.maxHp,
    maxHp: config.maxHp,
    position: { ...spawnPosition },
    visualPosition: { x: spawnPosition.x, y: spawnPosition.y },
    targetPosition: null,
    currentPath: [],
    pathIndex: 0,
    moveProgress: 0,
    turnsTaken: 0,
    lastDamageSource: null,
    spawnPosition: { ...spawnPosition },
  };
}

// ============================================================================
// Agent Events
// ============================================================================

/** Events emitted by agents for UI synchronization */
export interface AgentEventMap {
  /** FSM state changed */
  'state:changed': { agentId: string; oldState: AgentStateType; newState: AgentStateType };
  /** HP changed (damage or healing) */
  'hp:changed': { agentId: string; oldHp: number; newHp: number; damage: number; source: GameplayTileType | null };
  /** Position changed (tile to tile) */
  'position:changed': { agentId: string; from: GridCoord; to: GridCoord };
  /** Path computed */
  'path:computed': { agentId: string; path: GridCoord[]; cost: number };
  /** Path cleared (no path found or reached target) */
  'path:cleared': { agentId: string };
  /** Agent died */
  'died': { agentId: string; cause: GameplayTileType };
  /** Agent reached exit */
  'won': { agentId: string };
  /** Turn completed */
  'turn:completed': { agentId: string; turnNumber: number };
}

/** Event handler type */
export type AgentEventHandler<K extends keyof AgentEventMap> = (payload: AgentEventMap[K]) => void;

// ============================================================================
// State Machine Types
// ============================================================================

/** FSM transition definition */
export interface StateTransition {
  /** Source state(s) for this transition */
  from: AgentStateType | AgentStateType[] | '*';
  /** Target state */
  to: AgentStateType;
  /** Optional condition function */
  condition?: (state: AgentState) => boolean;
}

/** Valid state transitions for Clop agents */
export const CLOP_TRANSITIONS: StateTransition[] = [
  // Normal flow
  { from: 'idle', to: 'planning' },
  { from: 'planning', to: 'moving' },
  { from: 'planning', to: 'idle' },        // No path found
  { from: 'moving', to: 'idle' },          // Reached destination

  // Damage states
  { from: 'moving', to: 'hurt' },          // Hit hazard
  { from: 'idle', to: 'hurt' },            // Standing on hazard
  { from: 'hurt', to: 'moving' },          // Continue after damage
  { from: 'hurt', to: 'idle' },            // Stopped after damage
  { from: 'hurt', to: 'dead', condition: (s) => s.hp <= 0 },

  // Scared state (visual indicator near danger)
  { from: 'moving', to: 'scared' },
  { from: 'scared', to: 'moving' },
  { from: 'scared', to: 'idle' },

  // Terminal states
  { from: ['idle', 'moving', 'scared'], to: 'won' },
  { from: '*', to: 'dead' },               // Any state can die
];

// ============================================================================
// Pathfinding Types
// ============================================================================

/** Result of pathfinding operation */
export interface PathfindingResult {
  /** The computed path (empty if no path found) */
  path: GridCoord[];
  /** Total cost of the path */
  cost: number;
  /** Whether a path was found */
  found: boolean;
}

/** Options for pathfinding */
export interface PathfindingOptions {
  /** Weight for hazard avoidance (default 5) */
  hazardAvoidanceWeight?: number;
  /** Maximum iterations before giving up */
  maxIterations?: number;
  /** Whether to allow diagonal movement */
  allowDiagonal?: boolean;
}

export const DEFAULT_PATHFINDING_OPTIONS: PathfindingOptions = {
  hazardAvoidanceWeight: 5,
  maxIterations: 1000,
  allowDiagonal: false,
};
