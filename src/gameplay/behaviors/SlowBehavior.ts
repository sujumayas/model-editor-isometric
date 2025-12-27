/**
 * Slow tile behavior - increased movement cost (mud, water, vines).
 */

import { GameplayTileType } from '../../core/types';
import { BaseTileBehavior } from './BaseTileBehavior';
import { TileBehaviorContext } from '../types';

export class SlowBehavior extends BaseTileBehavior {
  readonly type: GameplayTileType = 'slow';

  getMovementCost(_ctx: TileBehaviorContext): number {
    return 2.5;
  }

  getOverlayColor(): string {
    return 'rgba(255, 199, 94, 0.35)';
  }
}
