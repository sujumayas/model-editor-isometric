import {
  PIXEL_ASSET_REQUIREMENTS,
  buildPixelAssetPrompt,
  type PixelAssetRequirements,
  type PixelAssetSheetMeta,
} from './PixelAssetRequirements';

export interface PixelAssetRequest {
  prompt: string;
  tileColumns?: number;
  tileRows?: number;
  palette?: string[];
  guidance?: string;
  model?: string;
  endpoint?: string;
}

export interface PixelAssetResponse {
  imageBase64: string;
  mimeType: string;
  fileName: string;
  sheet: PixelAssetSheetMeta;
  prompt: string;
  model: string;
  requirements: PixelAssetRequirements;
}

export async function generatePixelAsset(
  request: PixelAssetRequest,
  fetchImpl: typeof fetch = fetch
): Promise<PixelAssetResponse> {
  const tileColumns = request.tileColumns ?? 1;
  const tileRows = request.tileRows ?? 1;
  const endpoint =
    request.endpoint ?? '/.netlify/functions/pixel-asset-generator';

  const payload = {
    prompt: request.prompt,
    tileColumns,
    tileRows,
    tileSize: PIXEL_ASSET_REQUIREMENTS.tileSize,
    palette: request.palette,
    guidance: request.guidance,
    model: request.model,
  };

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Pixel asset generation failed (${response.status}): ${message}`
    );
  }

  const data = (await response.json()) as PixelAssetResponse;
  return data;
}

export function previewPixelAssetPrompt(request: PixelAssetRequest): string {
  return buildPixelAssetPrompt({
    basePrompt: request.prompt,
    tileColumns: request.tileColumns ?? 1,
    tileRows: request.tileRows ?? 1,
    palette: request.palette,
    guidance: request.guidance,
  });
}
