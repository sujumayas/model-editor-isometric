 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Phase 2 Implementation Plan: Single Clop AI Simulator

 Overview

 Create a new AI Simulator tool (separate from Movement Tester) for testing autonomous Clop AI behavior. The
 architecture is designed for reusability in Phases 3 (multiple Clops) and 4 (enemies).

 Key Design Decisions:
 - Separate tool from Movement Tester
 - Weighted A* pathfinding for hazard avoidance
 - Both auto-play and step-by-step modes
 - Clean agent abstraction for future extensibility

 ---
 File Structure

 src/
 ├── agent/                              # NEW - Agent system
 │   ├── index.ts                        # Module exports
 │   ├── types.ts                        # Agent interfaces and types
 │   ├── Agent.ts                        # Base Agent interface
 │   ├── ClopAgent.ts                    # Clop implementation
 │   ├── AgentStateMachine.ts            # FSM implementation
 │   └── AgentPathfinder.ts              # Weighted A* pathfinding
 │
 ├── simulation/                         # NEW - Simulation controller
 │   ├── index.ts                        # Module exports
 │   ├── types.ts                        # Simulation types
 │   └── AISimulator.ts                  # Main simulator class
 │
 ├── ui/
 │   └── AISimulatorControls.ts          # NEW - UI panel for AI Simulator
 │
 └── index.ts                            # Update to include AI Simulator

 ---
 Key Types

 Agent Types (/src/agent/types.ts)

 // Agent states for FSM
 export type AgentStateType =
   | 'idle'       // Waiting at spawn
   | 'planning'   // Computing path
   | 'moving'     // Executing movement
   | 'scared'     // Avoiding danger (visual)
   | 'hurt'       // Just took damage (flash)
   | 'dead'       // HP reached 0
   | 'won';       // Reached exit

 // Agent state data
 export interface AgentState {
   readonly type: AgentStateType;
   readonly hp: number;
   readonly maxHp: number;
   readonly position: GridCoord;
   readonly visualPosition: { x: number; y: number };
   readonly targetPosition: GridCoord | null;
   readonly currentPath: GridCoord[];
   readonly pathIndex: number;
   readonly moveProgress: number;  // 0-1 for animation
   readonly turnsTaken: number;
   readonly lastDamageSource: string | null;
 }

 // Agent configuration
 export interface AgentConfig {
   readonly id: string;
   readonly type: 'clop' | 'enemy';  // Extensible for Phase 4
   readonly maxHp: number;
   readonly moveSpeed: number;
   readonly hazardAvoidanceWeight: number;  // Higher = more avoidance
   readonly color: string;
 }

 // Default Clop config
 export const DEFAULT_CLOP_CONFIG: AgentConfig = {
   id: 'clop-1',
   type: 'clop',
   maxHp: 2,
   moveSpeed: 4,
   hazardAvoidanceWeight: 5,  // Hazards cost 5x more
   color: 'rgba(100, 200, 255, 0.9)',
 };

 Simulation Types (/src/simulation/types.ts)

 export type SimulationSpeed = 1 | 2 | 4;
 export type SimulationMode = 'auto' | 'step';

 export interface SimulationState {
   readonly mode: SimulationMode;
   readonly speed: SimulationSpeed;
   readonly isPaused: boolean;
   readonly isComplete: boolean;
   readonly turnNumber: number;
   readonly agents: Agent[];
   readonly level: Level;
 }

 ---
 Class Responsibilities

 1. AgentStateMachine

 - Manages FSM transitions (idle → planning → moving → hurt/won/dead)
 - Validates transitions
 - Handles timed states (hurt flashes for 0.3s then returns to moving)

 2. AgentPathfinder

 - Weighted A* algorithm with hazard avoidance
 - Key difference from MovementTester: hazards add hazardAvoidanceWeight to cost
 - Clop takes safe routes when reasonable alternatives exist
 - Still takes hazardous path if it's the only option

 getMovementCost(coord, avoidanceWeight): number {
   const baseCost = behavior.getMovementCost(ctx);  // 1 for floor, 2.5 for slow
   if (props?.type === 'hazard') {
     return baseCost + avoidanceWeight;  // 6 total with default weight
   }
   return baseCost;
 }

 3. ClopAgent

 - Implements Agent interface
 - Uses AgentStateMachine for state management
 - Uses AgentPathfinder for pathfinding
 - Handles tile behavior effects (damage, forced movement)
 - Emits events for UI updates

 4. AISimulator

 - Main controller (similar pattern to MovementTester)
 - Manages simulation state (play/pause/speed/mode)
 - Runs game loop with requestAnimationFrame
 - Coordinates agent turns
 - Renders level, agents, path preview
 - Emits events for UI

 5. AISimulatorControls

 - UI panel following MovementControls pattern
 - Sections: Map Input, Simulation Controls, Mode Toggle, Clop Info Panel, Path Preview Toggle, Legend

 ---
 Implementation Order

 Step 1: Agent Foundation

 1. Create /src/agent/types.ts - All agent type definitions
 2. Create /src/agent/AgentStateMachine.ts - FSM implementation
 3. Create /src/agent/AgentPathfinder.ts - Weighted A* algorithm
 4. Create /src/agent/index.ts - Module exports

 Step 2: ClopAgent Implementation

 1. Create /src/agent/Agent.ts - Base interface
 2. Create /src/agent/ClopAgent.ts - Full Clop implementation with:
   - spawn(), setTarget(), computePath()
   - takeTurn() - main AI loop
   - takeDamage(), reset()
   - Event emission

 Step 3: Simulation Controller

 1. Create /src/simulation/types.ts - Simulation types
 2. Create /src/simulation/AISimulator.ts - Main controller with:
   - Game loop (requestAnimationFrame)
   - play(), pause(), reset()
   - setSpeed(), setMode(), advanceStep()
   - Rendering (level, agents, path preview)
 3. Create /src/simulation/index.ts - Module exports

 Step 4: UI Integration

 1. Create /src/ui/AISimulatorControls.ts - Control panel
 2. Update /src/index.ts - Add AI Simulator initialization
 3. Update HTML - Add AI Simulator tab/canvas

 Step 5: Testing & Polish

 1. Test with existing maps
 2. Create test scenarios (straight line, maze, hazard choice)
 3. Debug and polish

 ---
 Critical Files to Reference/Modify

 | File                           | Action    | Purpose                           |
 |--------------------------------|-----------|-----------------------------------|
 | src/movement/MovementTester.ts | Reference | Game loop, rendering, A* patterns |
 | src/gameplay/types.ts          | Reference | PlayerState, GameState structure  |
 | src/gameplay/behaviors/*.ts    | Reference | Tile behavior integration         |
 | src/ui/MovementControls.ts     | Reference | UI panel pattern                  |
 | src/index.ts                   | Modify    | Add AI Simulator initialization   |
 | index.html                     | Modify    | Add AI Simulator tab/canvas       |

 ---
 Integration Points

 With Tile Behavior System

 // In ClopAgent.takeTurn():
 const behavior = behaviorRegistry.get(props?.type ?? 'floor');
 const context = this.createBehaviorContext(nextTile, props);
 if (!behavior.isWalkable(context)) { /* recalculate path */ }
 const newState = behavior.onEnter(context);
 this.applyStateChanges(newState);  // Handle HP, forced moves, win

 With Level System

 const spawnTile = level.findSpawnTile();
 const exitTile = level.findExitTile();
 const props = level.getGameplayTile(coord);

 ---
 Rendering

 1. Base Level - Using existing Renderer.render(level)
 2. Gameplay Overlays - Tile type colors (same as MovementTester)
 3. Path Preview - Dotted line from Clop to exit (togglable)
 4. Clop Agent - Colored circle with eye (cyclops!):
   - Normal: Blue
   - Hurt: Red flash
   - Scared: Yellow tint
   - Dead: X overlay
   - Won: Star/glow
 5. HP Display - Above Clop

 ---
 Test Scenarios

 Test Map 5: Straight Line

 [S] [ ] [ ] [ ] [E]
 Verifies: Basic pathfinding, movement, win condition

 Test Map 6: Obstacle Maze

 [S] [ ] [B] [ ] [ ]
 [ ] [B] [ ] [B] [ ]
 [ ] [ ] [ ] [ ] [E]
 Verifies: Pathfinding around blockers

 Test Map 7: Hazard Choice

 [S] [H] [H] [E]
 [ ] [ ] [ ] [ ]
 Verifies: Weighted pathfinding avoids hazards when safe path exists

 ---
 Future Extensibility

 Phase 3: Multiple Clops

 // AISimulator already supports agents array
 private agents: Agent[] = [];
 spawnClops(positions: GridCoord[]): void { /* spawn multiple */ }

 Phase 4: Enemies

 // Create EnemyAgent implementing same Agent interface
 class EnemyAgent implements Agent {
   // Different AI: chase Clops instead of going to exit
 }

 ---
 UI Layout (AISimulatorControls)

 ┌─────────────────────────────────┐
 │ AI SIMULATOR                    │
 ├─────────────────────────────────┤
 │ Map Input                       │
 │ [Load JSON] [Use Editor Map]    │
 ├─────────────────────────────────┤
 │ Simulation Controls             │
 │ [▶ Play] [⏸ Pause] [↺ Reset]   │
 │ Speed: [1x] [2x] [4x]           │
 ├─────────────────────────────────┤
 │ Mode: (●) Auto  ( ) Step        │
 │ [Advance Step] (when in step)   │
 ├─────────────────────────────────┤
 │ Clop Status                     │
 │ HP: ♥♥ (2/2)                    │
 │ State: Moving                   │
 │ Position: (3, 4)                │
 │ Turn: 5                         │
 │ [✓] Show Path Preview           │
 ├─────────────────────────────────┤
 │ Legend                          │
 │ ■ Floor  ■ Blocker  ■ Hazard   │
 │ ■ Slow   ■ Exit     ■ Spawn    │
 └─────────────────────────────────┘