/**
 * Finite State Machine for agent state management.
 * Handles state transitions and validation for autonomous agents.
 */

import { AgentState, AgentStateType, StateTransition, CLOP_TRANSITIONS } from './types';

/**
 * State machine for managing agent states with validated transitions.
 */
export class AgentStateMachine {
  private currentState: AgentStateType;
  private transitions: StateTransition[];
  private stateTime: number = 0;

  // Timed state durations (in seconds)
  private static readonly STATE_DURATIONS: Partial<Record<AgentStateType, number>> = {
    hurt: 0.3,    // Flash duration for damage
    scared: 0.5,  // Visual scare indicator
  };

  constructor(initialState: AgentStateType = 'idle', transitions: StateTransition[] = CLOP_TRANSITIONS) {
    this.currentState = initialState;
    this.transitions = transitions;
  }

  /**
   * Get the current state.
   */
  getState(): AgentStateType {
    return this.currentState;
  }

  /**
   * Get how long we've been in the current state (in seconds).
   */
  getStateTime(): number {
    return this.stateTime;
  }

  /**
   * Check if a transition to the target state is valid.
   */
  canTransition(to: AgentStateType, agentState?: AgentState): boolean {
    return this.transitions.some((t) => {
      // Check 'from' matches current state
      if (t.from === '*') {
        // Wildcard matches any state
      } else if (Array.isArray(t.from)) {
        if (!t.from.includes(this.currentState)) return false;
      } else {
        if (t.from !== this.currentState) return false;
      }

      // Check 'to' matches target
      if (t.to !== to) return false;

      // Check condition if present
      if (t.condition && agentState) {
        return t.condition(agentState);
      }

      return true;
    });
  }

  /**
   * Attempt to transition to a new state.
   * Returns true if transition was successful, false if invalid.
   */
  transition(to: AgentStateType, agentState?: AgentState): boolean {
    if (this.currentState === to) {
      return true; // Already in target state
    }

    if (!this.canTransition(to, agentState)) {
      console.warn(`Invalid state transition: ${this.currentState} -> ${to}`);
      return false;
    }

    this.currentState = to;
    this.stateTime = 0;
    return true;
  }

  /**
   * Force a state change without validation.
   * Use sparingly - mainly for reset operations.
   */
  forceState(state: AgentStateType): void {
    this.currentState = state;
    this.stateTime = 0;
  }

  /**
   * Update state timers.
   * Returns the next state if a timed transition should occur, null otherwise.
   */
  update(deltaTime: number): AgentStateType | null {
    this.stateTime += deltaTime;

    // Check for timed state transitions
    const duration = AgentStateMachine.STATE_DURATIONS[this.currentState];
    if (duration !== undefined && this.stateTime >= duration) {
      // Return the state we should transition to after the timed state expires
      if (this.currentState === 'hurt') {
        return 'moving'; // After hurt, continue moving (or idle if path is done)
      }
      if (this.currentState === 'scared') {
        return 'moving'; // After scared visual, continue normally
      }
    }

    return null;
  }

  /**
   * Check if the current state is a terminal state (dead or won).
   */
  isTerminal(): boolean {
    return this.currentState === 'dead' || this.currentState === 'won';
  }

  /**
   * Check if the agent is currently in motion.
   */
  isMoving(): boolean {
    return this.currentState === 'moving' || this.currentState === 'scared';
  }

  /**
   * Check if the agent can take actions (not dead/won).
   */
  canAct(): boolean {
    return !this.isTerminal();
  }

  /**
   * Reset the state machine to idle.
   */
  reset(): void {
    this.currentState = 'idle';
    this.stateTime = 0;
  }

  /**
   * Create a copy of this state machine.
   */
  clone(): AgentStateMachine {
    const clone = new AgentStateMachine(this.currentState, this.transitions);
    clone.stateTime = this.stateTime;
    return clone;
  }
}
