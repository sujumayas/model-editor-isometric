/**
 * Base tool interface and types
 */

import { GridCoord, ToolType } from '../../core/types';
import { Level } from '../../level/Level';
import { EditorState } from '../EditorState';
import type { HistoryManager } from '../history/HistoryManager';

/**
 * Tool context passed to tools for access to editor systems
 */
export interface ToolContext {
  level: Level;
  editorState: EditorState;
  history: HistoryManager;
}

/**
 * Base interface for editor tools
 */
export interface Tool {
  /** Tool type identifier */
  readonly type: ToolType;

  /** Human-readable name */
  readonly name: string;

  /** Tool description */
  readonly description: string;

  /** Keyboard shortcut (single key) */
  readonly shortcut?: string;

  /**
   * Called when the tool is activated
   */
  onActivate?(ctx: ToolContext): void;

  /**
   * Called when the tool is deactivated
   */
  onDeactivate?(ctx: ToolContext): void;

  /**
   * Called when mouse button is pressed
   */
  onMouseDown(ctx: ToolContext, coord: GridCoord): void;

  /**
   * Called when mouse moves (while button is pressed or not)
   */
  onMouseMove(ctx: ToolContext, coord: GridCoord, isPressed: boolean): void;

  /**
   * Called when mouse button is released
   */
  onMouseUp(ctx: ToolContext, coord: GridCoord): void;

  /**
   * Get cursor style for this tool
   */
  getCursor?(): string;
}

/**
 * Abstract base class for tools with common functionality
 */
export abstract class BaseTool implements Tool {
  abstract readonly type: ToolType;
  abstract readonly name: string;
  abstract readonly description: string;
  readonly shortcut?: string;

  protected lastCoord: GridCoord | null = null;
  protected isDrawing = false;

  onActivate(_ctx: ToolContext): void {
    this.lastCoord = null;
    this.isDrawing = false;
  }

  onDeactivate(_ctx: ToolContext): void {
    this.lastCoord = null;
    this.isDrawing = false;
  }

  abstract onMouseDown(ctx: ToolContext, coord: GridCoord): void;
  abstract onMouseMove(ctx: ToolContext, coord: GridCoord, isPressed: boolean): void;
  abstract onMouseUp(ctx: ToolContext, coord: GridCoord): void;

  getCursor(): string {
    return 'default';
  }

  /**
   * Check if coordinate has changed
   */
  protected hasCoordChanged(coord: GridCoord): boolean {
    if (!this.lastCoord) return true;
    return this.lastCoord.x !== coord.x || this.lastCoord.y !== coord.y;
  }

  /**
   * Update last coordinate
   */
  protected updateLastCoord(coord: GridCoord): void {
    this.lastCoord = { ...coord };
  }
}
