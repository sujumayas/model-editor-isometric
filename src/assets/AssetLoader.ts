/**
 * Asset loader for loading images and spritesheets
 */

export interface LoadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export type ProgressCallback = (progress: LoadProgress) => void;

/**
 * Load a single image from a URL
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Load the spritesheet and return the image element
 */
export async function loadSpritesheet(path: string): Promise<HTMLImageElement> {
  return loadImage(path);
}

/**
 * AssetLoader class for managing asset loading with progress tracking
 */
export class AssetLoader {
  private cache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  /**
   * Load an image, using cache if available
   */
  async load(src: string): Promise<HTMLImageElement> {
    // Return cached image if available
    const cached = this.cache.get(src);
    if (cached) {
      return cached;
    }

    // Return existing promise if already loading
    const existing = this.loadingPromises.get(src);
    if (existing) {
      return existing;
    }

    // Start loading
    const promise = loadImage(src).then((img) => {
      this.cache.set(src, img);
      this.loadingPromises.delete(src);
      return img;
    });

    this.loadingPromises.set(src, promise);
    return promise;
  }

  /**
   * Load multiple images with progress callback
   */
  async loadAll(
    sources: string[],
    onProgress?: ProgressCallback
  ): Promise<Map<string, HTMLImageElement>> {
    const total = sources.length;
    let loaded = 0;

    const results = new Map<string, HTMLImageElement>();

    await Promise.all(
      sources.map(async (src) => {
        const img = await this.load(src);
        results.set(src, img);
        loaded++;
        onProgress?.({
          loaded,
          total,
          percent: Math.round((loaded / total) * 100),
        });
      })
    );

    return results;
  }

  /**
   * Get a cached image
   */
  get(src: string): HTMLImageElement | undefined {
    return this.cache.get(src);
  }

  /**
   * Check if an image is cached
   */
  has(src: string): boolean {
    return this.cache.has(src);
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }
}
