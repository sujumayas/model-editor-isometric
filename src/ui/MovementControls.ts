/**
 * UI for the movement testing view.
 */

import { MovementTester, TileKind, ClickMode } from '../movement/MovementTester';
import { Editor } from '../editor/Editor';

export class MovementControls {
  private container: HTMLElement;
  private tester: MovementTester;
  private editor: Editor;

  private fileInput: HTMLInputElement;
  private modeButtons = new Map<ClickMode, HTMLButtonElement>();
  private kindButtons = new Map<TileKind, HTMLButtonElement>();
  private selectionLabel: HTMLElement;
  private kindLabel: HTMLElement;
  private pathLabel: HTMLElement;

  constructor(containerId: string, tester: MovementTester, editor: Editor) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    this.container = container;
    this.tester = tester;
    this.editor = editor;

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.json,application/json';
    this.fileInput.style.display = 'none';

    this.selectionLabel = document.createElement('div');
    this.kindLabel = document.createElement('div');
    this.pathLabel = document.createElement('div');

    this.render();
    this.setupListeners();
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.appendChild(this.fileInput);

    this.container.appendChild(this.renderLoadSection());
    this.container.appendChild(this.renderModeSection());
    this.container.appendChild(this.renderKindSection());
    this.container.appendChild(this.renderLegendSection());
    this.container.appendChild(this.renderStatusSection());
  }

  private renderLoadSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Map Input';

    const loadBtn = document.createElement('button');
    loadBtn.className = 'tool-btn full-width';
    loadBtn.type = 'button';
    loadBtn.textContent = 'Load Map JSON';
    loadBtn.addEventListener('click', () => this.fileInput.click());

    const useEditorBtn = document.createElement('button');
    useEditorBtn.className = 'tool-btn full-width';
    useEditorBtn.type = 'button';
    useEditorBtn.textContent = 'Use Current Editor Map';
    useEditorBtn.addEventListener('click', () => {
      this.tester.useLevelClone(this.editor.level);
    });

    group.appendChild(label);
    group.appendChild(loadBtn);
    group.appendChild(useEditorBtn);
    return group;
  }

  private renderModeSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Canvas Click Action';

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    this.addModeButton(buttons, 'move', 'Move Player');
    this.addModeButton(buttons, 'edit', 'Select Tile');

    group.appendChild(label);
    group.appendChild(buttons);
    return group;
  }

  private addModeButton(container: HTMLElement, mode: ClickMode, text: string): void {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool-btn small';
    btn.dataset.mode = mode;
    btn.textContent = text;
    btn.addEventListener('click', () => {
      this.tester.setClickMode(mode);
      this.updateModeButtons(mode);
    });
    this.modeButtons.set(mode, btn);
    container.appendChild(btn);
  }

  private renderKindSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Tile Kind';

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    this.addKindButton(buttons, 'floor', 'Floor');
    this.addKindButton(buttons, 'blocker', 'Blocker');
    this.addKindButton(buttons, 'slow', 'Slow');

    group.appendChild(label);
    group.appendChild(buttons);
    return group;
  }

  private addKindButton(container: HTMLElement, kind: TileKind, text: string): void {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool-btn small';
    btn.dataset.kind = kind;
    btn.textContent = text;
    btn.addEventListener('click', () => {
      this.tester.setSelectedKind(kind);
      this.updateKindButtons(kind);
    });
    this.kindButtons.set(kind, btn);
    container.appendChild(btn);
  }

  private renderLegendSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Legend';

    const grid = document.createElement('div');
    grid.className = 'legend-grid';

    grid.appendChild(this.createLegendRow('Floor', '#4a9eff'));
    grid.appendChild(this.createLegendRow('Blocker', '#ff4a4a'));
    grid.appendChild(this.createLegendRow('Slow', '#ffc75e'));

    group.appendChild(label);
    group.appendChild(grid);
    return group;
  }

  private createLegendRow(name: string, color: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'kind-row';

    const indicator = document.createElement('span');
    indicator.className = 'kind-indicator';
    indicator.style.backgroundColor = color;

    const text = document.createElement('span');
    text.textContent = name;

    row.appendChild(indicator);
    row.appendChild(text);
    return row;
  }

  private renderStatusSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Selection';

    this.selectionLabel.className = 'control-meta';
    this.kindLabel.className = 'control-meta';
    this.pathLabel.className = 'control-meta';

    group.appendChild(label);
    group.appendChild(this.selectionLabel);
    group.appendChild(this.kindLabel);
    group.appendChild(this.pathLabel);

    this.updateSelectionStatus(null, 'floor');
    this.updatePathStatus(false);
    return group;
  }

  private setupListeners(): void {
    this.fileInput.addEventListener('change', async () => {
      const file = this.fileInput.files?.[0];
      if (!file) return;
      try {
        await this.tester.loadLevelFromFile(file);
      } finally {
        this.fileInput.value = '';
      }
    });

    this.tester.on('selection:changed', ({ coord, kind }) => {
      this.updateSelectionStatus(coord, kind);
      this.updateKindButtons(kind);
    });

    this.tester.on('mode:changed', ({ mode }) => {
      this.updateModeButtons(mode);
    });

    this.tester.on('level:changed', () => {
      this.updateSelectionStatus(null, 'floor');
      this.updatePathStatus(false);
    });

    this.tester.on('path:updated', ({ hasPath }) => {
      this.updatePathStatus(hasPath);
    });

    // Initialize UI state
    this.updateModeButtons('move');
    this.updateKindButtons('floor');
  }

  private updateSelectionStatus(coord: { x: number; y: number } | null, kind: TileKind): void {
    if (coord) {
      this.selectionLabel.textContent = `Tile: ${coord.x}, ${coord.y}`;
    } else {
      this.selectionLabel.textContent = 'Tile: --';
    }
    this.kindLabel.textContent = `Kind: ${kind}`;
  }

  private updateModeButtons(active: ClickMode): void {
    this.modeButtons.forEach((btn, mode) => {
      const isActive = mode === active;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  private updateKindButtons(active: TileKind): void {
    this.kindButtons.forEach((btn, kind) => {
      const isActive = kind === active;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  private updatePathStatus(hasPath: boolean): void {
    this.pathLabel.textContent = hasPath ? 'Path: ready' : 'Path: none';
  }
}
