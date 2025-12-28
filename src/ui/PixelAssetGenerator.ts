import {
  PIXEL_ASSET_REQUIREMENTS,
  describeUploadReadiness,
} from '@assets/pixel/PixelAssetRequirements';
import {
  generatePixelAsset,
  previewPixelAssetPrompt,
  type PixelAssetResponse,
} from '@assets/pixel/PixelAssetGeneratorClient';

interface PixelGeneratorState {
  prompt: string;
  tileColumns: number;
  tileRows: number;
  palette: string;
  guidance: string;
  model: string;
}

export class PixelAssetGenerator {
  private controls: HTMLElement;
  private output: HTMLElement;

  private promptInput: HTMLTextAreaElement;
  private columnsInput: HTMLInputElement;
  private rowsInput: HTMLInputElement;
  private paletteInput: HTMLInputElement;
  private guidanceInput: HTMLTextAreaElement;
  private modelInput: HTMLInputElement;
  private statusEl: HTMLElement;
  private previewEl: HTMLPreElement;
  private resultImage: HTMLImageElement;
  private resultMeta: HTMLElement;
  private downloadLink: HTMLAnchorElement;
  private generateBtn: HTMLButtonElement;

  private state: PixelGeneratorState = {
    prompt: 'lush mossy cliff edges with small waterfalls and glowing mushrooms',
    tileColumns: 3,
    tileRows: 3,
    palette: 'emerald, moss green, slate gray, misty blue',
    guidance: 'soft rim light from the top-left, keep silhouettes readable',
    model: 'imagen-3.0-generate-001',
  };

  constructor(controlsId: string, outputId: string) {
    const controls = document.getElementById(controlsId);
    const output = document.getElementById(outputId);
    if (!controls || !output) {
      throw new Error('PixelAssetGenerator mounts require valid container ids');
    }

    this.controls = controls;
    this.output = output;

    this.promptInput = document.createElement('textarea');
    this.columnsInput = document.createElement('input');
    this.rowsInput = document.createElement('input');
    this.paletteInput = document.createElement('input');
    this.guidanceInput = document.createElement('textarea');
    this.modelInput = document.createElement('input');
    this.statusEl = document.createElement('div');
    this.previewEl = document.createElement('pre');
    this.resultImage = document.createElement('img');
    this.resultMeta = document.createElement('div');
    this.downloadLink = document.createElement('a');
    this.generateBtn = document.createElement('button');

    this.renderControls();
    this.renderOutput();
    this.updatePromptPreview();
  }

  private renderControls(): void {
    this.controls.innerHTML = '';

    this.controls.appendChild(this.renderRequirements());
    this.controls.appendChild(this.renderPromptGroup());
    this.controls.appendChild(this.renderLayoutGroup());
    this.controls.appendChild(this.renderPaletteGroup());
    this.controls.appendChild(this.renderGuidanceGroup());
    this.controls.appendChild(this.renderModelGroup());
    this.controls.appendChild(this.renderActions());
    this.controls.appendChild(this.renderPromptPreview());
  }

  private renderRequirements(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Requirements';

    const list = document.createElement('ul');
    list.className = 'pixel-req-list';
    list.innerHTML = `
      <li>${PIXEL_ASSET_REQUIREMENTS.tileSize}px transparent PNG tiles</li>
      <li>No padding or gutters (sheet ${PIXEL_ASSET_REQUIREMENTS.recommendedColumns} columns recommended)</li>
      <li>Pixel-perfect edges, ${PIXEL_ASSET_REQUIREMENTS.pixelRatio}:1 pixel ratio</li>
      <li>${PIXEL_ASSET_REQUIREMENTS.description}</li>
    `;

    group.appendChild(label);
    group.appendChild(list);
    return group;
  }

  private renderPromptGroup(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Subject prompt';

    this.promptInput.name = 'pixel-prompt';
    this.promptInput.value = this.state.prompt;
    this.promptInput.rows = 3;
    this.promptInput.placeholder = 'Describe the tiles you want generated...';
    this.promptInput.addEventListener('input', () => {
      this.state.prompt = this.promptInput.value;
      this.updatePromptPreview();
    });

    const hint = document.createElement('div');
    hint.className = 'control-meta';
    hint.textContent = 'Keep it concise; lighting + material cues help.';

    group.appendChild(label);
    group.appendChild(this.promptInput);
    group.appendChild(hint);
    return group;
  }

  private renderLayoutGroup(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Sheet layout';

    const row = document.createElement('div');
    row.className = 'control-row';

    this.columnsInput.type = 'number';
    this.columnsInput.min = '1';
    this.columnsInput.max = '64';
    this.columnsInput.value = String(this.state.tileColumns);
    this.columnsInput.className = 'input number';
    this.columnsInput.addEventListener('input', () => {
      this.state.tileColumns = this.parseIntWithFloor(this.columnsInput.value, 1);
      this.columnsInput.value = String(this.state.tileColumns);
      this.updatePromptPreview();
    });

    this.rowsInput.type = 'number';
    this.rowsInput.min = '1';
    this.rowsInput.max = '64';
    this.rowsInput.value = String(this.state.tileRows);
    this.rowsInput.className = 'input number';
    this.rowsInput.addEventListener('input', () => {
      this.state.tileRows = this.parseIntWithFloor(this.rowsInput.value, 1);
      this.rowsInput.value = String(this.state.tileRows);
      this.updatePromptPreview();
    });

    const columnsLabel = document.createElement('label');
    columnsLabel.textContent = 'Columns';
    columnsLabel.className = 'input-label';
    columnsLabel.appendChild(this.columnsInput);

    const rowsLabel = document.createElement('label');
    rowsLabel.textContent = 'Rows';
    rowsLabel.className = 'input-label';
    rowsLabel.appendChild(this.rowsInput);

    row.appendChild(columnsLabel);
    row.appendChild(rowsLabel);

    const meta = document.createElement('div');
    meta.className = 'control-meta';
    meta.textContent = `Recommended: ${PIXEL_ASSET_REQUIREMENTS.recommendedColumns} columns; up to ${PIXEL_ASSET_REQUIREMENTS.maxTilesPerSheet} tiles.`;

    group.appendChild(label);
    group.appendChild(row);
    group.appendChild(meta);
    return group;
  }

  private renderPaletteGroup(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Palette bias (optional)';

    this.paletteInput.type = 'text';
    this.paletteInput.value = this.state.palette;
    this.paletteInput.className = 'input';
    this.paletteInput.placeholder = 'Comma-separated colors, e.g. copper, tarnished gold, basalt gray';
    this.paletteInput.addEventListener('input', () => {
      this.state.palette = this.paletteInput.value;
      this.updatePromptPreview();
    });

    const meta = document.createElement('div');
    meta.className = 'control-meta';
    meta.textContent = 'Used as a gentle hint; leave blank to let the model pick.';

    group.appendChild(label);
    group.appendChild(this.paletteInput);
    group.appendChild(meta);
    return group;
  }

  private renderGuidanceGroup(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Guidance (optional)';

    this.guidanceInput.rows = 2;
    this.guidanceInput.className = 'input';
    this.guidanceInput.value = this.state.guidance;
    this.guidanceInput.placeholder = 'Lighting, polish, animation hints...';
    this.guidanceInput.addEventListener('input', () => {
      this.state.guidance = this.guidanceInput.value;
      this.updatePromptPreview();
    });

    group.appendChild(label);
    group.appendChild(this.guidanceInput);
    return group;
  }

  private renderModelGroup(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Model (optional)';

    this.modelInput.type = 'text';
    this.modelInput.value = this.state.model;
    this.modelInput.className = 'input';
    this.modelInput.placeholder = 'imagen-3.0-generate-001';
    this.modelInput.addEventListener('input', () => {
      this.state.model = this.modelInput.value;
    });

    const meta = document.createElement('div');
    meta.className = 'control-meta';
    meta.textContent = 'Defaults to the Gemini 3.0 model configured in the Netlify function.';

    group.appendChild(label);
    group.appendChild(this.modelInput);
    group.appendChild(meta);
    return group;
  }

  private renderActions(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Generate';

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'tool-btn full-width';
    previewBtn.textContent = 'Refresh prompt preview';
    previewBtn.addEventListener('click', () => this.updatePromptPreview());

    this.generateBtn.type = 'button';
    this.generateBtn.className = 'tool-btn full-width';
    this.generateBtn.textContent = 'Call generator';
    this.generateBtn.addEventListener('click', () => void this.generate());

    this.statusEl.className = 'control-meta pixel-status';
    this.setStatus('Ready to call Netlify function.');

    buttons.appendChild(previewBtn);
    buttons.appendChild(this.generateBtn);

    group.appendChild(label);
    group.appendChild(buttons);
    group.appendChild(this.statusEl);
    return group;
  }

  private renderPromptPreview(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'control-group';

    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Composed prompt';

    this.previewEl.className = 'prompt-preview';
    this.previewEl.textContent = 'Add a prompt to preview the composed instructions.';

    group.appendChild(label);
    group.appendChild(this.previewEl);
    return group;
  }

  private renderOutput(): void {
    this.output.innerHTML = '';
    this.output.classList.add('pixel-output');

    const header = document.createElement('div');
    header.className = 'pixel-output-header';
    header.innerHTML = `
      <div>
        <h3>Pixel Asset Generator</h3>
        <p>Create tile sheets via the Netlify Gemini function and download the PNG output.</p>
      </div>
      <div class="pixel-output-meta">
        <span>${PIXEL_ASSET_REQUIREMENTS.tileSize}x${PIXEL_ASSET_REQUIREMENTS.tileSize}px tiles</span>
        <span>Transparent PNG</span>
        <span>No padding</span>
      </div>
    `;

    const content = document.createElement('div');
    content.className = 'pixel-output-content';

    const resultCard = document.createElement('div');
    resultCard.className = 'pixel-card';

    const previewFrame = document.createElement('div');
    previewFrame.className = 'pixel-preview-frame';

    this.resultImage.className = 'pixel-preview-image';
    this.resultImage.alt = 'Generated pixel sheet preview';

    previewFrame.appendChild(this.resultImage);

    const resultBody = document.createElement('div');
    resultBody.className = 'pixel-card-body';

    this.resultMeta.className = 'pixel-meta';
    this.resultMeta.textContent = 'Run the generator to see sheet metadata and download links.';

    this.downloadLink.className = 'tool-btn small';
    this.downloadLink.textContent = 'Download PNG';
    this.downloadLink.style.display = 'none';

    resultBody.appendChild(this.resultMeta);
    resultBody.appendChild(this.downloadLink);

    resultCard.appendChild(previewFrame);
    resultCard.appendChild(resultBody);

    content.appendChild(resultCard);

    this.output.appendChild(header);
    this.output.appendChild(content);
  }

  private async generate(): Promise<void> {
    const palette = this.parsePalette(this.state.palette);
    const prompt = this.state.prompt.trim();

    if (!prompt) {
      this.setStatus('Please enter a subject prompt.', true);
      return;
    }

    this.toggleLoading(true);
    this.setStatus('Calling Netlify pixel asset generator...');

    try {
      const response = await generatePixelAsset({
        prompt,
        tileColumns: this.state.tileColumns,
        tileRows: this.state.tileRows,
        palette,
        guidance: this.state.guidance || undefined,
        model: this.state.model || undefined,
      });
      this.renderResult(response);
      this.setStatus(response.notes ?? 'Generation complete.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown generation error';
      this.setStatus(`Generation failed: ${message}`, true);
    } finally {
      this.toggleLoading(false);
    }
  }

  private renderResult(response: PixelAssetResponse): void {
    const dataUrl = `data:${response.mimeType};base64,${response.imageBase64}`;
    this.resultImage.src = dataUrl;
    this.resultImage.style.display = 'block';

    this.downloadLink.href = dataUrl;
    this.downloadLink.download = response.fileName;
    this.downloadLink.style.display = 'inline-flex';

    const readiness = describeUploadReadiness(
      response.sheet,
      response.requirements
    );

    this.resultMeta.innerHTML = `
      <div><strong>Model:</strong> ${response.model}</div>
      <div><strong>Sheet:</strong> ${response.sheet.columns} x ${response.sheet.rows} tiles (${response.sheet.width}x${response.sheet.height}px)</div>
      <div><strong>Prompt:</strong> ${response.prompt}</div>
      <div><strong>Notes:</strong> ${response.notes ?? readiness}</div>
    `;
  }

  private updatePromptPreview(): void {
    const palette = this.parsePalette(this.state.palette);
    if (!this.state.prompt.trim()) {
      this.previewEl.textContent =
        'Add a subject prompt to see the composed Gemini request.';
      return;
    }

    const composed = previewPixelAssetPrompt({
      prompt: this.state.prompt,
      tileColumns: this.state.tileColumns,
      tileRows: this.state.tileRows,
      palette,
      guidance: this.state.guidance || undefined,
    });
    this.previewEl.textContent = composed;
  }

  private parsePalette(value: string): string[] | undefined {
    const parts = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }

  private parseIntWithFloor(value: string, min: number): number {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return min;
    return Math.max(min, Math.min(64, parsed));
  }

  private setStatus(message: string, isError = false): void {
    this.statusEl.textContent = message;
    this.statusEl.classList.toggle('error', isError);
  }

  private toggleLoading(loading: boolean): void {
    this.generateBtn.disabled = loading;
    this.generateBtn.textContent = loading ? 'Generating...' : 'Call generator';
  }
}
