// @vitest-environment node
import { readFile, readdir, rm } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { ensureProject } from '../src/projects.js';
import { createProjectFileVersion, getProjectFileVersionRootStats, readProjectFileVersion } from '../src/project-file-versions.js';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const page = (text: string) => `<html><body><section id="scope" data-mokina-id="scope"><p>${text}</p><img src="data:image/png;base64,${png}" alt="sample"></section></body></html>`;
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

it('stores identical inline images once across frozen versions and materializes them on read', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-frozen-assets-'));
  roots.push(root);
  await ensureProject(root, 'p');
  const first = await createProjectFileVersion(root, 'p', 'plan.html', page('第一版'));
  const second = await createProjectFileVersion(root, 'p', 'plan.html', page('第二版'));
  const store = await getProjectFileVersionRootStats(root, 'p', 'plan.html');
  const assets = await readdir(path.join(store.root, 'assets'));
  expect(assets).toHaveLength(1);
  expect(assets[0]).toMatch(/^[a-f0-9]{64}\.png$/u);

  const manifest = JSON.parse(await readFile(path.join(store.root, 'manifest.json'), 'utf8')) as {
    entries: Array<{ id: string; frozenContentPath: string }>;
  };
  for (const version of [first, second]) {
    const stored = await readFile(path.join(store.root, manifest.entries.find(entry => entry.id === version.id)!.frozenContentPath), 'utf8');
    expect(stored).toContain('od-asset:');
    expect(stored).not.toContain(png);
  }

  const recovered = await readProjectFileVersion(root, 'p', 'plan.html', first.id);
  expect(recovered.frozenContent).toContain(`data:image/png;base64,${png}`);
  expect(recovered.quality.status).toBe('unreviewed');
});
