/**
 * Level data validation using Zod
 */

import { z } from 'zod';
import {
  LevelData,
  LayerData,
  TilePlacement,
  GridCoord,
  LevelMetadata,
  GridConfig,
  TileBehaviorPlacement,
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

// Tile behavior schema
const TileBehaviorSchema: z.ZodType<TileBehaviorPlacement> = z.object({
  position: GridCoordSchema,
  type: z.enum([
    'floor',
    'blocker',
    'slow',
    'hole',
    'conveyor',
    'hazard-burn',
    'door',
    'exit',
    'spawn',
  ]),
  direction: z.enum(['north', 'east', 'south', 'west']).optional(),
  doorId: z.string().optional(),
  open: z.boolean().optional(),
  damage: z.number().int().min(0).optional(),
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

// Complete level data schema
const LevelDataSchema = z.object({
  version: z.literal(1),
  metadata: LevelMetadataSchema,
  grid: GridConfigSchema,
  layers: z.array(LayerDataSchema).min(1),
  tileBehaviors: z.array(TileBehaviorSchema).optional(),
});

/**
 * Validate and parse level data
 * @throws ZodError if validation fails
 */
export function validateLevelData(data: unknown): LevelData {
  return LevelDataSchema.parse(data);
}

/**
 * Safely validate level data, returning result
 */
export function safeParseLevelData(data: unknown): z.SafeParseReturnType<unknown, LevelData> {
  return LevelDataSchema.safeParse(data);
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
  TileBehavior: TileBehaviorSchema,
};
