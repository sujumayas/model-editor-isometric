/**
 * Toolbar UI component
 */

import { ToolType } from '../core/types';
import { Editor } from '../editor/Editor';

interface ToolButton {
  type: ToolType;
  name: string;
  icon: string;
  shortcut: string;
}

const TOOL_BUTTONS: ToolButton[] = [
  { type: 'brush', name: 'Brush', icon: '🖌️', shortcut: 'B' },
  { type: 'eraser', name: 'Eraser', icon: '🧹', shortcut: 'E' },
];

/**
 * Toolbar displays tool selection buttons
 */
export class Toolbar {
  private container: HTMLElement;
  private editor: Editor;
  private buttonElements = new Map<ToolType, HTMLElement>();
  private fileInput: HTMLInputElement;

  constructor(containerId: string, editor: Editor) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    this.container = container;
    this.editor = editor;
    this.fileInput = this.createFileInput();

    this.render();
    this.container.appendChild(this.fileInput);
    this.setupEventListeners();
  }

  /**
   * Render the toolbar
   */
  private render(): void {
    this.container.innerHTML = '';

    for (const tool of TOOL_BUTTONS) {
      const btn = this.createToolButton(tool);
      this.buttonElements.set(tool.type, btn);
      this.container.appendChild(btn);
    }

    // Add separator
    const separator = document.createElement('div');
    separator.style.cssText = 'width: 1px; height: 24px; background: #0f3460; margin: 0 8px;';
    this.container.appendChild(separator);

    // Add action buttons
    this.addActionButton('💾', 'Save (Ctrl+S)', () => {
      this.editor.saveToStorage();
    });

    this.addActionButton('📂', 'Import JSON', () => {
      this.fileInput.click();
    });

    this.addActionButton('⬇️', 'Download JSON', () => {
      this.editor.downloadLevel();
    });

    this.addActionButton('↩️', 'Undo (Ctrl+Z)', () => {
      this.editor.history.undo();
    });

    this.addActionButton('↪️', 'Redo (Ctrl+Y)', () => {
      this.editor.history.redo();
    });

    // Update active state
    this.updateActiveButton();
  }

  /**
   * Create a tool button element
   */
  private createToolButton(tool: ToolButton): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.dataset.tool = tool.type;
    btn.title = `${tool.name} (${tool.shortcut})`;
    btn.textContent = `${tool.icon} ${tool.name}`;

    return btn;
  }

  /**
   * Add an action button
   */
  private addActionButton(icon: string, title: string, onClick: () => void): void {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.title = title;
    btn.textContent = icon;
    btn.addEventListener('click', onClick);
    this.container.appendChild(btn);
  }

  /**
   * Create a hidden file input for JSON import
   */
  private createFileInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.style.display = 'none';
    input.addEventListener('change', this.handleFileInputChange);
    return input;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Tool button clicks
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.tool-btn[data-tool]') as HTMLElement | null;

      if (btn && btn.dataset.tool) {
        this.editor.setTool(btn.dataset.tool as ToolType);
      }
    });

    // Listen for tool changes
    this.editor.state.on('tool:changed', () => {
      this.updateActiveButton();
    });
  }

  /**
   * Handle file input changes for importing JSON
   */
  private handleFileInputChange = async (): Promise<void> => {
    const file = this.fileInput.files?.[0];
    if (!file) return;

    try {
      await this.editor.loadLevelFromFile(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      window.alert(`Failed to import level: ${message}`);
    } finally {
      // Reset the input so the same file can be selected again
      this.fileInput.value = '';
    }
  };

  /**
   * Update active button state
   */
  private updateActiveButton(): void {
    const activeTool = this.editor.state.activeTool;

    this.buttonElements.forEach((btn, type) => {
      if (type === activeTool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}
