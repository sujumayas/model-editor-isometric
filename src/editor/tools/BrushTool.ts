/**
 * Brush tool for placing tiles
 */

import { GridCoord } from '../../core/types';
import { BaseTool, ToolContext } from './Tool';
import { PlaceTileCommand } from '../history/Command';

/**
 * BrushTool places tiles on the active layer
 */
export class BrushTool extends BaseTool {
  readonly type = 'brush' as const;
  readonly name = 'Brush';
  readonly description = 'Place tiles on the map';
  readonly shortcut = 'b';

  private placedCoords = new Set<string>();

  onActivate(ctx: ToolContext): void {
    super.onActivate(ctx);
    this.placedCoords.clear();
  }

  onDeactivate(ctx: ToolContext): void {
    super.onDeactivate(ctx);
    this.placedCoords.clear();
  }

  onMouseDown(ctx: ToolContext, coord: GridCoord): void {
    this.isDrawing = true;
    this.placedCoords.clear();
    this.placeTile(ctx, coord);
  }

  onMouseMove(ctx: ToolContext, coord: GridCoord, isPressed: boolean): void {
    if (isPressed && this.isDrawing) {
      // Only place if coordinate changed
      if (this.hasCoordChanged(coord)) {
        this.placeTile(ctx, coord);
      }
    }
    this.updateLastCoord(coord);
  }

  onMouseUp(_ctx: ToolContext, _coord: GridCoord): void {
    this.isDrawing = false;
    this.placedCoords.clear();
  }

  getCursor(): string {
    return 'crosshair';
  }

  private placeTile(ctx: ToolContext, coord: GridCoord): void {
    const { level, editorState, history } = ctx;
    const layerId = editorState.activeLayerId;
    const tileId = editorState.selectedTileId;

    // Need active layer and selected tile
    if (!layerId || tileId === null) return;

    // Check bounds
    if (!level.isInBounds(coord)) return;

    // Skip if already placed in this stroke
    const coordKey = `${coord.x},${coord.y}`;
    if (this.placedCoords.has(coordKey)) return;
    this.placedCoords.add(coordKey);

    // Get current tile for undo
    const previousTile = level.getTile(layerId, coord);

    // Skip if same tile already there
    if (previousTile?.tileId === tileId) return;

    // Create and execute command
    const command = new PlaceTileCommand(
      level,
      layerId,
      coord,
      { tileId },
      previousTile
    );

    history.execute(command);
    editorState.markDirty();
  }
}
