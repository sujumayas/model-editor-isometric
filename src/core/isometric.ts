/**
 * Isometric coordinate transformation utilities
 *
 * Coordinate systems:
 * - Grid: Logical tile positions (0,0) to (width-1, height-1)
 * - Screen: Pixel positions on the canvas
 *
 * Isometric projection uses a 2:1 ratio (diamond tiles):
 * - Grid X increases to the right and down on screen
 * - Grid Y increases to the left and down on screen
 */

import { GridCoord, ScreenCoord, GridBounds } from './types';
import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT } from './constants';

/**
 * Convert grid coordinates to screen (pixel) coordinates
 * Returns the top-center of the isometric tile diamond
 */
export function gridToScreen(gridX: number, gridY: number, offsetX = 0, offsetY = 0): ScreenCoord {
  return {
    x: (gridX - gridY) * (ISO_TILE_WIDTH / 2) + offsetX,
    y: (gridX + gridY) * (ISO_TILE_HEIGHT / 2) + offsetY,
  };
}

/**
 * Convert screen coordinates to grid coordinates
 * Returns floating-point grid position (use Math.floor for tile selection)
 */
export function screenToGrid(screenX: number, screenY: number, offsetX = 0, offsetY = 0): GridCoord {
  const adjustedX = screenX - offsetX;
  const adjustedY = screenY - offsetY;

  const gridX = (adjustedX / (ISO_TILE_WIDTH / 2) + adjustedY / (ISO_TILE_HEIGHT / 2)) / 2;
  const gridY = (adjustedY / (ISO_TILE_HEIGHT / 2) - adjustedX / (ISO_TILE_WIDTH / 2)) / 2;

  return {
    x: Math.floor(gridX),
    y: Math.floor(gridY),
  };
}

/**
 * Check if a grid coordinate is within bounds
 */
export function isInBounds(coord: GridCoord, width: number, height: number): boolean {
  return coord.x >= 0 && coord.x < width && coord.y >= 0 && coord.y < height;
}

/**
 * Calculate the depth key for isometric rendering
 * Higher values should be rendered later (on top)
 */
export function getDepthKey(gridX: number, gridY: number, layerZ: number = 0): number {
  // Primary sort: layer z-index (higher layers render on top)
  // Secondary sort: diagonal depth within a layer (x + y)
  const layerDepthScale = 10000;
  return layerZ * layerDepthScale + (gridX + gridY);
}

/**
 * Get the screen position for rendering a tile (top-left corner of sprite)
 * This adjusts for the fact that sprites are drawn from top-left,
 * but isometric positions are at the top-center of the diamond
 */
export function getTileRenderPosition(
  gridX: number,
  gridY: number,
  offsetX: number,
  offsetY: number
): ScreenCoord {
  const center = gridToScreen(gridX, gridY, offsetX, offsetY);
  const spriteTopOffset = TILE_HEIGHT - ISO_TILE_HEIGHT;
  return {
    x: center.x - TILE_WIDTH / 2,
    y: center.y - spriteTopOffset,
  };
}

/**
 * Calculate which grid tiles are visible within a screen rectangle
 */
export function getVisibleGridBounds(
  screenWidth: number,
  screenHeight: number,
  offsetX: number,
  offsetY: number,
  gridWidth: number,
  gridHeight: number
): GridBounds {
  // Convert screen corners to grid coordinates
  const topLeft = screenToGrid(0, 0, offsetX, offsetY);
  const topRight = screenToGrid(screenWidth, 0, offsetX, offsetY);
  const bottomLeft = screenToGrid(0, screenHeight, offsetX, offsetY);
  const bottomRight = screenToGrid(screenWidth, screenHeight, offsetX, offsetY);

  // Find the min/max grid coordinates, with padding for edge tiles
  const minX = Math.max(0, Math.min(topLeft.x, bottomLeft.x) - 1);
  const maxX = Math.min(gridWidth - 1, Math.max(topRight.x, bottomRight.x) + 1);
  const minY = Math.max(0, Math.min(topLeft.y, topRight.y) - 1);
  const maxY = Math.min(gridHeight - 1, Math.max(bottomLeft.y, bottomRight.y) + 1);

  return { minX, minY, maxX, maxY };
}

/**
 * Calculate the center offset to position the grid in the middle of the canvas
 */
export function calculateCenterOffset(
  canvasWidth: number,
  canvasHeight: number,
  gridWidth: number,
  gridHeight: number
): ScreenCoord {
  // The grid spans from (0,0) to (gridWidth-1, gridHeight-1)
  // Calculate the total screen size needed for the grid
  const topLeft = gridToScreen(0, 0);
  const topRight = gridToScreen(gridWidth - 1, 0);
  const bottomLeft = gridToScreen(0, gridHeight - 1);
  const bottomCenter = gridToScreen(gridWidth - 1, gridHeight - 1);

  const gridScreenWidth = topRight.x - bottomLeft.x + ISO_TILE_WIDTH;
  const gridScreenHeight = bottomCenter.y - topLeft.y + TILE_HEIGHT;

  return {
    x: (canvasWidth - gridScreenWidth) / 2 + (gridWidth - 1) * (ISO_TILE_WIDTH / 2),
    y: (canvasHeight - gridScreenHeight) / 2 + TILE_HEIGHT / 2,
  };
}

/**
 * Iterate over grid coordinates in render order (back to front)
 * Callback receives coordinates sorted by depth
 */
export function forEachInRenderOrder(
  bounds: GridBounds,
  callback: (x: number, y: number, depth: number) => void
): void {
  const tiles: Array<{ x: number; y: number; depth: number }> = [];

  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      tiles.push({ x, y, depth: getDepthKey(x, y) });
    }
  }

  // Sort by depth (back to front)
  tiles.sort((a, b) => a.depth - b.depth);

  for (const tile of tiles) {
    callback(tile.x, tile.y, tile.depth);
  }
}
