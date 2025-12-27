/**
 * Hole behavior - instant death on entry (pits, chasms).
 */

import { GameplayTileType } from '../../core/types';
import { BaseTileBehavior } from './BaseTileBehavior';
import { PlayerState, TileBehaviorContext } from '../types';

export class HoleBehavior extends BaseTileBehavior {
  readonly type: GameplayTileType = 'hole';

  // Holes are walkable (player can enter) but deadly
  isWalkable(_ctx: TileBehaviorContext): boolean {
    return true;
  }

  onEnter(ctx: TileBehaviorContext): PlayerState {
    // Player dies immediately upon entering a hole
    return {
      ...ctx.player,
      state: 'dead',
      hp: 0,
    };
  }

  getOverlayColor(): string {
    return 'rgba(0, 0, 0, 0.7)';
  }
}
