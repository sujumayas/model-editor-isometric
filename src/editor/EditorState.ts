/**
 * Editor state management
 */

import { GridCoord, TileId, ToolType, EditorStateData } from '../core/types';

export type EditorEventType =
  | 'tool:changed'
  | 'layer:changed'
  | 'tile:selected'
  | 'hover:changed'
  | 'dirty:changed';

export type EditorEventHandler = (data: unknown) => void;

/**
 * EditorState manages the current state of the editor
 */
export class EditorState {
  private state: EditorStateData;
  private listeners = new Map<EditorEventType, Set<EditorEventHandler>>();

  constructor() {
    this.state = {
      activeTool: 'brush',
      activeLayerId: null,
      selectedTileId: null,
      hoveredCoord: null,
      isDirty: false,
    };
  }

  // =========================================================================
  // Getters
  // =========================================================================

  get activeTool(): ToolType {
    return this.state.activeTool;
  }

  get activeLayerId(): string | null {
    return this.state.activeLayerId;
  }

  get selectedTileId(): TileId | null {
    return this.state.selectedTileId;
  }

  get hoveredCoord(): GridCoord | null {
    return this.state.hoveredCoord;
  }

  get isDirty(): boolean {
    return this.state.isDirty;
  }

  // =========================================================================
  // Setters
  // =========================================================================

  setActiveTool(tool: ToolType): void {
    if (this.state.activeTool !== tool) {
      this.state.activeTool = tool;
      this.emit('tool:changed', { tool });
    }
  }

  setActiveLayer(layerId: string | null): void {
    if (this.state.activeLayerId !== layerId) {
      this.state.activeLayerId = layerId;
      this.emit('layer:changed', { layerId });
    }
  }

  setSelectedTile(tileId: TileId | null): void {
    if (this.state.selectedTileId !== tileId) {
      this.state.selectedTileId = tileId;
      this.emit('tile:selected', { tileId });
    }
  }

  setHoveredCoord(coord: GridCoord | null): void {
    const changed =
      this.state.hoveredCoord?.x !== coord?.x ||
      this.state.hoveredCoord?.y !== coord?.y;

    if (changed) {
      this.state.hoveredCoord = coord;
      this.emit('hover:changed', { coord });
    }
  }

  setDirty(dirty: boolean): void {
    if (this.state.isDirty !== dirty) {
      this.state.isDirty = dirty;
      this.emit('dirty:changed', { isDirty: dirty });
    }
  }

  markDirty(): void {
    this.setDirty(true);
  }

  markClean(): void {
    this.setDirty(false);
  }

  // =========================================================================
  // Events
  // =========================================================================

  on(event: EditorEventType, handler: EditorEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  off(event: EditorEventType, handler: EditorEventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: EditorEventType, data: unknown): void {
    this.listeners.get(event)?.forEach((handler) => handler(data));
  }

  // =========================================================================
  // Serialization
  // =========================================================================

  getSnapshot(): EditorStateData {
    return { ...this.state };
  }

  restore(snapshot: Partial<EditorStateData>): void {
    if (snapshot.activeTool !== undefined) {
      this.setActiveTool(snapshot.activeTool);
    }
    if (snapshot.activeLayerId !== undefined) {
      this.setActiveLayer(snapshot.activeLayerId);
    }
    if (snapshot.selectedTileId !== undefined) {
      this.setSelectedTile(snapshot.selectedTileId);
    }
  }
}
