/**
 * Spawn behavior - marks player spawn point. Behaves like floor.
 */

import { GameplayTileType } from '../../core/types';
import { BaseTileBehavior } from './BaseTileBehavior';

export class SpawnBehavior extends BaseTileBehavior {
  readonly type: GameplayTileType = 'spawn';

  getOverlayColor(): string {
    return 'rgba(255, 255, 100, 0.5)';
  }

  getIcon(): string {
    return 'marker';
  }
}
