import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { readMokinaMaterial } from '../src/mokina/materials.js';
import { prepareMokinaContextSnapshot, sha256Hex } from '../src/mokina/context-store.js';

let projectsRoot: string;
beforeEach(async () => { projectsRoot = await mkdtemp(path.join(tmpdir(), 'mokina-exact-')); });
afterEach(async () => { await rm(projectsRoot, { recursive: true, force: true }); });

it('gives repeated headings and long-line parts distinct stable fragment identities', async () => {
  const bytes = Buffer.from('# Same\n' + 'x'.repeat(9_000) + '\n' + 'y'.repeat(9_000) + '\n# Same\nz');
  const first = await readMokinaMaterial('brief.md', bytes);
  const second = await readMokinaMaterial('brief.md', bytes);
  const ids = first.sections.map(section => section.fragmentId);
  expect(ids.every(Boolean)).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
  expect(second.sections.map(section => section.fragmentId)).toEqual(ids);
});

it('freezes only the exact chosen fragment and refuses a partially invalid selection', async () => {
  const bytes = Buffer.from('# Brief\n' + 'KEEP'.repeat(2_000) + '\nEXCLUDED_MARKER');
  const material = await readMokinaMaterial('brief.md', bytes);
  const selected = material.sections.find(section => section.text.startsWith('KEEP'))!;
  const selection = {
    itemId: 'S1', mode: 'fragments' as const, textKind: 'material-excerpt' as const,
    sourceRef: { kind: 'project-file' as const, projectId: 'p1', fileName: 'brief.md' },
    expectedSourceDigest: sha256Hex(bytes), expectedParserVersion: material.parserVersion!,
    fragmentIds: [selected.fragmentId!],
  };
  const prepare = (snapshotId: string, fragmentIds: string[]) => prepareMokinaContextSnapshot({
    projectsRoot, projectId: 'p1', source: { readProjectFile: async () => ({ bytes }) },
    request: { snapshotId, excluded: [], selections: [{ ...selection, fragmentIds }] },
  });
  const result = await prepare('exact', selection.fragmentIds);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  expect(result.snapshot.items[0]).toMatchObject({ text: selected.text });
  expect(JSON.stringify(result.snapshot)).not.toContain('EXCLUDED_MARKER');
  expect((await prepare('invalid', [...selection.fragmentIds, 'missing'])).ok).toBe(false);
});
