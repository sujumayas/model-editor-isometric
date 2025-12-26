/**
 * Movement testing view that reuses the isometric renderer and grid logic.
 */

import { calculateCenterOffset, gridToScreen } from '../core/isometric';
import { PositionKey, GridCoord, toPositionKey, fromPositionKey } from '../core/types';
import { Canvas } from '../engine/Canvas';
import { Camera } from '../engine/Camera';
import { Renderer } from '../engine/Renderer';
import { TileRegistry } from '../assets/TileRegistry';
import { Level } from '../level/Level';
import { deserializeLevel, loadLevelFromFile, serializeLevel } from '../level/LevelSerializer';
import { ISO_TILE_HEIGHT, ISO_TILE_WIDTH } from '../core/constants';

export type TileKind = 'floor' | 'blocker' | 'slow';
export type ClickMode = 'move' | 'edit';

export interface MovementTesterOptions {
  canvas: HTMLCanvasElement | string;
  container?: HTMLElement | string;
  tileRegistry: TileRegistry;
}

export interface MovementTesterEventMap {
  'selection:changed': { coord: GridCoord | null; kind: TileKind };
  'mode:changed': { mode: ClickMode };
  'level:changed': { level: Level };
  'path:updated': { hasPath: boolean };
}

type MovementTesterEvent = keyof MovementTesterEventMap;
type MovementTesterHandler<T extends MovementTesterEvent> = (payload: MovementTesterEventMap[T]) => void;
type MovementListener = (payload: unknown) => void;

const FLOOR_COLOR = 'rgba(74, 158, 255, 0.08)';
const BLOCKER_COLOR = 'rgba(255, 74, 74, 0.45)';
const SLOW_COLOR = 'rgba(255, 199, 94, 0.35)';
const SELECTION_COLOR = 'rgba(74, 255, 158, 0.5)';
const PATH_COLOR = 'rgba(74, 158, 255, 0.6)';
const PLAYER_COLOR = 'rgba(74, 255, 158, 0.9)';

interface PlayerState {
  position: { x: number; y: number };
  path: GridCoord[];
  segmentIndex: number;
  segmentProgress: number;
  moving: boolean;
}

export class MovementTester {
  readonly canvas: Canvas;
  readonly camera: Camera;
  readonly renderer: Renderer;
  private tileRegistry: TileRegistry;
  private level: Level;
  private kinds = new Map<PositionKey, TileKind>();
  private selected: GridCoord | null = null;
  private hovered: GridCoord | null = null;
  private clickMode: ClickMode = 'move';
  private listeners = new Map<MovementTesterEvent, Set<MovementListener>>();

  private animationFrame: number | null = null;
  private lastTimestamp = 0;
  private isRunning = false;

  private player: PlayerState = {
    position: { x: 0, y: 0 },
    path: [],
    segmentIndex: 0,
    segmentProgress: 0,
    moving: false,
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

  // Public API --------------------------------------------------------------
  getLevel(): Level {
    return this.level;
  }

  getSelectedCoord(): GridCoord | null {
    return this.selected;
  }

  getTileKind(coord: GridCoord): TileKind {
    const key = toPositionKey(coord);
    return this.kinds.get(key) ?? 'floor';
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
    this.kinds.clear();
    this.selected = null;
    this.hovered = null;
    this.resetPlayerPosition();
    this.emit('selection:changed', { coord: null, kind: 'floor' });
    this.emit('level:changed', { level });
  }

  setSelectedKind(kind: TileKind): void {
    if (!this.selected) return;
    this.setTileKind(this.selected, kind);
    this.emit('selection:changed', { coord: this.selected, kind });
  }

  setTileKind(coord: GridCoord, kind: TileKind): void {
    if (!this.level.isInBounds(coord)) return;
    const key = toPositionKey(coord);
    if (kind === 'floor') {
      this.kinds.delete(key);
    } else {
      this.kinds.set(key, kind);
    }
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
    this.emit('selection:changed', { coord, kind: this.getTileKind(coord) });
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
    const start = this.findFirstWalkable() ?? { x: 0, y: 0 };
    this.player.position = start;
    this.player.path = [];
    this.player.segmentIndex = 0;
    this.player.segmentProgress = 0;
    this.player.moving = false;
  }

  // Movement ----------------------------------------------------------------
  private movePlayerTo(target: GridCoord): void {
    if (!this.level.isInBounds(target)) return;
    if (this.getTileKind(target) === 'blocker') return;

    const start = { x: Math.round(this.player.position.x), y: Math.round(this.player.position.y) };
    const path = this.findPath(start, target);
    if (!path || path.length === 0) {
      this.player.path = [];
      this.player.moving = false;
      this.emit('path:updated', { hasPath: false });
      return;
    }

    this.player.path = path;
    this.player.segmentIndex = 0;
    this.player.segmentProgress = 0;
    this.player.moving = true;
    this.emit('path:updated', { hasPath: true });
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
        if (this.getTileKind(neighbor) === 'blocker') continue;

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
    const kind = this.getTileKind(coord);
    if (kind === 'slow') return 2.5;
    return 1;
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
    if (!this.player.moving || this.player.path.length < 2) return;

    const currentIndex = this.player.segmentIndex;
    const nextIndex = currentIndex + 1;
    const current = this.player.path[currentIndex];
    const next = this.player.path[nextIndex];

    if (!current || !next) {
      this.player.moving = false;
      this.emit('path:updated', { hasPath: false });
      return;
    }

    const stepDuration = 0.25 * this.getStepCost(next);
    this.player.segmentProgress += dt / stepDuration;

    if (this.player.segmentProgress >= 1) {
      this.player.position = { x: next.x, y: next.y };
      this.player.segmentIndex = nextIndex;
      this.player.segmentProgress = 0;

      if (nextIndex >= this.player.path.length - 1) {
        this.player.moving = false;
        this.player.path = [next];
        this.emit('path:updated', { hasPath: false });
      }
    } else {
      const t = this.player.segmentProgress;
      this.player.position = {
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      };
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

    this.renderKindOverlays(ctx, centerOffset.x, centerOffset.y);
    this.renderSelection(ctx, centerOffset.x, centerOffset.y);
    this.renderPath(ctx, centerOffset.x, centerOffset.y);
    this.renderPlayer(ctx, centerOffset.x, centerOffset.y);

    ctx.restore();
  }

  private renderKindOverlays(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    for (let y = 0; y < this.level.gridHeight; y++) {
      for (let x = 0; x < this.level.gridWidth; x++) {
        const kind = this.getTileKind({ x, y });
        const color =
          kind === 'blocker' ? BLOCKER_COLOR :
          kind === 'slow' ? SLOW_COLOR :
          FLOOR_COLOR;
        this.drawDiamond(ctx, { x, y }, offsetX, offsetY, color);
      }
    }
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
    ctx.fillStyle = PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y + ISO_TILE_HEIGHT / 2, ISO_TILE_WIDTH / 4, 0, Math.PI * 2);
    ctx.fill();
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

  private findFirstWalkable(): GridCoord | null {
    for (let y = 0; y < this.level.gridHeight; y++) {
      for (let x = 0; x < this.level.gridWidth; x++) {
        const coord = { x, y };
        if (this.getTileKind(coord) !== 'blocker') {
          return coord;
        }
      }
    }
    return null;
  }
}
