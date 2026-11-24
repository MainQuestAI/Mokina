import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_URL_RE = /data:([^;"'\s)]+);base64,([A-Za-z0-9+/=]+)/gu;
const ASSET_REF_RE = /od-asset:([a-f0-9]{64}):([^"'\s)]+)/gu;

function extensionFor(mime: string): string {
  switch (mime.split(';')[0]?.trim().toLowerCase()) {
    case 'image/png': return '.png';
    case 'image/jpeg': return '.jpg';
    case 'image/webp': return '.webp';
    case 'image/gif': return '.gif';
    case 'image/svg+xml': return '.svg';
    case 'font/woff2': return '.woff2';
    case 'font/woff': return '.woff';
    case 'font/ttf': return '.ttf';
    case 'font/otf': return '.otf';
    case 'text/css': return '.css';
    case 'text/javascript':
    case 'application/javascript': return '.js';
    default: return '.bin';
  }
}

/**
 * Replace inline data URLs with content-addressed asset references so identical
 * image/font bytes are stored once per version store instead of once per
 * version. The frozen record stays fully verifiable; consumers materialize it
 * back to standalone bytes through `materializeFrozenAssets` on read.
 */
export async function externalizeFrozenAssets(root: string, html: string): Promise<string> {
  if (!html.includes('data:')) return html;
  const assetsDir = path.join(root, 'assets');
  await mkdir(assetsDir, { recursive: true });
  let result = html;
  const seen = new Map<string, string>();
  for (const match of html.matchAll(DATA_URL_RE)) {
    const [raw, mime, base64] = match;
    const ref = seen.get(raw);
    if (ref) continue;
    const bytes = Buffer.from(base64!, 'base64');
    const digest = createHash('sha256').update(bytes).digest('hex');
    const assetPath = path.join(assetsDir, `${digest}${extensionFor(mime!)}`);
    try {
      await writeFile(assetPath, bytes, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const placeholder = `od-asset:${digest}:${encodeURIComponent(mime!)}`;
    seen.set(raw, placeholder);
    result = result.split(raw).join(placeholder);
  }
  return result;
}

/** Restore a stored frozen record to standalone HTML with inline data URLs. */
export async function materializeFrozenAssets(root: string, html: string): Promise<string> {
  if (!html.includes('od-asset:')) return html;
  const assetsDir = path.join(root, 'assets');
  let result = html;
  const cache = new Map<string, string>();
  for (const match of html.matchAll(ASSET_REF_RE)) {
    const [placeholder, digest, encodedMime] = match;
    if (cache.has(placeholder)) continue;
    const mime = decodeURIComponent(encodedMime!);
    const bytes = await readFile(path.join(assetsDir, `${digest}${extensionFor(mime)}`));
    cache.set(placeholder, `data:${mime};base64,${bytes.toString('base64')}`);
  }
  for (const [placeholder, dataUrl] of cache) result = result.split(placeholder).join(dataUrl);
  return result;
}
