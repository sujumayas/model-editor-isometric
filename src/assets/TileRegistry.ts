/**
 * Tile registry for managing tile definitions and spritesheet UV coordinates
 */

import { TileId, TileUV } from '../core/types';
import { TILE_WIDTH, TILE_HEIGHT, TOTAL_TILES, SPRITESHEET_PATH } from '../core/constants';
import { loadSpritesheet } from './AssetLoader';

/** Spritesheet configuration */
const SPRITESHEET_COLUMNS = 11;

/** Tile category for organization */
export interface TileCategory {
  id: string;
  name: string;
  startId: TileId;
  endId: TileId;
}

/** Predefined tile categories based on the spritesheet */
export const TILE_CATEGORIES: TileCategory[] = [
  { id: 'dirt', name: 'Dirt/Soil', startId: 0, endId: 19 },
  { id: 'grass-transition', name: 'Grass Transition', startId: 20, endId: 28 },
  { id: 'vegetation', name: 'Vegetation', startId: 29, endId: 39 },
  { id: 'props', name: 'Props', startId: 40, endId: 59 },
  { id: 'rocks-brown', name: 'Brown Rocks', startId: 60, endId: 66 },
  { id: 'rocks-gray', name: 'Gray Rocks', startId: 67, endId: 81 },
  { id: 'ice', name: 'Ice/Snow', startId: 82, endId: 89 },
  { id: 'water-deep', name: 'Deep Water', startId: 90, endId: 99 },
  { id: 'water-shallow', name: 'Shallow Water', startId: 100, endId: 114 },
];

/**
 * TileRegistry manages tile definitions and provides UV coordinates
 * for extracting tiles from the spritesheet
 */
export class TileRegistry {
  private spritesheet: HTMLImageElement | null = null;
  private uvCache = new Map<TileId, TileUV>();
  private _isReady = false;

  /**
   * Load the spritesheet and initialize UV coordinates
   */
  async initialize(): Promise<void> {
    this.spritesheet = await loadSpritesheet(SPRITESHEET_PATH);
    this.buildUVCache();
    this._isReady = true;
  }

  /**
   * Check if the registry is ready (spritesheet loaded)
   */
  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Get the loaded spritesheet image
   */
  getSpritesheet(): HTMLImageElement {
    if (!this.spritesheet) {
      throw new Error('TileRegistry not initialized. Call initialize() first.');
    }
    return this.spritesheet;
  }

  /**
   * Get UV coordinates for a tile ID
   */
  getTileUV(tileId: TileId): TileUV {
    const uv = this.uvCache.get(tileId);
    if (!uv) {
      throw new Error(`Invalid tile ID: ${tileId}`);
    }
    return uv;
  }

  /**
   * Check if a tile ID is valid
   */
  isValidTileId(tileId: TileId): boolean {
    return tileId >= 0 && tileId < TOTAL_TILES;
  }

  /**
   * Get the total number of tiles
   */
  getTileCount(): number {
    return TOTAL_TILES;
  }

  /**
   * Get all tile IDs
   */
  getAllTileIds(): TileId[] {
    return Array.from({ length: TOTAL_TILES }, (_, i) => i);
  }

  /**
   * Get tile IDs for a category
   */
  getTilesByCategory(categoryId: string): TileId[] {
    const category = TILE_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) {
      return [];
    }
    const tiles: TileId[] = [];
    for (let id = category.startId; id <= category.endId; id++) {
      tiles.push(id);
    }
    return tiles;
  }

  /**
   * Get the category for a tile ID
   */
  getCategoryForTile(tileId: TileId): TileCategory | undefined {
    return TILE_CATEGORIES.find(
      (c) => tileId >= c.startId && tileId <= c.endId
    );
  }

  /**
   * Build the UV coordinate cache for all tiles
   */
  private buildUVCache(): void {
    for (let tileId = 0; tileId < TOTAL_TILES; tileId++) {
      const col = tileId % SPRITESHEET_COLUMNS;
      const row = Math.floor(tileId / SPRITESHEET_COLUMNS);

      this.uvCache.set(tileId, {
        x: col * TILE_WIDTH,
        y: row * TILE_HEIGHT,
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
      });
    }
  }

  /**
   * Draw a tile to a canvas context
   */
  drawTile(
    ctx: CanvasRenderingContext2D,
    tileId: TileId,
    destX: number,
    destY: number,
    scale: number = 1
  ): void {
    if (!this.spritesheet) {
      throw new Error('TileRegistry not initialized');
    }

    const uv = this.getTileUV(tileId);
    const destWidth = TILE_WIDTH * scale;
    const destHeight = TILE_HEIGHT * scale;

    ctx.drawImage(
      this.spritesheet,
      uv.x,
      uv.y,
      uv.width,
      uv.height,
      destX,
      destY,
      destWidth,
      destHeight
    );
  }

  /**
   * Create an offscreen canvas with a single tile (for UI previews)
   */
  createTilePreview(tileId: TileId, scale: number = 1): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_WIDTH * scale;
    canvas.height = TILE_HEIGHT * scale;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      this.drawTile(ctx, tileId, 0, 0, scale);
    }

    return canvas;
  }
}
