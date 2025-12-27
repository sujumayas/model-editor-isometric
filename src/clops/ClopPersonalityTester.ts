import { calculateCenterOffset, gridToScreen } from '../core/isometric';
import {
  CardinalDirection,
  GridCoord,
  TileBehavior,
  TileBehaviorPlacement,
  TileBehaviorType,
} from '../core/types';
import { ISO_TILE_HEIGHT, ISO_TILE_WIDTH } from '../core/constants';
import { Canvas } from '../engine/Canvas';
import { Camera } from '../engine/Camera';
import { Renderer } from '../engine/Renderer';
import { TileRegistry } from '../assets/TileRegistry';
import { Level } from '../level/Level';
import { deserializeLevel, loadLevelFromFile, serializeLevel } from '../level/LevelSerializer';
import { ClopPersonality, ClopPersonalityConfig, ClopSnapshot, SimulationSpeed } from './types';

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

const CLOP_COLORS: Record<ClopPersonality, string> = {
  curious: '#4aff9e',
  coward: '#ffd75e',
  hyperactive: '#ff8fba',
};

interface ClopState {
  id: number;
  personality: ClopPersonality;
  position: GridCoord;
  spawn: GridCoord;
  destination: GridCoord | null;
  path: GridCoord[];
  segmentIndex: number;
  segmentProgress: number;
  currentStepDuration: number;
  moving: boolean;
  isAnimating: boolean;
  finished: boolean;
  stuck: boolean;
  pathHasHazard: boolean;
  blocked: boolean;
  visited: Set<string>;
}

export interface ClopPersonalityTesterOptions {
  canvas: HTMLCanvasElement | string;
  container?: HTMLElement | string;
  tileRegistry: TileRegistry;
}

interface ClopTesterEventMap {
  'level:changed': { level: Level };
  'clops:updated': { clops: ClopSnapshot[] };
  'log:message': { text: string };
}

type ClopTesterEvent = keyof ClopTesterEventMap;
type ClopTesterHandler<T extends ClopTesterEvent> = (payload: ClopTesterEventMap[T]) => void;
type ClopTesterListener = (payload: unknown) => void;

class DeterministicRng {
  private seed: number;

  constructor(seed = 1234) {
    this.seed = seed >>> 0;
  }

  next(): number {
    this.seed = (1664525 * this.seed + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
}

export class ClopPersonalityTester {
  readonly canvas: Canvas;
  readonly camera: Camera;
  readonly renderer: Renderer;
  private tileRegistry: TileRegistry;
  private level: Level;
  private listeners = new Map<ClopTesterEvent, Set<ClopTesterListener>>();

  private animationFrame: number | null = null;
  private lastTimestamp = 0;
  private isRunning = false;
  private isPaused = true;
  private speedMultiplier: SimulationSpeed = 1;
  private stepMode = false;
  private pendingStep = false;

  private baseStepDuration = 0.25;
  private defaultHazardDamage = 1;
  private defaultConveyorDirection: CardinalDirection = 'east';
  private readonly hazardPenalty = 2.5;
  private exitTile: GridCoord | null = null;
  private clops: ClopState[] = [];
  private rng = new DeterministicRng(42);

  constructor(options: ClopPersonalityTesterOptions) {
    this.tileRegistry = options.tileRegistry;

    this.canvas = new Canvas({
      canvas: options.canvas,
      container: options.container,
    });

    this.camera = new Camera({ zoom: 2 });
    this.renderer = new Renderer(this.canvas, this.camera, this.tileRegistry);
    this.renderer.setOptions({ showHover: false, showSelection: false });

    this.level = Level.createDefault('Clop Personality Test');
    this.setupEventListeners();
    this.resetClops();
    this.start();
  }

  on<T extends ClopTesterEvent>(event: T, handler: ClopTesterHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as ClopTesterListener);
    return () => this.listeners.get(event)?.delete(handler as ClopTesterListener);
  }

  private emit<T extends ClopTesterEvent>(event: T, payload: ClopTesterEventMap[T]): void {
    this.listeners.get(event)?.forEach((handler) => {
      (handler as ClopTesterHandler<T>)(payload);
    });
  }

  // Public API --------------------------------------------------------------
  getLevel(): Level {
    return this.level;
  }

  getClopSnapshots(): ClopSnapshot[] {
    return this.clops.map((clop) => this.toSnapshot(clop));
  }

  setPaused(paused: boolean): void {
    if (this.isPaused === paused) return;
    this.isPaused = paused;
  }

  setStepMode(enabled: boolean): void {
    this.stepMode = enabled;
    this.pendingStep = !enabled;
  }

  advanceTurn(): void {
    if (this.stepMode) {
      this.pendingStep = true;
    }
  }

  setSpeed(speed: SimulationSpeed): void {
    const allowed: SimulationSpeed[] = [1, 2, 4];
    if (!allowed.includes(speed)) return;
    this.speedMultiplier = speed;
  }

  setSeed(seed: number): void {
    if (!Number.isFinite(seed)) return;
    this.rng = new DeterministicRng(Math.max(1, Math.floor(seed)));
  }

  setLevel(level: Level): void {
    this.level = level;
    this.exitTile = this.findExitTile();
    this.resetClops();
    this.emit('level:changed', { level });
  }

  async loadLevelFromFile(file: File): Promise<void> {
    const level = await loadLevelFromFile(file);
    this.setLevel(level);
  }

  useLevelClone(level: Level): void {
    const json = serializeLevel(level);
    const clone = deserializeLevel(json);
    this.setLevel(clone);
  }

  resetClops(): void {
    const spawns = this.collectSpawnPoints();
    const assignments: ClopPersonality[] = ['curious', 'coward', 'hyperactive'];
    if (!spawns.length) {
      const fallback = this.findFirstWalkable() ?? { x: 0, y: 0 };
      spawns.push(fallback);
    }
    this.pendingStep = !this.stepMode;
    this.clops = spawns.map((spawn, index) => {
      const personality = assignments[index % assignments.length] ?? 'curious';
      return this.createClop(index + 1, personality, spawn);
    });
    this.emitClops();
  }

  setClopPersonality(config: ClopPersonalityConfig): void {
    const clop = this.clops.find((c) => c.id === config.id);
    if (!clop) return;
    clop.personality = config.personality;
    clop.destination = null;
    clop.path = [clop.position];
    clop.visited.clear();
    clop.finished = false;
    clop.stuck = false;
    clop.blocked = false;
    this.emitClops();
  }

  setDefaultConveyorDirection(direction: CardinalDirection): void {
    this.defaultConveyorDirection = direction;
  }

  setDefaultHazardDamage(damage: number): void {
    if (Number.isFinite(damage)) {
      this.defaultHazardDamage = Math.max(1, Math.round(damage));
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
  private createClop(id: number, personality: ClopPersonality, spawn: GridCoord): ClopState {
    return {
      id,
      personality,
      position: spawn,
      spawn,
      destination: null,
      path: [spawn],
      segmentIndex: 0,
      segmentProgress: 0,
      currentStepDuration: this.baseStepDuration,
      moving: false,
      isAnimating: false,
      finished: false,
      stuck: false,
      pathHasHazard: false,
      blocked: false,
      visited: new Set([this.key(spawn)]),
    };
  }

  private setupEventListeners(): void {
    const canvasEl = this.canvas.element;
    canvasEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const rect = canvasEl.getBoundingClientRect();
      this.camera.zoomBy(delta, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
  }

  private loop(timestamp: number): void {
    if (!this.isRunning) return;
    const deltaMs = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    this.update(deltaMs / 1000);
    this.render();

    this.animationFrame = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    if (this.isPaused) return;
    const scaledDt = dt * this.speedMultiplier;
    for (const clop of this.clops) {
      if (clop.finished || clop.stuck) continue;
      if (!this.exitTile) {
        clop.stuck = true;
        continue;
      }

      if (!clop.destination) {
        this.planDestination(clop);
      }

      if (clop.path.length <= 1 || clop.blocked) {
        this.rebuildPath(clop);
      }

      if (this.shouldStartNextSegment(clop)) {
        this.beginSegment(clop);
      }

      if (!clop.isAnimating || clop.path.length < 2) continue;

      const currentIndex = clop.segmentIndex;
      const nextIndex = currentIndex + 1;
      const current = clop.path[currentIndex];
      const next = clop.path[nextIndex];
      if (!current || !next) {
        clop.stuck = true;
        continue;
      }

      clop.segmentProgress += scaledDt / clop.currentStepDuration;
      if (clop.segmentProgress >= 1) {
        clop.position = { x: next.x, y: next.y };
        clop.segmentIndex = nextIndex;
        clop.segmentProgress = 0;
        clop.isAnimating = false;
        clop.visited.add(this.key(next));

        if (nextIndex >= clop.path.length - 1) {
          clop.moving = false;
        } else {
          clop.pathHasHazard = this.pathContainsHazard(clop.path, nextIndex + 1);
          if (this.stepMode) {
            this.pendingStep = false;
          }
        }
        this.handleTileArrival(clop, next);
      } else {
        const t = clop.segmentProgress;
        clop.position = {
          x: current.x + (next.x - current.x) * t,
          y: current.y + (next.y - current.y) * t,
        };
      }
    }
    this.emitClops();
  }

  private shouldStartNextSegment(clop: ClopState): boolean {
    if (!clop.moving || clop.isAnimating) return false;
    if (clop.segmentIndex >= clop.path.length - 1) return false;
    if (this.stepMode && !this.pendingStep) return false;
    return true;
  }

  private beginSegment(clop: ClopState): void {
    const next = clop.path[clop.segmentIndex + 1];
    if (!next) return;
    clop.currentStepDuration = this.getStepDuration(next, clop);
    clop.isAnimating = true;
    if (this.stepMode) {
      this.pendingStep = false;
    }
  }

  private handleTileArrival(clop: ClopState, coord: GridCoord): void {
    const behavior = this.getTileBehavior(coord);

    if (behavior.type === 'spawn') {
      clop.spawn = coord;
    }

    if (behavior.type === 'hole') {
      clop.stuck = true;
      clop.moving = false;
      clop.destination = null;
      clop.pathHasHazard = false;
      return;
    }

    if (behavior.type === 'hazard-burn') {
      // Cowards treat hazard arrival as failure and reroute
      if (clop.personality === 'coward') {
        clop.blocked = true;
      }
    }

    if (behavior.type === 'exit' && this.exitTile && this.sameCoord(coord, this.exitTile)) {
      clop.finished = true;
      clop.moving = false;
      clop.destination = coord;
      clop.pathHasHazard = false;
      return;
    }

    if (behavior.type === 'conveyor') {
      const next = this.getConveyorTarget(coord, behavior.direction ?? this.defaultConveyorDirection);
      if (next) {
        this.forceMoveTo(clop, next);
        return;
      }
    }

    if (clop.personality === 'hyperactive' && this.rng.next() < 0.2) {
      const randomTarget = this.pickRandomNeighbor(coord);
      if (randomTarget) {
        clop.destination = randomTarget;
        this.rebuildPath(clop);
        return;
      }
    }

    if (clop.destination && !this.sameCoord(coord, clop.destination)) {
      this.rebuildPath(clop);
      return;
    }

    if (clop.destination && this.sameCoord(coord, clop.destination)) {
      this.planDestination(clop);
    }
  }

  private planDestination(clop: ClopState): void {
    if (clop.personality === 'curious') {
      const explorationTarget = this.findNearestUnseen(clop);
      if (explorationTarget) {
        clop.destination = explorationTarget;
        this.rebuildPath(clop);
        return;
      }
    }
    clop.destination = this.exitTile;
    this.rebuildPath(clop);
  }

  private rebuildPath(clop: ClopState): void {
    if (!clop.destination) return;
    const start = this.roundCoord(clop.position);
    const path = this.findPath(start, clop.destination, clop);
    if (!path || path.length === 0) {
      clop.moving = false;
      clop.path = [start];
      clop.stuck = true;
      clop.blocked = true;
      return;
    }
    clop.path = path;
    clop.segmentIndex = 0;
    clop.segmentProgress = 0;
    clop.currentStepDuration = this.getStepDuration(path[1] ?? clop.destination, clop);
    clop.moving = path.length > 1;
    clop.isAnimating = false;
    clop.pathHasHazard = this.pathContainsHazard(path, 1);
    clop.blocked = false;
  }

  // Pathfinding -------------------------------------------------------------
  private findPath(start: GridCoord, goal: GridCoord, clop: ClopState): GridCoord[] | null {
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
        if (this.isBlocked(neighbor) || this.isHole(neighbor)) continue;
        if (this.isOccupied(neighbor, clop.id)) continue;

        const cost = this.getTraversalCost(neighbor, clop);
        if (!Number.isFinite(cost)) continue;

        const tentativeG = (gScore.get(current) ?? Infinity) + cost;
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

  private getTraversalCost(coord: GridCoord, clop: ClopState): number {
    const kind = this.getTileBehavior(coord).type;
    if (kind === 'slow') return 2.5;
    if (kind === 'hazard-burn') {
      if (clop.personality === 'coward') return 100;
      return this.hazardPenalty;
    }
    return 1;
  }

  private getStepDuration(coord: GridCoord, clop: ClopState): number {
    const kind = this.getTileBehavior(coord).type;
    const base = kind === 'slow' ? this.baseStepDuration * 2.5 : this.baseStepDuration;
    if (clop.personality === 'hyperactive') return base * 0.6;
    return base;
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

  private isHole(coord: GridCoord): boolean {
    return this.getTileBehavior(coord).type === 'hole';
  }

  private isOccupied(coord: GridCoord, clopId: number): boolean {
    return this.clops.some((c) => c.id !== clopId && !c.stuck && !c.finished && this.sameCoord(this.roundCoord(c.position), coord));
  }

  private getConveyorTarget(coord: GridCoord, direction: CardinalDirection): GridCoord | null {
    const target =
      direction === 'north' ? { x: coord.x, y: coord.y - 1 } :
      direction === 'south' ? { x: coord.x, y: coord.y + 1 } :
      direction === 'west' ? { x: coord.x - 1, y: coord.y } :
      { x: coord.x + 1, y: coord.y };

    if (!this.level.isInBounds(target)) return null;
    if (this.isBlocked(target)) return null;
    if (this.isOccupied(target, -1)) return null;
    return target;
  }

  private forceMoveTo(clop: ClopState, target: GridCoord): void {
    clop.path = [this.roundCoord(clop.position), target];
    clop.segmentIndex = 0;
    clop.segmentProgress = 0;
    clop.currentStepDuration = this.getStepDuration(target, clop);
    clop.moving = true;
    clop.isAnimating = false;
    clop.pathHasHazard = this.pathContainsHazard(clop.path, 1);
    clop.blocked = false;
  }

  private findNearestUnseen(clop: ClopState): GridCoord | null {
    const queue: GridCoord[] = [this.roundCoord(clop.position)];
    const visited = new Set<string>([this.key(this.roundCoord(clop.position))]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = this.key(current);
      if (!clop.visited.has(currentKey) && !this.isBlocked(current) && !this.isHole(current)) {
        return current;
      }
      for (const neighbor of this.getNeighbors(current)) {
        const key = this.key(neighbor);
        if (visited.has(key)) continue;
        if (this.isBlocked(neighbor) || this.isHole(neighbor)) continue;
        visited.add(key);
        queue.push(neighbor);
      }
    }
    return null;
  }

  private collectSpawnPoints(): GridCoord[] {
    const spawns: GridCoord[] = [];
    this.level.forEachTileBehavior((placement: TileBehaviorPlacement) => {
      if (placement.type === 'spawn') {
        spawns.push(placement.position);
      }
    });
    return spawns;
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

  private findExitTile(): GridCoord | null {
    let exit: GridCoord | null = null;
    this.level.forEachTileBehavior((placement: TileBehaviorPlacement) => {
      if (placement.type === 'exit' && !exit) {
        exit = placement.position;
      }
    });
    return exit;
  }

  private pathContainsHazard(path: GridCoord[], fromIndex = 0): boolean {
    return path.slice(fromIndex).some((coord) => this.getTileBehavior(coord).type === 'hazard-burn');
  }

  private pickRandomNeighbor(coord: GridCoord): GridCoord | null {
    const neighbors = this.getNeighbors(coord).filter((n) => !this.isBlocked(n) && !this.isHole(n));
    if (!neighbors.length) return null;
    const index = Math.floor(this.rng.next() * neighbors.length);
    return neighbors[index] ?? null;
  }

  private getTileBehavior(coord: GridCoord): TileBehavior {
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
    this.renderClops(ctx, centerOffset.x, centerOffset.y);

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

  private renderClops(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    for (const clop of this.clops) {
      const pos = gridToScreen(clop.position.x, clop.position.y, offsetX, offsetY);
      const color = CLOP_COLORS[clop.personality];
      ctx.fillStyle = clop.finished ? 'rgba(74, 255, 158, 0.9)' : color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y + ISO_TILE_HEIGHT / 2, ISO_TILE_WIDTH / 4, 0, Math.PI * 2);
      ctx.fill();

      // Personality badge
      ctx.fillStyle = 'rgba(15,15,20,0.8)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      this.drawRoundedRect(ctx, pos.x - 16, pos.y - 14, 32, 14, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tag = `${clop.id}: ${clop.personality}`;
      ctx.fillText(tag, pos.x, pos.y - 7);
    }
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

  private emitClops(): void {
    this.emit('clops:updated', { clops: this.getClopSnapshots() });
  }

  private toSnapshot(clop: ClopState): ClopSnapshot {
    return {
      id: clop.id,
      personality: clop.personality,
      position: this.roundCoord(clop.position),
      spawn: clop.spawn,
      target: clop.destination,
      status: clop.finished ? 'finished' : clop.stuck ? 'stuck' : 'active',
      pathLength: Math.max(0, clop.path.length - 1),
      pathHasHazard: clop.pathHasHazard,
      blocked: clop.blocked,
    };
  }

  private roundCoord(coord: GridCoord): GridCoord {
    return { x: Math.round(coord.x), y: Math.round(coord.y) };
  }

  private sameCoord(a: GridCoord | null, b: GridCoord | null): boolean {
    return !!a && !!b && a.x === b.x && a.y === b.y;
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
