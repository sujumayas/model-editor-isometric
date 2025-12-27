/**
 * UI for the movement testing view.
 */

import { MovementTester, TileKind, ClickMode, SimulationSpeed } from '../movement/MovementTester';
import { Editor } from '../editor/Editor';
import { CardinalDirection, GridCoord, TileBehavior } from '../core/types';
import { PHASE_TWO_SCENARIOS, TEST_SCENARIOS, TestScenario } from '../movement/testMaps';

interface PlayerUIState {
  hp: number;
  maxHp: number;
  alive: boolean;
  reachedExit: boolean;
  state: string;
  paused: boolean;
  speed: number;
  nextStep: GridCoord | null;
  pathHasHazard: boolean;
  stepMode: boolean;
  destination: GridCoord | null;
  spawn: GridCoord | null;
}

export class MovementControls {
  private container: HTMLElement;
  private tester: MovementTester;
  private editor: Editor;

  private fileInput: HTMLInputElement;
  private modeButtons = new Map<ClickMode, HTMLButtonElement>();
  private kindButtons = new Map<TileKind, HTMLButtonElement>();
  private scenarioButtons = new Map<string, HTMLButtonElement>();
  private selectionLabel: HTMLElement;
  private kindLabel: HTMLElement;
  private pathLabel: HTMLElement;
  private hpLabel: HTMLElement;
  private stateLabel: HTMLElement;
  private nextMoveLabel: HTMLElement;
  private stepLabel: HTMLElement;
  private statusLabel: HTMLElement;
  private stepToggleBtn: HTMLButtonElement;
  private advanceBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private playPauseBtn: HTMLButtonElement;
  private speedButtons = new Map<SimulationSpeed, HTMLButtonElement>();

  private directionSelect: HTMLSelectElement;
  private doorIdInput: HTMLInputElement;
  private doorToggleBtn: HTMLButtonElement;
  private hazardDamageInput: HTMLInputElement;
  private propertyRows: Record<'direction' | 'doorId' | 'doorState' | 'hazard', HTMLElement> = {
    direction: document.createElement('div'),
    doorId: document.createElement('div'),
    doorState: document.createElement('div'),
    hazard: document.createElement('div'),
  };

  private selectedCoord: GridCoord | null = null;
  private selectionBehavior: TileBehavior = { type: 'floor' };
  private playerState: PlayerUIState | null = null;
  private hasPath = false;

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
    this.hpLabel = document.createElement('div');
    this.stateLabel = document.createElement('div');
    this.nextMoveLabel = document.createElement('div');
    this.stepLabel = document.createElement('div');
    this.statusLabel = document.createElement('div');

    this.playPauseBtn = document.createElement('button');
    this.stepToggleBtn = document.createElement('button');
    this.advanceBtn = document.createElement('button');
    this.resetBtn = document.createElement('button');

    this.directionSelect = document.createElement('select');
    this.doorIdInput = document.createElement('input');
    this.doorToggleBtn = document.createElement('button');
    this.hazardDamageInput = document.createElement('input');

    this.render();
    this.setupListeners();
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.appendChild(this.fileInput);

    this.container.appendChild(this.renderLoadSection());
    this.container.appendChild(this.renderScenarioSection('Phase 1 Test Maps', TEST_SCENARIOS));
    this.container.appendChild(this.renderScenarioSection('Phase 2 Test Maps', PHASE_TWO_SCENARIOS));
    this.container.appendChild(this.renderMovementSection());
    this.container.appendChild(this.renderModeSection());
    this.container.appendChild(this.renderKindSection());
    this.container.appendChild(this.renderPropertiesSection());
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

  private renderScenarioSection(title: string, scenarios: TestScenario[]): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = title;

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    scenarios.forEach((scenario) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-btn small';
      btn.textContent = scenario.name;
      btn.title = scenario.description;
      btn.addEventListener('click', () => {
        const level = scenario.build();
        this.tester.setLevel(level);
      });
      this.scenarioButtons.set(scenario.id, btn);
      buttons.appendChild(btn);
    });

    group.appendChild(label);
    group.appendChild(buttons);
    return group;
  }

  private renderMovementSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Simulation';

    const playControls = document.createElement('div');
    playControls.className = 'button-group';

    this.playPauseBtn.type = 'button';
    this.playPauseBtn.className = 'tool-btn small';
    this.playPauseBtn.textContent = 'Play';
    this.playPauseBtn.addEventListener('click', () => {
      const paused = this.playerState?.paused ?? true;
      this.tester.setPaused(!paused);
    });

    const speedControls = document.createElement('div');
    speedControls.className = 'button-group';

    this.addSpeedButton(speedControls, 1);
    this.addSpeedButton(speedControls, 2);
    this.addSpeedButton(speedControls, 4);

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    this.stepToggleBtn.type = 'button';
    this.stepToggleBtn.className = 'tool-btn small';
    this.stepToggleBtn.textContent = 'Step-by-step: Off';
    this.stepToggleBtn.addEventListener('click', () => {
      const next = !(this.playerState?.stepMode ?? false);
      this.tester.setStepMode(next);
      this.updateStepToggle(next);
    });

    this.advanceBtn.type = 'button';
    this.advanceBtn.className = 'tool-btn small';
    this.advanceBtn.textContent = 'Advance Turn';
    this.advanceBtn.addEventListener('click', () => this.tester.advanceTurn());

    this.resetBtn.type = 'button';
    this.resetBtn.className = 'tool-btn small';
    this.resetBtn.textContent = 'Reset to Spawn';
    this.resetBtn.addEventListener('click', () => this.tester.resetPlayer());

    playControls.appendChild(this.playPauseBtn);
    buttons.appendChild(this.stepToggleBtn);
    buttons.appendChild(this.advanceBtn);
    buttons.appendChild(this.resetBtn);

    group.appendChild(label);
    group.appendChild(playControls);
    group.appendChild(speedControls);
    group.appendChild(buttons);
    return group;
  }

  private addSpeedButton(container: HTMLElement, speed: SimulationSpeed): void {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool-btn small';
    btn.textContent = `${speed}x`;
    btn.addEventListener('click', () => {
      this.tester.setSpeed(speed);
      this.updateSpeedButtons(speed);
    });
    this.speedButtons.set(speed, btn);
    container.appendChild(btn);
  }

  private renderModeSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Canvas Click Action';

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    this.addModeButton(buttons, 'move', 'Move Token');
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
    this.addKindButton(buttons, 'hole', 'Hole');
    this.addKindButton(buttons, 'conveyor', 'Conveyor');
    this.addKindButton(buttons, 'hazard-burn', 'Hazard (Burn)');
    this.addKindButton(buttons, 'door', 'Door');
    this.addKindButton(buttons, 'exit', 'Exit');
    this.addKindButton(buttons, 'spawn', 'Spawn');

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

  private renderPropertiesSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Tile Properties';

    // Conveyor direction
    this.propertyRows.direction.className = 'control-row';
    const dirLabel = document.createElement('span');
    dirLabel.className = 'control-meta';
    dirLabel.textContent = 'Conveyor Direction';
    ['north', 'east', 'south', 'west'].forEach((dir) => {
      const option = document.createElement('option');
      option.value = dir;
      option.textContent = dir;
      this.directionSelect.appendChild(option);
    });
    this.directionSelect.addEventListener('change', () => {
      const direction = this.directionSelect.value as CardinalDirection;
      this.tester.setDefaultConveyorDirection(direction);
      if (this.selectionBehavior.type === 'conveyor') {
        this.tester.updateSelectedBehavior({ direction });
      }
    });
    this.propertyRows.direction.appendChild(dirLabel);
    this.propertyRows.direction.appendChild(this.directionSelect);

    // Door ID
    this.propertyRows.doorId.className = 'control-row';
    const doorLabel = document.createElement('span');
    doorLabel.className = 'control-meta';
    doorLabel.textContent = 'Door Link ID';
    this.doorIdInput.type = 'text';
    this.doorIdInput.placeholder = 'e.g., A1';
    this.doorIdInput.addEventListener('input', () => {
      if (this.selectionBehavior.type === 'door') {
        this.tester.updateSelectedBehavior({ doorId: this.doorIdInput.value });
      }
    });
    this.propertyRows.doorId.appendChild(doorLabel);
    this.propertyRows.doorId.appendChild(this.doorIdInput);

    // Door toggle
    this.propertyRows.doorState.className = 'control-row';
    const doorStateLabel = document.createElement('span');
    doorStateLabel.className = 'control-meta';
    doorStateLabel.textContent = 'Door State';
    this.doorToggleBtn.type = 'button';
    this.doorToggleBtn.className = 'tool-btn small';
    this.doorToggleBtn.textContent = 'Toggle Door';
    this.doorToggleBtn.addEventListener('click', () => {
      if (this.selectedCoord) {
        this.tester.toggleDoorState(this.selectedCoord);
      }
    });
    this.propertyRows.doorState.appendChild(doorStateLabel);
    this.propertyRows.doorState.appendChild(this.doorToggleBtn);

    // Hazard damage
    this.propertyRows.hazard.className = 'control-row';
    const hazardLabel = document.createElement('span');
    hazardLabel.className = 'control-meta';
    hazardLabel.textContent = 'Hazard Damage';
    this.hazardDamageInput.type = 'number';
    this.hazardDamageInput.min = '1';
    this.hazardDamageInput.value = '1';
    this.hazardDamageInput.addEventListener('change', () => {
      const damage = parseInt(this.hazardDamageInput.value, 10);
      this.tester.setDefaultHazardDamage(damage);
      if (this.selectionBehavior.type === 'hazard-burn') {
        this.tester.updateSelectedBehavior({ damage: damage || 1 });
      }
    });
    this.propertyRows.hazard.appendChild(hazardLabel);
    this.propertyRows.hazard.appendChild(this.hazardDamageInput);

    group.appendChild(label);
    group.appendChild(this.propertyRows.direction);
    group.appendChild(this.propertyRows.doorId);
    group.appendChild(this.propertyRows.doorState);
    group.appendChild(this.propertyRows.hazard);
    this.updatePropertyVisibility(this.selectionBehavior);
    return group;
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
    grid.appendChild(this.createLegendRow('Hole', '#303040'));
    grid.appendChild(this.createLegendRow('Conveyor', '#87c4ff'));
    grid.appendChild(this.createLegendRow('Hazard (Burn)', '#ff8451'));
    grid.appendChild(this.createLegendRow('Door', '#9c84ff'));
    grid.appendChild(this.createLegendRow('Exit', '#4affc6'));
    grid.appendChild(this.createLegendRow('Spawn', '#8aff4a'));

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
    this.kindLabel.className = 'control-meta';
    this.pathLabel.className = 'control-meta';
    this.hpLabel.className = 'control-meta';
    this.stateLabel.className = 'control-meta';
    this.nextMoveLabel.className = 'control-meta';
    this.stepLabel.className = 'control-meta';
    this.statusLabel.className = 'control-meta';

    group.appendChild(label);
    group.appendChild(this.selectionLabel);
    group.appendChild(this.kindLabel);
    group.appendChild(this.pathLabel);
    group.appendChild(this.hpLabel);
    group.appendChild(this.stateLabel);
    group.appendChild(this.nextMoveLabel);
    group.appendChild(this.stepLabel);
    group.appendChild(this.statusLabel);

    this.updateSelectionStatus(null, { type: 'floor' });
    this.updatePathStatus(false, []);
    this.updatePlayerStatus({
      hp: 3,
      maxHp: 3,
      alive: true,
      reachedExit: false,
      state: 'normal',
      paused: true,
      speed: 1,
      nextStep: null,
      pathHasHazard: false,
      stepMode: false,
      destination: null,
      spawn: null,
    });
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

    this.tester.on('selection:changed', ({ coord, behavior }) => {
      this.selectedCoord = coord;
      this.selectionBehavior = behavior;
      this.updateSelectionStatus(coord, behavior);
      this.updateKindButtons(behavior.type);
      this.syncProperties(behavior);
    });

    this.tester.on('mode:changed', ({ mode }) => {
      this.updateModeButtons(mode);
    });

    this.tester.on('level:changed', () => {
      this.updateSelectionStatus(null, { type: 'floor' });
      this.updatePathStatus(false, []);
    });

    this.tester.on('path:updated', ({ hasPath, path }) => {
      this.hasPath = hasPath;
      this.updatePathStatus(hasPath, path);
    });

    this.tester.on('player:updated', (state) => {
      this.playerState = state;
      this.updatePlayerStatus(state);
      this.updateStepToggle(state.stepMode);
      this.updatePlayPause(state.paused);
      this.updateSpeedButtons(state.speed);
      this.refreshButtonStates();
    });

    // Initialize UI state
    this.updateModeButtons('move');
    this.updateKindButtons('floor');
    this.updatePlayPause(true);
    this.updateSpeedButtons(1);
    this.refreshButtonStates();
  }

  private updateSelectionStatus(coord: GridCoord | null, behavior: TileBehavior): void {
    if (coord) {
      this.selectionLabel.textContent = `Tile: ${coord.x}, ${coord.y}`;
    } else {
      this.selectionLabel.textContent = 'Tile: --';
    }
    this.kindLabel.textContent = `Kind: ${behavior.type}`;
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

  private updatePathStatus(hasPath: boolean, path: GridCoord[]): void {
    const hazardNote = this.playerState?.pathHasHazard ? ' (hazard ahead)' : '';
    if (hasPath && path.length > 1) {
      this.pathLabel.textContent = `Path: ${path.length - 1} steps${hazardNote}`;
    } else {
      this.pathLabel.textContent = 'Path: none';
    }
    this.refreshButtonStates();
  }

  private updatePlayerStatus(state: PlayerUIState): void {
    this.hpLabel.textContent = `HP: ${state.hp}/${state.maxHp}`;
    const spawnText = state.spawn ? `Spawn: ${state.spawn.x}, ${state.spawn.y}` : 'Spawn: --';
    const destText = state.destination ? `Destination: ${state.destination.x}, ${state.destination.y}` : 'Destination: --';
    this.stepLabel.textContent = `${spawnText} • ${destText}`;
    const next = state.nextStep ? `${state.nextStep.x}, ${state.nextStep.y}` : '--';
    this.stateLabel.textContent = `State: ${state.state}`;
    this.nextMoveLabel.textContent = `Next Move: ${next}`;
    if (!state.alive) {
      this.statusLabel.textContent = 'Status: Down (reset to respawn)';
    } else if (state.reachedExit) {
      this.statusLabel.textContent = 'Status: Exit reached';
    } else {
      const modeText = state.stepMode ? 'Step-by-step' : 'Auto movement';
      this.statusLabel.textContent = state.paused ? 'Status: Paused' : `Status: ${modeText}`;
    }
  }

  private updateStepToggle(stepMode: boolean): void {
    this.stepToggleBtn.textContent = stepMode ? 'Step-by-step: On' : 'Step-by-step: Off';
    this.stepToggleBtn.classList.toggle('active', stepMode);
  }

  private updatePlayPause(paused: boolean): void {
    this.playPauseBtn.textContent = paused ? 'Play' : 'Pause';
    this.playPauseBtn.classList.toggle('active', !paused);
  }

  private updateSpeedButtons(active: SimulationSpeed): void {
    this.speedButtons.forEach((btn, speed) => {
      const isActive = speed === active;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  private syncProperties(behavior: TileBehavior): void {
    if (behavior.type === 'conveyor' && behavior.direction) {
      this.directionSelect.value = behavior.direction;
    }

    if (behavior.type === 'door') {
      this.doorIdInput.value = behavior.doorId ?? '';
      this.doorToggleBtn.textContent = behavior.open ? 'Close Door' : 'Open Door';
    }

    if (behavior.type === 'hazard-burn' && behavior.damage) {
      this.hazardDamageInput.value = String(behavior.damage);
    }

    this.updatePropertyVisibility(behavior);
  }

  private updatePropertyVisibility(behavior: TileBehavior): void {
    this.propertyRows.direction.style.display = behavior.type === 'conveyor' ? 'flex' : 'none';
    this.propertyRows.doorId.style.display = behavior.type === 'door' ? 'flex' : 'none';
    this.propertyRows.doorState.style.display = behavior.type === 'door' ? 'flex' : 'none';
    this.propertyRows.hazard.style.display = behavior.type === 'hazard-burn' ? 'flex' : 'none';
  }

  private refreshButtonStates(): void {
    const alive = this.playerState?.alive ?? true;
    this.advanceBtn.disabled = !alive || !this.hasPath || !(this.playerState?.paused ?? true) || !(this.playerState?.stepMode ?? false);
    this.resetBtn.disabled = false;
  }
}
