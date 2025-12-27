# CLOPS - Game Design Document
**Version:** 0.1 (Pre-Production)  
**Last Updated:** December 2024

---

## 1. Core Concept

### One-Line Pitch
A tactics-puzzle game where you're a mage trying to guide chaotic, personality-driven cyclops creatures ("Clops") through dangerous dungeons—but the real challenge is that the Clops have minds of their own.

### Genre & Inspirations
- **Primary Genre:** Tactics / Puzzle Hybrid
- **Visual Style:** Isometric Pixel Art
- **Key Inspirations:**
  - *Into the Breach / Lost in Flatland* — Grid-based tactical decision-making
  - *X-COM* — Fog of war, enemy AI states, tactical positioning
  - *Lemmings* — Chaos management, indirect control, losing units to their own behavior

### Core Fantasy
You are a mage watching over a group of small, adorable, impossibly stupid creatures. You can cast spells to manipulate the dungeon, but you cannot directly control the Clops. Success means outsmarting both the dungeon AND your own chaotic companions.

---

## 2. Gameplay Loop

### Macro Loop (Level/Campaign)
```
Select Dungeon → Deploy Clops → Guide them to Exit → Rescue Count → Unlock Next
```

### Micro Loop (Turn-based)
```
1. OBSERVE — See dungeon through Clops' vision (fog of war)
2. PLAN — Decide which spells to cast / objects to trigger
3. CAST — Execute your mage actions (limited per turn)
4. CLOPS MOVE — Each Clop acts based on their personality + AI
5. ENEMIES MOVE — Enemies patrol, react, attack
6. RESOLVE — Effects trigger (burn, poison, traps, etc.)
→ Repeat until Exit reached or all Clops lost
```

### Win/Lose Conditions
- **Win:** At least 1 Clop reaches the exit (bronze), scaling rewards for more saved
- **Lose:** All Clops die or become permanently stuck
- **Optional Goals:** Save all Clops, complete under X turns, find secrets

---

## 3. The Player (The Mage)

### Role
The player is a mage who exists "outside" the dungeon—an omniscient observer who can cast spells but cannot physically interact. Think of it like a god-game perspective.

### Mage Actions (Per Turn)
- **Spell Casting:** Limited spell slots per turn (e.g., 2-3 casts)
- **Spell Types:**
  - **Manipulation:** Open Door, Move Tile, Activate Lever
  - **Environmental:** Create Light (reveal fog), Freeze Tile, Ignite
  - **Clop Influence:** Call (attract Clops to a point), Scare (repel from point), Sleep (pause a Clop)
  - **Combat Support:** Shield, Slow Enemy, Confuse

### Spell Acquisition
- Spells are unlocked progressively (campaign) or selected pre-dungeon (roguelike mode)
- Some dungeon objects require specific spells (lock requires "Unlock" spell)

---

## 4. The Clops

### What is a Clop?
A small, bouncy, one-eyed creature. Round body, single large eye, tiny legs. Cute but dumb. They move autonomously based on their personality and cannot be directly controlled.

### Movement Rules
- Move 1 tile per turn (unless modified by terrain or personality)
- Cannot move through Blockers (walls, closed doors)
- Slow tiles = 0.5 movement (takes 2 turns to cross)
- Will fall into holes (death)
- Affected by push/pull tiles

### Personality Types

| Personality | Core Behavior | Risk/Benefit |
|-------------|---------------|--------------|
| **Curious** | Moves toward unexplored areas, interacts with objects | Finds secrets, triggers traps |
| **Glutton** | Prioritizes food items, slower movement | Can be baited, but easily distracted |
| **Drowsy** | Moves slowly, sometimes skips turns (falls asleep) | Safe but slow, enemies might catch up |
| **Hyperactive (ADHD)** | Moves 2 tiles/turn, random direction changes | Fast but unpredictable |
| **Coward** | Flees from enemies, avoids dark tiles | Good survival, bad at pushing forward |
| **Social** | Follows other Clops closely | Group cohesion, but chain-reaction deaths |
| **Stubborn** | Ignores some mage spells, picks own path | Unreliable but sometimes surprisingly effective |

### Clop AI Decision Tree (Simplified)
```
1. Check immediate danger (enemy adjacent, hazard) → FLEE or PANIC
2. Check personality priority (food for Glutton, dark for Curious, etc.)
3. Check if mage "Call" spell active → Move toward if not Stubborn
4. Default: Move toward exit (pathfinding)
```

### Clop States
- **Normal:** Standard behavior
- **Scared:** Moves erratically, faster
- **Hurt:** Slower movement, 1 more hit = death
- **Charmed/Confused:** Temporary behavior override

---

## 5. Enemies

### Enemy AI States
```
IDLE → SUSPICIOUS → ALERT → HUNTING → COMBAT
  ↑__________________________________________|
                   (lose sight)
```

| State | Behavior | Trigger to Next |
|-------|----------|-----------------|
| **Idle** | Patrol route, ignores noise | Sees Clop, hears loud noise |
| **Suspicious** | Pauses, looks toward disturbance | Confirms Clop presence |
| **Alert** | Moves toward last known position | Gets close enough |
| **Hunting** | Actively pathfinds to Clops | Adjacent to Clop |
| **Combat** | Attacks, blocks path | Clop escapes vision |

### Vision System
- Cone-based or radius-based depending on enemy type
- Blocked by walls, closed doors
- Reduced in darkness (unless enemy has night vision)

### Enemy Types (Initial Set)
| Type | Speed | Vision | Behavior |
|------|-------|--------|----------|
| **Grunt** | 1 tile | Short cone | Basic patrol + chase |
| **Scout** | 2 tiles | Long cone | Fast, but weak |
| **Guardian** | 0 (stationary) | 360° radius | Blocks chokepoints |
| **Hunter** | 1 tile | Tracks by "scent" (last 3 Clop positions) | Persistent |

---

## 6. Map & Tiles

### Tile Types

| Tile | Effect | Visual Cue |
|------|--------|------------|
| **Floor** | Normal traversal | Standard ground |
| **Wall/Blocker** | Impassable | Raised, solid |
| **Slow** | Half movement speed | Mud, water, vines |
| **Hole** | Instant death (Clops fall) | Dark pit |
| **Conveyor** | Forces movement direction | Arrows, animation |
| **Hazard (Burn)** | Damage over time | Fire, lava glow |
| **Hazard (Poison)** | Damage + slow | Green mist |
| **Hazard (Ice)** | Slide until hitting wall | Blue, reflective |
| **Door** | Blocker until triggered | Visible door frame |
| **Pressure Plate** | Triggers linked object when stepped | Subtle plate |
| **Lever** | Triggers linked object when activated (spell) | Visible lever |
| **Exit** | Win condition tile | Glowing portal |
| **Spawn** | Clop starting position | Marked in editor |

### Trigger System
- Objects (doors, traps, bridges) have a **Trigger Condition**
- Conditions: Spell cast, pressure plate, lever, timer, enemy death
- Example: Door requires "Unlock" spell OR connected lever pulled

### Fog of War
- Tiles outside Clop vision are hidden (black or silhouette)
- Revealed tiles show terrain but not enemies (unless in current vision)
- Mage spells like "Light" can temporarily reveal areas

---

## 7. Spells (Initial Set)

| Spell | Effect | Cost | Unlock |
|-------|--------|------|--------|
| **Call** | Attract Clops toward target tile (3 turns) | 1 | Starting |
| **Scare** | Repel Clops from target tile (2 turns) | 1 | Starting |
| **Light** | Reveal 3x3 area for 3 turns | 1 | Starting |
| **Unlock** | Open locked door | 1 | Level 2 |
| **Freeze Tile** | Turn tile to Ice temporarily | 1 | Level 3 |
| **Shield** | Protect 1 Clop from next damage | 2 | Level 4 |
| **Sleep** | Pause 1 Clop for 2 turns | 1 | Level 5 |
| **Confuse Enemy** | Randomize enemy movement for 2 turns | 2 | Level 6 |

---

## 8. Core Design Pillars

### 1. Indirect Control is the Game
You're not playing Chess; you're playing "convince the pieces to move themselves." Every mechanic should reinforce that the Clops are autonomous and you're working around them.

### 2. Readable Chaos
The game can be chaotic, but the player should always understand WHY something happened. Clear visual feedback, predictable AI rules, no hidden information (except fog of war).

### 3. Fail Forward, Laugh Often
Losing Clops should feel tragic-comic, not frustrating. Deaths should be spectacular, memorable, and often the player's own fault in hindsight.

### 4. Small Maps, Dense Decisions
Maps should be compact (8x8 to 16x16) to keep turns fast and every tile meaningful. No empty filler space.

---

## 9. Open Questions (To Test)

1. **Turn Simultaneity:** Do Clops and enemies move at the same time, or sequentially? (Affects planning depth)
2. **Spell Slots:** How many casts per turn feels right? Too few = helpless, too many = trivial
3. **Clop Count:** How many Clops per level? 3-5 seems manageable, 10+ becomes Lemmings chaos
4. **Personality Balance:** Are some personalities too annoying or useless?
5. **Death Frequency:** How often should Clops die? Needs playtesting for emotional calibration
6. **Mage Presence:** Should the mage have any physical representation on the map?

---

## 10. Art Direction (Brief)

- **Perspective:** Isometric (2:1 ratio tiles)
- **Style:** Pixel art, 32x32 or 64x64 base tiles
- **Palette:** Dark dungeons with high-contrast highlights (Clops glow slightly)
- **Clops Design:** Simple, expressive eye is key (emotions readable at small size)
- **Tone:** Dark-cute (like Darkest Dungeon meets Tamagotchi)

---

*Document will evolve as prototyping reveals what's fun.*