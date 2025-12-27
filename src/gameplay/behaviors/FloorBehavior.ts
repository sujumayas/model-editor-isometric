/**
 * Floor behavior - default walkable tile with no special effects.
 */

import { GameplayTileType } from '../../core/types';
import { BaseTileBehavior } from './BaseTileBehavior';

export class FloorBehavior extends BaseTileBehavior {
  readonly type: GameplayTileType = 'floor';

  getOverlayColor(): string {
    return 'rgba(74, 158, 255, 0.08)';
  }
}
