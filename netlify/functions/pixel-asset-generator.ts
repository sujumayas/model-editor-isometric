import { randomUUID } from 'crypto';
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
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

const DEFAULT_IMAGE_MODEL = 'gemini-2.0-flash-exp-image-generation';

const requestSchema = z.object({
  prompt: z.string().min(3),
  tileColumns: z.number().int().positive().max(64).default(1),
  tileRows: z.number().int().positive().max(64).default(1),
  tileSize: z.number().int().positive().max(256).optional(),
  palette: z.array(z.string().min(1)).max(16).optional(),
  guidance: z.string().optional(),
  model: z.string().default(DEFAULT_IMAGE_MODEL),
  debug: z.boolean().optional(),
});

export const handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  const requestId = randomUUID();
  let debugEnabled = isDebugEnabled(event);

  if (!event.body) {
    return respond(400, { error: 'Missing request body' }, requestId);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(event.body);
  } catch (error) {
    const debugPayload = debugEnabled
      ? {
          requestId,
          bodyPreview: truncateString(event.body, 800),
        }
      : undefined;
    return respond(
      400,
      { error: 'Invalid JSON body', details: String(error), debug: debugPayload },
      requestId
    );
  }

  debugEnabled = isDebugEnabled(event, payload);

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    const debugPayload = debugEnabled
      ? {
          requestId,
          payloadPreview: truncateString(JSON.stringify(payload), 800),
          validationErrors: parsed.error.flatten(),
        }
      : undefined;
    return respond(400, {
      error: 'Invalid payload',
      details: parsed.error.flatten(),
      debug: debugPayload,
    }, requestId);
  }

  const { prompt, tileColumns, tileRows, palette, guidance } = parsed.data;
  const tileSize = parsed.data.tileSize ?? PIXEL_ASSET_REQUIREMENTS.tileSize;
  const model = parsed.data.model ?? DEFAULT_IMAGE_MODEL;
  const isValidImageModel =
    model.startsWith('gemini-') || model.startsWith('imagen-');
  const effectiveRequirements: PixelAssetRequirements = {
    ...PIXEL_ASSET_REQUIREMENTS,
    tileSize,
  };
  const requestSummary = debugEnabled
    ? summarizeRequest({
        prompt,
        tileColumns,
        tileRows,
        palette,
        guidance,
        tileSize,
        model,
      })
    : undefined;
  if (debugEnabled && requestSummary) {
    logDebug(debugEnabled, requestId, 'Pixel asset request', requestSummary);
  }

  if (!isValidImageModel) {
    const debugPayload = debugEnabled
      ? { requestId, request: requestSummary }
      : undefined;
    return respond(400, {
      error:
        'The requested model does not support image generation. Use a Gemini image model such as gemini-2.0-flash-exp-image-generation.',
      details: { model },
      debug: debugPayload,
    }, requestId);
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
    const debugPayload = debugEnabled
      ? { requestId, request: requestSummary }
      : undefined;
    return respond(500, {
      error: 'Missing GEMINI_API_KEY environment variable for Gemini 3.0',
      debug: debugPayload,
    }, requestId);
  }

  const startedAt = Date.now();
  const geminiResult = await generateImageWithGemini({
    apiKey,
    model,
    prompt: composedPrompt,
    debug: debugEnabled,
    requestId,
  });
  const durationMs = Date.now() - startedAt;
  const debugPayload = debugEnabled
    ? {
        requestId,
        request: requestSummary,
        gemini: geminiResult.debug,
        durationMs,
      }
    : undefined;

  if (!geminiResult.ok) {
    const status =
      geminiResult.status >= 400 && geminiResult.status < 600
        ? geminiResult.status
        : 502;
    return respond(status, {
      error: 'Gemini request failed',
      details: geminiResult.raw,
      debug: debugPayload,
    }, requestId);
  }

  if (!geminiResult.imageBase64) {
    return respond(502, {
      error: 'Gemini did not return image data',
      details: geminiResult.raw,
      debug: debugPayload,
    }, requestId);
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
    debug: debugPayload,
  }, requestId);
};

async function generateImageWithGemini({
  apiKey,
  model,
  prompt,
  debug,
  requestId,
}: {
  apiKey: string;
  model: string;
  prompt: string;
  debug?: boolean;
  requestId?: string;
}): Promise<{
  imageBase64?: string;
  raw: unknown;
  ok: boolean;
  status: number;
  debug?: GeminiDebugInfo;
}> {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  );

  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  const requestBytes = Buffer.byteLength(requestBody);
  const requestStarted = Date.now();
  if (debug && requestId) {
    logDebug(debug, requestId, 'Gemini request', {
      url: url.toString(),
      requestBytes,
      promptLength: prompt.length,
    });
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: requestBody,
  });

  // Read the body once to avoid double-consumption errors when parsing failures occur.
  const bodyText = await response.text();
  const responseTimeMs = Date.now() - requestStarted;
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch (error) {
    parsed = bodyText;
  }
  const geminiDebug = debug
    ? buildGeminiDebugInfo({
        url: url.toString(),
        requestBytes,
        response,
        bodyText,
        parsed,
        responseTimeMs,
      })
    : undefined;

  if (debug && requestId) {
    logDebug(debug, requestId, 'Gemini response summary', geminiDebug);
  }

  if (!response.ok) {
    return {
      raw: parsed,
      ok: false,
      status: response.status,
      debug: geminiDebug,
    };
  }

  // The generateContent endpoint returns candidates with parts containing inline_data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (parsed as any)?.candidates;
  const parts = candidates?.[0]?.content?.parts;
  const imagePart = Array.isArray(parts)
    ? parts.find(
        (part: unknown) =>
          part &&
          typeof part === 'object' &&
          'inlineData' in part &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (part as any).inlineData?.data
      )
    : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageBase64 = (imagePart as any)?.inlineData?.data;

  return {
    imageBase64: typeof imageBase64 === 'string' ? imageBase64 : undefined,
    raw: parsed,
    ok: true,
    status: response.status,
    debug: geminiDebug,
  };
}

function respond(
  statusCode: number,
  payload: unknown,
  requestId?: string
): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...(requestId ? { 'X-Request-Id': requestId } : {}),
    },
    body: JSON.stringify(payload),
  };
}

interface GeminiDebugInfo {
  url: string;
  requestBytes: number;
  responseStatus: number;
  responseStatusText: string;
  responseHeaders: Record<string, string>;
  responseTimeMs: number;
  responseBodyLength: number;
  responseBodyPreview: string;
  parsedType: string;
  responseKeys?: string[];
  imageSummary?: {
    count: number;
    dataSizes: number[];
    inlineDataSizes: number[];
  };
}

function isDebugEnabled(event: HandlerEvent, payload?: unknown): boolean {
  if (isTruthyEnv('DEBUG_GEMINI')) return true;
  if (isTruthyEnv('PIXEL_ASSET_DEBUG')) return true;
  if (isTruthyEnv('DEBUG_PIXEL_ASSET')) return true;

  const headerValue = getHeader(event, 'x-debug') ?? getHeader(event, 'x-debug-gemini');
  if (isTruthy(headerValue)) return true;

  const queryValue = event.queryStringParameters?.debug;
  if (isTruthy(queryValue)) return true;

  const payloadValue = extractDebugFlag(payload);
  return isTruthy(payloadValue);
}

function extractDebugFlag(payload: unknown): string | boolean | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  return record.debug as string | boolean | undefined;
}

function isTruthy(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }
  return false;
}

function isTruthyEnv(key: string): boolean {
  return isTruthy(process.env[key]);
}

function getHeader(
  event: HandlerEvent,
  name: string
): string | undefined {
  if (!event.headers) return undefined;
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(event.headers)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  return undefined;
}

function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...(${value.length} chars)`;
}

function summarizeRequest({
  prompt,
  tileColumns,
  tileRows,
  palette,
  guidance,
  tileSize,
  model,
}: {
  prompt: string;
  tileColumns: number;
  tileRows: number;
  palette?: string[];
  guidance?: string;
  tileSize: number;
  model: string;
}): {
  model: string;
  promptLength: number;
  promptPreview: string;
  tileColumns: number;
  tileRows: number;
  tileSize: number;
  paletteCount: number;
  guidanceLength: number;
} {
  return {
    model,
    promptLength: prompt.length,
    promptPreview: truncateString(prompt, 240),
    tileColumns,
    tileRows,
    tileSize,
    paletteCount: palette?.length ?? 0,
    guidanceLength: guidance?.length ?? 0,
  };
}

function buildGeminiDebugInfo({
  url,
  requestBytes,
  response,
  bodyText,
  parsed,
  responseTimeMs,
}: {
  url: string;
  requestBytes: number;
  response: Response;
  bodyText: string;
  parsed: unknown;
  responseTimeMs: number;
}): GeminiDebugInfo {
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    url,
    requestBytes,
    responseStatus: response.status,
    responseStatusText: response.statusText,
    responseHeaders,
    responseTimeMs,
    responseBodyLength: bodyText.length,
    responseBodyPreview: truncateString(bodyText, 2000),
    parsedType: typeof parsed,
    responseKeys:
      parsed && typeof parsed === 'object'
        ? Object.keys(parsed as Record<string, unknown>)
        : undefined,
    imageSummary: summarizeImagePayload(parsed),
  };
}

function summarizeImagePayload(parsed: unknown): GeminiDebugInfo['imageSummary'] {
  if (!parsed || typeof parsed !== 'object') return undefined;

  // Handle generateContent API format: candidates[].content.parts[].inlineData
  const candidates = (parsed as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return undefined;

  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content?.parts;
  if (!Array.isArray(parts)) return undefined;

  const inlineDataSizes = parts
    .filter(
      (part) =>
        part && typeof part === 'object' && 'inlineData' in part
    )
    .map((part) => {
      const data = (part as { inlineData?: { data?: unknown } }).inlineData?.data;
      return typeof data === 'string' ? data.length : 0;
    });

  return {
    count: inlineDataSizes.length,
    dataSizes: [],
    inlineDataSizes,
  };
}

function logDebug(
  enabled: boolean | undefined,
  requestId: string,
  message: string,
  data?: unknown
): void {
  if (!enabled) return;
  if (data !== undefined) {
    console.log(`[pixel-asset:${requestId}] ${message}`, data);
    return;
  }
  console.log(`[pixel-asset:${requestId}] ${message}`);
}
