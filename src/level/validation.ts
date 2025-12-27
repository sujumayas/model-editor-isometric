/**
 * Level data validation using Zod
 */

import { z } from 'zod';
import {
  LevelData,
  LevelDataV2,
  LayerData,
  TilePlacement,
  GridCoord,
  LevelMetadata,
  GridConfig,
  TileProperties,
  GameplayTilePlacement,
} from '../core/types';

// Grid coordinate schema
const GridCoordSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

// Tile placement schema
const TilePlacementSchema = z.object({
  tileId: z.number().int().min(0),
  position: GridCoordSchema,
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
});

// Layer data schema
const LayerDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  zIndex: z.number().int(),
  visible: z.boolean(),
  tiles: z.array(TilePlacementSchema),
});

// Grid config schema
const GridConfigSchema = z.object({
  width: z.number().int().min(1).max(256),
  height: z.number().int().min(1).max(256),
  tileWidth: z.number().int().min(1),
  tileHeight: z.number().int().min(1),
});

// Level metadata schema
const LevelMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  author: z.string().optional(),
  created: z.string(),
  modified: z.string(),
  version: z.number().int().min(1),
});

// ============================================================================
// Gameplay Tile Schemas (v2)
// ============================================================================

// Gameplay tile type enum
const GameplayTileTypeSchema = z.enum([
  'floor',
  'blocker',
  'slow',
  'hole',
  'conveyor',
  'hazard',
  'door',
  'exit',
  'spawn',
]);

// Direction enum for conveyors
const DirectionSchema = z.enum(['north', 'east', 'south', 'west']);

// Tile properties schema
const TilePropertiesSchema = z.object({
  type: GameplayTileTypeSchema,
  direction: DirectionSchema.optional(),
  linkedId: z.string().optional(),
  damage: z.number().int().min(1).optional(),
});

// Gameplay tile placement schema
const GameplayTilePlacementSchema = z.object({
  position: GridCoordSchema,
  properties: TilePropertiesSchema,
});

// Gameplay layer schema
const GameplayLayerSchema = z.object({
  tiles: z.array(GameplayTilePlacementSchema),
});

// ============================================================================
// Level Data Schemas
// ============================================================================

// V1 level data schema (legacy)
const LevelDataSchemaV1 = z.object({
  version: z.literal(1),
  metadata: LevelMetadataSchema,
  grid: GridConfigSchema,
  layers: z.array(LayerDataSchema).min(1),
});

// V2 level data schema (with gameplay layer)
const LevelDataSchemaV2 = z.object({
  version: z.literal(2),
  metadata: LevelMetadataSchema,
  grid: GridConfigSchema,
  layers: z.array(LayerDataSchema).min(1),
  gameplayLayer: GameplayLayerSchema.optional(),
});

// Combined schema that accepts both v1 and v2
const LevelDataSchema = z.union([LevelDataSchemaV1, LevelDataSchemaV2]);

/**
 * Validate and parse level data (supports v1 and v2)
 * @throws ZodError if validation fails
 */
export function validateLevelData(data: unknown): LevelData | LevelDataV2 {
  return LevelDataSchema.parse(data);
}

/**
 * Safely validate level data, returning result
 */
export function safeParseLevelData(data: unknown): z.SafeParseReturnType<unknown, LevelData | LevelDataV2> {
  return LevelDataSchema.safeParse(data);
}

/**
 * Validate tile properties
 */
export function validateTileProperties(data: unknown): TileProperties {
  return TilePropertiesSchema.parse(data);
}

/**
 * Validate gameplay tile placement
 */
export function validateGameplayTilePlacement(data: unknown): GameplayTilePlacement {
  return GameplayTilePlacementSchema.parse(data);
}

/**
 * Validate a single layer
 */
export function validateLayerData(data: unknown): LayerData {
  return LayerDataSchema.parse(data);
}

/**
 * Validate grid coordinate
 */
export function validateGridCoord(data: unknown): GridCoord {
  return GridCoordSchema.parse(data);
}

/**
 * Validate tile placement
 */
export function validateTilePlacement(data: unknown): TilePlacement {
  return TilePlacementSchema.parse(data);
}

/**
 * Get validation errors as readable strings
 */
export function getValidationErrors(error: z.ZodError): string[] {
  return error.errors.map((err) => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}

// Export schemas for external use
export const schemas = {
  GridCoord: GridCoordSchema,
  TilePlacement: TilePlacementSchema,
  LayerData: LayerDataSchema,
  GridConfig: GridConfigSchema,
  LevelMetadata: LevelMetadataSchema,
  LevelData: LevelDataSchema,
  LevelDataV1: LevelDataSchemaV1,
  LevelDataV2: LevelDataSchemaV2,
  // Gameplay schemas
  GameplayTileType: GameplayTileTypeSchema,
  Direction: DirectionSchema,
  TileProperties: TilePropertiesSchema,
  GameplayTilePlacement: GameplayTilePlacementSchema,
  GameplayLayer: GameplayLayerSchema,
};
