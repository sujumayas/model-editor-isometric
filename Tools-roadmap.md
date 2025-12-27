# CLOPS - Game Tools Roadmap
**Version:** 0.1  
**Philosophy:** Build the minimum tool to test each mechanic. Find the fun before polishing.

---

## Current State (Completed)

### ✅ Map Editor v0.1
- Grid-based tile placement
- Multiple map sizes (8x8 to 128x128)
- Layers: Terrain, Props, Decorations
- Brush/Eraser tools
- JSON export/import
- Zoom controls

### ✅ Movement Tester v0.1
- Load maps from JSON or editor
- Tile type visualization (Floor, Blocker, Slow)
- Player token placement
- Basic pathfinding visualization
- Tile selection/inspection

---

## Roadmap Overview

```
PHASE 1: Core Movement & Tiles     ← YOU ARE HERE
PHASE 2: Single Clop AI
PHASE 3: Multiple Clops + Personalities
PHASE 4: Enemy AI
PHASE 5: Spells & Triggers
PHASE 6: Fog of War
PHASE 7: Full Loop Integration
PHASE 8: Level Editor Polish
```

---

## PHASE 1: Core Movement & Tiles (1-2 weeks)

**Goal:** Validate that tile types feel right and movement is readable.

### 1.1 Extend Tile Types in Editor
- [ ] Add tile types: Hole, Conveyor (4 directions), Hazard (Burn), Door, Exit, Spawn
- [ ] Visual distinction per type (color overlay or icon for now)
- [ ] Tile properties panel (e.g., Conveyor direction, Door linked-to ID)

### 1.2 Movement Tester Upgrades
- [ ] Implement Hole behavior (token "dies" on entry)
- [ ] Implement Conveyor behavior (forced movement)
- [ ] Implement Hazard damage (visual indicator, HP counter)
- [ ] Door blocking (until manually toggled for now)
- [ ] Step-by-step mode (click to advance 1 turn)
- [ ] Reset button (return to spawn)

### 1.3 Test Scenarios to Build
- **Test Map 1:** Simple path with slow tiles (feel the delay)
- **Test Map 2:** Maze with holes (death consequences)
- **Test Map 3:** Conveyor puzzle (push player around)
- **Test Map 4:** Hazard gauntlet (damage over time)

### Deliverable
A tester where you can manually move a token and see all tile effects working correctly.

---

## PHASE 2: Single Clop AI (1-2 weeks)

**Goal:** One autonomous Clop that pathfinds and reacts to tiles.

### 2.1 Basic Clop Agent
- [ ] Spawn Clop at designated tile
- [ ] A* pathfinding toward Exit tile
- [ ] 1 tile/turn movement
- [ ] Respect tile rules (blocked, slow, hazard damage)

### 2.2 Clop State Machine
- [ ] States: Normal, Scared, Hurt
- [ ] HP system (start with 2 HP, hazards deal 1, death at 0)
- [ ] Visual state indicators (color tint or simple animation)

### 2.3 Testing Controls
- [ ] Play/Pause simulation
- [ ] Speed controls (1x, 2x, 4x)
- [ ] Clop info panel (HP, state, next intended move)
- [ ] Path preview (show intended route)

### 2.4 Test Scenarios
- **Test Map 5:** Straight line to exit (confirm basic pathfinding)
- **Test Map 6:** Obstacle maze (pathfinding around blockers)
- **Test Map 7:** Hazard choice (does AI avoid damage or take shortest path?)

### Deliverable
Watch a single Clop navigate a dungeon autonomously, taking damage and finding the exit.

---

## PHASE 3: Multiple Clops + Personalities (2-3 weeks)

**Goal:** Test how different personalities create emergent chaos.

### 3.1 Multi-Clop Support
- [ ] Spawn multiple Clops (from multiple Spawn tiles or single spawn)
- [ ] Independent pathfinding per Clop
- [ ] Collision handling (Clops can't occupy same tile? or can they stack?)

### 3.2 Personality System
- [ ] Personality selector per Clop (or random assignment)
- [ ] Implement 3 personalities first:
  - **Curious:** Pathfind to nearest unexplored area, then exit
  - **Coward:** Recalculate path to avoid hazards, even if longer
  - **Hyperactive:** Move 2 tiles/turn, 20% chance of random direction

### 3.3 Personality Testing Tools
- [ ] Personality breakdown panel (show each Clop's type)
- [ ] Override personality mid-simulation (for testing)
- [ ] Behavior log (text output: "Clop 2 (Curious) moved to unexplored tile 3,4")

### 3.4 Test Scenarios
- **Test Map 8:** Race to exit (which personality wins?)
- **Test Map 9:** Dangerous shortcut vs safe long path (Curious vs Coward)
- **Test Map 10:** Narrow corridor (do Clops jam up?)

### Key Question to Answer
Do personalities create interesting variety or just random frustration?

### Deliverable
Simulate 3-5 Clops with different personalities navigating the same map, observe emergent behavior.

---

## PHASE 4: Enemy AI (2-3 weeks)

**Goal:** Test enemy threat and stealth-puzzle dynamics.

### 4.1 Basic Enemy Agent
- [ ] Enemy spawn tiles in editor
- [ ] Patrol route definition (waypoints or simple back-forth)
- [ ] 1 tile/turn movement
- [ ] Enemy kills Clop on contact

### 4.2 Vision System
- [ ] Define vision cone (direction + range)
- [ ] Visualize vision cone on map (debug mode)
- [ ] Vision blocked by walls

### 4.3 Enemy State Machine
- [ ] States: Idle (patrol), Alert (investigate), Hunting (chase)
- [ ] State transition rules (see Clop → Alert → Hunting)
- [ ] Lose-sight timer (return to patrol after X turns)

### 4.4 Testing Tools
- [ ] Toggle vision cone visibility
- [ ] Enemy info panel (state, target, patrol route)
- [ ] Force state changes (debug)
- [ ] "Spotlight" mode (all vision visible, no fog)

### 4.5 Test Scenarios
- **Test Map 11:** Single patrolling enemy, sneak past
- **Test Map 12:** Two enemies with overlapping vision
- **Test Map 13:** Chase scenario (can Clop escape?)

### Key Question to Answer
Is the enemy threat fun to avoid, or just punishing?

### Deliverable
Simulate Clops navigating a map with patrolling enemies, observe stealth/detection dynamics.

---

## PHASE 5: Spells & Triggers (2-3 weeks)

**Goal:** Test the core mage interaction loop.

### 5.1 Spell System
- [ ] Spell palette (UI element with available spells)
- [ ] Spell casting (click spell, click target tile)
- [ ] Spell cost & limited slots per turn
- [ ] Implement 3 spells first:
  - **Call:** Mark tile, Clops pathfind toward it
  - **Scare:** Mark tile, Clops pathfind away from it
  - **Light:** Reveal 3x3 area (prep for fog of war)

### 5.2 Trigger Objects
- [ ] Lever tile type (clickable with spell or pressure-activated)
- [ ] Link system (Lever → Door relationship)
- [ ] Trigger editor (assign lever to door ID)

### 5.3 Testing Tools
- [ ] Spell log (show spell casts per turn)
- [ ] Trigger state panel (which doors/objects are open/closed)
- [ ] Undo last spell (for testing different approaches)

### 5.4 Test Scenarios
- **Test Map 14:** Use Call to guide Clop around obstacle
- **Test Map 15:** Use Scare to push Clop away from danger
- **Test Map 16:** Lever puzzle (open door to proceed)
- **Test Map 17:** Spell decision (limited slots, multiple needs)

### Key Question to Answer
Do spells feel impactful or like minor suggestions?

### Deliverable
Play a turn-based loop: cast spells, watch Clops react, iterate.

---

## PHASE 6: Fog of War (1-2 weeks)

**Goal:** Test information restriction and tension.

### 6.1 Vision Calculation
- [ ] Each Clop has vision radius
- [ ] Union of all Clop visions = visible area
- [ ] Everything else is hidden (or shadowed)

### 6.2 Fog Rendering
- [ ] Hidden tiles: Black/fully obscured
- [ ] Previously seen: Terrain visible, no entities
- [ ] Currently visible: Full information

### 6.3 Testing Tools
- [ ] Toggle fog (debug mode = all visible)
- [ ] Visualize per-Clop vision contribution
- [ ] "Mage Eye" spell test (temporary reveal)

### 6.4 Test Scenarios
- **Test Map 18:** Navigate with limited vision
- **Test Map 19:** Enemy ambush from fog
- **Test Map 20:** Split party (Clops in different areas, fragmented vision)

### Key Question to Answer
Does fog of war add tension or just frustration?

### Deliverable
Simulate full fog-of-war gameplay, feel the tension of unknown areas.

---

## PHASE 7: Full Loop Integration (2-3 weeks)

**Goal:** Play a complete level from start to finish.

### 7.1 Game State Management
- [ ] Level start (load map, spawn Clops)
- [ ] Turn loop (Mage phase → Clop phase → Enemy phase → Resolve)
- [ ] Win condition (Clop reaches exit)
- [ ] Lose condition (all Clops dead)
- [ ] Level complete screen (Clops saved, turns taken)

### 7.2 Turn Structure UI
- [ ] Phase indicator (whose turn is it?)
- [ ] End turn button
- [ ] Turn counter

### 7.3 Playtest Levels
- [ ] Design 3-5 "real" levels with all mechanics
- [ ] Vary difficulty and puzzle type
- [ ] Document what feels fun vs frustrating

### Deliverable
Playable prototype: select level, guide Clops with spells, avoid enemies, reach exit.

---

## PHASE 8: Level Editor Polish (Ongoing)

**Goal:** Make it fast and pleasant to create test levels.

### 8.1 Quality of Life
- [ ] Hotkeys for common tiles
- [ ] Copy/paste regions
- [ ] Undo/redo
- [ ] Grid snap improvements
- [ ] Multi-select for bulk changes

### 8.2 Validation
- [ ] Check for required tiles (at least 1 spawn, 1 exit)
- [ ] Pathability check (is exit reachable from spawn?)
- [ ] Warning for isolated areas

### 8.3 Level Metadata
- [ ] Level name, author
- [ ] Difficulty rating
- [ ] Par time / par rescues
- [ ] Hint text

---

## Testing Principles

### Always Ask
1. **Is this readable?** Can I understand what's happening?
2. **Is this predictable?** Can I anticipate consequences?
3. **Is this my fault?** When I fail, do I know why?
4. **Is this funny?** Do failures make me laugh or rage?
5. **Do I want to retry?** Is the loop engaging?

### Red Flags
- "That felt random" → Needs clearer AI rules or feedback
- "I didn't see that coming" → Needs better visibility
- "I couldn't do anything" → Needs more player agency
- "That was tedious" → Needs faster pacing

### Documentation Per Phase
After each phase, write a brief postmortem:
- What worked?
- What felt wrong?
- What should change?

---

## Tools Tech Notes

### Current Stack (Assumed from Screenshots)
- React-based web application
- Canvas or WebGL for rendering
- JSON for data serialization

### Recommended Additions
- **State Machine Library:** XState or custom FSM for AI
- **Pathfinding:** Pre-built A* library or custom implementation
- **Animation:** Simple tweening for movement (GSAP or custom)
- **Sound (Later):** Howler.js for web audio

---

*This roadmap is a living document. Update priorities based on playtest findings.*