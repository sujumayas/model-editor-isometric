/**
 * Weighted A* pathfinding for autonomous agents.
 * Supports hazard avoidance by adding penalty costs to dangerous tiles.
 */

import { GridCoord, PositionKey, toPositionKey, fromPositionKey, TileProperties } from '../core/types';
import { Level } from '../level/Level';
import { getTileBehaviorRegistry, TileBehaviorRegistry, TileBehaviorContext, GameState } from '../gameplay';
import { PathfindingResult, PathfindingOptions, DEFAULT_PATHFINDING_OPTIONS } from './types';

/**
 * Weighted A* pathfinder that considers hazard avoidance.
 *
 * Key difference from basic A*:
 * - Hazards add an avoidance penalty to their movement cost
 * - This encourages agents to take safer routes when reasonable alternatives exist
 * - If no safe path exists, the agent will still take the hazardous route
 */
export class AgentPathfinder {
  private behaviorRegistry: TileBehaviorRegistry;

  constructor() {
    this.behaviorRegistry = getTileBehaviorRegistry();
  }

  /**
   * Find a path from start to goal using weighted A*.
   */
  findPath(
    start: GridCoord,
    goal: GridCoord,
    level: Level,
    gameState: GameState,
    options: PathfindingOptions = {}
  ): PathfindingResult {
    const opts = { ...DEFAULT_PATHFINDING_OPTIONS, ...options };
    const hazardWeight = opts.hazardAvoidanceWeight ?? 5;
    const maxIterations = opts.maxIterations ?? 1000;

    const startKey = toPositionKey(start);
    const goalKey = toPositionKey(goal);

    // Check if goal is reachable
    const goalProps = this.getTileProperties(goal, level);
    const goalBehavior = this.behaviorRegistry.get(goalProps.type);
    const goalCtx = this.createContext(goal, goalProps, gameState);
    if (!goalBehavior.isWalkable(goalCtx)) {
      return { path: [], cost: Infinity, found: false };
    }

    // A* data structures
    const openSet = new Set<PositionKey>([startKey]);
    const cameFrom = new Map<PositionKey, PositionKey | null>();
    const gScore = new Map<PositionKey, number>([[startKey, 0]]);
    const fScore = new Map<PositionKey, number>([[startKey, this.heuristic(start, goal)]]);

    cameFrom.set(startKey, null);

    let iterations = 0;

    while (openSet.size > 0 && iterations < maxIterations) {
      iterations++;

      // Find node in openSet with lowest fScore
      let currentKey: PositionKey | null = null;
      let lowestF = Infinity;
      for (const key of openSet) {
        const f = fScore.get(key) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          currentKey = key;
        }
      }

      if (!currentKey) break;

      // Check if we reached the goal
      if (currentKey === goalKey) {
        const path = this.reconstructPath(cameFrom, currentKey);
        const cost = gScore.get(currentKey) ?? Infinity;
        return { path, cost, found: true };
      }

      openSet.delete(currentKey);
      const currentCoord = fromPositionKey(currentKey);

      // Explore neighbors
      for (const neighbor of this.getNeighbors(currentCoord, level)) {
        const neighborKey = toPositionKey(neighbor);
        const neighborProps = this.getTileProperties(neighbor, level);
        const neighborBehavior = this.behaviorRegistry.get(neighborProps.type);
        const ctx = this.createContext(neighbor, neighborProps, gameState);

        // Skip unwalkable tiles
        if (!neighborBehavior.isWalkable(ctx)) continue;

        // Calculate movement cost with hazard penalty
        const movementCost = this.getMovementCost(neighbor, neighborProps, ctx, hazardWeight);
        const tentativeG = (gScore.get(currentKey) ?? Infinity) + movementCost;

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          // This is a better path to this neighbor
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeG);
          fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, goal));

          if (!openSet.has(neighborKey)) {
            openSet.add(neighborKey);
          }
        }
      }
    }

    // No path found
    return { path: [], cost: Infinity, found: false };
  }

  /**
   * Get the movement cost for a tile, including hazard penalty.
   */
  private getMovementCost(
    coord: GridCoord,
    props: TileProperties,
    ctx: TileBehaviorContext,
    hazardWeight: number
  ): number {
    const behavior = this.behaviorRegistry.get(props.type);
    let baseCost = behavior.getMovementCost(ctx);

    // Add hazard avoidance penalty
    if (props.type === 'hazard') {
      baseCost += hazardWeight;
    }

    // Could add more penalties here:
    // - Conveyor tiles that push in wrong direction
    // - Tiles near enemies (Phase 4)
    // - Dark tiles for certain personality types (Phase 3)

    return baseCost;
  }

  /**
   * Manhattan distance heuristic.
   */
  private heuristic(a: GridCoord, b: GridCoord): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Reconstruct path from cameFrom map.
   */
  private reconstructPath(
    cameFrom: Map<PositionKey, PositionKey | null>,
    current: PositionKey
  ): GridCoord[] {
    const path: GridCoord[] = [fromPositionKey(current)];
    let cur = cameFrom.get(current);

    while (cur !== null && cur !== undefined) {
      path.unshift(fromPositionKey(cur));
      cur = cameFrom.get(cur);
    }

    return path;
  }

  /**
   * Get valid neighbor coordinates.
   */
  private getNeighbors(coord: GridCoord, level: Level): GridCoord[] {
    const neighbors: GridCoord[] = [
      { x: coord.x + 1, y: coord.y },
      { x: coord.x - 1, y: coord.y },
      { x: coord.x, y: coord.y + 1 },
      { x: coord.x, y: coord.y - 1 },
    ];
    return neighbors.filter((n) => level.isInBounds(n));
  }

  /**
   * Get tile properties at a coordinate.
   */
  private getTileProperties(coord: GridCoord, level: Level): TileProperties {
    return level.getGameplayTile(coord) ?? { type: 'floor' };
  }

  /**
   * Create behavior context for a tile.
   */
  private createContext(
    coord: GridCoord,
    props: TileProperties,
    gameState: GameState
  ): TileBehaviorContext {
    return {
      player: gameState.player,
      tileProperties: props,
      coord,
      gameState,
    };
  }

  /**
   * Check if a position is walkable.
   */
  isWalkable(coord: GridCoord, level: Level, gameState: GameState): boolean {
    if (!level.isInBounds(coord)) return false;

    const props = this.getTileProperties(coord, level);
    const behavior = this.behaviorRegistry.get(props.type);
    const ctx = this.createContext(coord, props, gameState);

    return behavior.isWalkable(ctx);
  }

  /**
   * Get the base movement cost for a tile (without hazard penalty).
   */
  getBaseCost(coord: GridCoord, level: Level, gameState: GameState): number {
    const props = this.getTileProperties(coord, level);
    const behavior = this.behaviorRegistry.get(props.type);
    const ctx = this.createContext(coord, props, gameState);

    return behavior.getMovementCost(ctx);
  }
}
