/**
 * Conveyor behavior - forces movement in a direction after entry.
 */

import { GameplayTileType, DIRECTION_VECTORS } from '../../core/types';
import { BaseTileBehavior } from './BaseTileBehavior';
import { PlayerState, TileBehaviorContext } from '../types';

export class ConveyorBehavior extends BaseTileBehavior {
  readonly type: GameplayTileType = 'conveyor';

  onEnter(ctx: TileBehaviorContext): PlayerState {
    const direction = ctx.tileProperties.direction ?? 'north';
    const delta = DIRECTION_VECTORS[direction];

    // Calculate forced move destination
    const forcedMove = {
      x: ctx.coord.x + delta.x,
      y: ctx.coord.y + delta.y,
    };

    return {
      ...ctx.player,
      pendingForcedMove: forcedMove,
    };
  }

  getOverlayColor(): string {
    return 'rgba(100, 200, 255, 0.5)';
  }

  getIcon(): string {
    return 'arrow';
  }
}
