/**
 * Level class - container for layers and metadata
 */

import {
  LevelData,
  LevelMetadata,
  GridConfig,
  GridCoord,
  TileData,
  LayerData,
} from '../core/types';
import { GRID_WIDTH, GRID_HEIGHT, TILE_WIDTH, TILE_HEIGHT, DEFAULT_LAYERS } from '../core/constants';
import { Layer } from './Layer';

/**
 * Level represents a complete level with multiple layers
 */
export class Level {
  readonly metadata: LevelMetadata;
  readonly gridConfig: GridConfig;
  private layers: Layer[] = [];
  private layerMap = new Map<string, Layer>();

  constructor(
    metadata: Partial<LevelMetadata> = {},
    gridConfig: Partial<GridConfig> = {}
  ) {
    // Generate metadata with defaults
    this.metadata = {
      id: metadata.id ?? crypto.randomUUID(),
      name: metadata.name ?? 'Untitled Level',
      author: metadata.author,
      created: metadata.created ?? new Date().toISOString(),
      modified: metadata.modified ?? new Date().toISOString(),
      version: metadata.version ?? 1,
    };

    // Set grid config with defaults
    this.gridConfig = {
      width: gridConfig.width ?? GRID_WIDTH,
      height: gridConfig.height ?? GRID_HEIGHT,
      tileWidth: gridConfig.tileWidth ?? TILE_WIDTH,
      tileHeight: gridConfig.tileHeight ?? TILE_HEIGHT,
    };
  }

  /**
   * Get grid width
   */
  get gridWidth(): number {
    return this.gridConfig.width;
  }

  /**
   * Get grid height
   */
  get gridHeight(): number {
    return this.gridConfig.height;
  }

  /**
   * Get all layers
   */
  getLayers(): readonly Layer[] {
    return this.layers;
  }

  /**
   * Get visible layers sorted by z-index
   */
  getVisibleLayers(): Layer[] {
    return this.layers
      .filter((layer) => layer.config.visible)
      .sort((a, b) => a.config.zIndex - b.config.zIndex);
  }

  /**
   * Get a layer by ID
   */
  getLayer(id: string): Layer | undefined {
    return this.layerMap.get(id);
  }

  /**
   * Get a layer by index
   */
  getLayerByIndex(index: number): Layer | undefined {
    return this.layers[index];
  }

  /**
   * Add a new layer
   */
  addLayer(layer: Layer): void {
    if (this.layerMap.has(layer.config.id)) {
      throw new Error(`Layer with id "${layer.config.id}" already exists`);
    }
    this.layers.push(layer);
    this.layerMap.set(layer.config.id, layer);
    this.sortLayers();
  }

  /**
   * Remove a layer by ID
   */
  removeLayer(id: string): boolean {
    const index = this.layers.findIndex((l) => l.config.id === id);
    if (index === -1) return false;

    this.layers.splice(index, 1);
    this.layerMap.delete(id);
    return true;
  }

  /**
   * Sort layers by z-index
   */
  private sortLayers(): void {
    this.layers.sort((a, b) => a.config.zIndex - b.config.zIndex);
  }

  /**
   * Check if a coordinate is within grid bounds
   */
  isInBounds(coord: GridCoord): boolean {
    return (
      coord.x >= 0 &&
      coord.x < this.gridConfig.width &&
      coord.y >= 0 &&
      coord.y < this.gridConfig.height
    );
  }

  /**
   * Get tile at position from a specific layer
   */
  getTile(layerId: string, coord: GridCoord): TileData | null {
    const layer = this.layerMap.get(layerId);
    if (!layer) return null;
    return layer.getTile(coord);
  }

  /**
   * Set tile at position on a specific layer
   */
  setTile(layerId: string, coord: GridCoord, tile: TileData): boolean {
    if (!this.isInBounds(coord)) return false;

    const layer = this.layerMap.get(layerId);
    if (!layer || layer.config.locked) return false;

    layer.setTile(coord, tile);
    return true;
  }

  /**
   * Remove tile at position from a specific layer
   */
  removeTile(layerId: string, coord: GridCoord): boolean {
    const layer = this.layerMap.get(layerId);
    if (!layer || layer.config.locked) return false;

    return layer.removeTile(coord);
  }

  /**
   * Get topmost tile at a position (checking all visible layers from top to bottom)
   */
  getTopTileAt(coord: GridCoord): { tile: TileData; layerId: string } | null {
    const visibleLayers = this.getVisibleLayers().reverse(); // Top to bottom

    for (const layer of visibleLayers) {
      const tile = layer.getTile(coord);
      if (tile) {
        return { tile, layerId: layer.config.id };
      }
    }

    return null;
  }

  /**
   * Update modified timestamp
   */
  touch(): void {
    (this.metadata as { modified: string }).modified = new Date().toISOString();
  }

  /**
   * Serialize level to plain object
   */
  toData(): LevelData {
    return {
      version: 1,
      metadata: { ...this.metadata },
      grid: { ...this.gridConfig },
      layers: this.layers.map((layer) => layer.toData()),
    };
  }

  /**
   * Create a level from serialized data
   */
  static fromData(data: LevelData): Level {
    const level = new Level(data.metadata, data.grid);

    for (const layerData of data.layers) {
      const layer = Layer.fromData(layerData);
      level.addLayer(layer);
    }

    return level;
  }

  /**
   * Create a new level with default layers
   */
  static createDefault(name: string = 'Untitled Level'): Level {
    const level = new Level({ name });

    // Add default layers
    for (const layerConfig of DEFAULT_LAYERS) {
      const layer = new Layer({
        id: layerConfig.id,
        name: layerConfig.name,
        zIndex: layerConfig.zIndex,
      });
      level.addLayer(layer);
    }

    return level;
  }
}
