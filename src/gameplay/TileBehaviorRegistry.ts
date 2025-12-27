/**
 * Registry for tile behaviors - singleton pattern for looking up behaviors by type.
 */

import { GameplayTileType, TileProperties } from '../core/types';
import { TileBehavior } from './behaviors/BaseTileBehavior';
import { FloorBehavior } from './behaviors/FloorBehavior';
import { BlockerBehavior } from './behaviors/BlockerBehavior';
import { SlowBehavior } from './behaviors/SlowBehavior';
import { HoleBehavior } from './behaviors/HoleBehavior';
import { ConveyorBehavior } from './behaviors/ConveyorBehavior';
import { HazardBehavior } from './behaviors/HazardBehavior';
import { DoorBehavior } from './behaviors/DoorBehavior';
import { ExitBehavior } from './behaviors/ExitBehavior';
import { SpawnBehavior } from './behaviors/SpawnBehavior';

/**
 * Registry that maps tile types to their behavior implementations.
 */
export class TileBehaviorRegistry {
  private behaviors = new Map<GameplayTileType, TileBehavior>();
  private defaultBehavior: TileBehavior;

  constructor() {
    // Register all behaviors
    this.register(new FloorBehavior());
    this.register(new BlockerBehavior());
    this.register(new SlowBehavior());
    this.register(new HoleBehavior());
    this.register(new ConveyorBehavior());
    this.register(new HazardBehavior());
    this.register(new DoorBehavior());
    this.register(new ExitBehavior());
    this.register(new SpawnBehavior());

    // Default to floor behavior for unknown types
    this.defaultBehavior = this.behaviors.get('floor')!;
  }

  /**
   * Register a behavior for a tile type.
   */
  register(behavior: TileBehavior): void {
    this.behaviors.set(behavior.type, behavior);
  }

  /**
   * Get behavior for a tile type.
   * Returns floor behavior if type not found.
   */
  get(type: GameplayTileType): TileBehavior {
    return this.behaviors.get(type) ?? this.defaultBehavior;
  }

  /**
   * Get behavior for tile properties.
   * Convenience method that extracts type from properties.
   */
  getForTile(properties: TileProperties | undefined): TileBehavior {
    if (!properties) return this.defaultBehavior;
    return this.get(properties.type);
  }

  /**
   * Get all registered tile types.
   */
  getAllTypes(): GameplayTileType[] {
    return Array.from(this.behaviors.keys());
  }

  /**
   * Get overlay color for a tile type.
   */
  getOverlayColor(type: GameplayTileType): string {
    return this.get(type).getOverlayColor();
  }

  /**
   * Get icon for a tile type (if any).
   */
  getIcon(type: GameplayTileType): string | undefined {
    const behavior = this.get(type);
    return behavior.getIcon?.();
  }
}

// Singleton instance
let registryInstance: TileBehaviorRegistry | null = null;

/**
 * Get the singleton registry instance.
 */
export function getTileBehaviorRegistry(): TileBehaviorRegistry {
  if (!registryInstance) {
    registryInstance = new TileBehaviorRegistry();
  }
  return registryInstance;
}
