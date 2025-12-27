/**
 * Hazard behavior - deals damage on entry (fire, lava, spikes).
 */

import { GameplayTileType } from '../../core/types';
import { BaseTileBehavior } from './BaseTileBehavior';
import { PlayerState, TileBehaviorContext } from '../types';

export class HazardBehavior extends BaseTileBehavior {
  readonly type: GameplayTileType = 'hazard';

  onEnter(ctx: TileBehaviorContext): PlayerState {
    const damage = ctx.tileProperties.damage ?? 1;
    const newHp = Math.max(0, ctx.player.hp - damage);

    return {
      ...ctx.player,
      hp: newHp,
      state: newHp <= 0 ? 'dead' : ctx.player.state,
    };
  }

  getOverlayColor(): string {
    return 'rgba(255, 100, 50, 0.6)';
  }

  getIcon(): string {
    return 'flame';
  }
}
