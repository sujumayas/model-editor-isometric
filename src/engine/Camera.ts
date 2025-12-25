/**
 * Camera for viewport control (pan and zoom)
 */

import { CameraState, Viewport, ScreenCoord, GridCoord, GridBounds } from '../core/types';
import { screenToGrid, getVisibleGridBounds, gridToScreen } from '../core/isometric';
import { GRID_WIDTH, GRID_HEIGHT } from '../core/constants';

export interface CameraOptions {
  /** Initial X offset */
  x?: number;
  /** Initial Y offset */
  y?: number;
  /** Initial zoom level */
  zoom?: number;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
}

/**
 * Camera manages the viewport position and zoom level
 */
export class Camera {
  private state: CameraState;
  private minZoom: number;
  private maxZoom: number;
  private viewport: Viewport = { width: 0, height: 0 };
  private zoomListeners = new Set<(zoom: number) => void>();

  constructor(options: CameraOptions = {}) {
    this.state = {
      x: options.x ?? 0,
      y: options.y ?? 0,
      zoom: options.zoom ?? 1,
    };
    this.minZoom = options.minZoom ?? 0.5;
    this.maxZoom = options.maxZoom ?? 3;
  }

  /**
   * Get the current camera X position
   */
  get x(): number {
    return this.state.x;
  }

  /**
   * Get the current camera Y position
   */
  get y(): number {
    return this.state.y;
  }

  /**
   * Get the current zoom level
   */
  get zoom(): number {
    return this.state.zoom;
  }

  /**
   * Get the minimum zoom level
   */
  get minZoomLevel(): number {
    return this.minZoom;
  }

  /**
   * Get the maximum zoom level
   */
  get maxZoomLevel(): number {
    return this.maxZoom;
  }

  /**
   * Set the viewport size (call when canvas resizes)
   */
  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
  }

  /**
   * Set the camera position
   */
  setPosition(x: number, y: number): void {
    this.state.x = x;
    this.state.y = y;
  }

  /**
   * Pan the camera by a delta amount
   */
  pan(deltaX: number, deltaY: number): void {
    this.state.x += deltaX;
    this.state.y += deltaY;
  }

  /**
   * Set the zoom level
   */
  setZoom(zoom: number, centerX?: number, centerY?: number): void {
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    const previousZoom = this.state.zoom;

    // If center point provided, adjust position to zoom toward that point
    if (centerX !== undefined && centerY !== undefined) {
      const zoomRatio = newZoom / this.state.zoom;
      this.state.x = centerX - (centerX - this.state.x) * zoomRatio;
      this.state.y = centerY - (centerY - this.state.y) * zoomRatio;
    }

    this.state.zoom = newZoom;
    if (previousZoom !== newZoom) {
      this.emitZoomChange();
    }
  }

  /**
   * Zoom by a delta amount (positive = zoom in, negative = zoom out)
   */
  zoomBy(delta: number, centerX?: number, centerY?: number): void {
    this.setZoom(this.state.zoom * (1 + delta), centerX, centerY);
  }

  /**
   * Reset camera to default position and zoom
   */
  reset(): void {
    this.state.x = 0;
    this.state.y = 0;
    this.setZoom(1);
  }

  /**
   * Center the camera on a specific grid coordinate
   */
  centerOn(gridX: number, gridY: number): void {
    // Calculate screen position of the grid coordinate
    const screen = gridToScreen(gridX, gridY);

    // Adjust camera to center this point
    this.state.x = this.viewport.width / 2 - screen.x * this.state.zoom;
    this.state.y = this.viewport.height / 2 - screen.y * this.state.zoom;
  }

  /**
   * Convert screen coordinates to world coordinates (accounting for camera)
   */
  screenToWorld(screenX: number, screenY: number): ScreenCoord {
    return {
      x: (screenX - this.state.x) / this.state.zoom,
      y: (screenY - this.state.y) / this.state.zoom,
    };
  }

  /**
   * Convert world coordinates to screen coordinates (accounting for camera)
   */
  worldToScreen(worldX: number, worldY: number): ScreenCoord {
    return {
      x: worldX * this.state.zoom + this.state.x,
      y: worldY * this.state.zoom + this.state.y,
    };
  }

  /**
   * Convert screen coordinates directly to grid coordinates
   */
  screenToGrid(screenX: number, screenY: number): GridCoord {
    const world = this.screenToWorld(screenX, screenY);
    return screenToGrid(world.x, world.y);
  }

  /**
   * Get the visible grid bounds based on current camera state
   */
  getVisibleBounds(gridWidth: number = GRID_WIDTH, gridHeight: number = GRID_HEIGHT): GridBounds {
    return getVisibleGridBounds(
      this.viewport.width / this.state.zoom,
      this.viewport.height / this.state.zoom,
      -this.state.x / this.state.zoom,
      -this.state.y / this.state.zoom,
      gridWidth,
      gridHeight
    );
  }

  /**
   * Apply camera transform to a canvas context
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.state.x, this.state.y);
    ctx.scale(this.state.zoom, this.state.zoom);
  }

  /**
   * Get the current camera state (for serialization)
   */
  getState(): Readonly<CameraState> {
    return { ...this.state };
  }

  /**
   * Restore camera state from saved data
   */
  setState(state: CameraState): void {
    this.state = { ...state };
    this.emitZoomChange();
  }

  // =========================================================================
  // Events
  // =========================================================================

  onZoomChange(handler: (zoom: number) => void): () => void {
    this.zoomListeners.add(handler);
    return () => {
      this.zoomListeners.delete(handler);
    };
  }

  private emitZoomChange(): void {
    for (const handler of this.zoomListeners) {
      handler(this.state.zoom);
    }
  }
}
