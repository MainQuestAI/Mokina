// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { buildHomeMokinaSelections, prepareHomeMokinaSnapshot, mokinaResponseError, saveHomeMokinaPreparation, clearHomeMokinaPreparation, readHomeMokinaPreparation, type HomeMokinaPreparationRecord } from '../../src/runtime/mokina/home-material-snapshot';
const { readMaterial } = vi.hoisted(() => ({ readMaterial: vi.fn() }));
vi.mock('../../src/providers/registry', () => ({ fetchProjectMaterial: readMaterial }));
afterEach(() => { readMaterial.mockReset(); vi.unstubAllGlobals(); localStorage.clear(); });
const extraction = (text: string) => ({ name: 'visible.md', contentDigest: 'd', parserVersion: 'mokina-material/2',
  status: 'read' as const, limitations: [], sections: [{ fragmentId: 'fragment:1', location: 'line 1', text, groupId: 'same' }] });
it('keeps real paths and exact fragments even when display names collide', () => {
  const plans = [0, 1].map(i => ({ inputId: `input-${i}`, name: 'same.md', size: 1, kind: 'material' as const, path: `stored-${i}.md` }));
  const built = buildHomeMokinaSelections({ projectId: 'p', plans, assets: [],
    materials: plans.map(plan => ({ name: plan.name, inputId: plan.inputId, extraction: extraction(plan.inputId) })) });
  expect(built.selections.map(selection => selection.sourceRef)).toEqual([
    { kind: 'project-file', projectId: 'p', fileName: 'stored-0.md' },
    { kind: 'project-file', projectId: 'p', fileName: 'stored-1.md' },
  ]);
  expect(built.selections[0]).toMatchObject({ mode: 'fragments', fragmentIds: ['fragment:1'], expectedParserVersion: 'mokina-material/2' });
});
it('counts separators at 24k and requires visible exclusions instead of silently truncating', () => {
  const material = extraction('a'.repeat(23_999));
  material.sections.push({ fragmentId: 'fragment:2', location: 'line 2', text: 'b', groupId: 'same' });
  const built = buildHomeMokinaSelections({ projectId: 'p', plans: [{ name: 'x.md', size: 1, kind: 'material' }],
    materials: [{ name: 'x.md', extraction: material }], assets: [] });
  expect(built.selections).toEqual([]);
  expect(built.excluded).toMatchObject([{ displayName: 'x.md', reason: 'budget' }]);
});
it('enforces cumulative asset and selection-count limits', () => {
  const plans = [0, 1].map(i => ({ name: `${i}.png`, size: 20 * 1024 * 1024, kind: 'asset' as const }));
  const built = buildHomeMokinaSelections({ projectId: 'p', plans, materials: [],
    assets: plans.map(plan => ({ name: plan.name, byteLength: plan.size, digest: 'd' })) });
  expect(built.selections).toHaveLength(1);
  expect(built.excluded[0]?.reason).toBe('budget');
  const small = Array.from({ length: 21 }, (_, i) => ({ name: `${i}.png`, size: 1, kind: 'asset' as const }));
  const many = buildHomeMokinaSelections({ projectId: 'p', plans: small, materials: [],
    assets: small.map(plan => ({ name: plan.name, byteLength: 1, digest: 'd' })) });
  expect(many.selections).toHaveLength(20);
  expect(many.excluded).toHaveLength(1);
});
it('blocks all-failed uploads and only accepts exclusion after explicit confirmation', async () => {
  const input = { projectId: 'p', plans: [{ name: 'missing.md', size: 1, kind: 'material' as const }] };
  expect(await prepareHomeMokinaSnapshot(input)).toMatchObject({ status: 'needs-input', snapshotId: null });
  expect(await prepareHomeMokinaSnapshot({ ...input, acceptExclusions: true })).toMatchObject({ status: 'ready', snapshotId: null });
  expect(readMaterial).not.toHaveBeenCalled();
});
it.each([409, 413, 403])('blocks rejected snapshot %i while retaining input', async status => {
  vi.stubGlobal('crypto', webcrypto);
  readMaterial.mockResolvedValue(extraction('selected'));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'denied' }), { status })));
  const plan = { inputId: 'input', name: 'visible.md', path: 'stored.md', size: 1, kind: 'material' as const };
  const result = await prepareHomeMokinaSnapshot({ projectId: 'p', plans: [plan] });
  expect(readMaterial).toHaveBeenCalledWith('p', 'stored.md', undefined);
  expect(result).toMatchObject({ status: 'needs-input', message: 'denied', snapshotId: null });
  expect(plan.path).toBe('stored.md');
});
it('supports string, structured and invalid error bodies', () => {
  expect(mokinaResponseError({ error: 'permission' }, 'fallback').message).toBe('permission');
  expect(mokinaResponseError({ error: { code: 'x', message: 'changed' } }, 'fallback')).toEqual({ code: 'x', message: 'changed' });
  expect(mokinaResponseError(null, 'fallback').message).toBe('fallback');
});
it('retries a lost freeze response with the original fixed selection, even after source deletion', async () => {
  vi.stubGlobal('crypto', webcrypto);
  readMaterial.mockResolvedValue(extraction('fixed input'));
  const network = vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(new Response(JSON.stringify({ snapshot: { items: [{ displayName: 'fixed', text: 'fixed input' }] } })));
  vi.stubGlobal('fetch', network);
  let fixedSelection: HomeMokinaPreparationRecord['fixedSelection'];
  const input = { projectId: 'p', conversationId: 'c', snapshotId: 'original-snapshot', plans: [{ inputId: 'input', name: 'visible.md', path: 'stored.md', size: 1, kind: 'material' as const }] };
  expect(await prepareHomeMokinaSnapshot({ ...input, onPrepared: async selection => { fixedSelection = selection; } })).toMatchObject({ status: 'needs-input' });
  readMaterial.mockRejectedValue(new Error('source deleted'));
  expect(await prepareHomeMokinaSnapshot({ ...input, fixedSelection })).toMatchObject({ status: 'ready', snapshotId: 'original-snapshot' });
  expect(readMaterial).toHaveBeenCalledTimes(1);
  expect(network.mock.calls[0]?.[1].body).toBe(network.mock.calls[1]?.[1].body);
});
it('rejects late preparation updates and does not clear a newer selection', async () => {
  const original: HomeMokinaPreparationRecord = { schemaVersion: 1, projectId: 'p', conversationId: 'c', workspaceKey: 'none', snapshotId: 's', plans: [], prompt: 'original', status: 'preparing', excluded: [] };
  const preparing = await saveHomeMokinaPreparation(original);
  const adjusted = await saveHomeMokinaPreparation({ ...preparing, bindingSnapshotId: 'adjusted', status: 'ready' });
  await expect(saveHomeMokinaPreparation({ ...preparing, status: 'needs-input' })).rejects.toThrow('保存失败');
  await clearHomeMokinaPreparation(preparing);
  expect(readHomeMokinaPreparation('p', 'c', 'none')).toEqual(adjusted);
});
