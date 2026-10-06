import { createHash } from 'node:crypto';
import { cp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
/** Checked-in PDF runtime is copied on every Mac resource materialization, including cache hits. */
export async function copyBundledPdfRuntime(workspaceRoot: string, resourceRoot: string, arch: string): Promise<void> {
  const root = join(workspaceRoot, 'tools', 'pack', 'resources', 'pdf', `mac-${arch}`);
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')) as {
    schemaVersion: number; architecture: string; files: Array<{ path: string; sha256: string }>;
  };
  if (manifest.schemaVersion !== 1 || manifest.architecture !== arch || !Array.isArray(manifest.files)) throw new Error('Invalid bundled PDF runtime manifest');
  for (const entry of manifest.files) {
    if (!entry.path || entry.path.startsWith('/') || entry.path.split('/').some(part => part === '..') || entry.path.includes('\\')) throw new Error('Invalid PDF resource path');
    const digest = createHash('sha256').update(await readFile(join(root, entry.path))).digest('hex');
    if (digest !== entry.sha256) throw new Error(`Bundled PDF runtime checksum mismatch: ${entry.path}`);
  }
  await cp(root, join(resourceRoot, 'pdf', `mac-${arch}`), { recursive: true });
}
