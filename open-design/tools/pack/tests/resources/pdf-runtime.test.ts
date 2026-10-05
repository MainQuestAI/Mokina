import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { copyBundledPdfRuntime } from '@/resources/pdf-runtime.js';
it('verifies resource identity on every materialization and refuses corrupted cached inputs', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'mokina-pdf-pack-'));
  try {
    const root = join(workspace, 'tools/pack/resources/pdf/mac-arm64');
    await mkdir(join(root, 'bin'), { recursive: true });
    const bytes = Buffer.from('controlled-runtime');
    await writeFile(join(root, 'bin/pdftotext'), bytes);
    await writeFile(join(root, 'manifest.json'), JSON.stringify({ schemaVersion: 1, architecture: 'arm64', files: [
      { path: 'bin/pdftotext', sha256: createHash('sha256').update(bytes).digest('hex') },
    ] }));
    await copyBundledPdfRuntime(workspace, join(workspace, 'out'), 'arm64');
    expect(await readFile(join(workspace, 'out/pdf/mac-arm64/bin/pdftotext'))).toEqual(bytes);
    await writeFile(join(root, 'bin/pdftotext'), 'tampered');
    await expect(copyBundledPdfRuntime(workspace, join(workspace, 'out'), 'arm64')).rejects.toThrow('checksum');
  } finally { await rm(workspace, { recursive: true, force: true }); }
});
