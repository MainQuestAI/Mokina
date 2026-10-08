import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { mokinaResources, macResources } from '@/resources/index.js';

it('keeps native and web derivatives tied to the same candidate without overwriting upstream', async () => {
  const root = dirname(mokinaResources.icon);
  const workspace = resolve(root, '../../../..');
  const web = join(workspace, 'apps/web/public/mokina');
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')) as {
    sourceHash: string; files: Record<string, string>; derived: Record<string, string>; status: string;
  };
  expect(manifest.status).toBe('candidate_not_finally_approved');
  expect(Object.keys(manifest.files)).toHaveLength(8);
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  for (const [name, expected] of Object.entries(manifest.files)) {
    const bytes = await readFile(join(web, name)); expect(hash(bytes)).toBe(expected);
    expect(bytes.toString()).not.toMatch(/<script|<image|<foreignObject|\shref=/i);
  }
  expect(hash(await readFile(join(web, 'mokina-icon-black.svg')))).toBe(manifest.sourceHash);
  for (const [path, expected] of Object.entries(manifest.derived)) {
    const [owner, ...parts] = path.split('/');
    expect(hash(await readFile(join(owner === 'native' ? root : web, ...parts)))).toBe(expected);
  }
  expect((await sharp(join(web, 'apple-touch-icon.png')).metadata()).width).toBe(180);
  expect((await sharp(mokinaResources.iconPng).metadata()).width).toBe(1024);
  expect(macResources.icon).not.toBe(mokinaResources.icon);
  const icns = await readFile(mokinaResources.icon);
  expect(icns.subarray(0, 4).toString()).toBe('icns'); expect(icns.readUInt32BE(4)).toBe(icns.length);
  let count = 0;
  for (let offset = 8; offset < icns.length;) {
    const length = icns.readUInt32BE(offset + 4);
    expect(length).toBeGreaterThan(8);
    const metadata = await sharp(icns.subarray(offset + 8, offset + length)).metadata();
    expect(metadata.width).toBe(metadata.height); count++; offset += length;
  }
  expect(count).toBe(11);
});
