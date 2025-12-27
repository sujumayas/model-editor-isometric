/**
 * Base tile behavior with default implementations.
 * All tile behaviors extend this class.
 */

import { GameplayTileType } from '../../core/types';
import { PlayerState, TileBehaviorContext } from '../types';

/** Tile behavior interface */
export interface TileBehavior {
  /** The tile type this behavior handles */
  readonly type: GameplayTileType;

  /**
   * Check if this tile is walkable (can be entered).
   * Used by pathfinding to determine valid paths.
   */
  isWalkable(ctx: TileBehaviorContext): boolean;

  /**
   * Get movement cost for this tile.
   * Used by pathfinding for weighted paths.
   * @returns Cost multiplier (1 = normal, 2.5 = slow, Infinity = blocked)
   */
  getMovementCost(ctx: TileBehaviorContext): number;

  /**
   * Called when player enters this tile.
   * @returns Updated player state after entering
   */
  onEnter(ctx: TileBehaviorContext): PlayerState;

  /**
   * Called each turn while player stays on this tile.
   * @returns Updated player state
   */
  onStay(ctx: TileBehaviorContext): PlayerState;

  /**
   * Called when player exits this tile.
   * @returns Updated player state after exiting
   */
  onExit(ctx: TileBehaviorContext): PlayerState;

  /**
   * Get overlay color for rendering this tile type.
   * @returns CSS color string with alpha
   */
  getOverlayColor(): string;

  /**
   * Get optional icon to render on this tile.
   * @returns Icon identifier or undefined
   */
  getIcon(): string | undefined;
}

/**
 * Abstract base class with default implementations.
 * Override methods as needed in specific behaviors.
 */
export abstract class BaseTileBehavior implements TileBehavior {
  abstract readonly type: GameplayTileType;

  isWalkable(_ctx: TileBehaviorContext): boolean {
    return true;
  }

  getMovementCost(_ctx: TileBehaviorContext): number {
    return 1;
  }

  onEnter(ctx: TileBehaviorContext): PlayerState {
    return ctx.player;
  }

  onStay(ctx: TileBehaviorContext): PlayerState {
    return ctx.player;
  }

  onExit(ctx: TileBehaviorContext): PlayerState {
    return ctx.player;
  }

  abstract getOverlayColor(): string;

  getIcon(): string | undefined {
    return undefined;
  }
}
