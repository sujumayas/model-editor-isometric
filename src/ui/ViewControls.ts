/**
 * View controls UI component
 */

import { Editor } from '../editor/Editor';

export class ViewControls {
  private container: HTMLElement;
  private editor: Editor;
  private zoomInput: HTMLInputElement;
  private zoomValue: HTMLElement;

  constructor(containerId: string, editor: Editor) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    this.container = container;
    this.editor = editor;

    this.zoomInput = document.createElement('input');
    this.zoomValue = document.createElement('span');

    this.render();
    this.setupEventListeners();
    this.updateZoomDisplay(this.editor.camera.zoom);
  }

  /**
   * Render the view controls
   */
  private render(): void {
    this.container.innerHTML = '';

    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Zoom';

    const row = document.createElement('div');
    row.className = 'control-row';

    this.zoomInput.type = 'range';
    this.zoomInput.className = 'control-range';
    this.zoomInput.min = String(this.editor.camera.minZoomLevel);
    this.zoomInput.max = String(this.editor.camera.maxZoomLevel);
    this.zoomInput.step = '0.1';
    this.zoomInput.value = String(this.editor.camera.zoom);
    this.zoomInput.setAttribute('aria-label', 'Zoom level');

    this.zoomValue.className = 'control-value';

    row.appendChild(this.zoomInput);
    row.appendChild(this.zoomValue);

    group.appendChild(label);
    group.appendChild(row);
    this.container.appendChild(group);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.zoomInput.addEventListener('input', () => {
      const zoom = Number(this.zoomInput.value);
      const rect = this.editor.canvas.element.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      this.editor.camera.setZoom(zoom, centerX, centerY);
    });

    this.editor.camera.onZoomChange((zoom) => {
      this.updateZoomDisplay(zoom);
    });
  }

  /**
   * Update zoom display and slider
   */
  private updateZoomDisplay(zoom: number): void {
    const rounded = Math.round(zoom * 100) / 100;
    this.zoomInput.value = String(rounded);
    this.zoomValue.textContent = `${Math.round(rounded * 100)}%`;
  }
}
