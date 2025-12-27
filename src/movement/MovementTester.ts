/**
 * Movement testing view that reuses the isometric renderer and grid logic.
 */

import { calculateCenterOffset, gridToScreen } from '../core/isometric';
import {
  GridCoord,
  TileBehavior,
  TileBehaviorType,
  CardinalDirection,
  TileBehaviorPlacement,
} from '../core/types';
import { Canvas } from '../engine/Canvas';
import { Camera } from '../engine/Camera';
import { Renderer } from '../engine/Renderer';
import { TileRegistry } from '../assets/TileRegistry';
import { Level } from '../level/Level';
import { deserializeLevel, loadLevelFromFile, serializeLevel } from '../level/LevelSerializer';
import { ISO_TILE_HEIGHT, ISO_TILE_WIDTH } from '../core/constants';

export type TileKind = TileBehaviorType;
export type ClickMode = 'move' | 'edit';
export type MovementMode = 'auto' | 'step';

export interface MovementTesterOptions {
  canvas: HTMLCanvasElement | string;
  container?: HTMLElement | string;
  tileRegistry: TileRegistry;
}

export interface MovementTesterEventMap {
  'selection:changed': { coord: GridCoord | null; behavior: TileBehavior };
  'mode:changed': { mode: ClickMode };
  'level:changed': { level: Level };
  'path:updated': { hasPath: boolean; path: GridCoord[] };
  'player:updated': {
    position: GridCoord;
    hp: number;
    maxHp: number;
    alive: boolean;
    spawn: GridCoord | null;
    stepMode: boolean;
    reachedExit: boolean;
    destination: GridCoord | null;
  };
}

type MovementTesterEvent = keyof MovementTesterEventMap;
type MovementTesterHandler<T extends MovementTesterEvent> = (payload: MovementTesterEventMap[T]) => void;
type MovementListener = (payload: unknown) => void;

const OVERLAY_COLORS: Record<TileBehaviorType, string> = {
  floor: 'rgba(74, 158, 255, 0.08)',
  blocker: 'rgba(255, 74, 74, 0.45)',
  slow: 'rgba(255, 199, 94, 0.35)',
  hole: 'rgba(20, 20, 20, 0.6)',
  conveyor: 'rgba(74, 158, 255, 0.22)',
  'hazard-burn': 'rgba(255, 132, 74, 0.38)',
  door: 'rgba(156, 132, 255, 0.4)',
  exit: 'rgba(74, 255, 198, 0.35)',
  spawn: 'rgba(138, 255, 74, 0.32)',
};

const SELECTION_COLOR = 'rgba(74, 255, 158, 0.5)';
const PATH_COLOR = 'rgba(74, 158, 255, 0.65)';
const PLAYER_COLOR = 'rgba(74, 255, 158, 0.9)';
const PLAYER_HURT_COLOR = 'rgba(255, 132, 132, 0.9)';

interface PlayerState {
  position: GridCoord;
  spawn: GridCoord | null;
  hp: number;
  maxHp: number;
  alive: boolean;
  reachedExit: boolean;
  destination: GridCoord | null;
  path: GridCoord[];
  segmentIndex: number;
  segmentProgress: number;
  currentStepDuration: number;
  moving: boolean;
  isAnimating: boolean;
  stepMode: boolean;
  pendingStep: boolean;
  lastDamageAt: number;
}

export class MovementTester {
  readonly canvas: Canvas;
  readonly camera: Camera;
  readonly renderer: Renderer;
  private tileRegistry: TileRegistry;
  private level: Level;
  private selected: GridCoord | null = null;
  private hovered: GridCoord | null = null;
  private clickMode: ClickMode = 'move';
  private listeners = new Map<MovementTesterEvent, Set<MovementListener>>();

  private animationFrame: number | null = null;
  private lastTimestamp = 0;
  private isRunning = false;

  private readonly baseStepDuration = 0.25;
  private defaultHazardDamage = 1;
  private defaultConveyorDirection: CardinalDirection = 'east';

  private player: PlayerState = {
    position: { x: 0, y: 0 },
    spawn: null,
    hp: 3,
    maxHp: 3,
    alive: true,
    reachedExit: false,
    destination: null,
    path: [],
    segmentIndex: 0,
    segmentProgress: 0,
    currentStepDuration: 0.25,
    moving: false,
    isAnimating: false,
    stepMode: false,
    pendingStep: true,
    lastDamageAt: 0,
  };

  constructor(options: MovementTesterOptions) {
    this.tileRegistry = options.tileRegistry;

    this.canvas = new Canvas({
      canvas: options.canvas,
      container: options.container,
    });

    this.camera = new Camera({ zoom: 2 });
    this.renderer = new Renderer(this.canvas, this.camera, this.tileRegistry);
    this.renderer.setOptions({ showHover: false, showSelection: false });

    this.level = Level.createDefault('Movement Test');
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

  private emitPlayerState(): void {
    this.emit('player:updated', {
      position: { ...this.player.position },
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      alive: this.player.alive,
      spawn: this.player.spawn,
      stepMode: this.player.stepMode,
      reachedExit: this.player.reachedExit,
      destination: this.player.destination,
    });
  }

  // Public API --------------------------------------------------------------
  getLevel(): Level {
    return this.level;
  }

  getSelectedCoord(): GridCoord | null {
    return this.selected;
  }

  getTileBehavior(coord: GridCoord): TileBehavior {
    const behavior = this.level.getTileBehavior(coord);
    if (!behavior) return { type: 'floor' };
    if (behavior.type === 'conveyor') {
      return {
        type: 'conveyor',
        direction: behavior.direction ?? this.defaultConveyorDirection,
      };
    }
    if (behavior.type === 'door') {
      return {
        type: 'door',
        doorId: behavior.doorId,
        open: behavior.open ?? false,
      };
    }
    if (behavior.type === 'hazard-burn') {
      return {
        type: 'hazard-burn',
        damage: behavior.damage ?? this.defaultHazardDamage,
      };
    }
    return behavior;
  }

  setClickMode(mode: ClickMode): void {
    if (this.clickMode === mode) return;
    this.clickMode = mode;
    this.emit('mode:changed', { mode });
  }

  setStepMode(enabled: boolean): void {
    this.player.stepMode = enabled;
    this.player.pendingStep = !enabled;
    this.emitPlayerState();
  }

  setDefaultConveyorDirection(direction: CardinalDirection): void {
    this.defaultConveyorDirection = direction;
  }

  setDefaultHazardDamage(damage: number): void {
    if (Number.isFinite(damage)) {
      this.defaultHazardDamage = Math.max(1, Math.round(damage));
    }
  }

  advanceTurn(): void {
    if (!this.player.alive) return;
    this.player.pendingStep = true;
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
    this.resetPlayerPosition();
    this.emit('selection:changed', { coord: null, behavior: { type: 'floor' } });
    this.emit('level:changed', { level });
  }

  setSelectedKind(kind: TileKind): void {
    if (!this.selected) return;
    this.setTileBehavior(this.selected, this.createDefaultBehavior(kind));
    this.emitSelection(this.selected);
  }

  setTileBehavior(coord: GridCoord, behavior: TileBehavior | null): void {
    if (!this.level.isInBounds(coord)) return;
    const wasBlocked = this.isBlocked(coord);
    this.level.setTileBehavior(coord, behavior);
    // Update spawn reference if a spawn tile is placed/removed
    if (behavior?.type === 'spawn' || this.player.spawn && this.sameCoord(this.player.spawn, coord)) {
      this.player.spawn = this.findSpawnPoint();
    }
    if (this.player.destination && this.player.moving && wasBlocked !== this.isBlocked(coord)) {
      this.rebuildPathToDestination();
    }
    this.emitSelection(coord);
  }

  updateSelectedBehavior(updates: Partial<TileBehavior>): void {
    if (!this.selected) return;
    const existing = this.getTileBehavior(this.selected);
    if (existing.type === 'floor') return;
    this.setTileBehavior(this.selected, { ...existing, ...updates });
  }

  toggleDoorState(coord: GridCoord): void {
    const behavior = this.getTileBehavior(coord);
    if (behavior.type !== 'door') return;
    this.setTileBehavior(coord, { ...behavior, open: !behavior.open });
  }

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

  resetPlayer(): void {
    this.resetPlayerPosition();
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
    this.emitSelection(coord);
  }

  private emitSelection(coord: GridCoord): void {
    this.emit('selection:changed', { coord, behavior: this.getTileBehavior(coord) });
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

  private resetPlayerPosition(): void {
    const start = this.findSpawnPoint() ?? this.findFirstWalkable() ?? { x: 0, y: 0 };
    this.player.position = start;
    this.player.spawn = start;
    this.player.hp = this.player.maxHp;
    this.player.alive = true;
    this.player.reachedExit = false;
    this.player.destination = null;
    this.player.path = [start];
    this.player.segmentIndex = 0;
    this.player.segmentProgress = 0;
    this.player.currentStepDuration = this.baseStepDuration;
    this.player.moving = false;
    this.player.isAnimating = false;
    this.player.pendingStep = !this.player.stepMode;
    this.emit('path:updated', { hasPath: false, path: this.player.path });
    this.emitPlayerState();
  }

  private createDefaultBehavior(kind: TileKind): TileBehavior | null {
    switch (kind) {
      case 'blocker':
      case 'slow':
      case 'hole':
      case 'exit':
      case 'spawn':
        return { type: kind };
      case 'conveyor':
        return { type: 'conveyor', direction: this.defaultConveyorDirection };
      case 'hazard-burn':
        return { type: 'hazard-burn', damage: this.defaultHazardDamage };
      case 'door':
        return { type: 'door', open: false };
      case 'floor':
      default:
        return null;
    }
  }

  // Movement ----------------------------------------------------------------
  private movePlayerTo(target: GridCoord): void {
    if (!this.level.isInBounds(target) || !this.player.alive) return;
    if (this.isBlocked(target)) return;

    const start = this.roundCoord(this.player.position);
    const path = this.findPath(start, target);
    if (!path || path.length === 0) {
      this.stopMovement();
      return;
    }

    this.player.destination = target;
    this.player.path = path;
    this.player.segmentIndex = 0;
    this.player.segmentProgress = 0;
    this.player.currentStepDuration = this.getStepDuration(path[1] ?? target);
    this.player.moving = true;
    this.player.isAnimating = false;
    this.player.pendingStep = !this.player.stepMode;
    this.emit('path:updated', { hasPath: true, path });
    this.emitPlayerState();
  }

  private findPath(start: GridCoord, goal: GridCoord): GridCoord[] | null {
    const startKey = this.key(start);
    const goalKey = this.key(goal);

    const open: string[] = [startKey];
    const cameFrom = new Map<string, string | null>();
    const gScore = new Map<string, number>([[startKey, 0]]);
    const fScore = new Map<string, number>([[startKey, this.heuristic(start, goal)]]);

    cameFrom.set(startKey, null);

    while (open.length > 0) {
      open.sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity));
      const current = open.shift()!;
      if (current === goalKey) {
        return this.reconstructPath(cameFrom, current);
      }

      const currentCoord = this.fromKey(current);
      for (const neighbor of this.getNeighbors(currentCoord)) {
        const neighborKey = this.key(neighbor);
        if (this.isBlocked(neighbor)) continue;

        const tentativeG = (gScore.get(current) ?? Infinity) + this.getStepCost(neighbor);
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

  private getStepCost(coord: GridCoord): number {
    const kind = this.getTileBehavior(coord).type;
    if (kind === 'slow') return 2.5;
    return 1;
  }

  private getStepDuration(coord: GridCoord): number {
    const cost = this.getStepCost(coord);
    return this.baseStepDuration * cost;
  }

  private reconstructPath(cameFrom: Map<string, string | null>, current: string): GridCoord[] {
    const path: GridCoord[] = [this.fromKey(current)];
    let cur = cameFrom.get(current);
    while (cur) {
      path.push(this.fromKey(cur));
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

  private isBlocked(coord: GridCoord): boolean {
    const behavior = this.getTileBehavior(coord);
    return behavior.type === 'blocker' || (behavior.type === 'door' && !behavior.open);
  }

  private stopMovement(): void {
    this.player.moving = false;
    this.player.isAnimating = false;
    this.emit('path:updated', { hasPath: false, path: this.player.path });
  }

  private roundCoord(coord: GridCoord): GridCoord {
    return { x: Math.round(coord.x), y: Math.round(coord.y) };
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
    if (!this.player.alive) return;

    if (this.shouldStartNextSegment()) {
      this.beginSegment();
    }

    if (!this.player.isAnimating || this.player.path.length < 2) return;

    const currentIndex = this.player.segmentIndex;
    const nextIndex = currentIndex + 1;
    const current = this.player.path[currentIndex];
    const next = this.player.path[nextIndex];

    if (!current || !next) {
      this.stopMovement();
      return;
    }

    this.player.segmentProgress += dt / this.player.currentStepDuration;

    if (this.player.segmentProgress >= 1) {
      this.player.position = { x: next.x, y: next.y };
      this.player.segmentIndex = nextIndex;
      this.player.segmentProgress = 0;
      this.player.isAnimating = false;

      if (nextIndex >= this.player.path.length - 1) {
        this.player.moving = false;
        this.emit('path:updated', { hasPath: false, path: this.player.path });
      } else {
        this.player.pendingStep = !this.player.stepMode;
      }

      this.handleTileArrival(next);
    } else {
      const t = this.player.segmentProgress;
      this.player.position = {
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      };
    }
  }

  private shouldStartNextSegment(): boolean {
    if (!this.player.moving || this.player.isAnimating) return false;
    if (this.player.segmentIndex >= this.player.path.length - 1) return false;
    if (this.player.stepMode && !this.player.pendingStep) return false;
    return true;
  }

  private beginSegment(): void {
    const next = this.player.path[this.player.segmentIndex + 1];
    if (!next) return;
    this.player.currentStepDuration = this.getStepDuration(next);
    this.player.isAnimating = true;
    this.player.pendingStep = false;
  }

  private handleTileArrival(coord: GridCoord): void {
    const behavior = this.getTileBehavior(coord);

    if (behavior.type === 'spawn') {
      this.player.spawn = coord;
    }

    if (behavior.type === 'hole') {
      this.player.alive = false;
      this.player.moving = false;
      this.player.destination = null;
      this.emit('path:updated', { hasPath: false, path: [coord] });
      this.emitPlayerState();
      return;
    }

    if (behavior.type === 'hazard-burn') {
      this.applyDamage(behavior.damage ?? this.defaultHazardDamage);
      if (!this.player.alive) return;
    }

    if (behavior.type === 'exit') {
      this.player.reachedExit = true;
      this.player.moving = false;
      this.emit('path:updated', { hasPath: false, path: [coord] });
      this.emitPlayerState();
      return;
    }

    if (behavior.type === 'conveyor') {
      const next = this.getConveyorTarget(coord, behavior.direction ?? this.defaultConveyorDirection);
      if (next) {
        this.forceMoveTo(next);
        return;
      }
    }

    if (this.player.destination && !this.sameCoord(coord, this.player.destination) && this.player.alive) {
      this.rebuildPathToDestination();
      return;
    }

    this.emitPlayerState();
  }

  private getConveyorTarget(coord: GridCoord, direction: CardinalDirection): GridCoord | null {
    const target =
      direction === 'north' ? { x: coord.x, y: coord.y - 1 } :
      direction === 'south' ? { x: coord.x, y: coord.y + 1 } :
      direction === 'west' ? { x: coord.x - 1, y: coord.y } :
      { x: coord.x + 1, y: coord.y };

    if (!this.level.isInBounds(target)) return null;
    if (this.isBlocked(target)) return null;
    return target;
  }

  private forceMoveTo(target: GridCoord): void {
    this.player.path = [this.roundCoord(this.player.position), target];
    this.player.segmentIndex = 0;
    this.player.segmentProgress = 0;
    this.player.currentStepDuration = this.getStepDuration(target);
    this.player.moving = true;
    this.player.isAnimating = false;
    this.player.pendingStep = true; // Forced movement ignores step gating
    this.emit('path:updated', { hasPath: true, path: this.player.path });
  }

  private rebuildPathToDestination(): void {
    if (!this.player.destination) return;
    const start = this.roundCoord(this.player.position);
    const path = this.findPath(start, this.player.destination);
    if (!path || path.length === 0) {
      this.stopMovement();
      this.emitPlayerState();
      return;
    }
    this.player.path = path;
    this.player.segmentIndex = 0;
    this.player.segmentProgress = 0;
    this.player.currentStepDuration = this.getStepDuration(path[1] ?? this.player.destination);
    this.player.moving = true;
    this.player.isAnimating = false;
    this.player.pendingStep = !this.player.stepMode;
    this.emit('path:updated', { hasPath: true, path });
    this.emitPlayerState();
  }

  private applyDamage(amount: number): void {
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.player.lastDamageAt = performance.now();
    if (this.player.hp <= 0) {
      this.player.alive = false;
      this.player.moving = false;
      this.player.destination = null;
      this.emit('path:updated', { hasPath: false, path: [this.roundCoord(this.player.position)] });
    }
    this.emitPlayerState();
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

    this.renderKindOverlays(ctx, centerOffset.x, centerOffset.y);
    this.renderSelection(ctx, centerOffset.x, centerOffset.y);
    this.renderPath(ctx, centerOffset.x, centerOffset.y);
    this.renderPlayer(ctx, centerOffset.x, centerOffset.y);

    ctx.restore();
  }

  private renderKindOverlays(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';

    for (let y = 0; y < this.level.gridHeight; y++) {
      for (let x = 0; x < this.level.gridWidth; x++) {
        const coord = { x, y };
        const behavior = this.getTileBehavior(coord);
        const color = this.getOverlayColor(behavior);
        this.drawDiamond(ctx, coord, offsetX, offsetY, color);
        this.drawTileIcon(ctx, coord, behavior, offsetX, offsetY);
      }
    }

    ctx.restore();
  }

  private renderSelection(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    if (!this.selected) return;
    this.drawDiamond(ctx, this.selected, offsetX, offsetY, SELECTION_COLOR);
  }

  private renderPath(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    if (!this.player.path.length) return;
    ctx.strokeStyle = PATH_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < this.player.path.length; i++) {
      const coord = this.player.path[i];
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
    const pos = gridToScreen(this.player.position.x, this.player.position.y, offsetX, offsetY);
    const isHurt = performance.now() - this.player.lastDamageAt < 400;
    ctx.fillStyle = isHurt ? PLAYER_HURT_COLOR : PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y + ISO_TILE_HEIGHT / 2, ISO_TILE_WIDTH / 4, 0, Math.PI * 2);
    ctx.fill();

    // HP indicator
    const hpText = `${this.player.hp}/${this.player.maxHp}`;
    ctx.fillStyle = 'rgba(15,15,20,0.75)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    this.drawRoundedRect(ctx, pos.x - 16, pos.y - 6, 32, 14, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hpText, pos.x, pos.y + 1);
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

  private drawTileIcon(
    ctx: CanvasRenderingContext2D,
    coord: GridCoord,
    behavior: TileBehavior,
    offsetX: number,
    offsetY: number
  ): void {
    const center = gridToScreen(coord.x, coord.y, offsetX, offsetY);
    const cx = center.x;
    const cy = center.y + ISO_TILE_HEIGHT / 2;

    switch (behavior.type) {
      case 'hole':
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 2, ISO_TILE_WIDTH / 5, ISO_TILE_HEIGHT / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'conveyor':
        this.drawArrow(ctx, cx, cy, behavior.direction ?? this.defaultConveyorDirection);
        break;
      case 'hazard-burn':
        this.drawFlame(ctx, cx, cy);
        break;
      case 'door':
        this.drawDoor(ctx, cx, cy, behavior.open ?? false);
        break;
      case 'exit':
        this.drawStar(ctx, cx, cy, '#4affc6');
        break;
      case 'spawn':
        this.drawStar(ctx, cx, cy, '#8aff4a', 4);
        break;
    }
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: CardinalDirection
  ): void {
    ctx.save();
    ctx.strokeStyle = '#d2e8ff';
    ctx.fillStyle = '#d2e8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const size = 8;
    const dx = direction === 'east' ? 1 : direction === 'west' ? -1 : 0;
    const dy = direction === 'south' ? 1 : direction === 'north' ? -1 : 0;
    ctx.moveTo(x - dx * size * 0.4, y - dy * size * 0.4);
    ctx.lineTo(x + dx * size * 0.8, y + dy * size * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + dx * size, y + dy * size);
    ctx.lineTo(x + dx * size - dy * 4 + dx * 2, y + dy * size + dx * 4 + dy * 2);
    ctx.lineTo(x + dx * size + dy * 4 + dx * 2, y + dy * size - dx * 4 + dy * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.quadraticCurveTo(x + 6, y - 2, x, y + 6);
    ctx.quadraticCurveTo(x - 6, y - 2, x, y - 6);
    ctx.fill();
    ctx.fillStyle = '#ff6b3d';
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.quadraticCurveTo(x + 3, y, x, y + 4);
    ctx.quadraticCurveTo(x - 3, y, x, y - 4);
    ctx.fill();
    ctx.restore();
  }

  private drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean): void {
    ctx.save();
    ctx.fillStyle = open ? 'rgba(200,255,200,0.9)' : 'rgba(120,90,180,0.9)';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    this.drawRoundedRect(ctx, x - 8, y - 6, 16, 12, 3);
    ctx.fill();
    ctx.stroke();
    if (!open) {
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + 4, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, points = 5): void {
    ctx.save();
    ctx.fillStyle = color;
    const outerRadius = 7;
    const innerRadius = 3;
    const step = Math.PI / points;
    ctx.beginPath();
    for (let i = 0; i < 2 * points; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = i * step - Math.PI / 2;
      ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private getOverlayColor(behavior: TileBehavior): string {
    if (behavior.type === 'door' && behavior.open) {
      return 'rgba(138, 255, 200, 0.3)';
    }
    return OVERLAY_COLORS[behavior.type] ?? OVERLAY_COLORS.floor;
  }

  private findFirstWalkable(): GridCoord | null {
    for (let y = 0; y < this.level.gridHeight; y++) {
      for (let x = 0; x < this.level.gridWidth; x++) {
        const coord = { x, y };
        const behavior = this.getTileBehavior(coord);
        if (!this.isBlocked(coord) && behavior.type !== 'hole') {
          return coord;
        }
      }
    }
    return null;
  }

  private findSpawnPoint(): GridCoord | null {
    let spawn: GridCoord | null = null;
    this.level.forEachTileBehavior((placement: TileBehaviorPlacement) => {
      if (placement.type === 'spawn' && !spawn) {
        spawn = placement.position;
      }
    });
    return spawn;
  }

  private sameCoord(a: GridCoord | null, b: GridCoord | null): boolean {
    return !!a && !!b && a.x === b.x && a.y === b.y;
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private key(coord: GridCoord): string {
    return `${coord.x},${coord.y}`;
  }

  private fromKey(key: string): GridCoord {
    const [xRaw, yRaw] = key.split(',');
    const x = Number(xRaw ?? 0);
    const y = Number(yRaw ?? 0);
    return { x, y };
  }
}
