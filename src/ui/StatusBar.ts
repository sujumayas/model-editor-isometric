/**
 * Status bar UI component
 */

import { Editor } from '../editor/Editor';

/**
 * StatusBar displays current editor state information
 */
export class StatusBar {
  private positionEl: HTMLElement;
  private tileEl: HTMLElement;
  private layerEl: HTMLElement;
  private editor: Editor;

  constructor(editor: Editor) {
    this.editor = editor;

    // Get status bar elements
    this.positionEl = document.getElementById('status-position')!;
    this.tileEl = document.getElementById('status-tile')!;
    this.layerEl = document.getElementById('status-layer')!;

    this.setupEventListeners();
    this.update();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Update on hover changes
    this.editor.state.on('hover:changed', () => {
      this.updatePosition();
    });

    // Update on tile selection
    this.editor.state.on('tile:selected', () => {
      this.updateTile();
    });

    // Update on layer changes
    this.editor.state.on('layer:changed', () => {
      this.updateLayer();
    });
  }

  /**
   * Update all status displays
   */
  update(): void {
    this.updatePosition();
    this.updateTile();
    this.updateLayer();
  }

  /**
   * Update position display
   */
  private updatePosition(): void {
    const coord = this.editor.state.hoveredCoord;
    if (coord) {
      this.positionEl.textContent = `Position: ${coord.x}, ${coord.y}`;
    } else {
      this.positionEl.textContent = 'Position: --';
    }
  }

  /**
   * Update tile display
   */
  private updateTile(): void {
    const tileId = this.editor.state.selectedTileId;
    if (tileId !== null) {
      this.tileEl.textContent = `Tile: ${tileId}`;
    } else {
      this.tileEl.textContent = 'Tile: --';
    }
  }

  /**
   * Update layer display
   */
  private updateLayer(): void {
    const layerId = this.editor.state.activeLayerId;
    if (layerId) {
      const layer = this.editor.level.getLayer(layerId);
      this.layerEl.textContent = `Layer: ${layer?.config.name ?? layerId}`;
    } else {
      this.layerEl.textContent = 'Layer: --';
    }
  }
}
