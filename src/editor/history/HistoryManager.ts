/**
 * History manager for undo/redo functionality
 */

import { Command } from '../../core/types';

export interface HistoryOptions {
  /** Maximum number of commands to keep in history */
  maxSize?: number;
}

export type HistoryEventType = 'change' | 'save';
export type HistoryEventHandler = () => void;

/**
 * HistoryManager manages undo/redo stacks
 */
export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxSize: number;
  private savePoint: number = 0;
  private listeners = new Map<HistoryEventType, Set<HistoryEventHandler>>();

  constructor(options: HistoryOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
  }

  /**
   * Execute a command and add it to the history
   */
  execute(command: Command): void {
    // Execute the command
    command.execute();

    // Add to undo stack
    this.undoStack.push(command);

    // Clear redo stack (can't redo after new action)
    this.redoStack = [];

    // Trim undo stack if too large
    while (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
      // Adjust save point if it was in the trimmed region
      if (this.savePoint > 0) {
        this.savePoint--;
      }
    }

    this.emit('change');
  }

  /**
   * Undo the last command
   */
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);

    this.emit('change');
    return true;
  }

  /**
   * Redo the last undone command
   */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.execute();
    this.undoStack.push(command);

    this.emit('change');
    return true;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get the description of the next undo command
   */
  getUndoDescription(): string | null {
    const command = this.undoStack[this.undoStack.length - 1];
    return command?.description ?? null;
  }

  /**
   * Get the description of the next redo command
   */
  getRedoDescription(): string | null {
    const command = this.redoStack[this.redoStack.length - 1];
    return command?.description ?? null;
  }

  /**
   * Mark the current state as saved
   */
  markSaved(): void {
    this.savePoint = this.undoStack.length;
    this.emit('save');
  }

  /**
   * Check if there are unsaved changes
   */
  isDirty(): boolean {
    return this.undoStack.length !== this.savePoint;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.savePoint = 0;
    this.emit('change');
  }

  /**
   * Get the number of commands in undo stack
   */
  get undoCount(): number {
    return this.undoStack.length;
  }

  /**
   * Get the number of commands in redo stack
   */
  get redoCount(): number {
    return this.redoStack.length;
  }

  // =========================================================================
  // Events
  // =========================================================================

  on(event: HistoryEventType, handler: HistoryEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  off(event: HistoryEventType, handler: HistoryEventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: HistoryEventType): void {
    this.listeners.get(event)?.forEach((handler) => handler());
  }
}
