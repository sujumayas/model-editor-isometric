/**
 * Movement testing view with gameplay mechanics integration.
 * Supports tile behaviors, player HP, step-by-step mode, and reset.
 */

import { calculateCenterOffset, gridToScreen } from '../core/isometric';
import {
  PositionKey,
  GridCoord,
  toPositionKey,
  fromPositionKey,
  TileProperties,
  GameplayTileType,
  Direction,
  DIRECTION_VECTORS,
} from '../core/types';
import { Canvas } from '../engine/Canvas';
import { Camera } from '../engine/Camera';
import { Renderer } from '../engine/Renderer';
import { TileRegistry } from '../assets/TileRegistry';
import { Level } from '../level/Level';
import { deserializeLevel, loadLevelFromFile, serializeLevel } from '../level/LevelSerializer';
import { ISO_TILE_HEIGHT, ISO_TILE_WIDTH } from '../core/constants';
import {
  getTileBehaviorRegistry,
  TileBehaviorRegistry,
  PlayerState,
  GameState,
  TileBehaviorContext,
  createDefaultPlayerState,
  createDefaultGameState,
  PlayerStateType,
} from '../gameplay';

export type ClickMode = 'move' | 'edit';

export interface MovementTesterOptions {
  canvas: HTMLCanvasElement | string;
  container?: HTMLElement | string;
  tileRegistry: TileRegistry;
}

export interface MovementTesterEventMap {
  'selection:changed': { coord: GridCoord | null; properties: TileProperties };
  'mode:changed': { mode: ClickMode };
  'level:changed': { level: Level };
  'path:updated': { hasPath: boolean };
  'player:hp:changed': { hp: number; maxHp: number; damage?: number };
  'player:state:changed': { state: PlayerStateType };
  'player:died': { cause: GameplayTileType };
  'player:won': void;
  'step:completed': { turnNumber: number };
  'door:toggled': { doorId: string; isOpen: boolean };
  'gamestate:changed': { gameState: GameState };
}

type MovementTesterEvent = keyof MovementTesterEventMap;
type MovementTesterHandler<T extends MovementTesterEvent> = (payload: MovementTesterEventMap[T]) => void;
type MovementListener = (payload: unknown) => void;

// Tile overlay colors
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

const SELECTION_COLOR = 'rgba(74, 255, 158, 0.5)';
const PATH_COLOR = 'rgba(74, 158, 255, 0.6)';
const PLAYER_COLOR = 'rgba(74, 255, 158, 0.9)';
const PLAYER_DEAD_COLOR = 'rgba(255, 74, 74, 0.9)';
const PLAYER_WON_COLOR = 'rgba(255, 215, 0, 0.9)';

// Door colors
const DOOR_OPEN_COLOR = 'rgba(139, 69, 19, 0.3)';
const DOOR_CLOSED_COLOR = 'rgba(139, 69, 19, 0.7)';

export class MovementTester {
  readonly canvas: Canvas;
  readonly camera: Camera;
  readonly renderer: Renderer;
  private tileRegistry: TileRegistry;
  private behaviorRegistry: TileBehaviorRegistry;
  private level: Level;
  private selected: GridCoord | null = null;
  private hovered: GridCoord | null = null;
  private clickMode: ClickMode = 'move';
  private listeners = new Map<MovementTesterEvent, Set<MovementListener>>();

  private animationFrame: number | null = null;
  private lastTimestamp = 0;
  private isRunning = false;

  // Game state
  private gameState: GameState;

  // Damage flash effect
  private damageFlashTimer = 0;
  private readonly DAMAGE_FLASH_DURATION = 0.3;

  constructor(options: MovementTesterOptions) {
    this.tileRegistry = options.tileRegistry;
    this.behaviorRegistry = getTileBehaviorRegistry();

    this.canvas = new Canvas({
      canvas: options.canvas,
      container: options.container,
    });

    this.camera = new Camera({ zoom: 2 });
    this.renderer = new Renderer(this.canvas, this.camera, this.tileRegistry);
    this.renderer.setOptions({ showHover: false, showSelection: false });

    this.level = Level.createDefault('Movement Test');
    this.gameState = createDefaultGameState();

    this.setupEventListeners();
    this.resetPlayerPosition();
    this.start();
  }

  // Event API ---------------------------------------------------------------
  on<T extends MovementTesterEvent>(event: T, handler: MovementTesterHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as MovementListener);
    return () => this.listeners.get(event)?.delete(handler as MovementListener);
  }

  private emit<T extends MovementTesterEvent>(event: T, payload: MovementTesterEventMap[T]): void {
    this.listeners.get(event)?.forEach((handler) => {
      (handler as MovementTesterHandler<T>)(payload);
    });
  }

  // Public API --------------------------------------------------------------
  getLevel(): Level {
    return this.level;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  getSelectedCoord(): GridCoord | null {
    return this.selected;
  }

  getTileProperties(coord: GridCoord): TileProperties {
    const props = this.level.getGameplayTile(coord);
    return props ?? { type: 'floor' };
  }

  setClickMode(mode: ClickMode): void {
    if (this.clickMode === mode) return;
    this.clickMode = mode;
    this.emit('mode:changed', { mode });
  }

  async loadLevelFromFile(file: File): Promise<void> {
    const level = await loadLevelFromFile(file);
    this.setLevel(level);
  }

  useLevelClone(level: Level): void {
    // Clone through serialization to avoid mutating the editor instance
    const json = serializeLevel(level);
    const cloned = deserializeLevel(json);
    this.setLevel(cloned);
  }

  setLevel(level: Level): void {
    this.level = level;
    this.selected = null;
    this.hovered = null;
    this.resetPlayer();
    this.emit('selection:changed', { coord: null, properties: { type: 'floor' } });
    this.emit('level:changed', { level });
  }

  // Tile editing ------------------------------------------------------------
  setSelectedProperties(properties: TileProperties): void {
    if (!this.selected) return;
    this.setTileProperties(this.selected, properties);
    this.emit('selection:changed', { coord: this.selected, properties });
  }

  setTileProperties(coord: GridCoord, properties: TileProperties): void {
    if (!this.level.isInBounds(coord)) return;
    this.level.setGameplayTile(coord, properties);
  }

  // Step mode ---------------------------------------------------------------
  isStepMode(): boolean {
    return this.gameState.isStepMode;
  }

  setStepMode(enabled: boolean): void {
    this.gameState.isStepMode = enabled;
    if (!enabled) {
      this.gameState.waitingForStep = false;
    }
    this.emit('gamestate:changed', { gameState: this.gameState });
  }

  advanceStep(): void {
    if (this.gameState.isStepMode && this.gameState.waitingForStep) {
      this.gameState.waitingForStep = false;
    }
  }

  // Door control ------------------------------------------------------------
  toggleDoor(doorId: string): void {
    const isOpen = this.gameState.openDoors.has(doorId);
    if (isOpen) {
      this.gameState.openDoors.delete(doorId);
    } else {
      this.gameState.openDoors.add(doorId);
    }
    this.emit('door:toggled', { doorId, isOpen: !isOpen });
    this.emit('gamestate:changed', { gameState: this.gameState });
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

  // Player control ----------------------------------------------------------
  resetPlayer(): void {
    const spawnTile = this.level.findSpawnTile();
    const spawnPos = spawnTile ?? this.findFirstWalkable() ?? { x: 0, y: 0 };

    this.gameState = createDefaultGameState(spawnPos);
    this.damageFlashTimer = 0;

    this.emit('player:hp:changed', { hp: this.gameState.player.hp, maxHp: this.gameState.player.maxHp });
    this.emit('player:state:changed', { state: this.gameState.player.state });
    this.emit('gamestate:changed', { gameState: this.gameState });
  }

  private resetPlayerPosition(): void {
    this.resetPlayer();
  }

  getPlayerHP(): { hp: number; maxHp: number } {
    return { hp: this.gameState.player.hp, maxHp: this.gameState.player.maxHp };
  }

  getPlayerState(): PlayerStateType {
    return this.gameState.player.state;
  }

  getTurnNumber(): number {
    return this.gameState.turnNumber;
  }

  // Animation control -------------------------------------------------------
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

  // Internal state ----------------------------------------------------------
  private setupEventListeners(): void {
    const canvasEl = this.canvas.element;

    canvasEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const coord = this.screenToGrid(e);
      if (!coord) return;

      if (this.clickMode === 'edit') {
        this.selectCoord(coord);
      } else {
        this.selectCoord(coord);
        this.movePlayerTo(coord);
      }
    });

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

  private selectCoord(coord: GridCoord): void {
    this.selected = coord;
    this.emit('selection:changed', { coord, properties: this.getTileProperties(coord) });
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

  // Movement ----------------------------------------------------------------
  private movePlayerTo(target: GridCoord): void {
    if (!this.level.isInBounds(target)) return;

    const player = this.gameState.player;

    // Cannot move if dead or won
    if (player.state === 'dead' || player.state === 'won') return;

    // Check if target is walkable
    const targetProps = this.getTileProperties(target);
    const targetBehavior = this.behaviorRegistry.get(targetProps.type);
    const ctx = this.createBehaviorContext(target, targetProps);
    if (!targetBehavior.isWalkable(ctx)) {
      this.emit('path:updated', { hasPath: false });
      return;
    }

    const start = { x: Math.round(player.position.x), y: Math.round(player.position.y) };
    const path = this.findPath(start, target);
    if (!path || path.length === 0) {
      player.path = [];
      this.emit('path:updated', { hasPath: false });
      return;
    }

    player.path = path;
    player.segmentIndex = 0;
    player.segmentProgress = 0;
    player.state = 'moving';
    this.emit('path:updated', { hasPath: true });
    this.emit('player:state:changed', { state: 'moving' });
  }

  private createBehaviorContext(coord: GridCoord, props: TileProperties): TileBehaviorContext {
    return {
      player: this.gameState.player,
      tileProperties: props,
      coord,
      gameState: this.gameState,
    };
  }

  private findPath(start: GridCoord, goal: GridCoord): GridCoord[] | null {
    const startKey = toPositionKey(start);
    const goalKey = toPositionKey(goal);

    const open: PositionKey[] = [startKey];
    const cameFrom = new Map<PositionKey, PositionKey | null>();
    const gScore = new Map<PositionKey, number>([[startKey, 0]]);
    const fScore = new Map<PositionKey, number>([[startKey, this.heuristic(start, goal)]]);

    cameFrom.set(startKey, null);

    while (open.length > 0) {
      open.sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity));
      const current = open.shift()!;
      if (current === goalKey) {
        return this.reconstructPath(cameFrom, current);
      }

      const currentCoord = fromPositionKey(current);
      for (const neighbor of this.getNeighbors(currentCoord)) {
        const neighborKey = toPositionKey(neighbor);
        const neighborProps = this.getTileProperties(neighbor);
        const neighborBehavior = this.behaviorRegistry.get(neighborProps.type);
        const ctx = this.createBehaviorContext(neighbor, neighborProps);

        if (!neighborBehavior.isWalkable(ctx)) continue;

        const movementCost = neighborBehavior.getMovementCost(ctx);
        const tentativeG = (gScore.get(current) ?? Infinity) + movementCost;
        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, goal));
          if (!open.includes(neighborKey)) {
            open.push(neighborKey);
          }
        }
      }
    }

    return null;
  }

  private heuristic(a: GridCoord, b: GridCoord): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private reconstructPath(cameFrom: Map<PositionKey, PositionKey | null>, current: PositionKey): GridCoord[] {
    const path: GridCoord[] = [fromPositionKey(current)];
    let cur = cameFrom.get(current);
    while (cur) {
      path.push(fromPositionKey(cur));
      cur = cameFrom.get(cur);
    }
    return path.reverse();
  }

  private getNeighbors(coord: GridCoord): GridCoord[] {
    const neighbors: GridCoord[] = [
      { x: coord.x + 1, y: coord.y },
      { x: coord.x - 1, y: coord.y },
      { x: coord.x, y: coord.y + 1 },
      { x: coord.x, y: coord.y - 1 },
    ];
    return neighbors.filter((n) => this.level.isInBounds(n));
  }

  // Loop --------------------------------------------------------------------
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

    const player = this.gameState.player;

    // Cannot update if dead or won
    if (player.state === 'dead' || player.state === 'won') return;

    // Step mode: wait for user input
    if (this.gameState.isStepMode && this.gameState.waitingForStep) return;

    // Not moving
    if (player.state !== 'moving' || player.path.length < 2) return;

    const currentIndex = player.segmentIndex;
    const nextIndex = currentIndex + 1;
    const current = player.path[currentIndex];
    const next = player.path[nextIndex];

    if (!current || !next) {
      player.state = 'idle';
      this.emit('player:state:changed', { state: 'idle' });
      this.emit('path:updated', { hasPath: false });
      return;
    }

    // Calculate step duration based on tile cost
    const nextProps = this.getTileProperties(next);
    const nextBehavior = this.behaviorRegistry.get(nextProps.type);
    const ctx = this.createBehaviorContext(next, nextProps);
    const movementCost = nextBehavior.getMovementCost(ctx);
    const stepDuration = 0.25 * movementCost;

    player.segmentProgress += dt / stepDuration;

    if (player.segmentProgress >= 1) {
      // Arrived at next tile
      player.position = { x: next.x, y: next.y };
      player.visualPosition = { x: next.x, y: next.y };
      player.segmentIndex = nextIndex;
      player.segmentProgress = 0;

      // Apply tile effect
      this.applyTileEffect(next);

      // Check if dead or won after effect (state may have changed)
      if (this.gameState.player.state === 'dead' || this.gameState.player.state === 'won') {
        this.gameState.player.path = [];
        return;
      }

      // Handle forced movement (conveyor)
      if (player.pendingForcedMove) {
        const forcedTarget = player.pendingForcedMove;
        player.pendingForcedMove = undefined;

        // Check if forced target is valid
        if (this.level.isInBounds(forcedTarget)) {
          const forcedProps = this.getTileProperties(forcedTarget);
          const forcedBehavior = this.behaviorRegistry.get(forcedProps.type);
          const forcedCtx = this.createBehaviorContext(forcedTarget, forcedProps);

          if (forcedBehavior.isWalkable(forcedCtx)) {
            // Execute forced movement
            player.path = [player.position, forcedTarget];
            player.segmentIndex = 0;
            player.segmentProgress = 0;
            return;
          }
        }
      }

      // Check if reached end of path
      if (nextIndex >= player.path.length - 1) {
        player.state = 'idle';
        player.path = [next];
        this.emit('player:state:changed', { state: 'idle' });
        this.emit('path:updated', { hasPath: false });

        // Step mode: wait for next input
        if (this.gameState.isStepMode) {
          this.gameState.turnNumber++;
          this.gameState.waitingForStep = true;
          this.emit('step:completed', { turnNumber: this.gameState.turnNumber });
          this.emit('gamestate:changed', { gameState: this.gameState });
        }
      }
    } else {
      // Interpolate position
      const t = player.segmentProgress;
      player.visualPosition = {
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      };
    }
  }

  private applyTileEffect(coord: GridCoord): void {
    const props = this.getTileProperties(coord);
    const behavior = this.behaviorRegistry.get(props.type);
    const ctx = this.createBehaviorContext(coord, props);

    const prevHp = this.gameState.player.hp;
    const prevState = this.gameState.player.state;

    // Apply behavior effect
    this.gameState.player = behavior.onEnter(ctx);

    // Check for HP change (damage)
    if (this.gameState.player.hp < prevHp) {
      const damage = prevHp - this.gameState.player.hp;
      this.damageFlashTimer = this.DAMAGE_FLASH_DURATION;
      this.emit('player:hp:changed', {
        hp: this.gameState.player.hp,
        maxHp: this.gameState.player.maxHp,
        damage,
      });
    }

    // Check for state change
    if (this.gameState.player.state !== prevState) {
      this.emit('player:state:changed', { state: this.gameState.player.state });

      if (this.gameState.player.state === 'dead') {
        this.emit('player:died', { cause: props.type });
      } else if (this.gameState.player.state === 'won') {
        this.emit('player:won', undefined);
      }
    }
  }

  // Rendering ---------------------------------------------------------------
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
    this.renderSelection(ctx, centerOffset.x, centerOffset.y);
    this.renderPath(ctx, centerOffset.x, centerOffset.y);
    this.renderPlayer(ctx, centerOffset.x, centerOffset.y);

    ctx.restore();

    // Render UI overlay (HP display)
    this.renderHPDisplay();
  }

  private renderTileOverlays(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    for (let y = 0; y < this.level.gridHeight; y++) {
      for (let x = 0; x < this.level.gridWidth; x++) {
        const coord = { x, y };
        const props = this.getTileProperties(coord);
        let color = OVERLAY_COLORS[props.type] ?? OVERLAY_COLORS.floor;

        // Special handling for doors
        if (props.type === 'door') {
          const doorId = props.linkedId ?? 'default';
          color = this.gameState.openDoors.has(doorId) ? DOOR_OPEN_COLOR : DOOR_CLOSED_COLOR;
        }

        this.drawDiamond(ctx, coord, offsetX, offsetY, color);

        // Draw direction arrows for conveyors
        if (props.type === 'conveyor' && props.direction) {
          this.drawConveyorArrow(ctx, coord, props.direction, offsetX, offsetY);
        }

        // Draw icons for special tiles
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

  private renderSelection(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    if (!this.selected) return;
    this.drawDiamond(ctx, this.selected, offsetX, offsetY, SELECTION_COLOR);
  }

  private renderPath(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    const player = this.gameState.player;
    if (!player.path.length) return;

    ctx.strokeStyle = PATH_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < player.path.length; i++) {
      const coord = player.path[i];
      if (!coord) continue;
      const center = gridToScreen(coord.x, coord.y, offsetX, offsetY);
      if (i === 0) {
        ctx.moveTo(center.x, center.y + ISO_TILE_HEIGHT / 2);
      } else {
        ctx.lineTo(center.x, center.y + ISO_TILE_HEIGHT / 2);
      }
    }
    ctx.stroke();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    const player = this.gameState.player;
    const pos = gridToScreen(player.visualPosition.x, player.visualPosition.y, offsetX, offsetY);

    // Determine player color based on state
    let color = PLAYER_COLOR;
    if (player.state === 'dead') {
      color = PLAYER_DEAD_COLOR;
    } else if (player.state === 'won') {
      color = PLAYER_WON_COLOR;
    } else if (this.damageFlashTimer > 0) {
      // Damage flash - alternate between red and normal
      const flashPhase = Math.floor(this.damageFlashTimer * 10) % 2;
      color = flashPhase === 0 ? PLAYER_DEAD_COLOR : PLAYER_COLOR;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y + ISO_TILE_HEIGHT / 2, ISO_TILE_WIDTH / 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw X for dead player
    if (player.state === 'dead') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      const size = ISO_TILE_WIDTH / 6;
      ctx.beginPath();
      ctx.moveTo(pos.x - size, pos.y + ISO_TILE_HEIGHT / 2 - size);
      ctx.lineTo(pos.x + size, pos.y + ISO_TILE_HEIGHT / 2 + size);
      ctx.moveTo(pos.x + size, pos.y + ISO_TILE_HEIGHT / 2 - size);
      ctx.lineTo(pos.x - size, pos.y + ISO_TILE_HEIGHT / 2 + size);
      ctx.stroke();
    }
  }

  private renderHPDisplay(): void {
    const ctx = this.canvas.ctx;
    const player = this.gameState.player;

    ctx.save();
    ctx.font = '14px monospace';

    // HP display
    const hpText = `HP: ${player.hp}/${player.maxHp}`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(8, 8, 80, 24);
    ctx.fillStyle = player.hp <= 1 ? '#ff4a4a' : '#4aff9e';
    ctx.fillText(hpText, 14, 24);

    // Turn counter (if step mode)
    if (this.gameState.isStepMode) {
      const turnText = `Turn: ${this.gameState.turnNumber}`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(8, 36, 80, 24);
      ctx.fillStyle = '#fff';
      ctx.fillText(turnText, 14, 52);

      // Waiting indicator
      if (this.gameState.waitingForStep) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(8, 64, 100, 24);
        ctx.fillStyle = '#ffc75e';
        ctx.fillText('Waiting...', 14, 80);
      }
    }

    // State display
    if (player.state === 'dead') {
      ctx.fillStyle = 'rgba(255, 74, 74, 0.9)';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('DEAD', this.canvas.viewport.width / 2 - 40, this.canvas.viewport.height / 2);
    } else if (player.state === 'won') {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('WIN!', this.canvas.viewport.width / 2 - 40, this.canvas.viewport.height / 2);
    }

    ctx.restore();
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
    direction: Direction,
    offsetX: number,
    offsetY: number
  ): void {
    const center = gridToScreen(coord.x, coord.y, offsetX, offsetY);
    const cx = center.x;
    const cy = center.y + ISO_TILE_HEIGHT / 2;

    ctx.save();
    ctx.translate(cx, cy);

    // Rotate based on direction
    const rotations: Record<Direction, number> = {
      north: -Math.PI / 2,
      east: 0,
      south: Math.PI / 2,
      west: Math.PI,
    };
    ctx.rotate(rotations[direction]);

    // Draw arrow
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
      // Simple flame shape
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.bezierCurveTo(cx - 3, cy - 2, cx - 3, cy + 2, cx, cy + 4);
      ctx.bezierCurveTo(cx + 3, cy + 2, cx + 3, cy - 2, cx, cy - 4);
      ctx.fill();
    } else if (icon === 'star') {
      // Simple star
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
      // Spawn marker
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private findFirstWalkable(): GridCoord | null {
    for (let y = 0; y < this.level.gridHeight; y++) {
      for (let x = 0; x < this.level.gridWidth; x++) {
        const coord = { x, y };
        const props = this.getTileProperties(coord);
        const behavior = this.behaviorRegistry.get(props.type);
        const ctx = this.createBehaviorContext(coord, props);
        if (behavior.isWalkable(ctx)) {
          return coord;
        }
      }
    }
    return null;
  }
}
