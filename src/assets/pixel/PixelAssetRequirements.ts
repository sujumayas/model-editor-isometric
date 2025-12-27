import { TILE_HEIGHT, TILE_WIDTH } from '@core/constants';

export interface PixelAssetRequirements {
  tileSize: number;
  transparentBackground: boolean;
  avoidSolidBlack: boolean;
  pixelRatio: number;
  tilePadding: number;
  recommendedColumns: number;
  maxTilesPerSheet: number;
  fileFormat: 'image/png';
  description: string;
}

export interface PixelAssetSheetMeta {
  columns: number;
  rows: number;
  width: number;
  height: number;
  tileSize: number;
  tilePadding: number;
}

export interface PixelAssetPromptInput {
  basePrompt: string;
  tileColumns: number;
  tileRows: number;
  palette?: string[];
  guidance?: string;
}

export const PIXEL_ASSET_REQUIREMENTS: PixelAssetRequirements = {
  tileSize: TILE_WIDTH,
  transparentBackground: true,
  avoidSolidBlack: true,
  pixelRatio: 1,
  tilePadding: 0,
  recommendedColumns: 11,
  maxTilesPerSheet: 121,
  fileFormat: 'image/png',
  description:
    '32x32px per tile, transparent PNG, pixel-perfect edges, no gutters or drop shadows.',
};

export function buildPixelAssetPrompt(
  input: PixelAssetPromptInput,
  requirements: PixelAssetRequirements = PIXEL_ASSET_REQUIREMENTS
): string {
  const sheetWidth = input.tileColumns * requirements.tileSize;
  const sheetHeight = input.tileRows * requirements.tileSize;
  const paletteLine =
    input.palette && input.palette.length > 0
      ? `Palette bias (keep subtle): ${input.palette.join(', ')}`
      : undefined;

  const notes: string[] = [
    'Create pixel-art tiles for an isometric level editor.',
    `Sheet layout: ${input.tileColumns} columns x ${input.tileRows} rows (${sheetWidth}x${sheetHeight}px total).`,
    `Tile size: ${requirements.tileSize}px square, ${requirements.pixelRatio}:1 pixel ratio, no sub-pixel antialiasing.`,
    'Background: fully transparent. Avoid solid black fill outside shapes.',
    'No gutters, spacing, drop shadows, or outer glows. Keep pixels aligned to the grid.',
    'Lighting: gentle top-left light, crisp 1px highlights, strong silhouettes.',
    'Preserve alpha edges so tiles can stack seamlessly in a 32x32 grid.',
    paletteLine,
    input.guidance,
    `Subject/style: ${input.basePrompt}`,
  ].filter(Boolean) as string[];

  return notes.join('\n');
}

export function validateSheetMeta(
  meta: PixelAssetSheetMeta,
  requirements: PixelAssetRequirements = PIXEL_ASSET_REQUIREMENTS
): boolean {
  const columnsFromWidth = meta.width / requirements.tileSize;
  const rowsFromHeight = meta.height / requirements.tileSize;
  const tileMultiple =
    Number.isInteger(columnsFromWidth) && Number.isInteger(rowsFromHeight);

  const tileCount = meta.columns * meta.rows;
  return (
    meta.tileSize === requirements.tileSize &&
    meta.tilePadding === requirements.tilePadding &&
    tileMultiple &&
    tileCount <= requirements.maxTilesPerSheet
  );
}

export function inferSheetFromDimensions(
  width: number,
  height: number,
  tileSize: number = TILE_HEIGHT
): PixelAssetSheetMeta | null {
  if (width % tileSize !== 0 || height % tileSize !== 0) {
    return null;
  }

  const columns = width / tileSize;
  const rows = height / tileSize;

  return {
    columns,
    rows,
    width,
    height,
    tileSize,
    tilePadding: 0,
  };
}

export function describeUploadReadiness(
  meta: PixelAssetSheetMeta,
  requirements: PixelAssetRequirements = PIXEL_ASSET_REQUIREMENTS
): string {
  const validity = validateSheetMeta(meta, requirements)
    ? 'Ready for upload'
    : 'Needs resizing or trimming';

  return `${validity}: ${meta.columns}x${meta.rows} tiles @ ${meta.tileSize}px (transparent PNG, no padding).`;
}
