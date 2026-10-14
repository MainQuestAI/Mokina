import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { ensureProject, projectDir, writeProjectFile } from '../src/projects.js';
const race = vi.hoisted(() => ({ target: '', fired: false }));
vi.mock('node:fs/promises', async original => {
  const actual = await original<typeof import('node:fs/promises')>();
  return { ...actual, writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
    if (race.target && !race.fired && (String(args[0]) === race.target || path.basename(String(args[0])).startsWith('.mokina-write-'))) {
      race.fired = true; await actual.writeFile(race.target, 'Concurrent user file');
    }
    return actual.writeFile(...args);
  } };
});
const roots: string[] = [];
afterEach(async () => { race.target = ''; race.fired = false; await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
it.each([true, false])('does not overwrite a file that appears after the initial existence check, atomic=%s', async atomic => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-exclusive-')); roots.push(root); await ensureProject(root, 'p');
  race.target = path.join(await realpath(projectDir(root, 'p')), 'source.md');
  await expect(writeProjectFile(root, 'p', 'source.md', 'Captured source', { overwrite: false, atomic })).rejects.toMatchObject({ code: 'EEXIST' });
  expect(await readFile(race.target, 'utf8')).toBe('Concurrent user file');
});
