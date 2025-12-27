/**
 * ClopAgent - Autonomous Clop (cyclops) agent implementation.
 * Handles AI decision-making, pathfinding, and state management.
 */

import { GridCoord, GameplayTileType, TileProperties, DIRECTION_VECTORS } from '../core/types';
import { Level } from '../level/Level';
import {
  getTileBehaviorRegistry,
  TileBehaviorRegistry,
  TileBehaviorContext,
  GameState,
  PlayerState,
  createDefaultPlayerState,
} from '../gameplay';
import { Agent } from './Agent';
import { AgentStateMachine } from './AgentStateMachine';
import { AgentPathfinder } from './AgentPathfinder';
import {
  AgentState,
  AgentConfig,
  AgentEventMap,
  AgentEventHandler,
  AgentStateType,
  createAgentState,
  DEFAULT_CLOP_CONFIG,
} from './types';

type AgentListener = (payload: unknown) => void;

/**
 * ClopAgent - A single autonomous Clop that pathfinds to the exit.
 */
export class ClopAgent implements Agent {
  readonly config: AgentConfig;
  private _state: AgentState;
  private stateMachine: AgentStateMachine;
  private pathfinder: AgentPathfinder;
  private behaviorRegistry: TileBehaviorRegistry;
  private listeners = new Map<keyof AgentEventMap, Set<AgentListener>>();

  constructor(config: AgentConfig = DEFAULT_CLOP_CONFIG) {
    this.config = config;
    this._state = createAgentState({ x: 0, y: 0 }, config);
    this.stateMachine = new AgentStateMachine('idle');
    this.pathfinder = new AgentPathfinder();
    this.behaviorRegistry = getTileBehaviorRegistry();
  }

  get state(): AgentState {
    return this._state;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  spawn(position: GridCoord): void {
    this._state = createAgentState(position, this.config);
    this.stateMachine.forceState('idle');
    this.emit('state:changed', {
      agentId: this.config.id,
      oldState: 'idle',
      newState: 'idle',
    });
  }

  reset(): void {
    const oldState = this._state.type;
    this._state = createAgentState(this._state.spawnPosition, this.config);
    this.stateMachine.forceState('idle');
    this.emit('state:changed', {
      agentId: this.config.id,
      oldState,
      newState: 'idle',
    });
    this.emit('path:cleared', { agentId: this.config.id });
  }

  // ============================================================================
  // Target Management
  // ============================================================================

  setTarget(position: GridCoord | null): void {
    this._state = {
      ...this._state,
      targetPosition: position ? { ...position } : null,
    };
  }

  isAtTarget(): boolean {
    if (!this._state.targetPosition) return false;
    return (
      this._state.position.x === this._state.targetPosition.x &&
      this._state.position.y === this._state.targetPosition.y
    );
  }

  // ============================================================================
  // Pathfinding
  // ============================================================================

  computePath(level: Level, gameState: GameState): GridCoord[] | null {
    if (!this._state.targetPosition) return null;

    const result = this.pathfinder.findPath(
      this._state.position,
      this._state.targetPosition,
      level,
      gameState,
      { hazardAvoidanceWeight: this.config.hazardAvoidanceWeight }
    );

    if (result.found) {
      this._state = {
        ...this._state,
        currentPath: result.path,
        pathIndex: 0,
        moveProgress: 0,
      };
      this.emit('path:computed', {
        agentId: this.config.id,
        path: result.path,
        cost: result.cost,
      });
      return result.path;
    }

    this._state = {
      ...this._state,
      currentPath: [],
      pathIndex: 0,
    };
    this.emit('path:cleared', { agentId: this.config.id });
    return null;
  }

  // ============================================================================
  // Turn Execution
  // ============================================================================

  takeTurn(level: Level, gameState: GameState): boolean {
    // Cannot act if terminal
    if (!this.canAct()) return false;

    const oldState = this._state.type;

    // Find exit if no target
    if (!this._state.targetPosition) {
      const exit = level.findExitTile();
      if (exit) {
        this.setTarget(exit);
      } else {
        return false; // No exit found
      }
    }

    // Compute path if needed
    if (this._state.currentPath.length === 0 || this._state.pathIndex >= this._state.currentPath.length - 1) {
      this.transitionState('planning');
      const path = this.computePath(level, gameState);
      if (!path || path.length < 2) {
        this.transitionState('idle');
        return false; // No path found
      }
    }

    // Get next tile in path
    const nextIndex = this._state.pathIndex + 1;
    const nextTile = this._state.currentPath[nextIndex];
    if (!nextTile) {
      this.transitionState('idle');
      return false;
    }

    // Move to next tile
    this.transitionState('moving');
    const oldPosition = { ...this._state.position };

    this._state = {
      ...this._state,
      position: { ...nextTile },
      visualPosition: { x: nextTile.x, y: nextTile.y },
      pathIndex: nextIndex,
      moveProgress: 0,
      turnsTaken: this._state.turnsTaken + 1,
    };

    this.emit('position:changed', {
      agentId: this.config.id,
      from: oldPosition,
      to: nextTile,
    });

    // Apply tile effect
    this.applyTileEffect(nextTile, level, gameState);

    // Check if reached end of path
    if (nextIndex >= this._state.currentPath.length - 1) {
      if (this._state.type !== 'dead' && this._state.type !== 'won') {
        this.transitionState('idle');
        this._state = {
          ...this._state,
          currentPath: [],
          pathIndex: 0,
        };
        this.emit('path:cleared', { agentId: this.config.id });
      }
    }

    this.emit('turn:completed', {
      agentId: this.config.id,
      turnNumber: this._state.turnsTaken,
    });

    return true;
  }

  // ============================================================================
  // Tile Effects
  // ============================================================================

  private applyTileEffect(coord: GridCoord, level: Level, gameState: GameState): void {
    const props = this.getTileProperties(coord, level);
    const behavior = this.behaviorRegistry.get(props.type);

    // Create a temporary player state to use with existing behavior system
    const tempPlayer = this.createTempPlayerState();
    const ctx: TileBehaviorContext = {
      player: tempPlayer,
      tileProperties: props,
      coord,
      gameState,
    };

    // Apply behavior
    const resultPlayer = behavior.onEnter(ctx);

    // Handle HP changes
    if (resultPlayer.hp < tempPlayer.hp) {
      const damage = tempPlayer.hp - resultPlayer.hp;
      this.takeDamage(damage, props.type);
    }

    // Handle win condition
    if (resultPlayer.state === 'won') {
      this.transitionState('won');
      this.emit('won', { agentId: this.config.id });
    }

    // Handle death
    if (resultPlayer.state === 'dead') {
      this.transitionState('dead');
      this.emit('died', { agentId: this.config.id, cause: props.type });
    }

    // Handle forced movement (conveyor)
    if (resultPlayer.pendingForcedMove) {
      this._state = {
        ...this._state,
        pendingForcedMove: resultPlayer.pendingForcedMove,
      };
    }
  }

  private getTileProperties(coord: GridCoord, level: Level): TileProperties {
    return level.getGameplayTile(coord) ?? { type: 'floor' };
  }

  private createTempPlayerState(): PlayerState {
    return {
      position: { ...this._state.position },
      visualPosition: { ...this._state.visualPosition },
      state: this._state.type === 'dead' ? 'dead' : this._state.type === 'won' ? 'won' : 'idle',
      hp: this._state.hp,
      maxHp: this._state.maxHp,
      spawnPosition: { ...this._state.spawnPosition },
      path: [...this._state.currentPath],
      segmentIndex: this._state.pathIndex,
      segmentProgress: this._state.moveProgress,
    };
  }

  // ============================================================================
  // Damage
  // ============================================================================

  takeDamage(amount: number, source: string): void {
    const oldHp = this._state.hp;
    const newHp = Math.max(0, oldHp - amount);

    this._state = {
      ...this._state,
      hp: newHp,
      lastDamageSource: source as GameplayTileType,
    };

    this.emit('hp:changed', {
      agentId: this.config.id,
      oldHp,
      newHp,
      damage: amount,
      source: source as GameplayTileType,
    });

    if (newHp <= 0) {
      this.transitionState('dead');
      this.emit('died', { agentId: this.config.id, cause: source as GameplayTileType });
    } else {
      this.transitionState('hurt');
    }
  }

  // ============================================================================
  // Visual Updates
  // ============================================================================

  updateVisuals(deltaTime: number): void {
    // Update state machine for timed states (hurt flash, etc.)
    const nextState = this.stateMachine.update(deltaTime);
    if (nextState) {
      this.transitionState(nextState);
    }

    // Interpolate visual position toward actual position
    const target = this._state.position;
    const current = this._state.visualPosition;
    const speed = this.config.moveSpeed;

    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.01) {
      const step = Math.min(speed * deltaTime, dist);
      const ratio = step / dist;

      this._state = {
        ...this._state,
        visualPosition: {
          x: current.x + dx * ratio,
          y: current.y + dy * ratio,
        },
        moveProgress: Math.min(1, this._state.moveProgress + step),
      };
    } else {
      // Snap to target
      this._state = {
        ...this._state,
        visualPosition: { x: target.x, y: target.y },
        moveProgress: 1,
      };
    }
  }

  // ============================================================================
  // State Management
  // ============================================================================

  private transitionState(to: AgentStateType): void {
    const from = this._state.type;
    if (from === to) return;

    if (this.stateMachine.transition(to, this._state)) {
      this._state = {
        ...this._state,
        type: to,
      };
      this.emit('state:changed', {
        agentId: this.config.id,
        oldState: from,
        newState: to,
      });
    }
  }

  canAct(): boolean {
    return this.stateMachine.canAct();
  }

  // ============================================================================
  // Events
  // ============================================================================

  on<K extends keyof AgentEventMap>(
    event: K,
    handler: AgentEventHandler<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as AgentListener);
    return () => this.listeners.get(event)?.delete(handler as AgentListener);
  }

  private emit<K extends keyof AgentEventMap>(event: K, payload: AgentEventMap[K]): void {
    this.listeners.get(event)?.forEach((handler) => {
      (handler as AgentEventHandler<K>)(payload);
    });
  }

  // ============================================================================
  // Debug
  // ============================================================================

  getStatus(): string {
    const s = this._state;
    return `[${this.config.id}] ${s.type} HP:${s.hp}/${s.maxHp} Pos:(${s.position.x},${s.position.y}) Turn:${s.turnsTaken}`;
  }
}
