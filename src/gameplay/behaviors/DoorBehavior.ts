/**
 * Door behavior - blocks passage until toggled open.
 */

import { GameplayTileType } from '../../core/types';
import { BaseTileBehavior } from './BaseTileBehavior';
import { TileBehaviorContext } from '../types';

export class DoorBehavior extends BaseTileBehavior {
  readonly type: GameplayTileType = 'door';

  isWalkable(ctx: TileBehaviorContext): boolean {
    const doorId = ctx.tileProperties.linkedId ?? 'default';
    return ctx.gameState.openDoors.has(doorId);
  }

  getMovementCost(ctx: TileBehaviorContext): number {
    return this.isWalkable(ctx) ? 1 : Infinity;
  }

  getOverlayColor(): string {
    return 'rgba(139, 69, 19, 0.7)';
  }
}
