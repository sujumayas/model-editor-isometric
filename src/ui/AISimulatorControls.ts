/**
 * UI controls for the AI Simulator view.
 * Includes simulation controls, clop status, and debugging tools.
 */

import { AISimulator, SimulationSpeed, SimulationMode } from '../simulation';
import { Editor } from '../editor/Editor';
import { GameplayTileType } from '../core/types';
import { AgentStateType } from '../agent';

// Tile types for legend
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

export class AISimulatorControls {
  private container: HTMLElement;
  private simulator: AISimulator;
  private editor: Editor;

  private fileInput: HTMLInputElement;

  // Simulation control buttons
  private playBtn: HTMLButtonElement;
  private pauseBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private stepBtn: HTMLButtonElement;

  // Speed buttons
  private speedButtons = new Map<SimulationSpeed, HTMLButtonElement>();

  // Mode buttons
  private modeButtons = new Map<SimulationMode, HTMLButtonElement>();

  // Status labels
  private hpLabel: HTMLElement;
  private stateLabel: HTMLElement;
  private positionLabel: HTMLElement;
  private turnLabel: HTMLElement;
  private pathLabel: HTMLElement;
  private resultLabel: HTMLElement;

  // Path preview toggle
  private pathPreviewCheckbox: HTMLInputElement;

  // Door controls panel
  private doorControlsPanel: HTMLElement;

  constructor(containerId: string, simulator: AISimulator, editor: Editor) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    this.container = container;
    this.simulator = simulator;
    this.editor = editor;

    // Create elements
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.json,application/json';
    this.fileInput.style.display = 'none';

    this.playBtn = document.createElement('button');
    this.pauseBtn = document.createElement('button');
    this.resetBtn = document.createElement('button');
    this.stepBtn = document.createElement('button');

    this.hpLabel = document.createElement('div');
    this.stateLabel = document.createElement('div');
    this.positionLabel = document.createElement('div');
    this.turnLabel = document.createElement('div');
    this.pathLabel = document.createElement('div');
    this.resultLabel = document.createElement('div');

    this.pathPreviewCheckbox = document.createElement('input');
    this.doorControlsPanel = document.createElement('div');

    this.render();
    this.setupListeners();
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.appendChild(this.fileInput);

    this.container.appendChild(this.renderLoadSection());
    this.container.appendChild(this.renderSimulationControlsSection());
    this.container.appendChild(this.renderSpeedSection());
    this.container.appendChild(this.renderModeSection());
    this.container.appendChild(this.renderClopStatusSection());
    this.container.appendChild(this.renderDoorControlsSection());
    this.container.appendChild(this.renderLegendSection());
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
      this.simulator.useLevelClone(this.editor.level);
    });

    group.appendChild(label);
    group.appendChild(loadBtn);
    group.appendChild(useEditorBtn);
    return group;
  }

  private renderSimulationControlsSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Simulation Controls';

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    // Play button
    this.playBtn.type = 'button';
    this.playBtn.className = 'tool-btn small';
    this.playBtn.textContent = '▶';
    this.playBtn.title = 'Play';
    this.playBtn.addEventListener('click', () => this.simulator.play());

    // Pause button
    this.pauseBtn.type = 'button';
    this.pauseBtn.className = 'tool-btn small';
    this.pauseBtn.textContent = '⏸';
    this.pauseBtn.title = 'Pause';
    this.pauseBtn.addEventListener('click', () => this.simulator.pause());

    // Reset button
    this.resetBtn.type = 'button';
    this.resetBtn.className = 'tool-btn small';
    this.resetBtn.textContent = '↺';
    this.resetBtn.title = 'Reset';
    this.resetBtn.addEventListener('click', () => this.simulator.resetSimulation());

    buttons.appendChild(this.playBtn);
    buttons.appendChild(this.pauseBtn);
    buttons.appendChild(this.resetBtn);

    // Step button (separate row)
    const stepRow = document.createElement('div');
    stepRow.style.marginTop = '4px';

    this.stepBtn.type = 'button';
    this.stepBtn.className = 'tool-btn full-width';
    this.stepBtn.textContent = 'Advance Step';
    this.stepBtn.addEventListener('click', () => this.simulator.advanceStep());

    stepRow.appendChild(this.stepBtn);

    group.appendChild(label);
    group.appendChild(buttons);
    group.appendChild(stepRow);
    return group;
  }

  private renderSpeedSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Speed';

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    const speeds: SimulationSpeed[] = [1, 2, 4];
    for (const speed of speeds) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-btn small';
      btn.textContent = `${speed}x`;
      btn.addEventListener('click', () => {
        this.simulator.setSpeed(speed);
        this.updateSpeedButtons(speed);
      });
      this.speedButtons.set(speed, btn);
      buttons.appendChild(btn);
    }

    group.appendChild(label);
    group.appendChild(buttons);

    // Initialize with current speed
    this.updateSpeedButtons(this.simulator.getSimulationState().speed);

    return group;
  }

  private renderModeSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Mode';

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    const modes: Array<{ mode: SimulationMode; label: string }> = [
      { mode: 'auto', label: 'Auto' },
      { mode: 'step', label: 'Step' },
    ];

    for (const { mode, label: modeLabel } of modes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-btn small';
      btn.textContent = modeLabel;
      btn.addEventListener('click', () => {
        this.simulator.setMode(mode);
        this.updateModeButtons(mode);
      });
      this.modeButtons.set(mode, btn);
      buttons.appendChild(btn);
    }

    group.appendChild(label);
    group.appendChild(buttons);

    // Initialize with current mode
    this.updateModeButtons(this.simulator.getSimulationState().mode);

    return group;
  }

  private renderClopStatusSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Clop Status';

    this.hpLabel.className = 'control-meta';
    this.stateLabel.className = 'control-meta';
    this.positionLabel.className = 'control-meta';
    this.turnLabel.className = 'control-meta';
    this.pathLabel.className = 'control-meta';
    this.resultLabel.className = 'control-meta';
    this.resultLabel.style.fontWeight = 'bold';

    // Path preview toggle
    const pathPreviewRow = document.createElement('div');
    pathPreviewRow.className = 'control-meta';
    pathPreviewRow.style.display = 'flex';
    pathPreviewRow.style.alignItems = 'center';
    pathPreviewRow.style.gap = '8px';

    this.pathPreviewCheckbox.type = 'checkbox';
    this.pathPreviewCheckbox.id = 'path-preview-toggle';
    this.pathPreviewCheckbox.checked = true;
    this.pathPreviewCheckbox.addEventListener('change', () => {
      this.simulator.setShowPathPreview(this.pathPreviewCheckbox.checked);
    });

    const checkboxLabel = document.createElement('label');
    checkboxLabel.htmlFor = 'path-preview-toggle';
    checkboxLabel.textContent = 'Show Path Preview';
    checkboxLabel.style.cursor = 'pointer';

    pathPreviewRow.appendChild(this.pathPreviewCheckbox);
    pathPreviewRow.appendChild(checkboxLabel);

    group.appendChild(label);
    group.appendChild(this.hpLabel);
    group.appendChild(this.stateLabel);
    group.appendChild(this.positionLabel);
    group.appendChild(this.turnLabel);
    group.appendChild(this.pathLabel);
    group.appendChild(this.resultLabel);
    group.appendChild(pathPreviewRow);

    // Initialize with default values
    this.updateClopStatus();

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

  private setupListeners(): void {
    // File input
    this.fileInput.addEventListener('change', async () => {
      const file = this.fileInput.files?.[0];
      if (!file) return;
      try {
        await this.simulator.loadLevelFromFile(file);
      } finally {
        this.fileInput.value = '';
      }
    });

    // Simulation events
    this.simulator.on('agent:updated', () => {
      this.updateClopStatus();
    });

    this.simulator.on('level:changed', () => {
      this.updateClopStatus();
      this.updateDoorControls();
    });

    this.simulator.on('reset', () => {
      this.updateClopStatus();
      this.resultLabel.textContent = '';
      this.updateDoorControls();
    });

    this.simulator.on('speed:changed', ({ speed }) => {
      this.updateSpeedButtons(speed);
    });

    this.simulator.on('mode:changed', ({ mode }) => {
      this.updateModeButtons(mode);
      this.updateStepButtonState();
    });

    this.simulator.on('step:waiting', () => {
      this.updateStepButtonState();
    });

    this.simulator.on('complete', ({ result }) => {
      this.updateClopStatus();
      if (result.type === 'won') {
        this.resultLabel.textContent = `WIN! (${result.turnsTaken} turns)`;
        this.resultLabel.style.color = '#ffd700';
      } else if (result.type === 'died') {
        this.resultLabel.textContent = `DEAD (${result.cause || 'unknown'})`;
        this.resultLabel.style.color = '#ff4a4a';
      } else if (result.type === 'stuck') {
        this.resultLabel.textContent = 'STUCK (no path)';
        this.resultLabel.style.color = '#ff9a4a';
      }
    });

    // Initialize step button state
    this.updateStepButtonState();
  }

  private updateSpeedButtons(active: SimulationSpeed): void {
    this.speedButtons.forEach((btn, speed) => {
      const isActive = speed === active;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  private updateModeButtons(active: SimulationMode): void {
    this.modeButtons.forEach((btn, mode) => {
      const isActive = mode === active;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  private updateStepButtonState(): void {
    const state = this.simulator.getSimulationState();
    this.stepBtn.disabled = state.mode !== 'step';
  }

  private updateClopStatus(): void {
    const agent = this.simulator.getAgent();
    const simState = this.simulator.getSimulationState();

    if (agent) {
      const state = agent.state;

      // HP with hearts
      const hearts = '♥'.repeat(state.hp) + '♡'.repeat(state.maxHp - state.hp);
      this.hpLabel.textContent = `HP: ${hearts} (${state.hp}/${state.maxHp})`;
      this.hpLabel.style.color = state.hp <= 1 ? '#ff4a4a' : '#4aff9e';

      // State
      const stateLabels: Record<AgentStateType, string> = {
        idle: 'Idle',
        planning: 'Planning',
        moving: 'Moving',
        scared: 'Scared',
        hurt: 'Hurt',
        dead: 'DEAD',
        won: 'WON!',
      };
      this.stateLabel.textContent = `State: ${stateLabels[state.type] || state.type}`;
      if (state.type === 'dead') {
        this.stateLabel.style.color = '#ff4a4a';
      } else if (state.type === 'won') {
        this.stateLabel.style.color = '#ffd700';
      } else {
        this.stateLabel.style.color = '';
      }

      // Position
      this.positionLabel.textContent = `Position: (${state.position.x}, ${state.position.y})`;

      // Path info
      const pathLength = state.currentPath.length;
      const remaining = pathLength > 0 ? pathLength - state.pathIndex - 1 : 0;
      this.pathLabel.textContent = `Path: ${remaining} tiles remaining`;
    } else {
      this.hpLabel.textContent = 'HP: --';
      this.stateLabel.textContent = 'State: --';
      this.positionLabel.textContent = 'Position: --';
      this.pathLabel.textContent = 'Path: --';
    }

    // Turn number
    this.turnLabel.textContent = `Turn: ${simState.turnNumber}`;
  }

  private updateDoorControls(): void {
    const doorIds = this.simulator.getAllDoorIds();

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
      const isOpen = this.simulator.isDoorOpen(doorId);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-btn full-width';
      btn.textContent = `${doorId}: ${isOpen ? 'OPEN' : 'CLOSED'}`;
      btn.classList.toggle('active', isOpen);
      btn.addEventListener('click', () => {
        this.simulator.toggleDoor(doorId);
        this.updateDoorControls();
      });
      buttons.appendChild(btn);
    }

    this.doorControlsPanel.appendChild(buttons);
  }
}
