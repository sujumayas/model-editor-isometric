/**
 * Level serialization and deserialization
 */

import { LevelData, LevelDataV2 } from '../core/types';
import { Level } from './Level';
import { validateLevelData } from './validation';

/**
 * Migrate v1 level data to v2 format
 */
export function migrateLevelData(data: LevelData | LevelDataV2): LevelDataV2 {
  if (data.version === 2) {
    return data as LevelDataV2;
  }

  // V1 -> V2: Add empty gameplay layer
  return {
    ...data,
    version: 2,
    gameplayLayer: undefined, // All tiles default to 'floor'
  };
}

export interface SerializeOptions {
  /** Pretty print JSON */
  pretty?: boolean;
}

/**
 * Serialize a level to JSON string
 */
export function serializeLevel(level: Level, options: SerializeOptions = {}): string {
  const data = level.toData();
  return options.pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
}

/**
 * Deserialize a level from JSON string
 */
export function deserializeLevel(json: string): Level {
  const data = JSON.parse(json) as unknown;
  const validatedData = validateLevelData(data);
  return Level.fromData(validatedData);
}

/**
 * Save level to a file (triggers browser download)
 */
export function downloadLevel(level: Level, filename?: string): void {
  const json = serializeLevel(level, { pretty: true });
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${level.metadata.name.replace(/[^a-z0-9]/gi, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Load level from a file (via file input)
 */
export function loadLevelFromFile(file: File): Promise<Level> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const level = deserializeLevel(json);
        resolve(level);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Save level to localStorage
 */
export function saveToLocalStorage(level: Level, key: string = 'isometric_level'): void {
  const json = serializeLevel(level);
  localStorage.setItem(key, json);
}

/**
 * Load level from localStorage
 */
export function loadFromLocalStorage(key: string = 'isometric_level'): Level | null {
  const json = localStorage.getItem(key);
  if (!json) return null;

  try {
    return deserializeLevel(json);
  } catch {
    return null;
  }
}

/**
 * Check if a level exists in localStorage
 */
export function hasLocalStorage(key: string = 'isometric_level'): boolean {
  return localStorage.getItem(key) !== null;
}

/**
 * Remove level from localStorage
 */
export function removeFromLocalStorage(key: string = 'isometric_level'): void {
  localStorage.removeItem(key);
}
