/**
 * Simulation type definitions for the AI Simulator.
 */

import type { Agent } from '../agent';
import type { Level } from '../level/Level';
import type { GameState } from '../gameplay';

// ============================================================================
// Simulation Speed & Mode
// ============================================================================

/** Simulation playback speed multiplier */
export type SimulationSpeed = 1 | 2 | 4;

/** Simulation mode */
export type SimulationMode = 'auto' | 'step';

/** Simulation status */
export type SimulationStatus = 'idle' | 'running' | 'paused' | 'complete';

// ============================================================================
// Simulation State
// ============================================================================

/** Complete simulation state */
export interface SimulationState {
  /** Current simulation mode */
  readonly mode: SimulationMode;
  /** Current playback speed */
  readonly speed: SimulationSpeed;
  /** Current status */
  readonly status: SimulationStatus;
  /** Current turn number */
  readonly turnNumber: number;
  /** Whether path preview is enabled */
  readonly showPathPreview: boolean;
}

/** Default simulation state */
export function createDefaultSimulationState(): SimulationState {
  return {
    mode: 'step',
    speed: 1,
    status: 'idle',
    turnNumber: 0,
    showPathPreview: true,
  };
}

// ============================================================================
// Simulation Result
// ============================================================================

/** Result type when simulation completes */
export type SimulationResultType = 'won' | 'died' | 'stuck' | 'cancelled';

/** Simulation result */
export interface SimulationResult {
  /** How the simulation ended */
  readonly type: SimulationResultType;
  /** Number of turns taken */
  readonly turnsTaken: number;
  /** Final HP */
  readonly finalHp: number;
  /** Cause of death/stuck (if applicable) */
  readonly cause?: string;
}

// ============================================================================
// Simulation Events
// ============================================================================

/** Events emitted by the simulator */
export interface SimulationEventMap {
  /** Simulation started */
  'started': { state: SimulationState };
  /** Simulation paused */
  'paused': { state: SimulationState };
  /** Simulation resumed */
  'resumed': { state: SimulationState };
  /** Simulation reset */
  'reset': { state: SimulationState };
  /** Turn started */
  'turn:started': { turnNumber: number };
  /** Turn completed */
  'turn:completed': { turnNumber: number };
  /** Waiting for step input */
  'step:waiting': { turnNumber: number };
  /** Speed changed */
  'speed:changed': { speed: SimulationSpeed };
  /** Mode changed */
  'mode:changed': { mode: SimulationMode };
  /** Simulation completed */
  'complete': { result: SimulationResult };
  /** Level changed */
  'level:changed': { level: Level };
  /** Agent state updated (for UI) */
  'agent:updated': { agent: Agent };
}

export type SimulationEventHandler<K extends keyof SimulationEventMap> = (
  payload: SimulationEventMap[K]
) => void;

// ============================================================================
// Simulator Options
// ============================================================================

/** Options for the AI Simulator */
export interface AISimulatorOptions {
  /** Canvas element or selector */
  canvas: HTMLCanvasElement | string;
  /** Container element or selector (optional) */
  container?: HTMLElement | string;
  /** Tile registry for rendering */
  tileRegistry: import('../assets/TileRegistry').TileRegistry;
  /** Initial simulation mode */
  initialMode?: SimulationMode;
  /** Initial speed */
  initialSpeed?: SimulationSpeed;
}
