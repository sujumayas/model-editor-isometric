/**
 * Map controls UI component
 */

import { Editor } from '../editor/Editor';
import { BatchTileCommand, ClearLayerCommand } from '../editor/history/Command';

const MAP_SIZES = [32, 64, 128];

export class MapControls {
  private container: HTMLElement;
  private editor: Editor;
  private sizeButtons = new Map<number, HTMLButtonElement>();
  private sizeMeta: HTMLElement;
  private clearButton: HTMLButtonElement;

  constructor(containerId: string, editor: Editor) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    this.container = container;
    this.editor = editor;
    this.sizeMeta = document.createElement('div');
    this.clearButton = document.createElement('button');

    this.render();
    this.setupEventListeners();
    this.updateSizeDisplay();
  }

  /**
   * Render the map controls
   */
  private render(): void {
    this.container.innerHTML = '';
    this.sizeButtons.clear();

    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Map Size';

    this.sizeMeta.className = 'control-meta';

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    for (const size of MAP_SIZES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-btn size-btn';
      btn.dataset.size = String(size);
      btn.textContent = `${size}x${size}`;
      btn.setAttribute('aria-pressed', 'false');
      this.sizeButtons.set(size, btn);
      buttons.appendChild(btn);
    }

    group.appendChild(label);
    group.appendChild(this.sizeMeta);
    group.appendChild(buttons);

    this.clearButton.type = 'button';
    this.clearButton.className = 'tool-btn danger full-width';
    this.clearButton.textContent = 'Clear All';
    this.clearButton.title = 'Clear all tiles from all layers';

    this.container.appendChild(group);
    this.container.appendChild(this.clearButton);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const sizeBtn = target.closest('button[data-size]') as HTMLButtonElement | null;
      if (sizeBtn?.dataset.size) {
        const size = Number(sizeBtn.dataset.size);
        this.confirmResize(size);
        return;
      }
    });

    this.clearButton.addEventListener('click', () => {
      this.clearAllTiles();
    });

    this.editor.state.on('level:loaded', () => {
      this.updateSizeDisplay();
    });
  }

  /**
   * Confirm and resize the map
   */
  private confirmResize(size: number): void {
    const { gridWidth, gridHeight } = this.editor.level;
    if (gridWidth === size && gridHeight === size) {
      return;
    }

    const confirmed = window.confirm(
      `Resize map to ${size}x${size}? This will clear all tiles and start a new level.`
    );
    if (!confirmed) {
      return;
    }

    const name = this.editor.level.metadata.name;
    this.editor.newLevel(name, { width: size, height: size });
    this.updateSizeDisplay();
  }

  /**
   * Clear all tiles from all layers
   */
  private clearAllTiles(): void {
    const layers = this.editor.level.getLayers();
    const layersWithTiles = layers.filter((layer) => layer.tileCount > 0);
    if (layersWithTiles.length === 0) {
      return;
    }

    const confirmed = window.confirm('Clear all tiles from every layer?');
    if (!confirmed) {
      return;
    }

    const commands = layersWithTiles.map(
      (layer) => new ClearLayerCommand(this.editor.level, layer.config.id)
    );
    const command = new BatchTileCommand(commands, 'Clear all layers');
    this.editor.history.execute(command);
    this.editor.state.markDirty();
  }

  /**
   * Update map size display and active button state
   */
  private updateSizeDisplay(): void {
    const width = this.editor.level.gridWidth;
    const height = this.editor.level.gridHeight;
    this.sizeMeta.textContent = `Current: ${width}x${height}`;

    this.sizeButtons.forEach((btn, size) => {
      const isActive = width === height && size === width;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }
}
