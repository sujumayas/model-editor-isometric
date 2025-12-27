/**
 * Core type definitions for the isometric engine
 */

// ============================================================================
// Coordinates
// ============================================================================

/** Grid coordinate (tile position on the logical grid) */
export interface GridCoord {
  readonly x: number;
  readonly y: number;
}

/** Screen coordinate (pixel position on canvas) */
export interface ScreenCoord {
  readonly x: number;
  readonly y: number;
}

/** Grid bounds (rectangular region in grid space) */
export interface GridBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

// ============================================================================
// Tiles
// ============================================================================

/** Tile ID (index into the tileset, 0-114) */
export type TileId = number;

// ============================================================================
// Gameplay Tile Types
// ============================================================================

/** Gameplay tile type - defines behavior for movement and effects */
export type GameplayTileType =
  | 'floor'     // Default walkable
  | 'blocker'   // Impassable wall
  | 'slow'      // Movement cost 2.5x
  | 'hole'      // Instant death on entry
  | 'conveyor'  // Forced movement after entry
  | 'hazard'    // Deals damage on entry
  | 'door'      // Blocks until toggled
  | 'exit'      // Win condition trigger
  | 'spawn';    // Player spawn point

/** Cardinal direction for conveyors */
export type Direction = 'north' | 'east' | 'south' | 'west';

/** Direction vectors for movement */
export const DIRECTION_VECTORS: Record<Direction, GridCoord> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

/** Gameplay properties for a tile */
export interface TileProperties {
  readonly type: GameplayTileType;
  readonly direction?: Direction;   // For conveyor
  readonly linkedId?: string;       // For door (links to trigger)
  readonly damage?: number;         // For hazard (default 1)
}

/** A gameplay tile placed at a specific position */
export interface GameplayTilePlacement {
  readonly position: GridCoord;
  readonly properties: TileProperties;
}

/** Gameplay layer data (for serialization) */
export interface GameplayLayerData {
  readonly tiles: GameplayTilePlacement[];
}

/** Data for a placed tile */
export interface TileData {
  readonly tileId: TileId;
  readonly rotation?: 0 | 90 | 180 | 270;
  readonly flipX?: boolean;
  readonly flipY?: boolean;
}

/** UV coordinates for extracting a tile from the spritesheet */
export interface TileUV {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// ============================================================================
// Layers
// ============================================================================

/** Layer type identifier */
export type LayerType = 'terrain' | 'props' | 'decorations' | 'custom';

/** Layer configuration */
export interface LayerConfig {
  readonly id: string;
  readonly name: string;
  readonly type?: LayerType;
  readonly zIndex: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

/** Serialized layer data (for JSON) */
export interface LayerData {
  readonly id: string;
  readonly name: string;
  readonly zIndex: number;
  readonly visible: boolean;
  readonly tiles: TilePlacement[];
}

/** A tile placed at a specific position */
export interface TilePlacement {
  readonly tileId: TileId;
  readonly position: GridCoord;
  readonly rotation?: 0 | 90 | 180 | 270;
}

// ============================================================================
// Level
// ============================================================================

/** Grid configuration */
export interface GridConfig {
  readonly width: number;
  readonly height: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
}

/** Level metadata */
export interface LevelMetadata {
  readonly id: string;
  readonly name: string;
  readonly author?: string;
  readonly created: string;
  readonly modified: string;
  readonly version: number;
}

/** Complete level data (serialized format) - v1 */
export interface LevelData {
  readonly version: number;
  readonly metadata: LevelMetadata;
  readonly grid: GridConfig;
  readonly layers: LayerData[];
}

/** Level data v2 with gameplay layer */
export interface LevelDataV2 extends LevelData {
  readonly gameplayLayer?: GameplayLayerData;
}

// ============================================================================
// Camera & Viewport
// ============================================================================

/** Camera state */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

/** Viewport bounds in screen coordinates */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

// ============================================================================
// Editor
// ============================================================================

/** Available editor tools */
export type ToolType = 'brush' | 'eraser' | 'select' | 'pan';

/** Editor state */
export interface EditorStateData {
  activeTool: ToolType;
  activeLayerId: string | null;
  selectedTileId: TileId | null;
  hoveredCoord: GridCoord | null;
  isDirty: boolean;
}

// ============================================================================
// Events
// ============================================================================

/** Event types emitted by the engine */
export interface EngineEvents {
  'tile:placed': { layerId: string; position: GridCoord; tile: TileData };
  'tile:removed': { layerId: string; position: GridCoord };
  'layer:changed': { layerId: string };
  'level:loaded': { level: LevelData };
  'level:saved': { level: LevelData };
  'tool:changed': { tool: ToolType };
  'selection:changed': { coords: GridCoord[] };
}

/** Generic event handler */
export type EventHandler<T> = (payload: T) => void;

// ============================================================================
// Commands (Undo/Redo)
// ============================================================================

/** Command interface for undo/redo */
export interface Command {
  readonly description: string;
  execute(): void;
  undo(): void;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Make all properties mutable */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/** Key for tile position in maps (format: "x,y") */
export type PositionKey = `${number},${number}`;

/** Convert GridCoord to PositionKey */
export function toPositionKey(coord: GridCoord): PositionKey {
  return `${coord.x},${coord.y}`;
}

/** Parse PositionKey back to GridCoord */
export function fromPositionKey(key: PositionKey): GridCoord {
  const [x, y] = key.split(',').map(Number);
  return { x: x!, y: y! };
}
