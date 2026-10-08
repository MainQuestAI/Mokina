// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { MokinaContextSnapshot } from '@open-design/contracts';
const { createProject, fetchProjectFiles, uploadProjectFiles, writeProjectTextFile } = vi.hoisted(() => ({
  createProject: vi.fn(), fetchProjectFiles: vi.fn(), uploadProjectFiles: vi.fn(), writeProjectTextFile: vi.fn(),
}));
vi.mock('../../src/state/projects', () => ({ createProject }));
vi.mock('../../src/providers/registry', () => ({ fetchProjectFiles, uploadProjectFiles, writeProjectTextFile,
  projectFileUrl: (id: string, name: string) => `/raw/${id}/${name}` }));
import { continuationIntentDigest, persistContinuationJournal, readMokinaContinuationJournal, readMokinaContinuationForKey, resumeMokinaContinuation,
  resumeLegacyMokinaContinuation, type ContinuationIntent, type MokinaContinuationJournal } from '../../src/runtime/mokina/continuation-recovery';
import { resetDurableRecoveryForTests } from '../../src/runtime/persistence/mokina-recovery-store';
import * as recoveryStore from '../../src/runtime/persistence/mokina-recovery-store';
import { readPendingMokinaSnapshot, clearPendingMokinaSnapshot } from '../../src/runtime/mokina/pending-context-snapshot';
const key = 'od:continuation:test';
const intent: ContinuationIntent = { source: { projectId: 'source', fileName: 'plan.html', versionId: 'v1', versionState: 'historical', contentDigest: 'source-digest' },
  sections: [{ id: 'budget', text: '预算 100' }], background: '', productionIntent: 'discuss', pluginId: 'marketing', promptLead: '讨论', workspaceKey: 'none', assets: [] };
let snapshot: MokinaContextSnapshot;
let journal: MokinaContinuationJournal;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function targetOnlyFetch(input: string) {
  if (input === '/api/projects/target') return Promise.resolve(json({ project: { id: 'target' } }));
  if (input.includes('context-snapshots/snapshot')) return Promise.resolve(json({ snapshot }));
  if (input === '/raw/target/MOKINA-CONTINUATION.json') return Promise.resolve(json({ schemaVersion: 2,
    operationId: journal.operationId, targetProjectId: 'target', source: journal.intent!.source,
    sections: journal.intent!.sections, background: journal.intent!.background,
    productionIntent: journal.intent!.productionIntent, contextSnapshotId: 'snapshot' }));
  if (input.startsWith('/raw/source')) throw new Error('Sources must not be read after freezing');
  throw new Error(`Unexpected request: ${input}`);
}
beforeEach(async () => {
  vi.resetAllMocks(); localStorage.clear(); resetDurableRecoveryForTests(); vi.stubGlobal('crypto', webcrypto);
  fetchProjectFiles.mockResolvedValue([]); writeProjectTextFile.mockResolvedValue(true);
  journal = { schemaVersion: 3, operationId: 'operation', targetProjectId: 'target', contextSnapshotId: 'snapshot',
    conversationId: 'conversation', checkpoint: 'snapshot-saved', updatedAt: '', revision: 0, intent,
    intentDigest: await continuationIntentDigest(intent), snapshotFingerprint: 'fingerprint' };
  snapshot = { schemaVersion: 1, snapshotId: 'snapshot', projectId: 'target', createdAt: '', parserVersion: 'test', selectionFingerprint: 'test', fingerprint: 'fingerprint',
    items: [{ itemId: 'section-1', kind: 'user-note', displayName: '选定章节', sourceRef: { kind: 'user-note' },
      sourceDigest: 'digest', limitations: [], locators: [], text: '【budget】\n预算 100', textDigest: 'digest' }], excluded: [] };
  await persistContinuationJournal(key, journal);
});
afterEach(() => vi.unstubAllGlobals());
describe('T14–T17/T34 target-first continuation recovery', () => {
  it('recovers a frozen target after source deletion without creating or uploading anything', async () => {
    vi.stubGlobal('fetch', vi.fn(targetOnlyFetch));
    const ready = await resumeMokinaContinuation(key, journal, null);
    expect(ready).toMatchObject({ operationId: 'operation', targetProjectId: 'target', checkpoint: 'draft-ready' });
    expect(createProject).not.toHaveBeenCalled(); expect(uploadProjectFiles).not.toHaveBeenCalled();
    expect(readPendingMokinaSnapshot('target', { conversationId: 'conversation', workspaceKey: 'none' })?.snapshotId).toBe('snapshot');
    expect(fetchProjectFiles).toHaveBeenCalledWith('target', { workspaceContext: null, fresh: true, requireAuthoritative: true });
  });
  it('does not rebind consumed inputs when reopening a completed operation', async () => {
    vi.stubGlobal('fetch', vi.fn(targetOnlyFetch));
    const ready = await resumeMokinaContinuation(key, journal, null);
    await clearPendingMokinaSnapshot('target', { conversationId: 'conversation', workspaceKey: 'none' });
    await resumeMokinaContinuation(key, ready, null);
    expect(readPendingMokinaSnapshot('target', { conversationId: 'conversation', workspaceKey: 'none' })).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    expect(readMokinaContinuationForKey(key)).toMatchObject({ checkpoint: 'draft-ready', operationId: 'operation' });
  });
  it('does not treat a failed file listing as empty or overwrite a draft', async () => {
    vi.stubGlobal('fetch', vi.fn(targetOnlyFetch)); fetchProjectFiles.mockRejectedValue(new Error('403'));
    await expect(resumeMokinaContinuation(key, journal, null)).rejects.toThrow('403');
    expect(writeProjectTextFile).not.toHaveBeenCalled(); expect(uploadProjectFiles).not.toHaveBeenCalled();
    expect(readMokinaContinuationJournal(localStorage.getItem(key))).toMatchObject({ targetProjectId: 'target', lastError: '403' });
  });
  it('retains both sides when the user has edited the target continuation', async () => {
    fetchProjectFiles.mockResolvedValue([{ name: 'MOKINA-CONTINUATION.json' }]);
    vi.stubGlobal('fetch', vi.fn(input => input === '/raw/target/MOKINA-CONTINUATION.json' ? Promise.resolve(json({ userEdited: true })) : targetOnlyFetch(input)));
    await expect(resumeMokinaContinuation(key, journal, null)).rejects.toThrow('修改');
    expect(writeProjectTextFile).not.toHaveBeenCalled(); expect(localStorage.getItem(key)).not.toBeNull();
  });
  it('refuses a mismatched snapshot even if its ID matches', async () => {
    snapshot.items[0] = { ...snapshot.items[0], text: '其他要求' } as typeof snapshot.items[0];
    vi.stubGlobal('fetch', vi.fn(targetOnlyFetch));
    await expect(resumeMokinaContinuation(key, journal, null)).rejects.toThrow('原接续意图');
    expect(writeProjectTextFile).not.toHaveBeenCalled();
  });
  it('refuses an extra fixed input rather than silently sending it', async () => {
    snapshot.items.push({ ...snapshot.items[0]!, itemId: 'unexpected' });
    vi.stubGlobal('fetch', vi.fn(targetOnlyFetch));
    await expect(resumeMokinaContinuation(key, journal, null)).rejects.toThrow('意图之外');
    expect(writeProjectTextFile).not.toHaveBeenCalled();
  });
  it('recovers a lost project-create response by querying the original target, not creating another', async () => {
    journal = { ...journal, checkpoint: 'prepared', snapshotFingerprint: undefined, conversationId: undefined };
    localStorage.setItem(key, JSON.stringify(journal));
    let targetExists = false;
    createProject.mockImplementation(async () => { targetExists = true; throw new Error('create response lost'); });
    vi.stubGlobal('fetch', vi.fn((input, options) => {
      if (input === '/api/projects/target') return Promise.resolve(json({}, targetExists ? 200 : 404));
      if (input === '/api/projects/target/conversations') return Promise.resolve(json({ conversations: [{ id: 'conversation' }] }));
      if (input.includes('context-snapshots') && options?.method === 'POST') return Promise.resolve(json({ snapshot }));
      if (input.includes('context-snapshots')) return Promise.resolve(json({}, 404));
      if (input === '/raw/target/MOKINA-CONTINUATION.json') return targetOnlyFetch(input);
      throw new Error(`Unexpected request: ${input}`);
    }));
    await expect(resumeMokinaContinuation(key, journal, null)).rejects.toThrow('create response lost');
    const saved = readMokinaContinuationJournal(localStorage.getItem(key))!;
    expect(saved).toMatchObject({ checkpoint: 'prepared', operationId: 'operation', targetProjectId: 'target' });
    const ready = await resumeMokinaContinuation(key, saved, null);
    expect(ready).toMatchObject({ targetProjectId: 'target', checkpoint: 'draft-ready' });
    expect(createProject).toHaveBeenCalledTimes(1);
    expect(createProject.mock.calls[0]?.[0]).toMatchObject({ id: 'target' });
  });
  it('recovers copied asset bytes after a lost upload response without reading the deleted source again', async () => {
    const bytes = new TextEncoder().encode('<svg>fixed</svg>');
    const digest = Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('');
    const asset = { inputId: 'asset-1', name: 'original.svg', digest, byteLength: bytes.byteLength, role: 'logo' as const, usageNote: 'header' };
    const withAsset = { ...intent, assets: [asset] };
    journal = { ...journal, checkpoint: 'project-created', snapshotFingerprint: undefined, intent: withAsset, intentDigest: await continuationIntentDigest(withAsset) };
    localStorage.setItem(key, JSON.stringify(journal));
    snapshot.items.push({ itemId: asset.inputId, displayName: 'logo', kind: 'asset', sourceRef: { kind: 'project-file', projectId: 'target', fileName: 'asset-1.svg' }, sourceDigest: digest, limitations: [], blobId: digest, mimeType: 'image/svg+xml', byteLength: bytes.byteLength, role: 'logo', usageNote: 'header' });
    let copied = false;
    uploadProjectFiles.mockImplementation(async () => { copied = true; throw new Error('upload response lost'); });
    const network = vi.fn((input, options) => {
      if (input === '/api/projects/target') return Promise.resolve(json({}, 200));
      if (input.includes('context-snapshots') && options?.method === 'POST') return Promise.resolve(json({ snapshot }));
      if (input.includes('context-snapshots')) return Promise.resolve(json({}, 404));
      if (input === '/raw/target/asset-1.svg') return Promise.resolve(new Response(bytes, { status: copied ? 200 : 404 }));
      if (input === '/raw/source/original.svg' && !copied) return Promise.resolve(new Response(bytes));
      if (input === '/raw/target/MOKINA-CONTINUATION.json') return targetOnlyFetch(input);
      throw new Error(`Original source is unavailable: ${input}`);
    });
    vi.stubGlobal('fetch', network);
    await expect(resumeMokinaContinuation(key, journal, null)).rejects.toThrow('upload response lost');
    const saved = readMokinaContinuationJournal(localStorage.getItem(key))!;
    expect(saved.copiedAssets?.['asset-1']).toMatchObject({ path: 'asset-1.svg', digest, uploaded: false });
    expect((await resumeMokinaContinuation(key, saved, null)).checkpoint).toBe('draft-ready');
    expect(uploadProjectFiles).toHaveBeenCalledTimes(1);
    expect(network.mock.calls.filter(([input]) => input === '/raw/source/original.svg')).toHaveLength(1);
    expect(readMokinaContinuationForKey(key)?.copiedAssets?.['asset-1']).toMatchObject({ path: 'asset-1.svg', digest, uploaded: true });
  });
  it.each([json({ error: 'forbidden' }, 403), json({ error: { code: 'SOURCE_CHANGED', message: '品牌已变化' } }, 409), new Response('not JSON', { status: 502 })])
    ('retains original operation after a safe freeze error %#', async response => {
      journal = { ...journal, checkpoint: 'project-created', snapshotFingerprint: undefined };
      localStorage.setItem(key, JSON.stringify(journal));
      vi.stubGlobal('fetch', vi.fn((input, options) => options?.method === 'POST' ? Promise.resolve(response)
        : input.includes('context-snapshots') ? Promise.resolve(json({}, 404)) : targetOnlyFetch(input)));
      await expect(resumeMokinaContinuation(key, journal, null)).rejects.toThrow();
      expect(readMokinaContinuationJournal(localStorage.getItem(key))).toMatchObject({ operationId: 'operation', targetProjectId: 'target' });
      expect(createProject).not.toHaveBeenCalled(); expect(writeProjectTextFile).not.toHaveBeenCalled();
    });
  it('rejects stale journal revisions, retaining the latest error and identities', async () => {
    const changed = { ...journal, revision: 1, lastError: 'newer' };
    await persistContinuationJournal(key, changed, 0);
    await expect(persistContinuationJournal(key, { ...journal, revision: 1, lastError: 'stale' }, 0)).rejects.toThrow('冲突');
    expect(readMokinaContinuationJournal(localStorage.getItem(key))?.lastError).toBe('newer');
  });
  it('retains the active operation when a successful draft write cannot be read back', async () => {
    vi.stubGlobal('fetch', vi.fn(input => input === '/raw/target/MOKINA-CONTINUATION.json'
      ? Promise.resolve(json({}, 503)) : targetOnlyFetch(input)));
    await expect(resumeMokinaContinuation(key, journal, null)).rejects.toThrow('读回失败');
    expect(writeProjectTextFile).toHaveBeenCalled();
    expect(readMokinaContinuationJournal(localStorage.getItem(key))).toMatchObject({ operationId: 'operation', targetProjectId: 'target' });
    expect(localStorage.getItem(`${key}:completed:operation`)).toBeNull();
    expect(readPendingMokinaSnapshot('target', { conversationId: 'conversation', workspaceKey: 'none' })).toBeNull();
  });
  it('retries failed completion cleanup without a second project or a consumed input rebind', async () => {
    vi.stubGlobal('fetch', vi.fn(targetOnlyFetch));
    const mutate = recoveryStore.mutateDurableRecord;
    const interception = vi.spyOn(recoveryStore, 'mutateDurableRecord').mockImplementation(async (recordKey, change) => {
      if (recordKey.endsWith(':completed:operation')) return false;
      return mutate(recordKey, change);
    });
    try {
      await expect(resumeMokinaContinuation(key, journal, null)).rejects.toThrow('完成记录待同步');
      const saved = readMokinaContinuationJournal(localStorage.getItem(key))!;
      expect(saved).toMatchObject({ checkpoint: 'draft-ready', targetProjectId: 'target', operationId: 'operation' });
      await clearPendingMokinaSnapshot('target', { conversationId: 'conversation', workspaceKey: 'none' });
      interception.mockRestore();
      await resumeMokinaContinuation(key, saved, null);
      expect(localStorage.getItem(key)).toBeNull();
      expect(readMokinaContinuationForKey(key)?.targetProjectId).toBe('target');
      expect(readPendingMokinaSnapshot('target', { conversationId: 'conversation', workspaceKey: 'none' })).toBeNull();
      expect(createProject).not.toHaveBeenCalled();
    } finally { interception.mockRestore(); }
  });
  it('never clears a newer operation arriving between completion archive and active cleanup', async () => {
    vi.stubGlobal('fetch', vi.fn(targetOnlyFetch));
    const mutate = recoveryStore.mutateDurableRecord;
    const replacement = { ...journal, operationId: 'new-operation', targetProjectId: 'new-target', revision: 0 };
    const interception = vi.spyOn(recoveryStore, 'mutateDurableRecord').mockImplementation(async (recordKey, change) => {
      const result = await mutate(recordKey, change);
      if (recordKey.endsWith(':completed:operation')) localStorage.setItem(key, JSON.stringify(replacement));
      return result;
    });
    try {
      await expect(resumeMokinaContinuation(key, journal, null)).rejects.toThrow('活动记录待同步');
      expect(readMokinaContinuationJournal(localStorage.getItem(key))).toMatchObject({ operationId: 'new-operation', targetProjectId: 'new-target' });
      expect(readMokinaContinuationJournal(localStorage.getItem(`${key}:completed:operation`))?.targetProjectId).toBe('target');
    } finally { interception.mockRestore(); }
  });
  it('does not guess incomplete legacy intent or replace its target', async () => {
    const legacy = { ...journal, schemaVersion: 2 as const, intent: undefined };
    await expect(resumeLegacyMokinaContinuation(legacy, null)).rejects.toThrow('完整意图');
    expect(createProject).not.toHaveBeenCalled(); expect(writeProjectTextFile).not.toHaveBeenCalled();
  });
  it('reopens a legacy operation using only its matching saved target and snapshot', async () => {
    const legacy: MokinaContinuationJournal = { schemaVersion: 2, operationId: 'operation', targetProjectId: 'target',
      checkpoint: 'snapshot-saved', updatedAt: '' };
    const original = JSON.stringify(legacy);
    localStorage.setItem(key, original);
    fetchProjectFiles.mockResolvedValue([{ name: 'MOKINA-CONTINUATION.json' }]);
    const network = vi.fn(targetOnlyFetch);
    vi.stubGlobal('fetch', network);
    expect(await resumeLegacyMokinaContinuation(legacy, null)).toEqual(legacy);
    expect(network.mock.calls.map(([url]) => url)).toEqual([
      '/raw/target/MOKINA-CONTINUATION.json', '/api/projects/target/mokina/context-snapshots/snapshot',
    ]);
    expect(createProject).not.toHaveBeenCalled(); expect(uploadProjectFiles).not.toHaveBeenCalled();
    expect(writeProjectTextFile).not.toHaveBeenCalled();
    expect(readPendingMokinaSnapshot('target', { conversationId: 'conversation', workspaceKey: 'none' })).toBeNull();
    expect(localStorage.getItem(key)).toBe(original);
  });
  it.each([
    { operationId: 'another-operation' }, { targetProjectId: 'another-target' }, { contextSnapshotId: '' },
  ])('preserves a legacy record and both drafts when the saved target identity differs: %j', async changes => {
    const legacy: MokinaContinuationJournal = { schemaVersion: 2, operationId: 'operation', targetProjectId: 'target',
      contextSnapshotId: 'snapshot', checkpoint: 'snapshot-saved', updatedAt: '' };
    const original = JSON.stringify(legacy);
    localStorage.setItem(key, original);
    fetchProjectFiles.mockResolvedValue([{ name: 'MOKINA-CONTINUATION.json' }]);
    const network = vi.fn(async () => json({ schemaVersion: 2, operationId: 'operation', targetProjectId: 'target',
      contextSnapshotId: 'snapshot', ...changes }));
    vi.stubGlobal('fetch', network);
    await expect(resumeLegacyMokinaContinuation(legacy, null)).rejects.toThrow('身份');
    expect(network).toHaveBeenCalledTimes(1);
    expect(createProject).not.toHaveBeenCalled(); expect(uploadProjectFiles).not.toHaveBeenCalled();
    expect(writeProjectTextFile).not.toHaveBeenCalled(); expect(localStorage.getItem(key)).toBe(original);
  });
  it.each(['forbidden', 'wrong-project', 'wrong-snapshot'])('retains the legacy operation when target snapshot cannot be trusted: %s', async failure => {
    const legacy: MokinaContinuationJournal = { schemaVersion: 2, operationId: 'operation', targetProjectId: 'target',
      contextSnapshotId: 'snapshot', checkpoint: 'snapshot-saved', updatedAt: '' };
    const original = JSON.stringify(legacy);
    localStorage.setItem(key, original);
    fetchProjectFiles.mockResolvedValue([{ name: 'MOKINA-CONTINUATION.json' }]);
    vi.stubGlobal('fetch', vi.fn(input => input === '/raw/target/MOKINA-CONTINUATION.json' ? targetOnlyFetch(input)
      : Promise.resolve(failure === 'forbidden' ? json({ error: 'forbidden' }, 403)
        : json({ snapshot: { ...snapshot, ...(failure === 'wrong-project' ? { projectId: 'other' } : { snapshotId: 'other' }) } }))));
    await expect(resumeLegacyMokinaContinuation(legacy, null)).rejects.toThrow('快照');
    expect(createProject).not.toHaveBeenCalled(); expect(uploadProjectFiles).not.toHaveBeenCalled();
    expect(writeProjectTextFile).not.toHaveBeenCalled(); expect(localStorage.getItem(key)).toBe(original);
  });
});
