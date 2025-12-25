/**
 * Core constants for the isometric engine
 */

// Tile dimensions (source sprite size)
export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 32;

// Isometric projection dimensions (2:1 ratio)
// The visible diamond shape in isometric view
export const ISO_TILE_WIDTH = 32;
export const ISO_TILE_HEIGHT = 16;

// Grid configuration
export const GRID_WIDTH = 8;
export const GRID_HEIGHT = 8;

// Spritesheet configuration
export const SPRITESHEET_PATH = 'isometric tileset/spritesheet.png';
export const TOTAL_TILES = 115;

// Default layer configuration
export const DEFAULT_LAYERS = [
  { id: 'terrain', name: 'Terrain', zIndex: 0 },
  { id: 'props', name: 'Props', zIndex: 10 },
  { id: 'decorations', name: 'Decorations', zIndex: 20 },
] as const;

// Editor colors
export const GRID_COLOR = 'rgba(255, 255, 255, 0.1)';
export const SELECTION_COLOR = 'rgba(74, 255, 158, 0.5)';
export const HOVER_COLOR = 'rgba(74, 158, 255, 0.3)';
