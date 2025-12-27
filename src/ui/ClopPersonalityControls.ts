import { ClopPersonalityTester } from '../clops/ClopPersonalityTester';
import { Editor } from '../editor/Editor';
import { ClopPersonality, ClopPersonalityConfig, ClopSnapshot, SimulationSpeed } from '../clops/types';
import { CardinalDirection } from '../core/types';

export class ClopPersonalityControls {
  private container: HTMLElement;
  private tester: ClopPersonalityTester;
  private editor: Editor;

  private fileInput: HTMLInputElement;
  private playPauseBtn: HTMLButtonElement;
  private stepToggleBtn: HTMLButtonElement;
  private advanceBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private speedButtons = new Map<SimulationSpeed, HTMLButtonElement>();
  private seedInput: HTMLInputElement;
  private rosterContainer: HTMLElement;
  private statusLabel: HTMLElement;
  private hazardInput: HTMLInputElement;
  private directionSelect: HTMLSelectElement;

  private clopSnapshots: ClopSnapshot[] = [];
  private isPaused = true;
  private stepMode = false;

  constructor(containerId: string, tester: ClopPersonalityTester, editor: Editor) {
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

    this.playPauseBtn = document.createElement('button');
    this.stepToggleBtn = document.createElement('button');
    this.advanceBtn = document.createElement('button');
    this.resetBtn = document.createElement('button');
    this.seedInput = document.createElement('input');
    this.rosterContainer = document.createElement('div');
    this.statusLabel = document.createElement('div');
    this.hazardInput = document.createElement('input');
    this.directionSelect = document.createElement('select');

    this.render();
    this.setupListeners();
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.appendChild(this.fileInput);

    this.container.appendChild(this.renderLoadSection());
    this.container.appendChild(this.renderSimulationSection());
    this.container.appendChild(this.renderPersonalitySection());
    this.container.appendChild(this.renderEnvironmentSection());
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

  private renderSimulationSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Simulation';

    const playRow = document.createElement('div');
    playRow.className = 'button-group';

    this.playPauseBtn.type = 'button';
    this.playPauseBtn.className = 'tool-btn small';
    this.playPauseBtn.textContent = 'Play';
    this.playPauseBtn.addEventListener('click', () => {
      this.tester.setPaused(!this.isPaused);
      this.isPaused = !this.isPaused;
      this.updatePlayPause();
    });

    this.stepToggleBtn.type = 'button';
    this.stepToggleBtn.className = 'tool-btn small';
    this.stepToggleBtn.textContent = 'Step-by-step: Off';
    this.stepToggleBtn.addEventListener('click', () => {
      this.stepMode = !this.stepMode;
      this.tester.setStepMode(this.stepMode);
      this.updateStepToggle();
    });

    this.advanceBtn.type = 'button';
    this.advanceBtn.className = 'tool-btn small';
    this.advanceBtn.textContent = 'Advance Step';
    this.advanceBtn.addEventListener('click', () => this.tester.advanceTurn());

    this.resetBtn.type = 'button';
    this.resetBtn.className = 'tool-btn small';
    this.resetBtn.textContent = 'Reset Clops';
    this.resetBtn.addEventListener('click', () => this.tester.resetClops());

    playRow.appendChild(this.playPauseBtn);
    playRow.appendChild(this.stepToggleBtn);
    playRow.appendChild(this.advanceBtn);
    playRow.appendChild(this.resetBtn);

    const speedRow = document.createElement('div');
    speedRow.className = 'button-group';
    this.addSpeedButton(speedRow, 1);
    this.addSpeedButton(speedRow, 2);
    this.addSpeedButton(speedRow, 4);

    const seedRow = document.createElement('div');
    seedRow.className = 'control-row';
    const seedLabel = document.createElement('span');
    seedLabel.className = 'control-meta';
    seedLabel.textContent = 'Deterministic Seed';
    this.seedInput.type = 'number';
    this.seedInput.min = '1';
    this.seedInput.value = '42';
    this.seedInput.addEventListener('change', () => {
      const seed = parseInt(this.seedInput.value, 10);
      if (Number.isFinite(seed)) {
        this.tester.setSeed(seed);
      }
    });
    seedRow.appendChild(seedLabel);
    seedRow.appendChild(this.seedInput);

    group.appendChild(label);
    group.appendChild(playRow);
    group.appendChild(speedRow);
    group.appendChild(seedRow);
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

  private renderPersonalitySection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Clop Personalities';

    this.rosterContainer.className = 'control-group';
    this.rosterContainer.style.gap = '6px';

    group.appendChild(label);
    group.appendChild(this.rosterContainer);
    this.renderRoster();
    return group;
  }

  private renderEnvironmentSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Environment Defaults';

    const hazardRow = document.createElement('div');
    hazardRow.className = 'control-row';
    const hazardLabel = document.createElement('span');
    hazardLabel.className = 'control-meta';
    hazardLabel.textContent = 'Hazard Damage';
    this.hazardInput.type = 'number';
    this.hazardInput.min = '1';
    this.hazardInput.value = '1';
    this.hazardInput.addEventListener('change', () => {
      const damage = parseInt(this.hazardInput.value, 10);
      this.tester.setDefaultHazardDamage(damage);
    });
    hazardRow.appendChild(hazardLabel);
    hazardRow.appendChild(this.hazardInput);

    const conveyorRow = document.createElement('div');
    conveyorRow.className = 'control-row';
    const conveyorLabel = document.createElement('span');
    conveyorLabel.className = 'control-meta';
    conveyorLabel.textContent = 'Conveyor Direction';
    ['north', 'east', 'south', 'west'].forEach((dir) => {
      const option = document.createElement('option');
      option.value = dir;
      option.textContent = dir;
      this.directionSelect.appendChild(option);
    });
    this.directionSelect.value = 'east';
    this.directionSelect.addEventListener('change', () => {
      this.tester.setDefaultConveyorDirection(this.directionSelect.value as CardinalDirection);
    });
    conveyorRow.appendChild(conveyorLabel);
    conveyorRow.appendChild(this.directionSelect);

    group.appendChild(label);
    group.appendChild(hazardRow);
    group.appendChild(conveyorRow);
    return group;
  }

  private renderStatusSection(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Status';

    this.statusLabel.className = 'control-meta';
    this.statusLabel.textContent = 'Paused';

    group.appendChild(label);
    group.appendChild(this.statusLabel);
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

    this.tester.on('clops:updated', ({ clops }) => {
      this.clopSnapshots = clops;
      this.renderRoster();
      this.refreshStatus();
    });

    this.tester.on('level:changed', () => {
      this.clopSnapshots = this.tester.getClopSnapshots();
      this.renderRoster();
    });

    this.updateSpeedButtons(1);
    this.updatePlayPause();
    this.updateStepToggle();
  }

  private renderRoster(): void {
    this.rosterContainer.innerHTML = '';
    if (!this.clopSnapshots.length) {
      const empty = document.createElement('div');
      empty.className = 'control-meta';
      empty.textContent = 'No clops spawned (add Spawn tiles)';
      this.rosterContainer.appendChild(empty);
      return;
    }

    this.clopSnapshots.forEach((clop) => {
      const row = document.createElement('div');
      row.className = 'control-row';
      row.style.justifyContent = 'space-between';

      const left = document.createElement('div');
      left.className = 'control-meta';
      left.textContent = `#${clop.id} (${clop.personality})`;

      const status = document.createElement('div');
      status.className = 'control-meta';
      status.textContent = `${clop.status} • ${clop.position.x},${clop.position.y}`;
      if (clop.blocked) {
        status.textContent += ' • blocked';
      }
      if (clop.pathHasHazard) {
        status.textContent += ' • hazard ahead';
      }

      const select = document.createElement('select');
      (['curious', 'coward', 'hyperactive'] as ClopPersonality[]).forEach((persona) => {
        const option = document.createElement('option');
        option.value = persona;
        option.textContent = persona;
        if (clop.personality === persona) {
          option.selected = true;
        }
        select.appendChild(option);
      });
      select.addEventListener('change', () => {
        const payload: ClopPersonalityConfig = {
          id: clop.id,
          personality: select.value as ClopPersonality,
        };
        this.tester.setClopPersonality(payload);
      });

      row.appendChild(left);
      row.appendChild(status);
      row.appendChild(select);
      this.rosterContainer.appendChild(row);
    });
  }

  private updatePlayPause(): void {
    this.playPauseBtn.textContent = this.isPaused ? 'Play' : 'Pause';
    this.playPauseBtn.classList.toggle('active', !this.isPaused);
  }

  private updateStepToggle(): void {
    this.stepToggleBtn.textContent = this.stepMode ? 'Step-by-step: On' : 'Step-by-step: Off';
    this.stepToggleBtn.classList.toggle('active', this.stepMode);
  }

  private updateSpeedButtons(active: SimulationSpeed): void {
    this.speedButtons.forEach((btn, speed) => {
      const isActive = speed === active;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  private refreshStatus(): void {
    const finished = this.clopSnapshots.filter((c) => c.status === 'finished').length;
    const stuck = this.clopSnapshots.filter((c) => c.status === 'stuck').length;
    this.statusLabel.textContent = `Active: ${this.clopSnapshots.length - finished - stuck} • Finished: ${finished} • Stuck: ${stuck}`;
  }
}
