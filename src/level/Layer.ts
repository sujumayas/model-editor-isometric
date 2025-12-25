/**
 * Layer class for storing tiles in a sparse map
 */

import {
  LayerConfig,
  LayerData,
  TileData,
  TilePlacement,
  GridCoord,
  PositionKey,
  toPositionKey,
  fromPositionKey,
} from '../core/types';

/**
 * Layer represents a single layer in the level
 * Uses sparse storage (only stores tiles that are placed)
 */
export class Layer {
  readonly config: LayerConfig;
  private tiles = new Map<PositionKey, TileData>();

  constructor(config: Omit<LayerConfig, 'visible' | 'locked' | 'opacity'> & Partial<LayerConfig>) {
    this.config = {
      visible: true,
      locked: false,
      opacity: 1,
      ...config,
    };
  }

  /**
   * Get a tile at a specific position
   */
  getTile(coord: GridCoord): TileData | null {
    const key = toPositionKey(coord);
    return this.tiles.get(key) ?? null;
  }

  /**
   * Set a tile at a specific position
   */
  setTile(coord: GridCoord, tile: TileData): void {
    const key = toPositionKey(coord);
    this.tiles.set(key, tile);
  }

  /**
   * Remove a tile at a specific position
   */
  removeTile(coord: GridCoord): boolean {
    const key = toPositionKey(coord);
    return this.tiles.delete(key);
  }

  /**
   * Check if there's a tile at a position
   */
  hasTile(coord: GridCoord): boolean {
    const key = toPositionKey(coord);
    return this.tiles.has(key);
  }

  /**
   * Get the number of tiles in this layer
   */
  get tileCount(): number {
    return this.tiles.size;
  }

  /**
   * Clear all tiles from this layer
   */
  clear(): void {
    this.tiles.clear();
  }

  /**
   * Iterate over all tiles
   */
  forEachTile(callback: (tile: TileData, coord: GridCoord) => void): void {
    this.tiles.forEach((tile, key) => {
      const coord = fromPositionKey(key);
      callback(tile, coord);
    });
  }

  /**
   * Get all tiles as an array
   */
  getAllTiles(): Array<{ tile: TileData; coord: GridCoord }> {
    const result: Array<{ tile: TileData; coord: GridCoord }> = [];
    this.forEachTile((tile, coord) => {
      result.push({ tile, coord });
    });
    return result;
  }

  /**
   * Set layer visibility
   */
  setVisible(visible: boolean): void {
    this.config.visible = visible;
  }

  /**
   * Toggle layer visibility
   */
  toggleVisible(): void {
    this.config.visible = !this.config.visible;
  }

  /**
   * Set layer locked state
   */
  setLocked(locked: boolean): void {
    this.config.locked = locked;
  }

  /**
   * Set layer opacity
   */
  setOpacity(opacity: number): void {
    this.config.opacity = Math.max(0, Math.min(1, opacity));
  }

  /**
   * Create a clone of this layer
   */
  clone(): Layer {
    const cloned = new Layer({ ...this.config });
    this.tiles.forEach((tile, key) => {
      cloned.tiles.set(key, { ...tile });
    });
    return cloned;
  }

  /**
   * Serialize layer to plain object
   */
  toData(): LayerData {
    const tiles: TilePlacement[] = [];
    this.forEachTile((tile, coord) => {
      tiles.push({
        tileId: tile.tileId,
        position: coord,
        rotation: tile.rotation,
      });
    });

    return {
      id: this.config.id,
      name: this.config.name,
      zIndex: this.config.zIndex,
      visible: this.config.visible,
      tiles,
    };
  }

  /**
   * Create a layer from serialized data
   */
  static fromData(data: LayerData): Layer {
    const layer = new Layer({
      id: data.id,
      name: data.name,
      zIndex: data.zIndex,
      visible: data.visible,
    });

    for (const placement of data.tiles) {
      layer.setTile(placement.position, {
        tileId: placement.tileId,
        rotation: placement.rotation,
      });
    }

    return layer;
  }
}
