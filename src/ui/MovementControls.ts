/**
 * UI controls for the movement testing view.
 * Includes tile type selection, properties editing, and game controls.
 */

import { MovementTester, ClickMode } from '../movement/MovementTester';
import { Editor } from '../editor/Editor';
import { GameplayTileType, Direction, TileProperties } from '../core/types';
import { PlayerStateType } from '../gameplay';

// All tile types with display info
const TILE_TYPES: Array<{ type: GameplayTileType; label: string; color: string }> = [
  { type: 'floor', label: 'Floor', color: '#4a9eff' },
  { type: 'blocker', label: 'Blocker', color: '#ff4a4a' },
  { type: 'slow', label: 'Slow', color: '#ffc75e' },
  { type: 'hole', label: 'Hole', color: '#000000' },
  { type: 'conveyor', label: 'Conveyor', color: '#64c8ff' },
  { type: 'hazard', label: 'Hazard', color: '#ff6432' },
  { type: 'door', label: 'Door', color: '#8b4513' },
  { type: 'exit', label: 'Exit', color: '#64ff64' },
  { type: 'spawn', label: 'Spawn', color: '#ffff64' },
];

const DIRECTIONS: Array<{ dir: Direction; label: string; arrow: string }> = [
  { dir: 'north', label: 'North', arrow: '↑' },
  { dir: 'east', label: 'East', arrow: '→' },
  { dir: 'south', label: 'South', arrow: '↓' },
  { dir: 'west', label: 'West', arrow: '←' },
];

export class MovementControls {
  private container: HTMLElement;
  private tester: MovementTester;
  private editor: Editor;

  private fileInput: HTMLInputElement;
  private modeButtons = new Map<ClickMode, HTMLButtonElement>();
  private typeButtons = new Map<GameplayTileType, HTMLButtonElement>();
  private directionButtons = new Map<Direction, HTMLButtonElement>();

  // UI elements
  private selectionLabel: HTMLElement;
  private typeLabel: HTMLElement;
  private pathLabel: HTMLElement;
  private hpLabel: HTMLElement;
  private turnLabel: HTMLElement;
  private stateLabel: HTMLElement;

  // Properties panel elements
  private propertiesPanel: HTMLElement;
  private directionPanel: HTMLElement;
  private linkedIdInput: HTMLInputElement;
  private linkedIdPanel: HTMLElement;
  private damageInput: HTMLInputElement;
  private damagePanel: HTMLElement;

  // Game controls
  private stepModeBtn: HTMLButtonElement;
  private advanceStepBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private doorControlsPanel: HTMLElement;

  // Current state
  private currentType: GameplayTileType = 'floor';
  private currentDirection: Direction = 'north';
  private currentLinkedId: string = 'door1';
  private currentDamage: number = 1;

  constructor(containerId: string, tester: MovementTester, editor: Editor) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    this.container = container;
    this.tester = tester;
    this.editor = editor;

    // Create elements
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.json,application/json';
    this.fileInput.style.display = 'none';

    this.selectionLabel = document.createElement('div');
    this.typeLabel = document.createElement('div');
    this.pathLabel = document.createElement('div');
    this.hpLabel = document.createElement('div');
    this.turnLabel = document.createElement('div');
    this.stateLabel = document.createElement('div');

    this.propertiesPanel = document.createElement('div');
    this.directionPanel = document.createElement('div');
    this.linkedIdInput = document.createElement('input');
    this.linkedIdPanel = document.createElement('div');
    this.damageInput = document.createElement('input');
    this.damagePanel = document.createElement('div');

    this.stepModeBtn = document.createElement('button');
    this.advanceStepBtn = document.createElement('button');
    this.resetBtn = document.createElement('button');
    this.doorControlsPanel = document.createElement('div');

    this.render();
    this.setupListeners();
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.appendChild(this.fileInput);

    this.container.appendChild(this.renderLoadSection());
    this.container.appendChild(this.renderModeSection());
    this.container.appendChild(this.renderTileTypeSection());
    this.container.appendChild(this.renderPropertiesSection());
    this.container.appendChild(this.renderGameControlsSection());
    this.container.appendChild(this.renderDoorControlsSection());
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
    label.textContent = 'Click Mode';

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    this.addModeButton(buttons, 'move', 'Move Player');
    this.addModeButton(buttons, 'edit', 'Edit Tiles');

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

  private renderTileTypeSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Tile Type';

    const grid = document.createElement('div');
    grid.className = 'tile-type-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    grid.style.gap = '4px';

    for (const { type, label: typeLabel, color } of TILE_TYPES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-btn small';
      btn.textContent = typeLabel;
      btn.style.borderLeft = `4px solid ${color}`;
      btn.addEventListener('click', () => this.selectTileType(type));
      this.typeButtons.set(type, btn);
      grid.appendChild(btn);
    }

    group.appendChild(label);
    group.appendChild(grid);
    return group;
  }

  private renderPropertiesSection(): HTMLElement {
    this.propertiesPanel.className = 'control-group';
    this.propertiesPanel.style.display = 'none';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Tile Properties';

    // Direction panel (for conveyors)
    this.directionPanel.className = 'direction-panel';
    this.directionPanel.style.display = 'none';
    const dirLabel = document.createElement('div');
    dirLabel.className = 'control-meta';
    dirLabel.textContent = 'Direction:';
    const dirButtons = document.createElement('div');
    dirButtons.className = 'button-group';
    for (const { dir, arrow } of DIRECTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-btn small';
      btn.textContent = arrow;
      btn.title = dir;
      btn.addEventListener('click', () => this.selectDirection(dir));
      this.directionButtons.set(dir, btn);
      dirButtons.appendChild(btn);
    }
    this.directionPanel.appendChild(dirLabel);
    this.directionPanel.appendChild(dirButtons);

    // Linked ID panel (for doors)
    this.linkedIdPanel.className = 'linked-id-panel';
    this.linkedIdPanel.style.display = 'none';
    const linkedLabel = document.createElement('div');
    linkedLabel.className = 'control-meta';
    linkedLabel.textContent = 'Door ID:';
    this.linkedIdInput.type = 'text';
    this.linkedIdInput.className = 'input-field';
    this.linkedIdInput.placeholder = 'door1';
    this.linkedIdInput.value = this.currentLinkedId;
    this.linkedIdInput.style.width = '100%';
    this.linkedIdInput.addEventListener('input', () => {
      this.currentLinkedId = this.linkedIdInput.value || 'door1';
      this.applyCurrentProperties();
    });
    this.linkedIdPanel.appendChild(linkedLabel);
    this.linkedIdPanel.appendChild(this.linkedIdInput);

    // Damage panel (for hazards)
    this.damagePanel.className = 'damage-panel';
    this.damagePanel.style.display = 'none';
    const damageLabel = document.createElement('div');
    damageLabel.className = 'control-meta';
    damageLabel.textContent = 'Damage:';
    this.damageInput.type = 'number';
    this.damageInput.className = 'input-field';
    this.damageInput.min = '1';
    this.damageInput.max = '10';
    this.damageInput.value = '1';
    this.damageInput.style.width = '60px';
    this.damageInput.addEventListener('input', () => {
      this.currentDamage = parseInt(this.damageInput.value) || 1;
      this.applyCurrentProperties();
    });
    this.damagePanel.appendChild(damageLabel);
    this.damagePanel.appendChild(this.damageInput);

    this.propertiesPanel.appendChild(label);
    this.propertiesPanel.appendChild(this.directionPanel);
    this.propertiesPanel.appendChild(this.linkedIdPanel);
    this.propertiesPanel.appendChild(this.damagePanel);

    return this.propertiesPanel;
  }

  private renderGameControlsSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Game Controls';

    const buttons = document.createElement('div');
    buttons.className = 'button-group-vertical';
    buttons.style.display = 'flex';
    buttons.style.flexDirection = 'column';
    buttons.style.gap = '4px';

    // Step mode toggle
    this.stepModeBtn.type = 'button';
    this.stepModeBtn.className = 'tool-btn full-width';
    this.stepModeBtn.textContent = 'Step Mode: OFF';
    this.stepModeBtn.addEventListener('click', () => {
      const isStepMode = this.tester.isStepMode();
      this.tester.setStepMode(!isStepMode);
      this.updateStepModeButton(!isStepMode);
    });

    // Advance step button
    this.advanceStepBtn.type = 'button';
    this.advanceStepBtn.className = 'tool-btn full-width';
    this.advanceStepBtn.textContent = 'Advance Step';
    this.advanceStepBtn.disabled = true;
    this.advanceStepBtn.addEventListener('click', () => {
      this.tester.advanceStep();
    });

    // Reset button
    this.resetBtn.type = 'button';
    this.resetBtn.className = 'tool-btn full-width';
    this.resetBtn.textContent = 'Reset Player';
    this.resetBtn.addEventListener('click', () => {
      this.tester.resetPlayer();
    });

    buttons.appendChild(this.stepModeBtn);
    buttons.appendChild(this.advanceStepBtn);
    buttons.appendChild(this.resetBtn);

    group.appendChild(label);
    group.appendChild(buttons);
    return group;
  }

  private renderDoorControlsSection(): HTMLElement {
    this.doorControlsPanel.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Door Controls';

    const hint = document.createElement('div');
    hint.className = 'control-meta';
    hint.textContent = 'No doors on map';
    hint.id = 'door-hint';

    this.doorControlsPanel.appendChild(label);
    this.doorControlsPanel.appendChild(hint);

    return this.doorControlsPanel;
  }

  private renderLegendSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Legend';

    const grid = document.createElement('div');
    grid.className = 'legend-grid';

    for (const { label: typeLabel, color } of TILE_TYPES) {
      grid.appendChild(this.createLegendRow(typeLabel, color));
    }

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
    label.textContent = 'Status';

    this.selectionLabel.className = 'control-meta';
    this.typeLabel.className = 'control-meta';
    this.pathLabel.className = 'control-meta';
    this.hpLabel.className = 'control-meta';
    this.turnLabel.className = 'control-meta';
    this.stateLabel.className = 'control-meta';

    group.appendChild(label);
    group.appendChild(this.selectionLabel);
    group.appendChild(this.typeLabel);
    group.appendChild(this.hpLabel);
    group.appendChild(this.stateLabel);
    group.appendChild(this.turnLabel);
    group.appendChild(this.pathLabel);

    this.updateSelectionStatus(null, { type: 'floor' });
    this.updateHPStatus(3, 3);
    this.updateStateStatus('idle');
    this.updateTurnStatus(0);
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

    this.tester.on('selection:changed', ({ coord, properties }) => {
      this.updateSelectionStatus(coord, properties);
      this.selectTileType(properties.type, false);
      if (properties.direction) {
        this.selectDirection(properties.direction, false);
      }
      if (properties.linkedId) {
        this.linkedIdInput.value = properties.linkedId;
        this.currentLinkedId = properties.linkedId;
      }
      if (properties.damage) {
        this.damageInput.value = String(properties.damage);
        this.currentDamage = properties.damage;
      }
    });

    this.tester.on('mode:changed', ({ mode }) => {
      this.updateModeButtons(mode);
    });

    this.tester.on('level:changed', () => {
      this.updateSelectionStatus(null, { type: 'floor' });
      this.updatePathStatus(false);
      this.updateDoorControls();
    });

    this.tester.on('path:updated', ({ hasPath }) => {
      this.updatePathStatus(hasPath);
    });

    this.tester.on('player:hp:changed', ({ hp, maxHp }) => {
      this.updateHPStatus(hp, maxHp);
    });

    this.tester.on('player:state:changed', ({ state }) => {
      this.updateStateStatus(state);
    });

    this.tester.on('gamestate:changed', ({ gameState }) => {
      this.updateTurnStatus(gameState.turnNumber);
      this.advanceStepBtn.disabled = !gameState.isStepMode || !gameState.waitingForStep;
      this.updateDoorControls();
    });

    // Initialize UI state
    this.updateModeButtons('move');
    this.selectTileType('floor', false);
    this.selectDirection('north', false);
  }

  private selectTileType(type: GameplayTileType, apply: boolean = true): void {
    this.currentType = type;

    // Update button states
    this.typeButtons.forEach((btn, t) => {
      const isActive = t === type;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    // Show/hide properties panels based on type
    const needsProperties = type === 'conveyor' || type === 'door' || type === 'hazard';
    this.propertiesPanel.style.display = needsProperties ? 'block' : 'none';
    this.directionPanel.style.display = type === 'conveyor' ? 'block' : 'none';
    this.linkedIdPanel.style.display = type === 'door' ? 'block' : 'none';
    this.damagePanel.style.display = type === 'hazard' ? 'block' : 'none';

    if (apply) {
      this.applyCurrentProperties();
    }
  }

  private selectDirection(dir: Direction, apply: boolean = true): void {
    this.currentDirection = dir;

    this.directionButtons.forEach((btn, d) => {
      const isActive = d === dir;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    if (apply) {
      this.applyCurrentProperties();
    }
  }

  private applyCurrentProperties(): void {
    const selectedCoord = this.tester.getSelectedCoord();
    if (!selectedCoord) return;

    const properties: TileProperties = {
      type: this.currentType,
      direction: this.currentType === 'conveyor' ? this.currentDirection : undefined,
      linkedId: this.currentType === 'door' ? this.currentLinkedId : undefined,
      damage: this.currentType === 'hazard' ? this.currentDamage : undefined,
    };

    this.tester.setSelectedProperties(properties);
    this.updateDoorControls();
  }

  private updateModeButtons(active: ClickMode): void {
    this.modeButtons.forEach((btn, mode) => {
      const isActive = mode === active;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  private updateSelectionStatus(coord: { x: number; y: number } | null, properties: TileProperties): void {
    if (coord) {
      this.selectionLabel.textContent = `Tile: ${coord.x}, ${coord.y}`;
    } else {
      this.selectionLabel.textContent = 'Tile: --';
    }
    this.typeLabel.textContent = `Type: ${properties.type}`;
  }

  private updateHPStatus(hp: number, maxHp: number): void {
    this.hpLabel.textContent = `HP: ${hp}/${maxHp}`;
    this.hpLabel.style.color = hp <= 1 ? '#ff4a4a' : '#4aff9e';
  }

  private updateStateStatus(state: PlayerStateType): void {
    const stateLabels: Record<PlayerStateType, string> = {
      idle: 'Idle',
      moving: 'Moving',
      dead: 'DEAD',
      won: 'WON!',
    };
    this.stateLabel.textContent = `State: ${stateLabels[state]}`;

    if (state === 'dead') {
      this.stateLabel.style.color = '#ff4a4a';
    } else if (state === 'won') {
      this.stateLabel.style.color = '#ffd700';
    } else {
      this.stateLabel.style.color = '';
    }
  }

  private updateTurnStatus(turn: number): void {
    this.turnLabel.textContent = `Turn: ${turn}`;
  }

  private updatePathStatus(hasPath: boolean): void {
    this.pathLabel.textContent = hasPath ? 'Path: ready' : 'Path: none';
  }

  private updateStepModeButton(isStepMode: boolean): void {
    this.stepModeBtn.textContent = `Step Mode: ${isStepMode ? 'ON' : 'OFF'}`;
    this.stepModeBtn.classList.toggle('active', isStepMode);
  }

  private updateDoorControls(): void {
    const doorIds = this.tester.getAllDoorIds();

    // Clear existing door buttons
    while (this.doorControlsPanel.children.length > 1) {
      this.doorControlsPanel.removeChild(this.doorControlsPanel.lastChild!);
    }

    if (doorIds.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'control-meta';
      hint.textContent = 'No doors on map';
      this.doorControlsPanel.appendChild(hint);
      return;
    }

    const buttons = document.createElement('div');
    buttons.className = 'button-group-vertical';
    buttons.style.display = 'flex';
    buttons.style.flexDirection = 'column';
    buttons.style.gap = '4px';

    for (const doorId of doorIds) {
      const isOpen = this.tester.isDoorOpen(doorId);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-btn full-width';
      btn.textContent = `${doorId}: ${isOpen ? 'OPEN' : 'CLOSED'}`;
      btn.classList.toggle('active', isOpen);
      btn.addEventListener('click', () => {
        this.tester.toggleDoor(doorId);
        this.updateDoorControls();
      });
      buttons.appendChild(btn);
    }

    this.doorControlsPanel.appendChild(buttons);
  }
}
