/**
 * Level class - container for layers and metadata
 */

import {
  LevelData,
  LevelDataV2,
  LevelMetadata,
  GridConfig,
  GridCoord,
  TileData,
  LayerData,
  TileProperties,
  GameplayTilePlacement,
  GameplayLayerData,
  PositionKey,
  toPositionKey,
  fromPositionKey,
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
  private gameplayTiles = new Map<PositionKey, TileProperties>();

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

  // ============================================================================
  // Gameplay Layer Methods
  // ============================================================================

  /**
   * Get gameplay properties for a tile position.
   * Returns undefined if no gameplay properties set (defaults to floor).
   */
  getGameplayTile(coord: GridCoord): TileProperties | undefined {
    if (!this.isInBounds(coord)) return undefined;
    return this.gameplayTiles.get(toPositionKey(coord));
  }

  /**
   * Set gameplay properties for a tile position.
   * Pass undefined or 'floor' type to remove custom properties.
   */
  setGameplayTile(coord: GridCoord, properties: TileProperties | undefined): boolean {
    if (!this.isInBounds(coord)) return false;

    const key = toPositionKey(coord);
    if (!properties || properties.type === 'floor') {
      this.gameplayTiles.delete(key);
    } else {
      this.gameplayTiles.set(key, properties);
    }
    return true;
  }

  /**
   * Remove gameplay properties for a tile position.
   */
  removeGameplayTile(coord: GridCoord): boolean {
    if (!this.isInBounds(coord)) return false;
    return this.gameplayTiles.delete(toPositionKey(coord));
  }

  /**
   * Clear all gameplay tiles.
   */
  clearGameplayTiles(): void {
    this.gameplayTiles.clear();
  }

  /**
   * Get all gameplay tiles as an array for iteration.
   */
  getAllGameplayTiles(): Array<{ coord: GridCoord; properties: TileProperties }> {
    const result: Array<{ coord: GridCoord; properties: TileProperties }> = [];
    for (const [key, properties] of this.gameplayTiles) {
      result.push({ coord: fromPositionKey(key), properties });
    }
    return result;
  }

  /**
   * Find all tiles with a specific gameplay type.
   */
  findGameplayTilesByType(type: TileProperties['type']): GridCoord[] {
    const result: GridCoord[] = [];
    for (const [key, properties] of this.gameplayTiles) {
      if (properties.type === type) {
        result.push(fromPositionKey(key));
      }
    }
    return result;
  }

  /**
   * Find the first spawn tile. Returns null if none found.
   */
  findSpawnTile(): GridCoord | null {
    const spawns = this.findGameplayTilesByType('spawn');
    return spawns[0] ?? null;
  }

  /**
   * Find the first exit tile. Returns null if none found.
   */
  findExitTile(): GridCoord | null {
    const exits = this.findGameplayTilesByType('exit');
    return exits[0] ?? null;
  }

  /**
   * Update modified timestamp
   */
  touch(): void {
    (this.metadata as { modified: string }).modified = new Date().toISOString();
  }

  /**
   * Serialize level to plain object (v2 format with gameplay layer)
   */
  toData(): LevelDataV2 {
    // Build gameplay layer data
    const gameplayTiles: GameplayTilePlacement[] = [];
    for (const [key, properties] of this.gameplayTiles) {
      gameplayTiles.push({
        position: fromPositionKey(key),
        properties,
      });
    }

    return {
      version: 2,
      metadata: { ...this.metadata },
      grid: { ...this.gridConfig },
      layers: this.layers.map((layer) => layer.toData()),
      gameplayLayer: gameplayTiles.length > 0 ? { tiles: gameplayTiles } : undefined,
    };
  }

  /**
   * Create a level from serialized data (supports v1 and v2)
   */
  static fromData(data: LevelData | LevelDataV2): Level {
    const level = new Level(data.metadata, data.grid);

    for (const layerData of data.layers) {
      const layer = Layer.fromData(layerData);
      level.addLayer(layer);
    }

    // Load gameplay layer if present (v2 format)
    const v2Data = data as LevelDataV2;
    if (v2Data.gameplayLayer?.tiles) {
      for (const placement of v2Data.gameplayLayer.tiles) {
        level.setGameplayTile(placement.position, placement.properties);
      }
    }

    return level;
  }

  /**
   * Create a new level with default layers
   */
  static createDefault(
    name: string = 'Untitled Level',
    gridConfig: Partial<GridConfig> = {}
  ): Level {
    const level = new Level({ name }, gridConfig);

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
