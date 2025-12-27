/**
 * Exit behavior - triggers win condition when entered.
 */

import { GameplayTileType } from '../../core/types';
import { BaseTileBehavior } from './BaseTileBehavior';
import { PlayerState, TileBehaviorContext } from '../types';

export class ExitBehavior extends BaseTileBehavior {
  readonly type: GameplayTileType = 'exit';

  onEnter(ctx: TileBehaviorContext): PlayerState {
    return {
      ...ctx.player,
      state: 'won',
    };
  }

  getOverlayColor(): string {
    return 'rgba(100, 255, 100, 0.6)';
  }

  getIcon(): string {
    return 'portal';
  }
}
