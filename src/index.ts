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
import { ViewControls } from './ui/ViewControls';
import { MapControls } from './ui/MapControls';
import { loadFromLocalStorage } from './level/LevelSerializer';
import { MovementTester } from './movement/MovementTester';
import { MovementControls } from './ui/MovementControls';

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
        container: '#canvas-stack',
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
    const viewControls = new ViewControls('view-controls', editor);
    const mapControls = new MapControls('map-controls', editor);
    const layerPanel = new LayerPanel('layer-list', editor);
    const tilePalette = new TilePalette('tile-palette', editor, tileRegistry);
    const statusBar = new StatusBar(editor);
    const movementTester = new MovementTester(
      {
        canvas: '#movement-canvas',
        container: '#canvas-stack',
        tileRegistry,
      }
    );
    const movementControls = new MovementControls('movement-controls', movementTester, editor);

    // Select first tile by default
    tilePalette.selectTile(0);

    // Start render loop
    editor.start();
    movementTester.start();

    setupCanvasToggle();

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

function setupCanvasToggle(): void {
  const toggle = document.getElementById('canvas-mode-toggle');
  const sidebarTabs = document.getElementById('sidebar-tabs');
  const editorCanvas = document.getElementById('editor-canvas');
  const movementCanvas = document.getElementById('movement-canvas');
  const editorPane = document.getElementById('editor-pane');
  const movementPane = document.getElementById('movement-pane');

  if (!toggle || !editorCanvas || !movementCanvas || !sidebarTabs || !editorPane || !movementPane) return;

  toggle.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button[data-canvas]') as HTMLButtonElement | null;
    if (!btn) return;

    const mode = btn.dataset.canvas;
    if (mode === 'editor') {
      editorCanvas.classList.remove('inactive');
      movementCanvas.classList.add('inactive');
      editorPane.classList.add('active');
      movementPane.classList.remove('active');
    } else if (mode === 'movement') {
      movementCanvas.classList.remove('inactive');
      editorCanvas.classList.add('inactive');
      movementPane.classList.add('active');
      editorPane.classList.remove('active');
    }

    toggle.querySelectorAll('button[data-canvas]').forEach((button) => {
      button.classList.toggle('active', (button as HTMLButtonElement).dataset.canvas === mode);
    });

    sidebarTabs.querySelectorAll('button[data-pane]').forEach((button) => {
      const paneId = (button as HTMLButtonElement).dataset.pane;
      const isActive = paneId === `${mode}-pane`;
      button.classList.toggle('active', isActive);
    });
  });

  sidebarTabs.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button[data-pane]') as HTMLButtonElement | null;
    if (!btn) return;

    const pane = btn.dataset.pane;
    if (pane === 'editor-pane') {
      editorCanvas.classList.remove('inactive');
      movementCanvas.classList.add('inactive');
      editorPane.classList.add('active');
      movementPane.classList.remove('active');
      toggle.querySelector('button[data-canvas="editor"]')?.classList.add('active');
      toggle.querySelector('button[data-canvas="movement"]')?.classList.remove('active');
    } else if (pane === 'movement-pane') {
      movementCanvas.classList.remove('inactive');
      editorCanvas.classList.add('inactive');
      movementPane.classList.add('active');
      editorPane.classList.remove('active');
      toggle.querySelector('button[data-canvas="movement"]')?.classList.add('active');
      toggle.querySelector('button[data-canvas="editor"]')?.classList.remove('active');
    }
  });
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
