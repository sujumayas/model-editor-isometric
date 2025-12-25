/**
 * Eraser tool for removing tiles
 */

import { GridCoord } from '../../core/types';
import { BaseTool, ToolContext } from './Tool';
import { RemoveTileCommand } from '../history/Command';

/**
 * EraserTool removes tiles from the active layer
 */
export class EraserTool extends BaseTool {
  readonly type = 'eraser' as const;
  readonly name = 'Eraser';
  readonly description = 'Remove tiles from the map';
  readonly shortcut = 'e';

  private erasedCoords = new Set<string>();

  onActivate(ctx: ToolContext): void {
    super.onActivate(ctx);
    this.erasedCoords.clear();
  }

  onDeactivate(ctx: ToolContext): void {
    super.onDeactivate(ctx);
    this.erasedCoords.clear();
  }

  onMouseDown(ctx: ToolContext, coord: GridCoord): void {
    this.isDrawing = true;
    this.erasedCoords.clear();
    this.eraseTile(ctx, coord);
  }

  onMouseMove(ctx: ToolContext, coord: GridCoord, isPressed: boolean): void {
    if (isPressed && this.isDrawing) {
      if (this.hasCoordChanged(coord)) {
        this.eraseTile(ctx, coord);
      }
    }
    this.updateLastCoord(coord);
  }

  onMouseUp(_ctx: ToolContext, _coord: GridCoord): void {
    this.isDrawing = false;
    this.erasedCoords.clear();
  }

  getCursor(): string {
    return 'crosshair';
  }

  private eraseTile(ctx: ToolContext, coord: GridCoord): void {
    const { level, editorState, history } = ctx;
    const layerId = editorState.activeLayerId;

    // Need active layer
    if (!layerId) return;

    // Check bounds
    if (!level.isInBounds(coord)) return;

    // Skip if already erased in this stroke
    const coordKey = `${coord.x},${coord.y}`;
    if (this.erasedCoords.has(coordKey)) return;
    this.erasedCoords.add(coordKey);

    // Get current tile for undo
    const previousTile = level.getTile(layerId, coord);

    // Skip if no tile there
    if (!previousTile) return;

    // Create and execute command
    const command = new RemoveTileCommand(level, layerId, coord, previousTile);

    history.execute(command);
    editorState.markDirty();
  }
}
