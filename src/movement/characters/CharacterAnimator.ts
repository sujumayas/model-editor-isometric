import { AssetLoader } from '@assets/AssetLoader';

export type CharacterAnimationKey = 'idle' | 'run';
export type CharacterDirection = 'ne' | 'nw' | 'se' | 'sw';

export interface CharacterAnimationConfig {
  key: CharacterAnimationKey;
  frameDuration: number;
  frames: Record<CharacterDirection, string[]>;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  size: { width: number; height: number };
  anchor: { x: number; y: number };
  states: Record<CharacterAnimationKey, CharacterAnimationConfig>;
}

type FrameStore = Record<CharacterAnimationKey, Record<CharacterDirection, HTMLImageElement[]>>;

/**
 * Lightweight animation player for character sprites with direction-aware frames.
 */
export class CharacterAnimator {
  private loader: AssetLoader;
  private definition: CharacterDefinition;
  private frames: FrameStore = {
    idle: { ne: [], nw: [], se: [], sw: [] },
    run: { ne: [], nw: [], se: [], sw: [] },
  };
  private currentState: CharacterAnimationKey = 'idle';
  private currentDirection: CharacterDirection = 'se';
  private elapsed = 0;
  private ready = false;

  constructor(definition: CharacterDefinition, loader = new AssetLoader()) {
    this.definition = definition;
    this.loader = loader;
  }

  get id(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  get size(): { width: number; height: number } {
    return this.definition.size;
  }

  get anchor(): { x: number; y: number } {
    return this.definition.anchor;
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Preloads all frames declared in the definition.
   */
  async load(): Promise<void> {
    const loadTasks: Promise<void>[] = [];

    Object.values(this.definition.states).forEach((stateConfig) => {
      Object.entries(stateConfig.frames).forEach(([direction, sources]) => {
        const dir = direction as CharacterDirection;
        loadTasks.push(
          Promise.all(sources.map((src) => this.loader.load(src))).then((images) => {
            this.frames[stateConfig.key][dir] = images;
          })
        );
      });
    });

    await Promise.all(loadTasks);
    this.ready = true;
  }

  /**
   * Advance animation time and switch state/direction if requested.
   */
  update(state: CharacterAnimationKey, direction: CharacterDirection, dt: number, speedMultiplier = 1): void {
    if (!this.ready) return;

    if (state !== this.currentState || direction !== this.currentDirection) {
      this.currentState = state;
      this.currentDirection = direction;
      this.elapsed = 0;
      return;
    }

    this.elapsed += dt * speedMultiplier;
  }

  /**
   * Current frame for the active state/direction.
   */
  getCurrentFrame(): HTMLImageElement | null {
    if (!this.ready) return null;

    const stateConfig = this.definition.states[this.currentState];
    const frames = this.frames[this.currentState]?.[this.currentDirection] ?? [];
    if (!stateConfig || frames.length === 0) {
      return null;
    }

    const frameDuration = Math.max(0.01, stateConfig.frameDuration);
    const frameIndex = Math.floor(this.elapsed / frameDuration) % frames.length;
    return frames[frameIndex] ?? null;
  }
}
