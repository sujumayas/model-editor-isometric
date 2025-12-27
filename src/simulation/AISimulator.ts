/**
 * AI Simulator - Main controller for autonomous Clop simulation.
 * Manages game loop, agent turns, and rendering.
 */

import { calculateCenterOffset, gridToScreen } from '../core/isometric';
import { GridCoord, TileProperties, GameplayTileType } from '../core/types';
import { Canvas } from '../engine/Canvas';
import { Camera } from '../engine/Camera';
import { Renderer } from '../engine/Renderer';
import { TileRegistry } from '../assets/TileRegistry';
import { Level } from '../level/Level';
import { deserializeLevel, loadLevelFromFile, serializeLevel } from '../level/LevelSerializer';
import { ISO_TILE_HEIGHT, ISO_TILE_WIDTH } from '../core/constants';
import {
  createDefaultGameState,
  GameState,
  getTileBehaviorRegistry,
  TileBehaviorRegistry,
} from '../gameplay';
import {
  Agent,
  ClopAgent,
  createClopConfig,
  AgentState,
} from '../agent';
import {
  SimulationState,
  SimulationEventMap,
  SimulationEventHandler,
  AISimulatorOptions,
  SimulationSpeed,
  SimulationMode,
  SimulationResult,
  createDefaultSimulationState,
} from './types';

type SimulationListener = (payload: unknown) => void;

// ============================================================================
// Colors
// ============================================================================

const OVERLAY_COLORS: Record<GameplayTileType, string> = {
  floor: 'rgba(74, 158, 255, 0.08)',
  blocker: 'rgba(255, 74, 74, 0.45)',
  slow: 'rgba(255, 199, 94, 0.35)',
  hole: 'rgba(0, 0, 0, 0.7)',
  conveyor: 'rgba(100, 200, 255, 0.5)',
  hazard: 'rgba(255, 100, 50, 0.6)',
  door: 'rgba(139, 69, 19, 0.7)',
  exit: 'rgba(100, 255, 100, 0.6)',
  spawn: 'rgba(255, 255, 100, 0.5)',
};

const DOOR_OPEN_COLOR = 'rgba(139, 69, 19, 0.3)';
const DOOR_CLOSED_COLOR = 'rgba(139, 69, 19, 0.7)';
const PATH_COLOR = 'rgba(100, 200, 255, 0.6)';
const PATH_DOT_COLOR = 'rgba(100, 200, 255, 0.9)';

// Clop colors by state
const CLOP_COLORS = {
  normal: 'rgba(100, 200, 255, 0.9)',
  hurt: 'rgba(255, 74, 74, 0.9)',
  scared: 'rgba(255, 200, 74, 0.9)',
  dead: 'rgba(100, 100, 100, 0.9)',
  won: 'rgba(255, 215, 0, 0.9)',
} as const;

// ============================================================================
// AISimulator
// ============================================================================

export class AISimulator {
  // Rendering
  readonly canvas: Canvas;
  readonly camera: Camera;
  readonly renderer: Renderer;
  private tileRegistry: TileRegistry;
  private behaviorRegistry: TileBehaviorRegistry;

  // State
  private level: Level;
  private gameState: GameState;
  private simulationState: SimulationState;
  private agent: ClopAgent | null = null;

  // Animation
  private animationFrame: number | null = null;
  private lastTimestamp = 0;
  private isRunning = false;
  private turnTimer = 0;
  private readonly TURN_DELAY = 0.5; // Seconds between turns in auto mode

  // UI
  private hovered: GridCoord | null = null;
  private listeners = new Map<keyof SimulationEventMap, Set<SimulationListener>>();

  // Damage flash
  private damageFlashTimer = 0;
  private readonly DAMAGE_FLASH_DURATION = 0.3;

  constructor(options: AISimulatorOptions) {
    this.tileRegistry = options.tileRegistry;
    this.behaviorRegistry = getTileBehaviorRegistry();

    this.canvas = new Canvas({
      canvas: options.canvas,
      container: options.container,
    });

    this.camera = new Camera({ zoom: 2 });
    this.renderer = new Renderer(this.canvas, this.camera, this.tileRegistry);
    this.renderer.setOptions({ showHover: false, showSelection: false });

    this.level = Level.createDefault('AI Simulation');
    this.gameState = createDefaultGameState();
    this.simulationState = createDefaultSimulationState();

    if (options.initialMode) {
      this.simulationState = { ...this.simulationState, mode: options.initialMode };
    }
    if (options.initialSpeed) {
      this.simulationState = { ...this.simulationState, speed: options.initialSpeed };
    }

    this.setupEventListeners();
    this.start();
  }

  // ============================================================================
  // Event API
  // ============================================================================

  on<T extends keyof SimulationEventMap>(
    event: T,
    handler: SimulationEventHandler<T>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as SimulationListener);
    return () => this.listeners.get(event)?.delete(handler as SimulationListener);
  }

  private emit<T extends keyof SimulationEventMap>(
    event: T,
    payload: SimulationEventMap[T]
  ): void {
    this.listeners.get(event)?.forEach((handler) => {
      (handler as SimulationEventHandler<T>)(payload);
    });
  }

  // ============================================================================
  // Public API - Level Management
  // ============================================================================

  getLevel(): Level {
    return this.level;
  }

  getSimulationState(): SimulationState {
    return this.simulationState;
  }

  getAgent(): ClopAgent | null {
    return this.agent;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  async loadLevelFromFile(file: File): Promise<void> {
    const level = await loadLevelFromFile(file);
    this.setLevel(level);
  }

  useLevelClone(level: Level): void {
    const json = serializeLevel(level);
    const cloned = deserializeLevel(json);
    this.setLevel(cloned);
  }

  setLevel(level: Level): void {
    this.level = level;
    this.resetSimulation();
    this.emit('level:changed', { level });
  }

  // ============================================================================
  // Public API - Simulation Control
  // ============================================================================

  play(): void {
    if (this.simulationState.status === 'complete') {
      this.resetSimulation();
    }

    this.simulationState = {
      ...this.simulationState,
      status: 'running',
    };
    this.turnTimer = 0;
    this.emit('resumed', { state: this.simulationState });
  }

  pause(): void {
    this.simulationState = {
      ...this.simulationState,
      status: 'paused',
    };
    this.emit('paused', { state: this.simulationState });
  }

  resetSimulation(): void {
    // Find spawn tile
    const spawnTile = this.level.findSpawnTile();
    const spawnPos = spawnTile ?? this.findFirstWalkable() ?? { x: 0, y: 0 };

    // Create agent
    this.agent = new ClopAgent(createClopConfig('clop-1'));
    this.agent.spawn(spawnPos);

    // Set target to exit
    const exitTile = this.level.findExitTile();
    if (exitTile) {
      this.agent.setTarget(exitTile);
    }

    // Subscribe to agent events
    this.setupAgentListeners();

    // Reset game state
    this.gameState = createDefaultGameState(spawnPos);

    // Reset simulation state
    this.simulationState = {
      ...this.simulationState,
      status: 'idle',
      turnNumber: 0,
    };

    this.turnTimer = 0;
    this.damageFlashTimer = 0;

    this.emit('reset', { state: this.simulationState });
    if (this.agent) {
      this.emit('agent:updated', { agent: this.agent });
    }
  }

  setSpeed(speed: SimulationSpeed): void {
    this.simulationState = {
      ...this.simulationState,
      speed,
    };
    this.emit('speed:changed', { speed });
  }

  setMode(mode: SimulationMode): void {
    this.simulationState = {
      ...this.simulationState,
      mode,
    };
    this.emit('mode:changed', { mode });
  }

  advanceStep(): void {
    if (this.simulationState.mode !== 'step') return;
    if (!this.agent || !this.agent.canAct()) return;

    this.executeTurn();
  }

  setShowPathPreview(show: boolean): void {
    this.simulationState = {
      ...this.simulationState,
      showPathPreview: show,
    };
  }

  // ============================================================================
  // Door Control
  // ============================================================================

  toggleDoor(doorId: string): void {
    if (this.gameState.openDoors.has(doorId)) {
      this.gameState.openDoors.delete(doorId);
    } else {
      this.gameState.openDoors.add(doorId);
    }
  }

  isDoorOpen(doorId: string): boolean {
    return this.gameState.openDoors.has(doorId);
  }

  getAllDoorIds(): string[] {
    const doorIds = new Set<string>();
    for (const { properties } of this.level.getAllGameplayTiles()) {
      if (properties.type === 'door' && properties.linkedId) {
        doorIds.add(properties.linkedId);
      }
    }
    return Array.from(doorIds);
  }

  // ============================================================================
  // Animation Control
  // ============================================================================

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.loop(this.lastTimestamp);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // ============================================================================
  // Internal - Event Listeners
  // ============================================================================

  private setupEventListeners(): void {
    const canvasEl = this.canvas.element;

    canvasEl.addEventListener('mousemove', (e) => {
      const coord = this.screenToGrid(e);
      this.hovered = coord;
    });

    canvasEl.addEventListener('mouseleave', () => {
      this.hovered = null;
    });

    canvasEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const rect = canvasEl.getBoundingClientRect();
      this.camera.zoomBy(delta, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
  }

  private setupAgentListeners(): void {
    if (!this.agent) return;

    this.agent.on('hp:changed', ({ damage }) => {
      if (damage > 0) {
        this.damageFlashTimer = this.DAMAGE_FLASH_DURATION;
      }
      this.emit('agent:updated', { agent: this.agent! });
    });

    this.agent.on('state:changed', () => {
      this.emit('agent:updated', { agent: this.agent! });
    });

    this.agent.on('died', ({ cause }) => {
      this.completeSimulation('died', cause);
    });

    this.agent.on('won', () => {
      this.completeSimulation('won');
    });
  }

  private screenToGrid(e: MouseEvent): GridCoord | null {
    const rect = this.canvas.element.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const coord = this.renderer.screenToGrid(screenX, screenY, this.level);
    if (this.level.isInBounds(coord)) {
      return coord;
    }
    return null;
  }

  // ============================================================================
  // Internal - Game Loop
  // ============================================================================

  private loop(timestamp: number): void {
    if (!this.isRunning) return;

    const deltaMs = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    this.update(deltaMs / 1000);
    this.render();

    this.animationFrame = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    // Update damage flash
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    }

    // Update agent visuals
    if (this.agent) {
      this.agent.updateVisuals(dt);
    }

    // Check simulation status
    if (this.simulationState.status !== 'running') return;
    if (!this.agent || !this.agent.canAct()) return;

    // Auto mode: advance turns on timer
    if (this.simulationState.mode === 'auto') {
      const adjustedDt = dt * this.simulationState.speed;
      this.turnTimer += adjustedDt;

      if (this.turnTimer >= this.TURN_DELAY) {
        this.turnTimer = 0;
        this.executeTurn();
      }
    }
  }

  private executeTurn(): void {
    if (!this.agent || !this.agent.canAct()) return;

    this.emit('turn:started', { turnNumber: this.simulationState.turnNumber });

    const moved = this.agent.takeTurn(this.level, this.gameState);

    this.simulationState = {
      ...this.simulationState,
      turnNumber: this.simulationState.turnNumber + 1,
    };

    this.emit('turn:completed', { turnNumber: this.simulationState.turnNumber });
    this.emit('agent:updated', { agent: this.agent });

    // Check if stuck (no path found and not at exit)
    if (!moved && !this.agent.isAtTarget() && this.agent.canAct()) {
      // Try to recompute path
      const path = this.agent.computePath(this.level, this.gameState);
      if (!path) {
        this.completeSimulation('stuck');
      }
    }

    // In step mode, pause after each turn
    if (this.simulationState.mode === 'step') {
      this.simulationState = {
        ...this.simulationState,
        status: 'paused',
      };
      this.emit('step:waiting', { turnNumber: this.simulationState.turnNumber });
    }
  }

  private completeSimulation(type: 'won' | 'died' | 'stuck', cause?: string): void {
    this.simulationState = {
      ...this.simulationState,
      status: 'complete',
    };

    const result: SimulationResult = {
      type,
      turnsTaken: this.simulationState.turnNumber,
      finalHp: this.agent?.state.hp ?? 0,
      cause,
    };

    this.emit('complete', { result });
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  private render(): void {
    this.renderer.render(this.level);
    const ctx = this.canvas.ctx;

    ctx.save();
    this.camera.applyTransform(ctx);

    const centerOffset = calculateCenterOffset(
      this.canvas.viewport.width / this.camera.zoom,
      this.canvas.viewport.height / this.camera.zoom,
      this.level.gridWidth,
      this.level.gridHeight
    );

    this.renderTileOverlays(ctx, centerOffset.x, centerOffset.y);
    this.renderPathPreview(ctx, centerOffset.x, centerOffset.y);
    this.renderAgent(ctx, centerOffset.x, centerOffset.y);

    ctx.restore();

    this.renderUI();
  }

  private renderTileOverlays(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    for (let y = 0; y < this.level.gridHeight; y++) {
      for (let x = 0; x < this.level.gridWidth; x++) {
        const coord = { x, y };
        const props = this.getTileProperties(coord);
        let color = OVERLAY_COLORS[props.type] ?? OVERLAY_COLORS.floor;

        if (props.type === 'door') {
          const doorId = props.linkedId ?? 'default';
          color = this.gameState.openDoors.has(doorId) ? DOOR_OPEN_COLOR : DOOR_CLOSED_COLOR;
        }

        this.drawDiamond(ctx, coord, offsetX, offsetY, color);

        if (props.type === 'conveyor' && props.direction) {
          this.drawConveyorArrow(ctx, coord, props.direction, offsetX, offsetY);
        }

        if (props.type === 'hazard') {
          this.drawTileIcon(ctx, coord, 'flame', offsetX, offsetY);
        } else if (props.type === 'exit') {
          this.drawTileIcon(ctx, coord, 'star', offsetX, offsetY);
        } else if (props.type === 'spawn') {
          this.drawTileIcon(ctx, coord, 'circle', offsetX, offsetY);
        }
      }
    }
  }

  private renderPathPreview(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    if (!this.simulationState.showPathPreview) return;
    if (!this.agent || this.agent.state.currentPath.length < 2) return;

    const path = this.agent.state.currentPath;
    const currentIndex = this.agent.state.pathIndex;

    // Draw remaining path as dotted line
    ctx.strokeStyle = PATH_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();

    for (let i = currentIndex; i < path.length; i++) {
      const coord = path[i];
      if (!coord) continue;
      const center = gridToScreen(coord.x, coord.y, offsetX, offsetY);
      if (i === currentIndex) {
        ctx.moveTo(center.x, center.y + ISO_TILE_HEIGHT / 2);
      } else {
        ctx.lineTo(center.x, center.y + ISO_TILE_HEIGHT / 2);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw dots at each path point
    ctx.fillStyle = PATH_DOT_COLOR;
    for (let i = currentIndex + 1; i < path.length; i++) {
      const coord = path[i];
      if (!coord) continue;
      const center = gridToScreen(coord.x, coord.y, offsetX, offsetY);
      ctx.beginPath();
      ctx.arc(center.x, center.y + ISO_TILE_HEIGHT / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderAgent(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    if (!this.agent) return;

    const state = this.agent.state;
    const pos = gridToScreen(
      state.visualPosition.x,
      state.visualPosition.y,
      offsetX,
      offsetY
    );

    // Determine color based on state
    let color: string = CLOP_COLORS.normal;
    if (state.type === 'dead') {
      color = CLOP_COLORS.dead;
    } else if (state.type === 'won') {
      color = CLOP_COLORS.won;
    } else if (state.type === 'hurt' || this.damageFlashTimer > 0) {
      const flashPhase = Math.floor(this.damageFlashTimer * 10) % 2;
      color = flashPhase === 0 ? CLOP_COLORS.hurt : CLOP_COLORS.normal;
    } else if (state.type === 'scared') {
      color = CLOP_COLORS.scared;
    }

    const cx = pos.x;
    const cy = pos.y + ISO_TILE_HEIGHT / 2;
    const radius = ISO_TILE_WIDTH / 4;

    // Draw body (cyclops!)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw outline
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw single eye (cyclops characteristic!)
    if (state.type !== 'dead') {
      // Eye white
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 5, 0, Math.PI * 2);
      ctx.fill();

      // Eye pupil
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Eye highlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 1, cy - 3, 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Dead: X eyes
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      const size = 4;
      ctx.beginPath();
      ctx.moveTo(cx - size, cy - size);
      ctx.lineTo(cx + size, cy + size);
      ctx.moveTo(cx + size, cy - size);
      ctx.lineTo(cx - size, cy + size);
      ctx.stroke();
    }

    // Win glow effect
    if (state.type === 'won') {
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private renderUI(): void {
    const ctx = this.canvas.ctx;
    const agent = this.agent;

    ctx.save();
    ctx.font = '14px monospace';

    // Clop status panel
    const panelX = 8;
    let panelY = 8;
    const panelWidth = 140;
    const lineHeight = 20;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(panelX, panelY, panelWidth, lineHeight * 5 + 10);

    panelY += 4;

    // HP
    if (agent) {
      const hpText = `HP: ${agent.state.hp}/${agent.state.maxHp}`;
      ctx.fillStyle = agent.state.hp <= 1 ? '#ff4a4a' : '#4aff9e';
      ctx.fillText(hpText, panelX + 8, panelY + 14);
      panelY += lineHeight;

      // State
      ctx.fillStyle = '#fff';
      ctx.fillText(`State: ${agent.state.type}`, panelX + 8, panelY + 14);
      panelY += lineHeight;

      // Position
      ctx.fillText(`Pos: (${agent.state.position.x}, ${agent.state.position.y})`, panelX + 8, panelY + 14);
      panelY += lineHeight;
    }

    // Turn
    ctx.fillStyle = '#ffc75e';
    ctx.fillText(`Turn: ${this.simulationState.turnNumber}`, panelX + 8, panelY + 14);
    panelY += lineHeight;

    // Mode/Speed
    ctx.fillStyle = '#aaa';
    ctx.fillText(`${this.simulationState.mode} x${this.simulationState.speed}`, panelX + 8, panelY + 14);

    // Status indicator
    if (this.simulationState.status === 'complete' && agent) {
      const resultText = agent.state.type === 'won' ? 'WIN!' : 'DEAD';
      const resultColor = agent.state.type === 'won' ? 'rgba(255, 215, 0, 0.9)' : 'rgba(255, 74, 74, 0.9)';
      ctx.fillStyle = resultColor;
      ctx.font = 'bold 24px monospace';
      ctx.fillText(resultText, this.canvas.viewport.width / 2 - 30, this.canvas.viewport.height / 2);
    }

    ctx.restore();
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private getTileProperties(coord: GridCoord): TileProperties {
    return this.level.getGameplayTile(coord) ?? { type: 'floor' };
  }

  private findFirstWalkable(): GridCoord | null {
    for (let y = 0; y < this.level.gridHeight; y++) {
      for (let x = 0; x < this.level.gridWidth; x++) {
        const coord = { x, y };
        const props = this.getTileProperties(coord);
        const behavior = this.behaviorRegistry.get(props.type);
        const ctx = {
          player: this.gameState.player,
          tileProperties: props,
          coord,
          gameState: this.gameState,
        };
        if (behavior.isWalkable(ctx)) {
          return coord;
        }
      }
    }
    return null;
  }

  private drawDiamond(
    ctx: CanvasRenderingContext2D,
    coord: GridCoord,
    offsetX: number,
    offsetY: number,
    color: string
  ): void {
    const center = gridToScreen(coord.x, coord.y, offsetX, offsetY);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(center.x + ISO_TILE_WIDTH / 2, center.y + ISO_TILE_HEIGHT / 2);
    ctx.lineTo(center.x, center.y + ISO_TILE_HEIGHT);
    ctx.lineTo(center.x - ISO_TILE_WIDTH / 2, center.y + ISO_TILE_HEIGHT / 2);
    ctx.closePath();
    ctx.fill();
  }

  private drawConveyorArrow(
    ctx: CanvasRenderingContext2D,
    coord: GridCoord,
    direction: string,
    offsetX: number,
    offsetY: number
  ): void {
    const center = gridToScreen(coord.x, coord.y, offsetX, offsetY);
    const cx = center.x;
    const cy = center.y + ISO_TILE_HEIGHT / 2;

    ctx.save();
    ctx.translate(cx, cy);

    const rotations: Record<string, number> = {
      north: -Math.PI / 2,
      east: 0,
      south: Math.PI / 2,
      west: Math.PI,
    };
    ctx.rotate(rotations[direction] ?? 0);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.lineTo(1, -3);
    ctx.moveTo(4, 0);
    ctx.lineTo(1, 3);
    ctx.stroke();

    ctx.restore();
  }

  private drawTileIcon(
    ctx: CanvasRenderingContext2D,
    coord: GridCoord,
    icon: string,
    offsetX: number,
    offsetY: number
  ): void {
    const center = gridToScreen(coord.x, coord.y, offsetX, offsetY);
    const cx = center.x;
    const cy = center.y + ISO_TILE_HEIGHT / 2;

    ctx.save();

    if (icon === 'flame') {
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.bezierCurveTo(cx - 3, cy - 2, cx - 3, cy + 2, cx, cy + 4);
      ctx.bezierCurveTo(cx + 3, cy + 2, cx + 3, cy - 2, cx, cy - 4);
      ctx.fill();
    } else if (icon === 'star') {
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? 4 : 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    } else if (icon === 'circle') {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
