/**
 * Layer panel UI component
 */

import { Editor } from '../editor/Editor';
import { Layer } from '../level/Layer';

/**
 * LayerPanel displays and manages layers
 */
export class LayerPanel {
  private container: HTMLElement;
  private editor: Editor;
  private layerElements = new Map<string, HTMLElement>();

  constructor(containerId: string, editor: Editor) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    this.container = container;
    this.editor = editor;

    this.render();
    this.setupEventListeners();
  }

  /**
   * Render the layer panel
   */
  render(): void {
    this.container.innerHTML = '';
    this.layerElements.clear();

    const layers = this.editor.level.getLayers();
    const activeLayerId = this.editor.state.activeLayerId;

    // Render in reverse order (top layer first in UI)
    const reversedLayers = [...layers].reverse();

    for (const layer of reversedLayers) {
      const item = this.createLayerItem(layer, layer.config.id === activeLayerId);
      this.layerElements.set(layer.config.id, item);
      this.container.appendChild(item);
    }
  }

  /**
   * Create a layer item element
   */
  private createLayerItem(layer: Layer, isActive: boolean): HTMLElement {
    const item = document.createElement('div');
    item.className = `layer-item${isActive ? ' active' : ''}`;
    item.dataset.layerId = layer.config.id;

    // Visibility toggle
    const visibilityBtn = document.createElement('button');
    visibilityBtn.className = 'layer-visibility';
    visibilityBtn.textContent = layer.config.visible ? '👁' : '○';
    visibilityBtn.title = layer.config.visible ? 'Hide layer' : 'Show layer';
    visibilityBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLayerVisibility(layer.config.id);
    });

    // Layer name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'layer-name';
    nameSpan.textContent = layer.config.name;

    // Tile count badge
    const countBadge = document.createElement('span');
    countBadge.className = 'layer-count';
    countBadge.textContent = String(layer.tileCount);
    countBadge.style.cssText = 'font-size: 11px; color: #666; margin-left: auto;';

    item.appendChild(visibilityBtn);
    item.appendChild(nameSpan);
    item.appendChild(countBadge);

    return item;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Click to select layer
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const layerItem = target.closest('.layer-item') as HTMLElement | null;

      if (layerItem && layerItem.dataset.layerId) {
        this.selectLayer(layerItem.dataset.layerId);
      }
    });

    // Listen for editor state changes
    this.editor.state.on('layer:changed', () => {
      this.updateActiveLayer();
    });

    // Re-render when history changes (tile counts may have changed)
    this.editor.history.on('change', () => {
      this.updateTileCounts();
    });
  }

  /**
   * Select a layer
   */
  selectLayer(layerId: string): void {
    this.editor.state.setActiveLayer(layerId);
    this.updateActiveLayer();
  }

  /**
   * Toggle layer visibility
   */
  toggleLayerVisibility(layerId: string): void {
    const layer = this.editor.level.getLayer(layerId);
    if (layer) {
      layer.toggleVisible();
      this.render(); // Re-render to update visibility icon
    }
  }

  /**
   * Update active layer visual state
   */
  private updateActiveLayer(): void {
    const activeLayerId = this.editor.state.activeLayerId;

    this.layerElements.forEach((el, layerId) => {
      if (layerId === activeLayerId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  /**
   * Update tile counts
   */
  private updateTileCounts(): void {
    const layers = this.editor.level.getLayers();

    for (const layer of layers) {
      const el = this.layerElements.get(layer.config.id);
      if (el) {
        const countBadge = el.querySelector('.layer-count');
        if (countBadge) {
          countBadge.textContent = String(layer.tileCount);
        }
      }
    }
  }
}
