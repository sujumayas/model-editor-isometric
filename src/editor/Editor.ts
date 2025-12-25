/**
 * Main editor controller
 */

import { ToolType, GridCoord } from '../core/types';
import { Level } from '../level/Level';
import { Canvas } from '../engine/Canvas';
import { Camera } from '../engine/Camera';
import { Renderer } from '../engine/Renderer';
import { TileRegistry } from '../assets/TileRegistry';
import { EditorState } from './EditorState';
import { HistoryManager } from './history/HistoryManager';
import { Tool, ToolContext } from './tools/Tool';
import { BrushTool } from './tools/BrushTool';
import { EraserTool } from './tools/EraserTool';
import {
  serializeLevel,
  deserializeLevel,
  downloadLevel,
  saveToLocalStorage,
  loadFromLocalStorage,
} from '../level/LevelSerializer';

export interface EditorOptions {
  canvas: HTMLCanvasElement | string;
  container?: HTMLElement | string;
}

/**
 * Editor is the main controller that coordinates all editor systems
 */
export class Editor {
  // Core systems
  readonly canvas: Canvas;
  readonly camera: Camera;
  readonly renderer: Renderer;
  readonly tileRegistry: TileRegistry;

  // Editor systems
  readonly state: EditorState;
  readonly history: HistoryManager;

  // Level
  private _level: Level;

  // Tools
  private tools = new Map<ToolType, Tool>();
  private activeTool: Tool | null = null;

  // Render loop
  private animationFrameId: number | null = null;
  private isRunning = false;

  constructor(options: EditorOptions, tileRegistry: TileRegistry) {
    // Initialize canvas
    this.canvas = new Canvas({
      canvas: options.canvas,
      container: options.container,
    });

    // Initialize camera
    this.camera = new Camera({ zoom: 2 });

    // Store tile registry
    this.tileRegistry = tileRegistry;

    // Initialize renderer
    this.renderer = new Renderer(this.canvas, this.camera, tileRegistry);

    // Initialize editor state
    this.state = new EditorState();

    // Initialize history
    this.history = new HistoryManager({ maxSize: 100 });

    // Create default level
    this._level = Level.createDefault();

    // Set initial active layer
    const firstLayer = this._level.getLayers()[0];
    if (firstLayer) {
      this.state.setActiveLayer(firstLayer.config.id);
    }

    // Register tools
    this.registerTool(new BrushTool());
    this.registerTool(new EraserTool());

    // Set default tool
    this.setTool('brush');

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Get the current level
   */
  get level(): Level {
    return this._level;
  }

  // =========================================================================
  // Tool Management
  // =========================================================================

  /**
   * Register a tool
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.type, tool);
  }

  /**
   * Set the active tool
   */
  setTool(type: ToolType): void {
    const tool = this.tools.get(type);
    if (!tool) return;

    // Deactivate current tool
    if (this.activeTool) {
      this.activeTool.onDeactivate?.(this.getToolContext());
    }

    // Activate new tool
    this.activeTool = tool;
    this.activeTool.onActivate?.(this.getToolContext());
    this.state.setActiveTool(type);

    // Update cursor
    const cursor = tool.getCursor?.() ?? 'default';
    this.canvas.element.style.cursor = cursor;
  }

  /**
   * Get tool context for tool callbacks
   */
  private getToolContext(): ToolContext {
    return {
      level: this._level,
      editorState: this.state,
      history: this.history,
    };
  }

  // =========================================================================
  // Level Management
  // =========================================================================

  /**
   * Create a new level
   */
  newLevel(name?: string): void {
    this._level = Level.createDefault(name);

    // Reset history
    this.history.clear();

    // Set active layer
    const firstLayer = this._level.getLayers()[0];
    if (firstLayer) {
      this.state.setActiveLayer(firstLayer.config.id);
    }

    this.state.markClean();
  }

  /**
   * Load a level from JSON string
   */
  loadLevel(json: string): void {
    this._level = deserializeLevel(json);

    // Reset history
    this.history.clear();

    // Set active layer
    const firstLayer = this._level.getLayers()[0];
    if (firstLayer) {
      this.state.setActiveLayer(firstLayer.config.id);
    }

    this.state.markClean();
  }

  /**
   * Save level to JSON string
   */
  saveLevel(): string {
    const json = serializeLevel(this._level, { pretty: true });
    this.history.markSaved();
    this.state.markClean();
    return json;
  }

  /**
   * Download level as JSON file
   */
  downloadLevel(filename?: string): void {
    downloadLevel(this._level, filename);
    this.history.markSaved();
    this.state.markClean();
  }

  /**
   * Save to localStorage
   */
  saveToStorage(): void {
    saveToLocalStorage(this._level);
    this.history.markSaved();
    this.state.markClean();
  }

  /**
   * Load from localStorage
   */
  loadFromStorage(): boolean {
    const level = loadFromLocalStorage();
    if (!level) return false;

    this._level = level;
    this.history.clear();

    const firstLayer = this._level.getLayers()[0];
    if (firstLayer) {
      this.state.setActiveLayer(firstLayer.config.id);
    }

    this.state.markClean();
    return true;
  }

  // =========================================================================
  // Input Handling
  // =========================================================================

  private setupEventListeners(): void {
    const canvasEl = this.canvas.element;

    // Mouse events
    canvasEl.addEventListener('mousedown', this.handleMouseDown);
    canvasEl.addEventListener('mousemove', this.handleMouseMove);
    canvasEl.addEventListener('mouseup', this.handleMouseUp);
    canvasEl.addEventListener('mouseleave', this.handleMouseLeave);
    canvasEl.addEventListener('wheel', this.handleWheel, { passive: false });

    // Keyboard events (on window)
    window.addEventListener('keydown', this.handleKeyDown);
  }

  private handleMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return; // Only left click

    const coord = this.getGridCoord(e);
    if (coord && this.activeTool) {
      this.activeTool.onMouseDown(this.getToolContext(), coord);
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    const coord = this.getGridCoord(e);

    // Update hover state
    this.state.setHoveredCoord(coord);
    if (coord) {
      this.renderer.setHoveredCoord(coord);
    } else {
      this.renderer.setHoveredCoord(null);
    }

    // Forward to tool
    if (coord && this.activeTool) {
      const isPressed = (e.buttons & 1) !== 0;
      this.activeTool.onMouseMove(this.getToolContext(), coord, isPressed);
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button !== 0) return;

    const coord = this.getGridCoord(e);
    if (coord && this.activeTool) {
      this.activeTool.onMouseUp(this.getToolContext(), coord);
    }
  };

  private handleMouseLeave = (): void => {
    this.state.setHoveredCoord(null);
    this.renderer.setHoveredCoord(null);
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();

    // Zoom with scroll
    const delta = -e.deltaY * 0.001;
    const rect = this.canvas.element.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;

    this.camera.zoomBy(delta, centerX, centerY);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Don't handle if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Undo/Redo
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey) {
        this.history.redo();
      } else {
        this.history.undo();
      }
      e.preventDefault();
      return;
    }

    if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
      this.history.redo();
      e.preventDefault();
      return;
    }

    // Save
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      this.saveToStorage();
      e.preventDefault();
      return;
    }

    // Tool shortcuts
    for (const tool of this.tools.values()) {
      if (tool.shortcut === e.key.toLowerCase()) {
        this.setTool(tool.type);
        return;
      }
    }
  };

  private getGridCoord(e: MouseEvent): GridCoord | null {
    const rect = this.canvas.element.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const coord = this.renderer.screenToGrid(screenX, screenY, this._level);

    // Check bounds
    if (this._level.isInBounds(coord)) {
      return coord;
    }

    return null;
  }

  // =========================================================================
  // Render Loop
  // =========================================================================

  /**
   * Start the render loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.renderLoop();
  }

  /**
   * Stop the render loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private renderLoop = (): void => {
    if (!this.isRunning) return;

    this.render();
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  /**
   * Render a single frame
   */
  render(): void {
    this.renderer.render(this._level);
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /**
   * Dispose of the editor and cleanup resources
   */
  dispose(): void {
    this.stop();

    // Remove event listeners
    const canvasEl = this.canvas.element;
    canvasEl.removeEventListener('mousedown', this.handleMouseDown);
    canvasEl.removeEventListener('mousemove', this.handleMouseMove);
    canvasEl.removeEventListener('mouseup', this.handleMouseUp);
    canvasEl.removeEventListener('mouseleave', this.handleMouseLeave);
    canvasEl.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('keydown', this.handleKeyDown);

    // Cleanup canvas
    this.canvas.dispose();
  }
}
