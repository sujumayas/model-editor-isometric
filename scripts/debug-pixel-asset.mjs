#!/usr/bin/env node
import { writeFile } from 'fs/promises';

const options = parseArgs(process.argv.slice(2));

if (options.help || options.h) {
  printUsage();
  process.exit(0);
}

const prompt = options.prompt ?? process.env.PIXEL_ASSET_PROMPT;
if (!prompt) {
  console.error('Missing required --prompt.');
  printUsage();
  process.exit(1);
}

const endpoint =
  options.endpoint ??
  process.env.PIXEL_ASSET_ENDPOINT ??
  'http://localhost:8888/.netlify/functions/pixel-asset-generator';
const tileColumns = parseIntOption(options.columns ?? options.cols, 1);
const tileRows = parseIntOption(options.rows, 1);
const tileSize = parseIntOption(options['tile-size'], undefined);
const model = options.model ?? process.env.PIXEL_ASSET_MODEL;
const palette = options.palette ? parsePalette(options.palette) : undefined;
const guidance = options.guidance ?? undefined;
const debug = isTruthy(options.debug) || isTruthy(process.env.PIXEL_ASSET_DEBUG);
const outFile = options.out ?? options.output ?? undefined;

const payload = {
  prompt,
  tileColumns,
  tileRows,
  tileSize,
  palette,
  guidance,
  model,
  debug: debug || undefined,
};

const requestUrl = new URL(endpoint);
if (debug) {
  requestUrl.searchParams.set('debug', '1');
}

const response = await fetch(requestUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(debug ? { 'x-debug': '1' } : {}),
  },
  body: JSON.stringify(payload),
});

const text = await response.text();
let data;
try {
  data = JSON.parse(text);
} catch (error) {
  data = text;
}

if (!response.ok) {
  console.error(`Request failed (${response.status}).`);
  console.error(formatOutput(data));
  process.exit(1);
}

console.log(`Status: ${response.status}`);
if (data && typeof data === 'object') {
  const modelName = data.model ? `Model: ${data.model}` : undefined;
  const sheet = data.sheet
    ? `Sheet: ${data.sheet.columns}x${data.sheet.rows} (${data.sheet.width}x${data.sheet.height})`
    : undefined;
  if (modelName) console.log(modelName);
  if (sheet) console.log(sheet);
}

if (data?.debug) {
  console.log('Debug info:');
  console.log(formatOutput(data.debug));
}

if (outFile && data?.imageBase64) {
  const buffer = Buffer.from(data.imageBase64, 'base64');
  await writeFile(outFile, buffer);
  console.log(`Saved image: ${outFile} (${buffer.length} bytes)`);
} else if (outFile) {
  console.warn('No image data returned; skipping save.');
}

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    i += 1;
  }
  return result;
}

function parseIntOption(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parsePalette(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isTruthy(value) {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  }
  return false;
}

function formatOutput(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function printUsage() {
  console.log(`
Usage:
  node scripts/debug-pixel-asset.mjs --prompt "..." [options]

Options:
  --endpoint   Function URL (default: http://localhost:8888/.netlify/functions/pixel-asset-generator)
  --columns    Tile columns (default: 1)
  --rows       Tile rows (default: 1)
  --tile-size  Tile size override (optional)
  --palette    Comma-separated palette list
  --guidance   Extra guidance text
  --model      Gemini/Imagen model name
  --debug      Enable verbose debug output
  --out        Save PNG to a file path

Env:
  PIXEL_ASSET_PROMPT
  PIXEL_ASSET_ENDPOINT
  PIXEL_ASSET_MODEL
  PIXEL_ASSET_DEBUG
`);
}
