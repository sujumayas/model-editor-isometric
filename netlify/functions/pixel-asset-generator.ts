import { z } from 'zod';

import {
  PIXEL_ASSET_REQUIREMENTS,
  buildPixelAssetPrompt,
  describeUploadReadiness,
  type PixelAssetRequirements,
  type PixelAssetSheetMeta,
} from '../../src/assets/pixel/PixelAssetRequirements';

interface HandlerEvent {
  body: string | null;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

const DEFAULT_IMAGE_MODEL = 'imagen-3.0-generate-001';

const requestSchema = z.object({
  prompt: z.string().min(3),
  tileColumns: z.number().int().positive().max(64).default(1),
  tileRows: z.number().int().positive().max(64).default(1),
  tileSize: z.number().int().positive().max(256).optional(),
  palette: z.array(z.string().min(1)).max(16).optional(),
  guidance: z.string().optional(),
  model: z.string().default(DEFAULT_IMAGE_MODEL),
});

export const handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  if (!event.body) {
    return respond(400, { error: 'Missing request body' });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(event.body);
  } catch (error) {
    return respond(400, { error: 'Invalid JSON body', details: String(error) });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return respond(400, {
      error: 'Invalid payload',
      details: parsed.error.flatten(),
    });
  }

  const { prompt, tileColumns, tileRows, palette, guidance } = parsed.data;
  const tileSize = parsed.data.tileSize ?? PIXEL_ASSET_REQUIREMENTS.tileSize;
  const model = parsed.data.model ?? DEFAULT_IMAGE_MODEL;
  const effectiveRequirements: PixelAssetRequirements = {
    ...PIXEL_ASSET_REQUIREMENTS,
    tileSize,
  };

  if (model.startsWith('gemini-3.')) {
    return respond(400, {
      error:
        'The selected Gemini 3.0 model only supports text responses. Use an image-capable model such as imagen-3.0-generate-001 (default) or gemini-1.5-flash-latest.',
      details: { model },
    });
  }

  const composedPrompt = buildPixelAssetPrompt(
    {
      basePrompt: prompt,
      tileColumns,
      tileRows,
      palette,
      guidance,
    },
    effectiveRequirements
  );

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return respond(500, {
      error: 'Missing GEMINI_API_KEY environment variable for Gemini 3.0',
    });
  }

  const geminiResult = await generateImageWithGemini({
    apiKey,
    model,
    prompt: composedPrompt,
  });

  if (!geminiResult.ok) {
    const status =
      geminiResult.status >= 400 && geminiResult.status < 600
        ? geminiResult.status
        : 502;
    return respond(status, {
      error: 'Gemini request failed',
      details: geminiResult.raw,
    });
  }

  if (!geminiResult.imageBase64) {
    return respond(502, {
      error: 'Gemini did not return image data',
      details: geminiResult.raw,
    });
  }

  const sheet: PixelAssetSheetMeta = {
    columns: tileColumns,
    rows: tileRows,
    width: tileColumns * tileSize,
    height: tileRows * tileSize,
    tileSize,
    tilePadding: effectiveRequirements.tilePadding,
  };

  return respond(200, {
    imageBase64: geminiResult.imageBase64,
    mimeType: effectiveRequirements.fileFormat,
    fileName: `pixel-asset-${Date.now()}.png`,
    sheet,
    prompt: composedPrompt,
    model,
    requirements: effectiveRequirements,
    notes: describeUploadReadiness(sheet, effectiveRequirements),
  });
};

async function generateImageWithGemini({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<{ imageBase64?: string; raw: unknown; ok: boolean; status: number }> {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  );
  url.searchParams.set('key', apiKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'image/png' },
    }),
  });

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (error) {
    parsed = await response.text();
  }

  if (!response.ok) {
    return { raw: parsed, ok: false, status: response.status };
  }

  const imagePart =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (parsed as any)?.candidates?.[0]?.content?.parts?.find(
      (part: unknown) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (part as any).inlineData?.data || (part as any).inline_data?.data
    );

  const imageBase64 =
    imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;

  return {
    imageBase64: typeof imageBase64 === 'string' ? imageBase64 : undefined,
    raw: parsed,
    ok: true,
    status: response.status,
  };
}

function respond(statusCode: number, payload: unknown): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(payload),
  };
}
