// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareMokinaImport, persistMokinaImport, resumeMokinaRecoveryImport } from '../../src/runtime/mokina/recovery-import-journal';
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('Mokina recovery import identity', () => {
  it('reuses lost-response and imported identities across refresh, and mints only explicit copies', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const file = { name: 'recovery.zip', size: 3, arrayBuffer: async () => new TextEncoder().encode('zip').buffer } as File;
    const first = await prepareMokinaImport(file, 'workspace');
    expect(await prepareMokinaImport(file, 'workspace')).toEqual(first);
    await persistMokinaImport({ ...first, state: 'imported' });
    const recovered = await prepareMokinaImport(file, 'workspace');
    expect(recovered.operationId).toBe(first.operationId);
    expect(recovered.state).toBe('imported');
    const copy = await prepareMokinaImport(file, 'workspace', true);
    expect(copy.targetProjectId).not.toBe(first.targetProjectId);
    const other = await prepareMokinaImport(file, 'other-workspace');
    expect(other.operationId).not.toBe(copy.operationId);
  });
  it('does not upload if the workspace changed while the archive identity was being persisted', async () => {
    vi.stubGlobal('crypto', webcrypto);
    let release!: (bytes: ArrayBuffer) => void;
    const bytes = new Promise<ArrayBuffer>(resolve => { release = resolve; });
    const file = { name: 'recovery.zip', size: 3, arrayBuffer: () => bytes } as File;
    const upload = vi.fn();
    vi.stubGlobal('fetch', upload);
    let current = true;
    const pending = resumeMokinaRecoveryImport(file, { workspace: 'original', workspaceContext: null, isCurrent: () => current });
    current = false;
    release(new TextEncoder().encode('zip').buffer);
    expect(await pending).toBeNull();
    expect(upload).not.toHaveBeenCalled();
    expect((await prepareMokinaImport(file, 'original')).state).toBe('prepared');
  });

  it('keeps a completed upload in its original journal without returning it to a changed workspace', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const file = new File(['zip'], 'recovery.zip');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode('zip').buffer });
    let finish!: (response: Response) => void;
    let issued!: () => void;
    const uploading = new Promise<void>(resolve => { issued = resolve; });
    const response = new Promise<Response>(resolve => { finish = resolve; });
    const fetchMock = vi.fn(async () => { issued(); return response; });
    vi.stubGlobal('fetch', fetchMock);
    let current = true;
    const pending = resumeMokinaRecoveryImport(file, { workspace: 'original', workspaceContext: null, isCurrent: () => current });
    await uploading;
    const original = await prepareMokinaImport(file, 'original');
    current = false;
    const integrity = { status: 'partial', issues: [{ path: 'history', reason: 'missing', message: 'Missing' }] };
    finish(new Response(JSON.stringify({ projectId: original.targetProjectId, integrity, warnings: ['Missing'] }), { status: 200 }));
    expect(await pending).toBeNull();
    expect(await prepareMokinaImport(file, 'original')).toMatchObject({ state: 'imported', operationId: original.operationId, integrity });
    const resumed = await resumeMokinaRecoveryImport(file, { workspace: 'original', workspaceContext: null, isCurrent: () => true });
    expect(resumed).toMatchObject({ projectId: original.targetProjectId, integrity });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a completed import truthfully when saving its final journal fails, then retries the same operation', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const file = new File(['zip'], 'recovery.zip');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode('zip').buffer });
    const original = await prepareMokinaImport(file, 'original');
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect((init!.body as FormData).get('operationId')).toBe(original.operationId);
      expect((init!.body as FormData).get('targetProjectId')).toBe(original.targetProjectId);
      return new Response(JSON.stringify({ projectId: original.targetProjectId, integrity: { status: 'complete', issues: [] } }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('storage unavailable'); });
    await expect(resumeMokinaRecoveryImport(file, { workspace: 'original', workspaceContext: null, isCurrent: () => true }))
      .rejects.toThrow('项目已导入，恢复状态未保存');
    expect((await prepareMokinaImport(file, 'original')).operationId).toBe(original.operationId);
    const resumed = await resumeMokinaRecoveryImport(file, { workspace: 'original', workspaceContext: null, isCurrent: () => true });
    expect(resumed?.projectId).toBe(original.targetProjectId);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

});
