/**
 * Canvas management - setup, resize handling, and DPR support
 */

import { Viewport } from '../core/types';

export interface CanvasOptions {
  /** Canvas element or selector */
  canvas: HTMLCanvasElement | string;
  /** Container element for sizing (defaults to canvas parent) */
  container?: HTMLElement | string;
  /** Whether to handle DPR scaling */
  handleDPR?: boolean;
  /** Background color */
  backgroundColor?: string;
}

/**
 * Canvas class manages the HTML canvas element and rendering context
 */
export class Canvas {
  readonly element: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private handleDPR: boolean;
  private backgroundColor: string;
  private resizeObserver: ResizeObserver | null = null;
  private _viewport: Viewport = { width: 0, height: 0 };
  private _dpr: number = 1;

  constructor(options: CanvasOptions) {
    // Get canvas element
    if (typeof options.canvas === 'string') {
      const el = document.querySelector<HTMLCanvasElement>(options.canvas);
      if (!el) throw new Error(`Canvas not found: ${options.canvas}`);
      this.element = el;
    } else {
      this.element = options.canvas;
    }

    // Get rendering context
    const ctx = this.element.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context');
    this.ctx = ctx;

    // Get container
    if (options.container) {
      if (typeof options.container === 'string') {
        const el = document.querySelector<HTMLElement>(options.container);
        if (!el) throw new Error(`Container not found: ${options.container}`);
        this.container = el;
      } else {
        this.container = options.container;
      }
    } else {
      this.container = this.element.parentElement || document.body;
    }

    this.handleDPR = options.handleDPR ?? true;
    this.backgroundColor = options.backgroundColor ?? '#0f0f23';

    // Initial setup
    this.updateSize();
    this.setupResizeObserver();
  }

  /**
   * Get the current viewport size (CSS pixels)
   */
  get viewport(): Viewport {
    return this._viewport;
  }

  /**
   * Get the device pixel ratio
   */
  get dpr(): number {
    return this._dpr;
  }

  /**
   * Update canvas size to match container
   */
  private updateSize(): void {
    const rect = this.container.getBoundingClientRect();
    this._dpr = this.handleDPR ? window.devicePixelRatio || 1 : 1;

    // Set CSS size
    this.element.style.width = `${rect.width}px`;
    this.element.style.height = `${rect.height}px`;

    // Set actual canvas size (accounting for DPR)
    this.element.width = rect.width * this._dpr;
    this.element.height = rect.height * this._dpr;

    // Update viewport
    this._viewport = {
      width: rect.width,
      height: rect.height,
    };

    // Scale context for DPR
    if (this.handleDPR) {
      this.ctx.scale(this._dpr, this._dpr);
    }

    // Configure context defaults
    this.ctx.imageSmoothingEnabled = false; // Crisp pixel art
  }

  /**
   * Setup resize observer for automatic resizing
   */
  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.updateSize();
    });
    this.resizeObserver.observe(this.container);
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    // Reset transform before clearing
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.handleDPR) {
      this.ctx.scale(this._dpr, this._dpr);
    }

    // Clear with background color
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this._viewport.width, this._viewport.height);
  }

  /**
   * Dispose of the canvas and cleanup
   */
  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
}
