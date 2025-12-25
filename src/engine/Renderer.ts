/**
 * Renderer for isometric tile maps
 */

import { GridCoord, GridBounds, TileData, PositionKey } from '../core/types';
import {
  getTileRenderPosition,
  getDepthKey,
  forEachInRenderOrder,
  gridToScreen,
  screenToGrid,
  calculateCenterOffset,
} from '../core/isometric';
import {
  ISO_TILE_WIDTH,
  ISO_TILE_HEIGHT,
  GRID_COLOR,
  HOVER_COLOR,
  SELECTION_COLOR,
} from '../core/constants';
import { Canvas } from './Canvas';
import { Camera } from './Camera';
import { TileRegistry } from '../assets/TileRegistry';
import type { Layer } from '../level/Layer';
import type { Level } from '../level/Level';

export interface RenderOptions {
  showGrid?: boolean;
  showHover?: boolean;
  showSelection?: boolean;
}

/**
 * Renderer handles drawing the isometric tile map to the canvas
 */
export class Renderer {
  private canvas: Canvas;
  private camera: Camera;
  private tileRegistry: TileRegistry;
  private options: RenderOptions = {
    showGrid: true,
    showHover: true,
    showSelection: true,
  };

  // State for overlays
  private hoveredCoord: GridCoord | null = null;
  private selectedCoords: GridCoord[] = [];

  constructor(canvas: Canvas, camera: Camera, tileRegistry: TileRegistry) {
    this.canvas = canvas;
    this.camera = camera;
    this.tileRegistry = tileRegistry;

    // Update camera viewport on canvas resize
    this.camera.setViewport(this.canvas.viewport);
  }

  /**
   * Set render options
   */
  setOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Set the hovered grid coordinate
   */
  setHoveredCoord(coord: GridCoord | null): void {
    this.hoveredCoord = coord;
  }

  /**
   * Set selected grid coordinates
   */
  setSelectedCoords(coords: GridCoord[]): void {
    this.selectedCoords = coords;
  }

  /**
   * Render a complete frame
   */
  render(level: Level): void {
    const ctx = this.canvas.ctx;

    // Update camera viewport in case it changed
    this.camera.setViewport(this.canvas.viewport);

    // Clear canvas
    this.canvas.clear();

    // Save context state
    ctx.save();

    // Apply camera transform
    this.camera.applyTransform(ctx);

    // Calculate center offset for the grid
    const centerOffset = calculateCenterOffset(
      this.canvas.viewport.width / this.camera.zoom,
      this.canvas.viewport.height / this.camera.zoom,
      level.gridWidth,
      level.gridHeight
    );

    // Get visible bounds
    const bounds: GridBounds = {
      minX: 0,
      minY: 0,
      maxX: level.gridWidth - 1,
      maxY: level.gridHeight - 1,
    };

    // Draw grid if enabled
    if (this.options.showGrid) {
      this.renderGrid(ctx, bounds, centerOffset.x, centerOffset.y);
    }

    // Collect all tiles from all visible layers
    const renderItems = this.collectRenderItems(level, bounds);

    // Sort by depth and render
    renderItems.sort((a, b) => a.depth - b.depth);
    for (const item of renderItems) {
      this.renderTile(ctx, item.tileId, item.screenX, item.screenY);
    }

    // Draw hover overlay if enabled
    if (this.options.showHover && this.hoveredCoord) {
      this.renderTileOverlay(ctx, this.hoveredCoord, centerOffset.x, centerOffset.y, HOVER_COLOR);
    }

    // Draw selection overlays if enabled
    if (this.options.showSelection && this.selectedCoords.length > 0) {
      for (const coord of this.selectedCoords) {
        this.renderTileOverlay(ctx, coord, centerOffset.x, centerOffset.y, SELECTION_COLOR);
      }
    }

    // Restore context state
    ctx.restore();
  }

  /**
   * Collect all tiles to render from all visible layers
   */
  private collectRenderItems(
    level: Level,
    bounds: GridBounds
  ): Array<{ tileId: number; screenX: number; screenY: number; depth: number }> {
    const items: Array<{ tileId: number; screenX: number; screenY: number; depth: number }> = [];

    const centerOffset = calculateCenterOffset(
      this.canvas.viewport.width / this.camera.zoom,
      this.canvas.viewport.height / this.camera.zoom,
      level.gridWidth,
      level.gridHeight
    );

    // Get layers sorted by z-index
    const layers = level.getVisibleLayers();

    for (const layer of layers) {
      const layerYOffset = this.getLayerYOffset(layer);

      // Iterate over all tiles in the layer
      layer.forEachTile((tile, coord) => {
        // Check if in bounds
        if (
          coord.x >= bounds.minX &&
          coord.x <= bounds.maxX &&
          coord.y >= bounds.minY &&
          coord.y <= bounds.maxY
        ) {
          const renderPos = getTileRenderPosition(
            coord.x,
            coord.y,
            centerOffset.x,
            centerOffset.y
          );
          const depth = getDepthKey(coord.x, coord.y, layer.config.zIndex);

          items.push({
            tileId: tile.tileId,
            screenX: renderPos.x,
            screenY: renderPos.y - layerYOffset,
            depth,
          });
        }
      });
    }

    return items;
  }

  private getLayerYOffset(layer: Layer): number {
    if (layer.config.id === 'props' || layer.config.id === 'decorations') {
      return ISO_TILE_HEIGHT / 2;
    }
    return 0;
  }

  /**
   * Render a single tile
   */
  private renderTile(
    ctx: CanvasRenderingContext2D,
    tileId: number,
    x: number,
    y: number
  ): void {
    this.tileRegistry.drawTile(ctx, tileId, x, y);
  }

  /**
   * Render the grid overlay
   */
  private renderGrid(
    ctx: CanvasRenderingContext2D,
    bounds: GridBounds,
    offsetX: number,
    offsetY: number
  ): void {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;

    forEachInRenderOrder(bounds, (x, y) => {
      this.renderTileOutline(ctx, { x, y }, offsetX, offsetY, GRID_COLOR);
    });
  }

  /**
   * Render a diamond outline for a tile
   */
  private renderTileOutline(
    ctx: CanvasRenderingContext2D,
    coord: GridCoord,
    offsetX: number,
    offsetY: number,
    color: string
  ): void {
    const center = gridToScreen(coord.x, coord.y, offsetX, offsetY);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Draw diamond shape
    ctx.moveTo(center.x, center.y); // Top
    ctx.lineTo(center.x + ISO_TILE_WIDTH / 2, center.y + ISO_TILE_HEIGHT / 2); // Right
    ctx.lineTo(center.x, center.y + ISO_TILE_HEIGHT); // Bottom
    ctx.lineTo(center.x - ISO_TILE_WIDTH / 2, center.y + ISO_TILE_HEIGHT / 2); // Left
    ctx.closePath();
    ctx.stroke();
  }

  /**
   * Render a filled diamond overlay for a tile
   */
  private renderTileOverlay(
    ctx: CanvasRenderingContext2D,
    coord: GridCoord,
    offsetX: number,
    offsetY: number,
    color: string
  ): void {
    const center = gridToScreen(coord.x, coord.y, offsetX, offsetY);

    ctx.fillStyle = color;
    ctx.beginPath();

    // Draw diamond shape
    ctx.moveTo(center.x, center.y); // Top
    ctx.lineTo(center.x + ISO_TILE_WIDTH / 2, center.y + ISO_TILE_HEIGHT / 2); // Right
    ctx.lineTo(center.x, center.y + ISO_TILE_HEIGHT); // Bottom
    ctx.lineTo(center.x - ISO_TILE_WIDTH / 2, center.y + ISO_TILE_HEIGHT / 2); // Left
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Convert screen coordinates to grid coordinates (through camera)
   */
  screenToGrid(screenX: number, screenY: number, level: Level): GridCoord {
    const world = this.camera.screenToWorld(screenX, screenY);

    const centerOffset = calculateCenterOffset(
      this.canvas.viewport.width / this.camera.zoom,
      this.canvas.viewport.height / this.camera.zoom,
      level.gridWidth,
      level.gridHeight
    );

    return screenToGrid(world.x, world.y, centerOffset.x, centerOffset.y);
  }
}
