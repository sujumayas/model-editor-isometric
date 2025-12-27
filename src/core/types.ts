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

/** Data for a placed tile */
export interface TileData {
  readonly tileId: TileId;
  readonly rotation?: 0 | 90 | 180 | 270;
  readonly flipX?: boolean;
  readonly flipY?: boolean;
}

/** Cardinal direction helper */
export type CardinalDirection = 'north' | 'east' | 'south' | 'west';

/** Logical tile behavior used by movement tools */
export type TileBehaviorType =
  | 'floor'
  | 'blocker'
  | 'slow'
  | 'hole'
  | 'conveyor'
  | 'hazard-burn'
  | 'door'
  | 'exit'
  | 'spawn';

/** Tile behavior metadata stored alongside the map */
export interface TileBehavior {
  readonly type: TileBehaviorType;
  readonly direction?: CardinalDirection;
  readonly doorId?: string;
  readonly open?: boolean;
  readonly damage?: number;
}

/** Serialized tile behavior placement */
export interface TileBehaviorPlacement extends TileBehavior {
  readonly position: GridCoord;
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

/** Complete level data (serialized format) */
export interface LevelData {
  readonly version: number;
  readonly metadata: LevelMetadata;
  readonly grid: GridConfig;
  readonly layers: LayerData[];
  readonly tileBehaviors?: TileBehaviorPlacement[];
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
