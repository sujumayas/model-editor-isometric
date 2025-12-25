/**
 * Isometric Level Editor - Entry Point
 *
 * This is the main entry point that initializes all editor systems
 * and starts the application.
 */

import { TileRegistry } from './assets/TileRegistry';
import { Editor } from './editor/Editor';
import { TilePalette } from './ui/TilePalette';
import { LayerPanel } from './ui/LayerPanel';
import { Toolbar } from './ui/Toolbar';
import { StatusBar } from './ui/StatusBar';
import { loadFromLocalStorage } from './level/LevelSerializer';

// Global reference to editor for debugging
declare global {
  interface Window {
    editor: Editor;
  }
}

/**
 * Main initialization function
 */
async function init(): Promise<void> {
  console.log('Initializing Isometric Level Editor...');

  // Show loading state
  const loadingEl = document.createElement('div');
  loadingEl.id = 'loading';
  loadingEl.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 18px;
    color: #4a9eff;
    z-index: 1000;
  `;
  loadingEl.textContent = 'Loading assets...';
  document.body.appendChild(loadingEl);

  try {
    // Initialize tile registry (loads spritesheet)
    const tileRegistry = new TileRegistry();
    await tileRegistry.initialize();
    console.log(`Loaded ${tileRegistry.getTileCount()} tiles`);

    // Initialize editor
    const editor = new Editor(
      {
        canvas: '#editor-canvas',
        container: '#canvas-container',
      },
      tileRegistry
    );

    // Try to load from localStorage
    const hasStoredLevel = editor.loadFromStorage();
    if (hasStoredLevel) {
      console.log('Loaded level from localStorage');
    } else {
      console.log('Created new default level');
    }

    // Initialize UI components
    const toolbar = new Toolbar('toolbar', editor);
    const layerPanel = new LayerPanel('layer-list', editor);
    const tilePalette = new TilePalette('tile-palette', editor, tileRegistry);
    const statusBar = new StatusBar(editor);

    // Select first tile by default
    tilePalette.selectTile(0);

    // Start render loop
    editor.start();

    // Expose editor globally for debugging
    window.editor = editor;

    // Remove loading indicator
    loadingEl.remove();

    console.log('Editor initialized successfully!');
    console.log('Controls:');
    console.log('  - Click to place tiles');
    console.log('  - B: Brush tool');
    console.log('  - E: Eraser tool');
    console.log('  - Ctrl+Z: Undo');
    console.log('  - Ctrl+Y/Ctrl+Shift+Z: Redo');
    console.log('  - Ctrl+S: Save to localStorage');
    console.log('  - Mouse wheel: Zoom');
  } catch (error) {
    console.error('Failed to initialize editor:', error);
    loadingEl.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    loadingEl.style.color = '#ff4a4a';
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
