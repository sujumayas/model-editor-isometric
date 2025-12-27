/**
 * Agent interface for autonomous entities.
 * Designed for extensibility to support different agent types (Clops, enemies).
 */

import { GridCoord } from '../core/types';
import { Level } from '../level/Level';
import { GameState } from '../gameplay';
import { AgentState, AgentConfig, AgentEventMap, AgentEventHandler } from './types';

/**
 * Agent interface - represents any autonomous entity in the game.
 * Implementations: ClopAgent (Phase 2), EnemyAgent (Phase 4)
 */
export interface Agent {
  /** Agent configuration (immutable) */
  readonly config: AgentConfig;

  /** Current agent state (readonly, use methods to modify) */
  readonly state: AgentState;

  /**
   * Initialize agent at spawn position.
   */
  spawn(position: GridCoord): void;

  /**
   * Set the target the agent is trying to reach.
   * For Clops, this is the exit tile.
   * For enemies, this might be a Clop position.
   */
  setTarget(position: GridCoord | null): void;

  /**
   * Compute path to current target.
   * Returns the path or null if no path exists.
   */
  computePath(level: Level, gameState: GameState): GridCoord[] | null;

  /**
   * Execute one turn of AI decision-making.
   * Returns true if agent moved, false if blocked/dead/won.
   */
  takeTurn(level: Level, gameState: GameState): boolean;

  /**
   * Update visual interpolation (called every frame).
   * @param deltaTime Time since last update in seconds
   */
  updateVisuals(deltaTime: number): void;

  /**
   * Apply damage to the agent.
   * @param amount Amount of damage
   * @param source Source of damage (tile type)
   */
  takeDamage(amount: number, source: string): void;

  /**
   * Reset agent to spawn state.
   */
  reset(): void;

  /**
   * Subscribe to agent events.
   * @returns Unsubscribe function
   */
  on<K extends keyof AgentEventMap>(
    event: K,
    handler: AgentEventHandler<K>
  ): () => void;

  /**
   * Check if agent is at target position.
   */
  isAtTarget(): boolean;

  /**
   * Check if agent can act (not dead/won).
   */
  canAct(): boolean;

  /**
   * Get a readable status for debugging.
   */
  getStatus(): string;
}
