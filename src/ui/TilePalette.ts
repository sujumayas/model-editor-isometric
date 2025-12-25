/**
 * Tile palette UI component
 */

import { TileId } from '../core/types';
import { TileRegistry, TILE_CATEGORIES } from '../assets/TileRegistry';
import { Editor } from '../editor/Editor';

/**
 * TilePalette displays available tiles for selection
 */
export class TilePalette {
  private container: HTMLElement;
  private editor: Editor;
  private tileRegistry: TileRegistry;
  private selectedTileId: TileId | null = null;
  private tileElements = new Map<TileId, HTMLElement>();

  constructor(containerId: string, editor: Editor, tileRegistry: TileRegistry) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    this.container = container;
    this.editor = editor;
    this.tileRegistry = tileRegistry;

    this.render();
    this.setupEventListeners();
  }

  /**
   * Render the tile palette
   */
  private render(): void {
    this.container.innerHTML = '';

    // Get all tile IDs
    const tileIds = this.tileRegistry.getAllTileIds();

    // Create grid
    const grid = document.createElement('div');
    grid.id = 'tile-grid';

    for (const tileId of tileIds) {
      const item = this.createTileItem(tileId);
      this.tileElements.set(tileId, item);
      grid.appendChild(item);
    }

    this.container.appendChild(grid);
  }

  /**
   * Create a tile item element
   */
  private createTileItem(tileId: TileId): HTMLElement {
    const item = document.createElement('div');
    item.className = 'tile-item';
    item.dataset.tileId = String(tileId);

    // Create canvas preview
    const canvas = this.tileRegistry.createTilePreview(tileId, 1.5);
    canvas.style.imageRendering = 'pixelated';
    item.appendChild(canvas);

    return item;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tileItem = target.closest('.tile-item') as HTMLElement | null;

      if (tileItem && tileItem.dataset.tileId) {
        const tileId = parseInt(tileItem.dataset.tileId, 10);
        this.selectTile(tileId);
      }
    });

    // Listen for editor state changes
    this.editor.state.on('tile:selected', (data) => {
      const { tileId } = data as { tileId: TileId | null };
      this.updateSelection(tileId);
    });
  }

  /**
   * Select a tile
   */
  selectTile(tileId: TileId): void {
    this.selectedTileId = tileId;
    this.editor.state.setSelectedTile(tileId);
    this.updateSelection(tileId);
  }

  /**
   * Update visual selection
   */
  private updateSelection(tileId: TileId | null): void {
    // Remove previous selection
    this.tileElements.forEach((el) => {
      el.classList.remove('selected');
    });

    // Add new selection
    if (tileId !== null) {
      const el = this.tileElements.get(tileId);
      el?.classList.add('selected');
    }

    this.selectedTileId = tileId;
  }

  /**
   * Get the selected tile ID
   */
  getSelectedTileId(): TileId | null {
    return this.selectedTileId;
  }
}
