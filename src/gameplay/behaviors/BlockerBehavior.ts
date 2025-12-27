/**
 * Blocker behavior - impassable wall/obstacle.
 */

import { GameplayTileType } from '../../core/types';
import { BaseTileBehavior } from './BaseTileBehavior';
import { TileBehaviorContext } from '../types';

export class BlockerBehavior extends BaseTileBehavior {
  readonly type: GameplayTileType = 'blocker';

  isWalkable(_ctx: TileBehaviorContext): boolean {
    return false;
  }

  getMovementCost(_ctx: TileBehaviorContext): number {
    return Infinity;
  }

  getOverlayColor(): string {
    return 'rgba(255, 74, 74, 0.45)';
  }
}
