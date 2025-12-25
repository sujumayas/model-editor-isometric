/**
 * Command pattern for undo/redo operations
 */

import { GridCoord, TileData, Command } from '../../core/types';
import { Level } from '../../level/Level';

/**
 * Command to place a tile
 */
export class PlaceTileCommand implements Command {
  readonly description: string;

  constructor(
    private level: Level,
    private layerId: string,
    private coord: GridCoord,
    private newTile: TileData,
    private previousTile: TileData | null
  ) {
    this.description = `Place tile ${newTile.tileId} at (${coord.x}, ${coord.y})`;
  }

  execute(): void {
    this.level.setTile(this.layerId, this.coord, this.newTile);
  }

  undo(): void {
    if (this.previousTile) {
      this.level.setTile(this.layerId, this.coord, this.previousTile);
    } else {
      this.level.removeTile(this.layerId, this.coord);
    }
  }
}

/**
 * Command to remove a tile
 */
export class RemoveTileCommand implements Command {
  readonly description: string;

  constructor(
    private level: Level,
    private layerId: string,
    private coord: GridCoord,
    private previousTile: TileData
  ) {
    this.description = `Remove tile at (${coord.x}, ${coord.y})`;
  }

  execute(): void {
    this.level.removeTile(this.layerId, this.coord);
  }

  undo(): void {
    this.level.setTile(this.layerId, this.coord, this.previousTile);
  }
}

/**
 * Command to batch multiple tile operations
 */
export class BatchTileCommand implements Command {
  readonly description: string;

  constructor(
    private commands: Command[],
    description?: string
  ) {
    this.description = description ?? `Batch operation (${commands.length} tiles)`;
  }

  execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i]!.undo();
    }
  }
}

/**
 * Command to clear all tiles from a layer
 */
export class ClearLayerCommand implements Command {
  readonly description: string;
  private previousTiles: Array<{ coord: GridCoord; tile: TileData }> = [];

  constructor(
    private level: Level,
    private layerId: string
  ) {
    this.description = `Clear layer "${layerId}"`;

    // Store current tiles for undo
    const layer = this.level.getLayer(layerId);
    if (layer) {
      this.previousTiles = layer.getAllTiles().map(({ tile, coord }) => ({
        coord,
        tile: { ...tile },
      }));
    }
  }

  execute(): void {
    const layer = this.level.getLayer(this.layerId);
    layer?.clear();
  }

  undo(): void {
    for (const { coord, tile } of this.previousTiles) {
      this.level.setTile(this.layerId, coord, tile);
    }
  }
}
